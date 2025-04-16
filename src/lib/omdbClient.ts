// Helper function to safely access environment variables
const getEnvVar = (key: string, defaultValue: string = ""): string => {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] || defaultValue;
  } else if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env[key]
  ) {
    return import.meta.env[key] || defaultValue;
  }
  return defaultValue;
};

// Always use Netlify function for OMDB API calls
const API_ENDPOINT = "/.netlify/functions/omdb";

// Helper function to make API calls to OMDB via Netlify function
async function fetchFromOmdb(params: URLSearchParams) {
  try {
    // Remove any API key from params as it's handled server-side
    params.delete("apikey");

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);
    const data = await response.json();

    if (data.Response === "False") {
      console.error("OMDB API error:", data.Error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching from OMDB API:", error);
    return null;
  }
}

// Helper function to search for movies and TV shows
export async function searchContent(
  query: string,
  type?: "movie" | "series" | "all",
): Promise<ContentItem[]> {
  try {
    const params = new URLSearchParams({
      s: query,
    });

    if (type && type !== "all") {
      params.append("type", type);
    }

    const data = await fetchFromOmdb(params);
    if (!data) return [];

    // Transform OMDB data to match our application's expected format
    return data.Search.map((item: any) => ({
      id: item.imdbID,
      title: item.Title,
      poster_path: item.Poster !== "N/A" ? item.Poster : "",
      media_type: item.Type === "movie" ? "movie" : "tv",
      release_date: item.Year,
      vote_average: 0, // OMDB search doesn't provide ratings in search results
      vote_count: 0,
      genre_ids: [], // OMDB search doesn't provide genres in search results
      overview: "", // OMDB search doesn't provide overview in search results
    }));
  } catch (error) {
    console.error("Error searching content:", error);
    return [];
  }
}

// Helper function to get content details by ID
export async function getContentById(id: string): Promise<ContentItem | null> {
  try {
    const params = new URLSearchParams({
      i: id,
      plot: "full",
    });

    const data = await fetchFromOmdb(params);
    if (!data) return null;

    // Map genres from string to array of IDs (using a simple hash function)
    const genreStrings = data.Genre ? data.Genre.split(", ") : [];
    const genreIds = genreStrings.map((genre: string) => {
      // Simple hash function to generate consistent IDs for genres
      let hash = 0;
      for (let i = 0; i < genre.length; i++) {
        hash = (hash << 5) - hash + genre.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      return Math.abs(hash % 100); // Keep it positive and under 100
    });

    // Transform OMDB data to match our application's expected format
    return {
      id: data.imdbID,
      title: data.Title,
      poster_path: data.Poster !== "N/A" ? data.Poster : "",
      backdrop_path: data.Poster !== "N/A" ? data.Poster : "", // OMDB doesn't provide backdrop
      media_type: data.Type === "movie" ? "movie" : "tv",
      release_date: data.Released !== "N/A" ? data.Released : data.Year,
      first_air_date:
        data.Type === "series"
          ? data.Released !== "N/A"
            ? data.Released
            : data.Year
          : undefined,
      vote_average: data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : 0,
      vote_count:
        data.imdbVotes !== "N/A"
          ? parseInt(data.imdbVotes.replace(/,/g, ""))
          : 0,
      genre_ids: genreIds,
      genre_strings: genreStrings, // Additional field to store actual genre names
      overview: data.Plot !== "N/A" ? data.Plot : "",
      runtime: data.Runtime !== "N/A" ? parseInt(data.Runtime) : 0,
      content_rating: data.Rated !== "N/A" ? data.Rated : undefined,
      streaming_providers: null, // OMDB doesn't provide streaming info
      popularity: 0, // OMDB doesn't provide popularity metrics
    };
  } catch (error) {
    console.error("Error fetching content by ID:", error);
    return null;
  }
}

// Helper function to extract keywords from a text
function extractKeywords(text: string): string[] {
  if (!text) return [];

  // Define stop words (common words to ignore)
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "about",
    "as",
    "into",
    "like",
    "through",
    "after",
    "over",
    "between",
    "out",
    "against",
    "during",
    "without",
    "before",
    "under",
    "around",
    "among",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
    "of",
    "from",
    "then",
    "than",
    "that",
    "this",
    "these",
    "those",
    "it",
    "its",
    "they",
    "them",
    "their",
    "he",
    "him",
    "his",
    "she",
    "her",
    "hers",
    "we",
    "us",
    "our",
    "you",
    "your",
    "yours",
  ]);

  // Normalize text: convert to lowercase, remove punctuation, and split into words
  const words = text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s{2,}/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word)); // Filter out stop words and short words

  // Count word frequencies
  const wordFreq: Record<string, number> = {};
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  // Get top keywords (adjust count as needed)
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20) // Get top 20 keywords
    .map((entry) => entry[0]);
}

// Helper function to calculate keyword similarity between two texts
function calculateKeywordSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }

  // Jaccard similarity: size of intersection divided by size of union
  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Helper function to calculate text similarity between two strings
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Convert to lowercase and remove punctuation
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s{2,}/g, " ");
  };

  const normalizedText1 = normalize(text1);
  const normalizedText2 = normalize(text2);

  // Create word sets
  const words1 = new Set(normalizedText1.split(" "));
  const words2 = new Set(normalizedText2.split(" "));

  // Calculate Jaccard similarity (intersection over union)
  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// Helper function to extract key plot elements from a synopsis
function extractKeyPlotElements(synopsis: string): string[] {
  if (!synopsis) return [];

  // List of common plot-related keywords
  const plotKeywords = [
    "discovers",
    "discovery",
    "journey",
    "quest",
    "mission",
    "adventure",
    "struggle",
    "conflict",
    "battle",
    "fight",
    "war",
    "revenge",
    "betrayal",
    "mystery",
    "secret",
    "conspiracy",
    "plot",
    "plan",
    "scheme",
    "heist",
    "romance",
    "love",
    "relationship",
    "family",
    "friend",
    "enemy",
    "rival",
    "survival",
    "escape",
    "rescue",
    "save",
    "protect",
    "defend",
    "attack",
    "transformation",
    "change",
    "growth",
    "learn",
    "realize",
    "understand",
    "dystopian",
    "apocalypse",
    "future",
    "past",
    "history",
    "time travel",
    "supernatural",
    "magic",
    "power",
    "ability",
    "gift",
    "curse",
    "destiny",
    "fate",
    "prophecy",
    "prediction",
    "vision",
    "dream",
    "nightmare",
  ];

  // Extract sentences containing plot keywords
  const sentences = synopsis.split(/[.!?]\s+/);
  const plotElements = sentences.filter((sentence) => {
    const words = sentence.toLowerCase().split(/\s+/);
    return plotKeywords.some((keyword) =>
      words.includes(keyword.toLowerCase()),
    );
  });

  return plotElements;
}

// Helper function to call the Netlify edge function for plot similarity
async function calculatePlotSimilarities(
  basePlot: string,
  candidatePlots: string[],
  baseContent?: ContentItem,
  candidateContents?: (ContentItem | null)[],
): Promise<number[] | null> {
  try {
    console.log(
      `[calculatePlotSimilarities] Calling edge function with ${candidatePlots.length} plots`,
    );

    // Call the Netlify edge function
    const response = await fetch("/.netlify/functions/similarity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        basePlot,
        candidatePlots,
      }),
    });

    if (!response.ok) {
      console.error(
        `[calculatePlotSimilarities] Edge function returned status: ${response.status}`,
      );
      const errorText = await response.text();
      console.error(`[calculatePlotSimilarities] Error details: ${errorText}`);

      // Fallback to local calculation if edge function fails
      console.log(
        `[calculatePlotSimilarities] Falling back to local calculation`,
      );
      return calculateLocalSimilarities(
        basePlot,
        candidatePlots,
        baseContent,
        candidateContents,
      );
    }

    const data = await response.json();
    console.log(
      `[calculatePlotSimilarities] Received similarities for ${data.similarities.length} plots`,
    );
    return data.similarities;
  } catch (error) {
    console.error(
      "[calculatePlotSimilarities] Error calling edge function:",
      error,
    );
    // Fallback to local calculation if edge function fails
    console.log(
      `[calculatePlotSimilarities] Falling back to local calculation due to error`,
    );
    return calculateLocalSimilarities(
      basePlot,
      candidatePlots,
      baseContent,
      candidateContents,
    );
  }
}

// Local fallback for calculating similarities when the edge function fails
function calculateLocalSimilarities(
  basePlot: string,
  candidatePlots: string[],
  baseContent?: ContentItem,
  candidateContents?: (ContentItem | null)[],
): number[] {
  console.log(
    `[calculateLocalSimilarities] Calculating similarities locally for ${candidatePlots.length} plots`,
  );

  // If we have genre information, filter by genre first
  let similarityScores = new Array(candidatePlots.length).fill(0);

  // If we have content items with genre information, prioritize same genre
  if (baseContent && candidateContents && baseContent.genre_strings) {
    console.log(
      `[calculateLocalSimilarities] Filtering by genre: ${baseContent.genre_strings.join(", ")}`,
    );

    // Create a set of base content genres for faster lookup
    const baseGenres = new Set(
      baseContent.genre_strings.map((g) => g.toLowerCase()),
    );

    // Check each candidate content for genre match
    candidateContents.forEach((candidate, index) => {
      if (!candidate || !candidate.genre_strings) return;

      // Check if any genres match
      const hasMatchingGenre = candidate.genre_strings.some((genre) =>
        baseGenres.has(genre.toLowerCase()),
      );

      // If genres match, calculate similarity, otherwise leave as 0
      if (hasMatchingGenre) {
        similarityScores[index] = calculateCosineSimilarity(
          basePlot,
          candidatePlots[index],
        );
      }
    });

    return similarityScores;
  }

  // Fallback to regular similarity if no genre information is available
  return candidatePlots.map((plot) =>
    calculateCosineSimilarity(basePlot, plot),
  );
}

// Helper function to calculate cosine similarity between two text strings
function calculateCosineSimilarity(text1: string, text2: string): number {
  // Simple implementation of cosine similarity using bag of words
  const getWordFrequency = (text: string): Record<string, number> => {
    const words = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(/\s+/);

    const frequency: Record<string, number> = {};
    for (const word of words) {
      if (word.length > 2) {
        // Skip very short words
        frequency[word] = (frequency[word] || 0) + 1;
      }
    }
    return frequency;
  };

  const freq1 = getWordFrequency(text1);
  const freq2 = getWordFrequency(text2);

  // Calculate dot product
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  // Get all unique words
  const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

  // Calculate similarity
  for (const word of allWords) {
    const value1 = freq1[word] || 0;
    const value2 = freq2[word] || 0;

    dotProduct += value1 * value2;
    magnitude1 += value1 * value1;
    magnitude2 += value2 * value2;
  }

  // Avoid division by zero
  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  // Return cosine similarity
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
}

// Import AI and Vector services
import {
  getSimilarContentTitles,
  storeContentInVectorDB,
} from "../services/aiService";
import {
  querySimilarContent,
  storeContentVector,
} from "../services/vectorService";

// Helper function to get similar content using multiple similarity metrics
export async function getSimilarContent(
  contentId: string,
  useDirectApi = false,
  limit = 12, // Increased from 8 to 12 to get more diverse recommendations
  useAI = getEnvVar("USE_AI_RECOMMENDATIONS") === "true",
  useVectorDB = getEnvVar("USE_VECTOR_DB") === "true",
  fallbackToTrending = true,
): Promise<ContentItem[]> {
  try {
    // First get the content details to find genres, actors, directors
    const content = await getContentById(contentId);

    if (!content) {
      console.log(
        `[getSimilarContent] Content with ID ${contentId} not found, falling back to trending content`,
      );
      return await getTrendingContent("movie", limit);
    }

    // Store the content in the vector database for future queries
    if (useVectorDB) {
      storeContentVector(content).catch((error) => {
        console.error(
          "[getSimilarContent] Error storing content vector:",
          error,
        );
      });
    }

    // If AI is enabled, try to get similar content titles from the AI service
    if (useAI && content.title && content.overview) {
      console.log(
        `[getSimilarContent] Using AI to find similar content for "${content.title}"`,
      );

      // Check if Gemini API key is available
      const geminiApiKey = getEnvVar("GEMINI_API_KEY");
      if (!geminiApiKey) {
        console.warn(
          "[getSimilarContent] Gemini API key not found, skipping AI recommendations",
        );
      } else {
        // Get similar content titles from the AI service
        const similarTitles = await getSimilarContentTitles(
          content.title,
          content.overview,
          content.media_type,
          Math.min(20, limit * 2), // Request more titles than needed to account for not finding some
          { apiKey: geminiApiKey },
        );

        console.log(
          `[getSimilarContent] AI returned titles: ${JSON.stringify(similarTitles)}`,
        ); // Add logging

        if (similarTitles.length > 0) {
          console.log(
            `[getSimilarContent] AI returned ${similarTitles.length} similar titles`,
          );

          // Search for each title in OMDB
          const searchPromises = similarTitles.map((title) => {
            const params = new URLSearchParams({
              s: title,
              type: content.media_type === "movie" ? "movie" : "series",
            });
            return fetchFromOmdb(params);
          });

          // Wait for all search results
          const searchResults = await Promise.all(searchPromises);

          // Process the results
          const aiRecommendations = [];

          searchResults.forEach((result, index) => {
            if (result && result.Response === "True" && result.Search) {
              // Take the first result for each title (most relevant match)
              const item = result.Search[0];
              if (item && item.imdbID !== contentId) {
                aiRecommendations.push({
                  id: item.imdbID,
                  title: item.Title,
                  poster_path: item.Poster !== "N/A" ? item.Poster : "",
                  media_type: item.Type === "movie" ? "movie" : "tv",
                  release_date: item.Year,
                  vote_average: 0,
                  vote_count: 0,
                  genre_ids: content.genre_ids || [],
                  genre_strings: content.genre_strings || [],
                  overview: "",
                  recommendationReason: `AI recommended based on ${content.title}`,
                  aiRecommended: true,
                  aiSimilarityScore: 1 - index / similarTitles.length, // Higher score for earlier results
                });

                // Store this content in the vector database for future queries
                if (useVectorDB) {
                  getContentById(item.imdbID)
                    .then((detailedContent) => {
                      if (detailedContent) {
                        storeContentVector(detailedContent).catch((error) => {
                          console.error(
                            "[getSimilarContent] Error storing AI recommendation vector:",
                            error,
                          );
                        });
                      }
                    })
                    .catch((error) => {
                      console.error(
                        "[getSimilarContent] Error getting AI recommendation details:",
                        error,
                      );
                    });
                }
              }
            }
          });

          if (aiRecommendations.length >= limit) {
            console.log(
              `[getSimilarContent] Returning ${limit} AI recommendations`,
            );
            return aiRecommendations.slice(0, limit);
          }

          console.log(
            `[getSimilarContent] AI returned only ${aiRecommendations.length} valid recommendations, supplementing with traditional search`,
          );
          // If we don't have enough AI recommendations, continue with traditional search
          // and combine the results later
        }
      }
    }

    // If vector DB is enabled, try to get similar content from the vector database
    let vectorResults = [];
    if (useVectorDB) {
      // Check if Pinecone API key is available
      const pineconeApiKey = getEnvVar("PINECONE_API_KEY");

      if (!pineconeApiKey) {
        console.warn(
          "[getSimilarContent] Pinecone API key not found, skipping vector DB recommendations",
        );
      } else {
        const similarIds = await querySimilarContent(
          contentId,
          undefined,
          limit,
        );
        if (similarIds.length > 0) {
          const detailsPromises = similarIds.map((id) => getContentById(id));
          const detailedContents = await Promise.all(detailsPromises);
          vectorResults = detailedContents.filter((item) => item !== null);

          if (vectorResults.length >= limit) {
            console.log(
              `[getSimilarContent] Returning ${limit} vector DB recommendations`,
            );
            return vectorResults.slice(0, limit);
          }
        }
      }
    }

    // Collect all available metadata for similarity matching
    const genres = content.genre_strings || [];
    const actors = content.Actors ? content.Actors.split(", ") : [];
    const director = content.Director || "";
    const year = content.Year ? parseInt(content.Year.substring(0, 4)) : 0;
    const contentType = content.media_type === "movie" ? "movie" : "series";
    const plotSynopsis = content.overview || "";

    // If we don't have enough metadata, use the title for search
    if (genres.length === 0 && actors.length === 0 && !director) {
      console.log(
        `[getSimilarContent] No metadata found for ${contentId}, using title-based search`,
      );
      // Use the title for search instead of just returning trending content
      const titleWords = content.title
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter((word) => word.length > 3);

      if (titleWords.length > 0) {
        // Try multiple title words for better coverage
        const titleSearchPromises = [];

        // Use individual meaningful words from the title
        for (let i = 0; i < Math.min(3, titleWords.length); i++) {
          const titleParams = new URLSearchParams({
            s: titleWords[i],
            type: contentType,
          });
          titleSearchPromises.push(fetchFromOmdb(titleParams));
        }

        // Also try the full title for exact matches
        const fullTitleParams = new URLSearchParams({
          s: content.title.substring(0, 30), // Limit length to avoid issues with very long titles
          type: contentType,
        });
        titleSearchPromises.push(fetchFromOmdb(fullTitleParams));

        // Wait for all title searches to complete
        const titleSearchResults = await Promise.all(titleSearchPromises);

        // Combine and deduplicate results
        const uniqueResults = new Map();

        titleSearchResults.forEach((result) => {
          if (result && result.Response === "True" && result.Search) {
            result.Search.forEach((item: any) => {
              if (
                item.imdbID !== contentId &&
                !uniqueResults.has(item.imdbID)
              ) {
                uniqueResults.set(item.imdbID, item);
              }
            });
          }
        });

        if (uniqueResults.size > 0) {
          const mappedResults = Array.from(uniqueResults.values()).map(
            (item: any) => ({
              id: item.imdbID,
              title: item.Title,
              poster_path: item.Poster !== "N/A" ? item.Poster : "",
              media_type: item.Type === "movie" ? "movie" : "tv",
              release_date: item.Year,
              vote_average: 0,
              vote_count: 0,
              genre_ids: [],
              overview: "",
              combinedSimilarity: 0.5, // Default similarity score
              recommendationReason: `Similar to "${content.title}"`,
            }),
          );
          return mappedResults.slice(0, limit);
        }
      }

      if (fallbackToTrending) {
        console.log(
          `[getSimilarContent] No results found for title search, falling back to trending content`,
        );
        return await getTrendingContent(contentType, limit);
      } else {
        return [];
      }
    }

    // Create multiple search promises based on different criteria
    const searchPromises = [];

    // 1. Search by primary genre with title keywords for better relevance
    if (genres.length > 0) {
      // Extract meaningful keywords from the title
      const titleWords = content.title
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .split(/\s+/)
        .filter((word) => word.length > 3);

      // Use the first genre plus a meaningful title word if available
      const primaryGenre = genres[0];
      const searchTerm =
        titleWords.length > 0
          ? `${primaryGenre} ${titleWords[0]}`
          : primaryGenre;

      const genreParams = new URLSearchParams({
        s: searchTerm,
        type: contentType,
      });
      searchPromises.push(fetchFromOmdb(genreParams));
    }

    // 2. Search by main actor if available
    if (actors.length > 0) {
      const mainActor = actors[0];
      const actorParams = new URLSearchParams({
        s: mainActor,
        type: contentType,
      });
      searchPromises.push(fetchFromOmdb(actorParams));
    }

    // 3. Search by director if available (more relevant for movies)
    if (director && contentType === "movie") {
      const directorParams = new URLSearchParams({
        s: director,
        type: contentType,
      });
      searchPromises.push(fetchFromOmdb(directorParams));
    }

    // 4. Search by decade/era (e.g., "1990s action")
    if (year > 0) {
      const decade = Math.floor(year / 10) * 10;
      const decadeParams = new URLSearchParams({
        s: `${decade}s ${genres[0] || contentType}`,
        type: contentType,
      });
      searchPromises.push(fetchFromOmdb(decadeParams));
    }

    // 5. Search by plot keywords if we have a synopsis
    if (plotSynopsis) {
      const plotElements = extractKeyPlotElements(plotSynopsis);
      if (plotElements.length > 0) {
        // Use multiple plot elements for better coverage
        for (let i = 0; i < Math.min(3, plotElements.length); i++) {
          const plotKeyword = plotElements[i].split(" ").slice(0, 3).join(" ");
          // Add the primary genre to make the search more relevant
          const searchTerm =
            genres.length > 0 ? `${genres[0]} ${plotKeyword}` : plotKeyword;

          const plotParams = new URLSearchParams({
            s: searchTerm,
            type: contentType,
          });
          searchPromises.push(fetchFromOmdb(plotParams));
        }
      }
    }

    // Wait for all search results
    const searchResults = await Promise.all(searchPromises);

    // Log search results for debugging
    console.log(
      `[getSimilarContent] Received ${searchResults.length} search results`,
    );
    searchResults.forEach((result, index) => {
      if (result && result.Response === "True" && result.Search) {
        console.log(
          `[getSimilarContent] Search ${index} returned ${result.Search.length} items`,
        );
      } else {
        console.log(
          `[getSimilarContent] Search ${index} failed or returned no results`,
        );
      }
    });

    // Combine and score results
    const scoredResults = new Map();
    const detailsPromises = [];

    // First pass: collect all candidate IDs and their initial scores
    searchResults.forEach((result, index) => {
      if (result && result.Response === "True" && result.Search) {
        result.Search.forEach((item: any) => {
          // Skip the original content
          if (item.imdbID === contentId) return;

          // Calculate similarity score based on which search returned this item
          // Items appearing in multiple searches get higher scores
          const existingScore = scoredResults.get(item.imdbID)?.score || 0;
          let additionalScore = 0;

          // Weight different searches differently
          switch (index) {
            case 0:
              additionalScore = 4;
              break; // Genre + title keyword match (high weight)
            case 1:
              additionalScore = 3;
              break; // Actor match
            case 2:
              additionalScore = 3;
              break; // Director match
            case 3:
              additionalScore = 2;
              break; // Era/decade match
            default:
              // Plot keyword matches (highest weight)
              additionalScore = 5;
              break;
          }

          scoredResults.set(item.imdbID, {
            item,
            score: existingScore + additionalScore,
          });

          // Queue up detailed content fetches for plot comparison
          // Only fetch details for top candidates to avoid API rate limits
          if (existingScore + additionalScore >= 2) {
            detailsPromises.push(getContentById(item.imdbID));
          }
        });
      }
    });

    // Fetch detailed content for plot comparison (in parallel)
    const detailedContents = await Promise.all(detailsPromises);

    // Second pass: adjust scores based on plot similarity
    if (plotSynopsis && detailedContents.length > 0) {
      // Filter out null contents and those without synopses
      const validContents = detailedContents.filter(
        (content) => content && content.overview,
      );

      if (validContents.length > 0 && useDirectApi) {
        // Use the TensorFlow.js edge function for more accurate similarity calculation
        console.log(
          `[getSimilarContent] Using TensorFlow.js for ${validContents.length} plot comparisons`,
        );

        // Extract plots for comparison
        const candidatePlots = validContents.map(
          (content) => content.overview || "",
        );

        // Call the edge function to calculate similarities
        const similarities = await calculatePlotSimilarities(
          plotSynopsis,
          candidatePlots,
          content,
          validContents,
        );

        if (similarities) {
          // Update scores with the TensorFlow-based similarities
          validContents.forEach((detailedContent, index) => {
            if (!detailedContent) return;

            const tfSimilarity = similarities[index];
            console.log(
              `[getSimilarContent] TF similarity for ${detailedContent.title}: ${tfSimilarity}`,
            );

            // Calculate title similarity separately (not using TensorFlow for this)
            const titleSimilarityScore = calculateTextSimilarity(
              content.title,
              detailedContent.title,
            );

            // Combine TF plot similarity with title similarity
            const combinedSimilarityScore =
              tfSimilarity * 0.7 + titleSimilarityScore * 0.3;

            // Add plot similarity score to the existing score
            const existingData = scoredResults.get(detailedContent.id);
            if (existingData) {
              // Apply a higher multiplier to make the plot score more significant
              const plotScore = Math.round(combinedSimilarityScore * 10);
              scoredResults.set(detailedContent.id, {
                ...existingData,
                score: existingData.score + plotScore,
                plotSimilarity: tfSimilarity,
                titleSimilarity: titleSimilarityScore,
                combinedSimilarity: combinedSimilarityScore,
                keywords: extractKeywords(detailedContent.overview || "").slice(
                  0,
                  10,
                ), // Store top 10 keywords
              });
            }
          });
        } else {
          // Fallback to traditional similarity if edge function fails
          console.log(
            `[getSimilarContent] TensorFlow similarity failed, falling back to traditional methods`,
          );
          useTraditionalSimilarity(
            validContents,
            plotSynopsis,
            content,
            scoredResults,
          );
        }
      } else {
        // Use traditional similarity methods
        useTraditionalSimilarity(
          validContents,
          plotSynopsis,
          content,
          scoredResults,
        );
      }
    }

    // Sort by score and convert to ContentItem format
    const sortedResults = Array.from(scoredResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(
        ({
          item,
          plotSimilarity,
          keywordSimilarity,
          titleSimilarity,
          combinedSimilarity,
        }) => ({
          id: item.imdbID,
          title: item.Title,
          poster_path: item.Poster !== "N/A" ? item.Poster : "",
          media_type: item.Type === "movie" ? "movie" : "tv",
          release_date: item.Year,
          vote_average: 0, // OMDB search doesn't provide ratings
          vote_count: 0,
          genre_ids: content.genre_ids || [], // Use the genre IDs from the original content
          genre_strings: content.genre_strings || [], // Use genre strings from original content
          overview: "", // OMDB search doesn't provide overview
          plotSimilarity: plotSimilarity || 0, // Add plot similarity score if available
          keywordSimilarity: keywordSimilarity || 0,
          titleSimilarity: titleSimilarity || 0,
          combinedSimilarity: combinedSimilarity || 0,
        }),
      );

    // If we didn't find enough results, supplement with trending content
    if (sortedResults.length < limit / 2 && fallbackToTrending) {
      console.log(
        `[getSimilarContent] Found only ${sortedResults.length} results, supplementing with trending content`,
      );
      const trendingItems = await getTrendingContent(
        contentType,
        limit - sortedResults.length,
      );

      // Mark trending items as supplementary
      const markedTrendingItems = trendingItems.map((item) => ({
        ...item,
        isTrendingFallback: true,
        recommendationReason:
          item.recommendationReason || `Trending ${contentType}`,
      }));

      return [...sortedResults, ...markedTrendingItems];
    }

    console.log(
      `[getSimilarContent] Returning ${sortedResults.length} similar items`,
    );
    return sortedResults;
  } catch (error) {
    console.error("Error getting similar content:", error);

    // Fallback to trending content in case of any error, if enabled
    if (fallbackToTrending) {
      console.log(
        "[getSimilarContent] Error occurred, falling back to trending content",
      );
      try {
        const trendingItems = await getTrendingContent("movie", limit);
        return trendingItems.map((item) => ({
          ...item,
          isErrorFallback: true,
          recommendationReason:
            item.recommendationReason || "Recommended while we fix an issue",
        }));
      } catch (fallbackError) {
        console.error(
          "Error getting trending content as fallback:",
          fallbackError,
        );
        return [];
      }
    } else {
      console.log(
        "[getSimilarContent] Error occurred, returning empty array as fallback is disabled",
      );
      return [];
    }
  }
}

// Helper function to use traditional similarity methods
function useTraditionalSimilarity(
  validContents: (ContentItem | null)[],
  plotSynopsis: string,
  originalContent: ContentItem,
  scoredResults: Map<
    string,
    {
      item: any;
      score: number;
      plotSimilarity?: number;
      keywordSimilarity?: number;
      textSimilarity?: number;
      titleSimilarity?: number;
      combinedSimilarity?: number;
      keywords?: string[];
    }
  >,
): void {
  validContents.forEach((detailedContent) => {
    if (!detailedContent) return;

    const candidateSynopsis = detailedContent.overview || "";
    if (!candidateSynopsis) return;

    // Calculate plot similarity score using both methods
    const textSimilarityScore = calculateTextSimilarity(
      plotSynopsis,
      candidateSynopsis,
    );

    // Calculate keyword-based similarity score
    const keywordSimilarityScore = calculateKeywordSimilarity(
      plotSynopsis,
      candidateSynopsis,
    );

    // Calculate title similarity
    const titleSimilarityScore = calculateTextSimilarity(
      originalContent.title,
      detailedContent.title,
    );

    // Use a weighted average of all similarity methods
    // Give more weight to title and keyword similarity
    const combinedSimilarityScore =
      textSimilarityScore * 0.3 +
      keywordSimilarityScore * 0.4 +
      titleSimilarityScore * 0.3;

    // Add plot similarity score (0-5 scale) to the existing score
    const existingData = scoredResults.get(detailedContent.id);
    if (existingData) {
      // Apply a higher multiplier to make the plot score more significant
      const plotScore = Math.round(combinedSimilarityScore * 10);
      scoredResults.set(detailedContent.id, {
        ...existingData,
        score: existingData.score + plotScore,
        plotSimilarity: combinedSimilarityScore,
        keywordSimilarity: keywordSimilarityScore,
        textSimilarity: textSimilarityScore,
        titleSimilarity: titleSimilarityScore,
        combinedSimilarity: combinedSimilarityScore,
        keywords: extractKeywords(candidateSynopsis).slice(0, 10), // Store top 10 keywords
      });
    }
  });
}

// Simplified function to get trending content directly from the OMDB API via edge function
export async function getTrendingContent(
  type?: "movie" | "tv",
  limit = 8,
): Promise<ContentItem[]> {
  console.log(
    `[getTrendingContent] Fetching ${type || "all"} content directly from API`,
  );
  const startTime = performance.now();

  try {
    // Use the Netlify edge function to get fresh content
    const params = new URLSearchParams({
      trending: "true",
      limit: limit.toString(),
    });

    if (type) {
      params.append("type", type);
    }

    // Fetch content directly from the edge function
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Edge function returned status: ${response.status}`);
    }

    const data = await response.json();
    const endTime = performance.now();
    console.log(
      `[getTrendingContent] API fetch completed in ${endTime - startTime}ms`,
    );

    if (!data || !Array.isArray(data.results) || data.results.length === 0) {
      throw new Error("No results returned from edge function");
    }

    // Format the results to match ContentItem format
    const formattedResults = data.results.map((item: any) => ({
      id: item.imdbID,
      title: item.Title,
      poster_path: item.Poster !== "N/A" ? item.Poster : "",
      media_type: item.Type === "movie" ? "movie" : "tv",
      release_date: item.Year,
      vote_average: item.imdbRating ? parseFloat(item.imdbRating) : 0,
      vote_count: item.imdbVotes
        ? parseInt(item.imdbVotes.replace(/,/g, ""))
        : 0,
      genre_ids: [],
      overview: "",
      recommendationReason: `Trending ${item.Type === "movie" ? "movie" : "TV show"}`,
    }));

    return formattedResults.slice(0, limit);
  } catch (error) {
    console.error(`[getTrendingContent] Error fetching content:`, error);
    return [];
  }
}

// This function is no longer needed in the simplified implementation

// This function is no longer needed in the simplified implementation
export function initializeContentCache(): void {
  console.log(
    "[initializeContentCache] Cache initialization disabled in simplified implementation",
  );
  // No-op in simplified implementation
}

// This function is no longer needed in the simplified implementation
