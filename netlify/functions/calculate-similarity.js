// Netlify function to calculate content similarity and populate the junction table
const { createClient } = require("@supabase/supabase-js");
const natural = require("natural"); // Using the natural NLP library

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
const stemmer = natural.PorterStemmer;

// Calculate similarity between two content items
function calculateSimilarity(item1, item2) {
  let score = 0;
  const maxScore = 6; // Maximum possible similarity score (increased to accommodate plot similarity)

  // Compare genres (up to 50% of the score)
  if (item1.genre_strings && item2.genre_strings) {
    const genreSet1 = new Set(item1.genre_strings);
    const genreSet2 = new Set(item2.genre_strings);

    // Calculate Jaccard similarity for genres
    const intersection = new Set(
      [...genreSet1].filter((x) => genreSet2.has(x)),
    );
    const union = new Set([...genreSet1, ...genreSet2]);

    if (union.size > 0) {
      score += (intersection.size / union.size) * 3; // Up to 3 points (50%)
    }
  }

  // Compare directors (up to 16.7% of the score)
  if (item1.director && item2.director) {
    const directors1 = item1.director.split(", ");
    const directors2 = item2.director.split(", ");

    // Check for any matching directors
    const hasMatchingDirector = directors1.some((d) => directors2.includes(d));
    if (hasMatchingDirector) {
      score += 1; // 1 point (16.7%)
    }
  }

  // Compare actors (up to 8.3% of the score)
  if (item1.actors && item2.actors) {
    const actors1 = item1.actors.split(", ");
    const actors2 = item2.actors.split(", ");

    // Count matching actors
    const matchingActors = actors1.filter((a) => actors2.includes(a));
    score += Math.min(matchingActors.length * 0.25, 0.5); // Up to 0.5 points (8.3%)
  }

  // Compare time period/year (up to 8.3% of the score)
  if (item1.year && item2.year) {
    const year1 = parseInt(item1.year);
    const year2 = parseInt(item2.year);

    // If within 5 years, add some similarity
    if (Math.abs(year1 - year2) <= 5) {
      score += 0.5; // 0.5 points (8.3%)
    }
  }

  // Compare plot descriptions using basic NLP techniques (up to 16.7% of the score)
  if (item1.plot && item2.plot) {
    // Calculate semantic similarity between plots
    const plotSimilarity = calculatePlotSimilarity(item1.plot, item2.plot);
    score += plotSimilarity * 1; // Up to 1 point (16.7%)
  }

  // Normalize score to be between 0 and 1
  return Math.min(score / maxScore, 1);
}

// Main function to handle the request
// Calculate semantic similarity between two plot descriptions
function calculatePlotSimilarity(plot1, plot2) {
  if (!plot1 || !plot2 || plot1.trim() === "" || plot2.trim() === "") {
    return 0;
  }

  try {
    // Tokenize and stem the plots
    const tokens1 = tokenizer.tokenize(plot1.toLowerCase());
    const tokens2 = tokenizer.tokenize(plot2.toLowerCase());

    const stemmed1 = tokens1.map((token) => stemmer.stem(token));
    const stemmed2 = tokens2.map((token) => stemmer.stem(token));

    // Use TF-IDF to calculate similarity
    const tfidf = new TfIdf();
    tfidf.addDocument(stemmed1.join(" "));
    tfidf.addDocument(stemmed2.join(" "));

    // Get term vectors
    const vector1 = {};
    const vector2 = {};

    // Create term frequency vectors
    const uniqueTerms = new Set([...stemmed1, ...stemmed2]);
    uniqueTerms.forEach((term) => {
      tfidf.tfidfs(term, (i, measure) => {
        if (i === 0) vector1[term] = measure;
        if (i === 1) vector2[term] = measure;
      });
    });

    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    uniqueTerms.forEach((term) => {
      const v1 = vector1[term] || 0;
      const v2 = vector2[term] || 0;

      dotProduct += v1 * v2;
      magnitude1 += v1 * v1;
      magnitude2 += v2 * v2;
    });

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    const similarity = dotProduct / (magnitude1 * magnitude2);
    return similarity;
  } catch (error) {
    console.error("Error calculating plot similarity:", error);
    return 0; // Return 0 similarity on error
  }
}

exports.handler = async (event) => {
  // Allow both GET and POST requests
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Get parameters from the request
    const params =
      event.httpMethod === "POST"
        ? JSON.parse(event.body || "{}")
        : event.queryStringParameters || {};

    const { contentId, recalculateAll = false } = params;

    // Fetch content items from Supabase
    let contentItems;

    if (contentId) {
      // If a specific content ID is provided, only calculate similarities for that item
      const { data: sourceItem, error: sourceError } = await supabase
        .from("content")
        .select("*")
        .eq("id", contentId)
        .single();

      if (sourceError || !sourceItem) {
        return {
          statusCode: 404,
          body: JSON.stringify({
            error: "Content item not found",
            details: sourceError,
          }),
        };
      }

      // Get all other content items to compare with
      const { data: otherItems, error: otherError } = await supabase
        .from("content")
        .select("*")
        .neq("id", contentId);

      if (otherError) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: "Error fetching content items",
            details: otherError,
          }),
        };
      }

      // Calculate similarities
      const similarities = [];

      for (const targetItem of otherItems) {
        const similarityScore = calculateSimilarity(sourceItem, targetItem);

        // Only store significant similarities (score > 0.3)
        if (similarityScore > 0.3) {
          similarities.push({
            source_id: sourceItem.id,
            target_id: targetItem.id,
            similarity_score: similarityScore,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      // Insert similarities into the junction table
      if (similarities.length > 0) {
        const { data, error } = await supabase
          .from("content_similarities")
          .upsert(similarities, { onConflict: ["source_id", "target_id"] });

        if (error) {
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: "Error inserting similarities",
              details: error,
            }),
          };
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Similarity calculation completed",
          contentId,
          similaritiesCount: similarities.length,
        }),
      };
    } else if (recalculateAll) {
      // If recalculateAll is true, calculate similarities for all content pairs
      // This could be a heavy operation, so it might need to be batched or scheduled

      // Get all content items
      const { data: allItems, error: fetchError } = await supabase
        .from("content")
        .select("*");

      if (fetchError) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: "Error fetching content items",
            details: fetchError,
          }),
        };
      }

      // Calculate similarities for all pairs
      const similarities = [];

      for (let i = 0; i < allItems.length; i++) {
        for (let j = i + 1; j < allItems.length; j++) {
          const sourceItem = allItems[i];
          const targetItem = allItems[j];

          const similarityScore = calculateSimilarity(sourceItem, targetItem);

          // Only store significant similarities (score > 0.3)
          if (similarityScore > 0.3) {
            similarities.push({
              source_id: sourceItem.id,
              target_id: targetItem.id,
              similarity_score: similarityScore,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            // Also add the reverse relationship
            similarities.push({
              source_id: targetItem.id,
              target_id: sourceItem.id,
              similarity_score: similarityScore,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      // Insert similarities in batches
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < similarities.length; i += batchSize) {
        batches.push(similarities.slice(i, i + batchSize));
      }

      const insertResults = [];

      for (const batch of batches) {
        const { data, error } = await supabase
          .from("content_similarities")
          .upsert(batch, { onConflict: ["source_id", "target_id"] });

        if (error) {
          console.error("Error inserting batch:", error);
          insertResults.push({ success: false, error });
        } else {
          insertResults.push({ success: true, count: batch.length });
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Full similarity calculation completed",
          totalSimilarities: similarities.length,
          results: insertResults,
        }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Missing parameters. Provide contentId or set recalculateAll to true",
        }),
      };
    }
  } catch (error) {
    console.error("Error in calculate-similarity function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        details: error.message,
      }),
    };
  }
};
