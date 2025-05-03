// Netlify function to process recommendations on the server side
const axios = require("axios");

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  console.log(
    "🔄 SERVER: process-recommendations function triggered at " +
      new Date().toISOString(),
  );
  console.log("🔄 SERVER: HTTP Method: " + event.httpMethod);
  console.log("🔄 SERVER: Headers: " + JSON.stringify(event.headers));
  console.log(
    "🔄 SERVER: Body length: " + (event.body ? event.body.length : 0),
  );

  try {
    // Parse the request body
    let recommendations = [];
    try {
      console.log("🔄 SERVER: Parsing request body");
      const requestBody = JSON.parse(event.body || "{}");
      console.log("🔄 SERVER: Request body parsed successfully");
      console.log(
        "🔄 SERVER: Request body keys: " + Object.keys(requestBody).join(", "),
      );

      recommendations = requestBody.recommendations || [];
      console.log(
        `🔄 SERVER: Received ${recommendations.length} recommendations to process`,
      );
      if (recommendations.length > 0) {
        console.log(
          "🔄 SERVER: First recommendation: " +
            JSON.stringify(recommendations[0]),
        );
      }
    } catch (parseError) {
      console.error("❌ SERVER: Error parsing request body:", parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON in request body" }),
      };
    }

    if (
      !recommendations ||
      !Array.isArray(recommendations) ||
      recommendations.length === 0
    ) {
      console.log("❌ SERVER: No recommendations to process");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No recommendations to process" }),
      };
    }

    // Process each recommendation
    const processedRecommendations = [];
    const errors = [];

    console.log(
      `🔄 SERVER: Starting to process ${recommendations.length} recommendations`,
    );

    // Process recommendations sequentially to avoid rate limiting
    for (const rec of recommendations) {
      try {
        console.log(`🔄 SERVER: Processing recommendation: ${rec.title}`);

        // Skip if no title
        if (!rec.title) {
          console.log("⚠️ SERVER: Skipping recommendation with no title");
          errors.push({ id: rec.id, error: "No title provided" });
          continue;
        }

        // First try IMDB ID if available
        if (rec.imdb_id) {
          console.log(`🔍 SERVER: Looking up by IMDB ID: ${rec.imdb_id}`);
          const omdbResponse = await axios.get(
            `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${rec.imdb_id}&plot=full`,
          );

          if (omdbResponse.data && omdbResponse.data.Response === "True") {
            console.log(`✅ SERVER: Found match by IMDB ID for ${rec.title}`);
            const processedRec = convertOmdbToContentItem(
              omdbResponse.data,
              rec,
            );
            processedRecommendations.push(processedRec);
            continue;
          } else {
            console.log(
              `⚠️ SERVER: IMDB ID lookup failed for ${rec.imdb_id}, falling back to title search`,
            );
          }
        }

        // Search by title
        const searchQuery = rec.year ? `${rec.title} ${rec.year}` : rec.title;
        console.log(`🔍 SERVER: Searching by title: ${searchQuery}`);
        const searchResponse = await axios.get(
          `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${encodeURIComponent(searchQuery)}`,
        );

        if (
          searchResponse.data &&
          searchResponse.data.Response === "True" &&
          searchResponse.data.Search &&
          searchResponse.data.Search.length > 0
        ) {
          console.log(
            `✅ SERVER: Found ${searchResponse.data.Search.length} results for ${rec.title}`,
          );

          // If multiple results, find best match
          if (searchResponse.data.Search.length > 1) {
            // Get full details for each result to compare
            const detailedResults = [];
            for (const result of searchResponse.data.Search.slice(0, 3)) {
              // Limit to top 3 to avoid too many API calls
              const detailResponse = await axios.get(
                `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${result.imdbID}&plot=full`,
              );
              if (
                detailResponse.data &&
                detailResponse.data.Response === "True"
              ) {
                detailedResults.push(detailResponse.data);
              }
            }

            // Find best match by comparing titles and plots
            const bestMatch = findBestMatch(rec, detailedResults);
            if (bestMatch) {
              console.log(
                `✅ SERVER: Found best match for ${rec.title}: ${bestMatch.Title}`,
              );
              const processedRec = convertOmdbToContentItem(bestMatch, rec);
              processedRecommendations.push(processedRec);
              continue;
            }
          } else {
            // Only one result, get full details
            const detailResponse = await axios.get(
              `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${searchResponse.data.Search[0].imdbID}&plot=full`,
            );
            if (
              detailResponse.data &&
              detailResponse.data.Response === "True"
            ) {
              console.log(
                `✅ SERVER: Using single search result for ${rec.title}: ${detailResponse.data.Title}`,
              );
              const processedRec = convertOmdbToContentItem(
                detailResponse.data,
                rec,
              );
              processedRecommendations.push(processedRec);
              continue;
            }
          }
        }

        // If we get here, we couldn't find a match
        console.log(`❌ SERVER: No match found for ${rec.title}`);
        errors.push({ id: rec.id, title: rec.title, error: "No match found" });
      } catch (recError) {
        console.error(
          `❌ SERVER: Error processing recommendation ${rec.title}:`,
          recError,
        );
        errors.push({ id: rec.id, title: rec.title, error: recError.message });
      }
    }

    console.log(
      `✅ SERVER: Processed ${processedRecommendations.length} recommendations successfully`,
    );
    if (errors.length > 0) {
      console.log(
        `⚠️ SERVER: Encountered ${errors.length} errors during processing`,
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        processed: processedRecommendations.length,
        errors: errors.length,
        processedRecommendations,
        errorDetails: errors,
      }),
    };
  } catch (error) {
    console.error("❌ SERVER: Error processing recommendations:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error processing recommendations",
        message: error.message,
      }),
    };
  }
};

// Helper function to find the best match for a recommendation
function findBestMatch(recommendation, omdbResults) {
  if (!omdbResults || omdbResults.length === 0) return null;

  // Calculate similarity scores
  const scoredResults = omdbResults.map((result) => {
    // Title similarity (most important)
    const titleSimilarity = calculateTitleSimilarity(
      recommendation.title,
      result.Title,
    );

    // Year similarity if available
    let yearSimilarity = 0;
    if (recommendation.year && result.Year) {
      const recYear = parseInt(recommendation.year);
      const resultYear = parseInt(result.Year.split("–")[0]); // Handle year ranges
      yearSimilarity =
        recYear === resultYear
          ? 1
          : 1 - Math.min(Math.abs(recYear - resultYear) / 10, 1);
    }

    // Plot similarity if available
    let plotSimilarity = 0;
    if (recommendation.synopsis && result.Plot) {
      plotSimilarity = calculateTextSimilarity(
        recommendation.synopsis,
        result.Plot,
      );
    }

    // Combined score (weighted)
    const score =
      titleSimilarity * 0.6 + yearSimilarity * 0.2 + plotSimilarity * 0.2;

    return { result, score };
  });

  // Sort by score and return the best match
  scoredResults.sort((a, b) => b.score - a.score);
  return scoredResults.length > 0 ? scoredResults[0].result : null;
}

// Helper function to calculate title similarity
function calculateTitleSimilarity(title1, title2) {
  if (!title1 || !title2) return 0;

  // Normalize titles
  const normalize = (title) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const normalizedTitle1 = normalize(title1);
  const normalizedTitle2 = normalize(title2);

  // Exact match
  if (normalizedTitle1 === normalizedTitle2) return 1.0;

  // Check if one contains the other
  if (
    normalizedTitle1.includes(normalizedTitle2) ||
    normalizedTitle2.includes(normalizedTitle1)
  ) {
    const lengthRatio =
      Math.min(normalizedTitle1.length, normalizedTitle2.length) /
      Math.max(normalizedTitle1.length, normalizedTitle2.length);
    return 0.7 + 0.3 * lengthRatio;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalizedTitle1, normalizedTitle2);
  const maxLength = Math.max(normalizedTitle1.length, normalizedTitle2.length);

  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

// Helper function to calculate text similarity
function calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  // Normalize texts
  const normalize = (text) => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const normalizedText1 = normalize(text1);
  const normalizedText2 = normalize(text2);

  // Create word sets
  const words1 = new Set(
    normalizedText1.split(/\s+/).filter((w) => w.length > 2),
  );
  const words2 = new Set(
    normalizedText2.split(/\s+/).filter((w) => w.length > 2),
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  // Calculate intersection
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  // Jaccard similarity: intersection / union
  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  // Create matrix
  const dp = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(0));

  // Initialize
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[m][n];
}

// Helper function to convert OMDB data to ContentItem format
function convertOmdbToContentItem(omdbData, originalRecommendation) {
  // Handle different property casing
  const title = omdbData.Title || omdbData.title || "Unknown Title";
  const imdbId = omdbData.imdbID || omdbData.imdb_id;
  const poster = omdbData.Poster || omdbData.poster_path || omdbData.poster;
  const plot = omdbData.Plot || omdbData.overview || omdbData.plot || "";
  const type = omdbData.Type || omdbData.media_type || "movie";

  // Extract genre information
  let genreStrings = [];
  if (omdbData.Genre && typeof omdbData.Genre === "string") {
    genreStrings = omdbData.Genre.split(", ");
  } else if (omdbData.genre_strings && Array.isArray(omdbData.genre_strings)) {
    genreStrings = omdbData.genre_strings;
  } else if (omdbData.genres && Array.isArray(omdbData.genres)) {
    genreStrings = omdbData.genres.map((g) => g.name || g);
  }

  // Extract rating information
  const rating = omdbData.imdbRating || omdbData.vote_average || "0";
  const voteCount = omdbData.imdbVotes || omdbData.vote_count || "0";

  // Get synopsis from original recommendation or use plot as fallback
  const synopsis =
    originalRecommendation.synopsis || originalRecommendation.overview || plot;

  return {
    id: imdbId,
    imdb_id: imdbId,
    title: title,
    poster_path: poster !== "N/A" ? poster : "",
    media_type: type === "movie" ? "movie" : "tv",
    vote_average: rating !== "N/A" ? parseFloat(rating.toString()) : 0,
    vote_count:
      voteCount && voteCount !== "N/A"
        ? parseInt(voteCount.toString().replace(/,/g, ""))
        : 0,
    genre_ids: omdbData.genre_ids || [],
    genre_strings: genreStrings,
    overview: plot !== "N/A" ? plot : "",
    plot: plot !== "N/A" ? plot : "",
    content_rating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
    year:
      omdbData.Year ||
      (omdbData.release_date
        ? new Date(omdbData.release_date).getFullYear().toString()
        : ""),
    release_date:
      omdbData.Released !== "N/A"
        ? omdbData.Released
        : omdbData.release_date || omdbData.Year,
    runtime:
      omdbData.Runtime !== "N/A" ? omdbData.Runtime : omdbData.runtime || "",
    director:
      omdbData.Director !== "N/A" ? omdbData.Director : omdbData.director || "",
    actors: omdbData.Actors !== "N/A" ? omdbData.Actors : omdbData.actors || "",
    writer: omdbData.Writer !== "N/A" ? omdbData.Writer : omdbData.writer || "",
    language:
      omdbData.Language !== "N/A" ? omdbData.Language : omdbData.language || "",
    country:
      omdbData.Country !== "N/A" ? omdbData.Country : omdbData.country || "",
    awards: omdbData.Awards !== "N/A" ? omdbData.Awards : omdbData.awards || "",
    metascore:
      omdbData.Metascore !== "N/A"
        ? omdbData.Metascore
        : omdbData.metascore || "",
    production:
      omdbData.Production !== "N/A"
        ? omdbData.Production
        : omdbData.production || "",
    website:
      omdbData.Website !== "N/A" ? omdbData.Website : omdbData.website || "",
    boxOffice:
      omdbData.BoxOffice !== "N/A"
        ? omdbData.BoxOffice
        : omdbData.boxOffice || "",
    imdb_rating: rating !== "N/A" ? rating.toString() : "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    poster: omdbData.Poster !== "N/A" ? omdbData.Poster : omdbData.poster || "",
    contentRating:
      omdbData.Rated !== "N/A" ? omdbData.Rated : omdbData.contentRating || "",
    // Add recommendation data from original recommendation
    recommendationReason:
      originalRecommendation.reason ||
      originalRecommendation.recommendationReason,
    reason:
      originalRecommendation.reason ||
      originalRecommendation.recommendationReason,
    synopsis: synopsis,
    aiRecommended: true,
    aiVerified: true,
    similarityScore: 0.9,
    verified: true,
  };
}
