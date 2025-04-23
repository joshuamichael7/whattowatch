import { getEnvVar } from "../lib/utils";
import {
  getContentByIdFromSupabase,
  searchContentInSupabase,
} from "../lib/supabaseClient";

// Use only regular Netlify functions for all OMDB API calls
const API_ENDPOINT = "/.netlify/functions/omdb";

// Helper function to make API calls to OMDB via Netlify function
async function fetchFromOmdb(params: URLSearchParams) {
  try {
    // Remove any API key from params as it's handled server-side
    params.delete("apikey");

    // Log the search query for debugging
    if (params.has("s")) {
      console.log(`[omdbClient] Search query: ${params.get("s")}`);
    }

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

// Transform OMDB search results to ContentItem format
function transformSearchResults(results: any[]): ContentItem[] {
  return results.map((item) => ({
    id: item.imdbID,
    title: item.Title,
    poster_path: item.Poster !== "N/A" ? item.Poster : "",
    media_type: item.Type === "movie" ? "movie" : "tv",
    release_date: item.Year,
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    overview: "",
  }));
}

// Transform exact match OMDB data to ContentItem format
function transformExactMatchData(data: any): ContentItem {
  return {
    id: data.imdbID,
    title: data.Title,
    poster_path: data.Poster !== "N/A" ? data.Poster : "",
    media_type: data.Type === "movie" ? "movie" : "tv",
    release_date: data.Year,
    vote_average: data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : 0,
    vote_count:
      data.imdbVotes !== "N/A" ? parseInt(data.imdbVotes.replace(/,/g, "")) : 0,
    genre_ids: [],
    overview: data.Plot !== "N/A" ? data.Plot : "",
    content_rating: data.Rated !== "N/A" ? data.Rated : undefined,
  };
}

// Extract query title and year from search query
function extractQueryTitleAndYear(query: string): {
  queryTitle: string;
  queryYear: number | null;
} {
  const queryParts = query.toLowerCase().match(/(.+?)(?:\s+(\d{4}))?$/i);
  const queryTitle = queryParts ? queryParts[1].trim() : query.toLowerCase();
  const queryYear =
    queryParts && queryParts[2] ? parseInt(queryParts[2]) : null;

  return { queryTitle, queryYear };
}

// Find exact title match in results
function findExactTitleMatch(
  results: ContentItem[],
  queryTitle: string,
  queryYear: number | null,
): ContentItem | null {
  return (
    results.find((item) => {
      // First check for exact title match (case-insensitive)
      const titleMatches = item.title.toLowerCase() === queryTitle;

      // If a year was specified in the query, also check if it matches
      if (queryYear && titleMatches) {
        const itemYear = item.release_date
          ? parseInt(item.release_date.substring(0, 4))
          : null;
        return titleMatches && itemYear === queryYear;
      }

      return titleMatches;
    }) || null
  );
}

// Helper function to search for movies and TV shows
export async function searchContent(
  query: string,
  type?: "movie" | "series" | "all",
): Promise<ContentItem[]> {
  try {
    // Add more detailed logging for the search query
    console.log(
      `[omdbClient] Searching for content with query: "${query}", type: ${type || "all"}`,
    );

    if (!query || query.trim() === "") {
      console.warn("[omdbClient] Empty search query provided");
      return [];
    }

    // First, try to search in Supabase
    const supabaseResults = await searchContentInSupabase(query, type);

    // If we have results from Supabase, return them
    if (supabaseResults && supabaseResults.length > 0) {
      console.log(
        `[omdbClient] Found ${supabaseResults.length} results in Supabase for "${query}"`,
      );

      // Extract title and year from query
      const { queryTitle, queryYear } = extractQueryTitleAndYear(query);

      // Find exact title match
      const exactTitleMatch = findExactTitleMatch(
        supabaseResults,
        queryTitle,
        queryYear,
      );

      if (exactTitleMatch) {
        console.log(
          `[omdbClient] Found exact title match for "${query}": ${exactTitleMatch.title}`,
        );
        const otherResults = supabaseResults.filter(
          (item) => item.id !== exactTitleMatch.id,
        );
        return [exactTitleMatch, ...otherResults];
      }

      // We're no longer doing partial matching since it can cause confusion
      // Only use exact title matches to ensure accuracy
      return supabaseResults;
    }

    // If no results from Supabase, fall back to OMDB API
    console.log(
      `[omdbClient] No results found in Supabase for "${query}", falling back to OMDB API`,
    );

    return await searchFromOmdb(query, type);
  } catch (error) {
    console.error(
      `[omdbClient] Error searching content for "${query}":`,
      error,
    );
    return [];
  }
}

// Search content from OMDB API
async function searchFromOmdb(
  query: string,
  type?: "movie" | "series" | "all",
): Promise<ContentItem[]> {
  try {
    // First try an exact title search using the 't' parameter
    const exactParams = new URLSearchParams({
      t: query,
    });

    if (type && type !== "all") {
      exactParams.append("type", type);
    }

    const exactData = await fetchFromOmdb(exactParams);

    // If we found an exact match, use it and then supplement with regular search results
    if (exactData && exactData.Response === "True" && exactData.Title) {
      console.log(
        `[omdbClient] Found exact match for "${query}": ${exactData.Title}`,
      );

      // Now do a regular search to get additional results
      const params = new URLSearchParams({
        s: query,
      });

      if (type && type !== "all") {
        params.append("type", type);
      }

      const searchData = await fetchFromOmdb(params);

      // Create the exact match item
      const exactItem = transformExactMatchData(exactData);

      // If we have additional search results, add them (excluding the exact match)
      if (searchData && searchData.Response === "True" && searchData.Search) {
        const additionalItems = searchData.Search.filter(
          (item: any) => item.imdbID !== exactData.imdbID,
        ).map((item: any) => ({
          id: item.imdbID,
          title: item.Title,
          poster_path: item.Poster !== "N/A" ? item.Poster : "",
          media_type: item.Type === "movie" ? "movie" : "tv",
          release_date: item.Year,
          vote_average: 0,
          vote_count: 0,
          genre_ids: [],
          overview: "",
        }));

        return [exactItem, ...additionalItems];
      }

      // If no additional results, just return the exact match
      return [exactItem];
    }

    // If no exact match, fall back to regular search
    const params = new URLSearchParams({
      s: query,
    });

    if (type && type !== "all") {
      params.append("type", type);
    }

    const data = await fetchFromOmdb(params);
    if (!data) {
      console.log(`[omdbClient] No results found for "${query}" in OMDB API`);
      return [];
    }

    // Transform OMDB data to match our application's expected format
    console.log(
      `[omdbClient] Found ${data.Search?.length || 0} results for "${query}" in OMDB API`,
    );

    // Transform search results
    const searchResults = transformSearchResults(data.Search);

    // Extract title and year from query
    const { queryTitle, queryYear } = extractQueryTitleAndYear(query);

    // Find exact title match
    const exactMatch = findExactTitleMatch(
      searchResults,
      queryTitle,
      queryYear,
    );

    // If we have an exact match, prioritize it
    if (exactMatch) {
      console.log(
        `[omdbClient] Found exact match in search results for "${query}": ${exactMatch.title}`,
      );
      const otherResults = searchResults.filter(
        (item) => item.id !== exactMatch.id,
      );
      return [exactMatch, ...otherResults];
    }

    return searchResults;
  } catch (error) {
    console.error(
      `[omdbClient] Error searching for "${query}" in OMDB API:`,
      error,
    );
    // Return an empty array instead of throwing an error
    return [];
  }
}

// Generate a UUID for the id field
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

import { mapGenreStringsToIds } from "./utils";

// Convert OMDB data to our format
function formatOMDBData(data: any): ContentItem {
  // Extract genres as an array
  const genreStrings = data.Genre ? data.Genre.split(", ") : [];

  // Map genre strings to consistent IDs using our explicit mapping
  const genreIds = mapGenreStringsToIds(genreStrings);

  return {
    id: generateUUID(),
    imdb_id: data.imdbID,
    title: data.Title,
    poster_path: data.Poster !== "N/A" ? data.Poster : "",
    backdrop_path: data.Poster !== "N/A" ? data.Poster : "",
    media_type: data.Type === "movie" ? "movie" : "tv",
    release_date: data.Released !== "N/A" ? data.Released : data.Year,
    first_air_date:
      data.Type === "series"
        ? data.Released !== "N/A"
          ? data.Released
          : data.Year
        : null,
    vote_average: data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : 0,
    vote_count:
      data.imdbVotes !== "N/A" ? parseInt(data.imdbVotes.replace(/,/g, "")) : 0,
    genre_ids: genreIds,
    genre_strings: genreStrings,
    overview: data.Plot !== "N/A" ? data.Plot : "",
    runtime: data.Runtime !== "N/A" ? data.Runtime : "0",
    content_rating: data.Rated !== "N/A" ? data.Rated : null,
    streaming_providers: null,
    popularity: 0,
    year: data.Year,
    plot: data.Plot !== "N/A" ? data.Plot : "",
    director: data.Director !== "N/A" ? data.Director : "",
    actors: data.Actors !== "N/A" ? data.Actors : "",
    writer: data.Writer !== "N/A" ? data.Writer : "",
    language: data.Language !== "N/A" ? data.Language : "",
    country: data.Country !== "N/A" ? data.Country : "",
    awards: data.Awards !== "N/A" ? data.Awards : "",
    metascore: data.Metascore !== "N/A" ? data.Metascore : "",
    production: data.Production !== "N/A" ? data.Production : "",
    website: data.Website !== "N/A" ? data.Website : "",
    boxOffice: data.BoxOffice !== "N/A" ? data.BoxOffice : "",
    imdb_rating: data.imdbRating !== "N/A" ? data.imdbRating : "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Helper function to get content details by ID
export async function getContentById(id: string): Promise<ContentItem | null> {
  try {
    console.log(`[omdbClient] Getting content details for ID: ${id}`);

    // First, try to get content from Supabase
    const supabaseContent = await getContentByIdFromSupabase(id);

    // If we have content from Supabase, return it
    if (supabaseContent) {
      console.log(
        `[omdbClient] Found content in Supabase: ${supabaseContent.title}`,
      );
      return supabaseContent;
    }

    // If no content from Supabase, fall back to OMDB API
    console.log(
      `[omdbClient] Content not found in Supabase, falling back to OMDB API`,
    );
    const params = new URLSearchParams({
      i: id,
      plot: "full",
    });

    const data = await fetchFromOmdb(params);
    if (!data) return null;

    // Use the helper function to format OMDB data
    const contentItem: ContentItem = {
      ...data,
      poster_path: data.Poster !== "N/A" ? data.Poster : "",
      recommendationReason: "AI recommended based on your preferences",
    };

    // Add these fields for UI compatibility but they won't be saved to the database
    contentItem.poster = data.Poster !== "N/A" ? data.Poster : "";
    contentItem.contentRating = data.Rated !== "N/A" ? data.Rated : undefined;
    contentItem.ratings = data.Ratings || [];

    // Try to add this content to Supabase for future use
    try {
      const { addContentToSupabase } = await import("../lib/supabaseClient");
      // Log the content item for debugging
      console.log(
        `[omdbClient] Attempting to add to Supabase: ${contentItem.title}`,
        {
          id: contentItem.id,
          imdb_id: contentItem.imdb_id,
          media_type: contentItem.media_type,
        },
      );
      const result = await addContentToSupabase(contentItem);
      console.log(
        `[omdbClient] Added content to Supabase: ${contentItem.title}, result: ${result}`,
      );
    } catch (supabaseError) {
      console.error("Error adding content to Supabase:", supabaseError);
      // Continue even if adding to Supabase fails
    }

    return contentItem;
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

// Helper function to get similar content based on ID
export async function getSimilarContent(
  id: string,
  useDirectApi = false,
  limit = 8,
  useAi = false,
  useVectorDb = false,
): Promise<ContentItem[]> {
  console.log("[DEBUG] getSimilarContent started with params:", {
    id,
    useDirectApi,
    limit,
    useAi,
    useVectorDb,
  });

  try {
    console.log(
      `[getSimilarContent] Getting similar content for ID: ${id}, useDirectApi: ${useDirectApi}, limit: ${limit}, useAi: ${useAi}, useVectorDb: ${useVectorDb}`,
    );

    // Get the content details first
    console.log("[DEBUG] Before calling getContentById");
    const contentDetails = await getContentById(id);
    console.log(
      "[DEBUG] After calling getContentById, result:",
      contentDetails ? "found" : "not found",
    );

    if (!contentDetails) {
      console.error(`[getSimilarContent] Content with ID ${id} not found`);
      return [];
    }

    console.log("[DEBUG] Content details:", {
      id: contentDetails.id,
      title: contentDetails.title,
      media_type: contentDetails.media_type,
      overview: contentDetails.overview
        ? contentDetails.overview.substring(0, 50) + "..."
        : "none",
    });

    // If useAi is true, call the similar-content function with title and overview
    if (useAi && contentDetails.title && contentDetails.overview) {
      try {
        console.log(
          `[getSimilarContent] Using AI to get recommendations for "${contentDetails.title}"`,
        );

        console.log("[DEBUG] Before calling similar-content Netlify function");
        const aiResponse = await fetch("/.netlify/functions/similar-content", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: contentDetails.title,
            overview: contentDetails.overview,
            mediaType: contentDetails.media_type,
            limit: limit,
          }),
        });
        console.log(
          "[DEBUG] After calling similar-content Netlify function, status:",
          aiResponse.status,
        );

        if (!aiResponse.ok) {
          console.error(
            `[DEBUG] AI function returned error status: ${aiResponse.status}`,
          );
          throw new Error(`AI function returned status: ${aiResponse.status}`);
        }

        console.log("[DEBUG] Before parsing AI response JSON");
        const aiData = await aiResponse.json();
        console.log(
          "[DEBUG] After parsing AI response JSON:",
          aiData ? "data received" : "no data",
        );

        if (aiData && aiData.titles && aiData.titles.length > 0) {
          console.log(
            `[getSimilarContent] AI returned ${aiData.titles.length} recommendations`,
            aiData.titles.map((t: any) => t.title),
          );

          // Process AI recommendations
          console.log("[DEBUG] Before calling processAiRecommendations");
          const aiResults = await processAiRecommendations(
            aiData.titles,
            contentDetails,
          );
          console.log(
            "[DEBUG] After calling processAiRecommendations, results:",
            aiResults.length,
          );
          return aiResults;
        } else {
          console.log(
            "[DEBUG] AI returned no recommendations or invalid data format",
            aiData,
          );
        }
      } catch (aiError) {
        console.error(`[DEBUG] Error getting AI recommendations:`, aiError);
        // Continue with regular similar content if AI fails
      }
    }

    // Call the Netlify function for similar content (fallback or if AI is not used)
    const params = new URLSearchParams({
      id: id,
      limit: limit.toString(),
      useAi: useAi.toString(),
      useVectorDb: useVectorDb.toString(),
    });

    if (contentDetails.media_type) {
      params.append("type", contentDetails.media_type);
    }

    console.log(
      `[getSimilarContent] Calling similar-content function with params: ${params.toString()}`,
    );

    console.log("[DEBUG] Before calling OMDB API endpoint");
    const response = await fetch(
      `${API_ENDPOINT}/similar-content?${params.toString()}`,
    );
    console.log(
      "[DEBUG] After calling OMDB API endpoint, status:",
      response.status,
    );

    if (!response.ok) {
      console.error(
        `[DEBUG] Function returned error status: ${response.status}`,
      );
      throw new Error(`Function returned status: ${response.status}`);
    }

    console.log("[DEBUG] Before parsing response JSON");
    const data = await response.json();
    console.log(
      "[DEBUG] After parsing response JSON:",
      data ? "data received" : "no data",
    );

    if (!data) {
      console.error(`[getSimilarContent] No data returned from function`);
      return [];
    }

    // Handle OMDB error response format
    if (data.Response === "False") {
      console.error(`[getSimilarContent] OMDB API error: ${data.Error}`);
      return [];
    }

    // Check for results array
    if (!data.results) {
      console.error(
        `[getSimilarContent] No results property in response:`,
        data,
      );
      // Create an empty results array if missing
      data.results = [];
    }

    // Ensure results is an array
    if (!Array.isArray(data.results)) {
      console.error(`[getSimilarContent] Results is not an array:`, data);
      return [];
    }

    console.log(
      `[getSimilarContent] Found ${data.results.length} similar items for ${contentDetails.title}`,
    );

    return data.results;
  } catch (error) {
    console.error(`[DEBUG] Error getting similar content:`, error);
    return [];
  } finally {
    console.log("[DEBUG] getSimilarContent completed");
  }
}

// Process AI recommendations by searching Supabase first, then OMDB
async function processAiRecommendations(
  aiTitles: {
    title: string;
    year: string | null;
    imdb_id: string | null;
    aiRecommended: boolean;
    recommendationReason?: string;
  }[],
  originalContent: ContentItem,
): Promise<ContentItem[]> {
  if (!aiTitles || !Array.isArray(aiTitles)) {
    console.error(
      "[processAiRecommendations] aiTitles is not an array or is null",
      aiTitles,
    );
    return [];
  }
  console.log(
    `[processAiRecommendations] Processing ${aiTitles.length} AI recommendations`,
  );
  console.log(
    "[DEBUG] AI titles to process:",
    aiTitles.map(
      (t) =>
        `${t.title} ${t.year || ""} [${t.imdb_id || "no imdb_id"}] - Reason: ${t.recommendationReason?.substring(0, 30) || "No reason"}...`,
    ),
  );

  const results: ContentItem[] = [];

  try {
    console.log("[DEBUG] Before importing searchContentInSupabase");
    const { searchContentInSupabase, getContentByIdFromSupabase } =
      await import("../lib/supabaseClient");
    console.log("[DEBUG] After importing searchContentInSupabase");

    // Process each AI recommendation
    for (const aiTitle of aiTitles) {
      try {
        // If we have an IMDB ID, try to find it directly first
        if (aiTitle.imdb_id) {
          console.log(
            `[DEBUG] Searching Supabase for IMDB ID: "${aiTitle.imdb_id}"`,
          );
          const contentByImdbId = await getContentByIdFromSupabase(
            aiTitle.imdb_id,
          );

          if (
            contentByImdbId &&
            contentByImdbId.title &&
            contentByImdbId.title !== "Unknown"
          ) {
            // Found in Supabase by IMDB ID
            contentByImdbId.aiRecommended = true;
            // Preserve the AI's specific recommendation reason
            contentByImdbId.recommendationReason =
              aiTitle.recommendationReason &&
              aiTitle.recommendationReason !== "Similar in style and themes"
                ? aiTitle.recommendationReason
                : `AI recommended based on similarity to "${originalContent.title}"`;
            console.log(
              `[processAiRecommendations] Setting reason for "${contentByImdbId.title}": ${contentByImdbId.recommendationReason}`,
            );

            // Only add items that have a poster image and valid title
            if (
              contentByImdbId.poster_path &&
              contentByImdbId.poster_path.trim() !== ""
            ) {
              // Verify the poster URL is valid (not a 404)
              if (!contentByImdbId.poster_path.includes("null")) {
                results.push(contentByImdbId);
                console.log(
                  `[processAiRecommendations] Found "${contentByImdbId.title}" in Supabase by IMDB ID`,
                );
              } else {
                console.log(
                  `[processAiRecommendations] Skipping "${contentByImdbId.title}" - invalid poster URL`,
                );
              }
            } else {
              console.log(
                `[processAiRecommendations] Skipping "${contentByImdbId.title}" - no poster image available`,
              );
            }
            continue; // Skip to next recommendation
          }
        }

        // If no IMDB ID or not found by IMDB ID, try to find by title and year
        const query = aiTitle.year
          ? `${aiTitle.title} ${aiTitle.year}`
          : aiTitle.title;
        console.log(`[DEBUG] Searching Supabase for: "${query}"`);
        const supabaseResults = await searchContentInSupabase(query);
        console.log(
          `[DEBUG] Supabase search results for "${query}":", ${supabaseResults ? supabaseResults.length : 0} results`,
        );

        if (supabaseResults && supabaseResults.length > 0) {
          // Found in Supabase, add the first match
          const match = supabaseResults[0];
          if (match && match.title && match.title !== "Unknown") {
            match.aiRecommended = true;
            // Preserve the AI's specific recommendation reason
            match.recommendationReason =
              aiTitle.recommendationReason &&
              aiTitle.recommendationReason !== "Similar in style and themes"
                ? aiTitle.recommendationReason
                : `AI recommended based on similarity to "${originalContent.title}"`;
            console.log(
              `[processAiRecommendations] Setting reason for "${match.title}": ${match.recommendationReason}`,
            );

            // Only add items that have a poster image and valid title
            if (match.poster_path && match.poster_path.trim() !== "") {
              // Verify the poster URL is valid (not a 404)
              if (!match.poster_path.includes("null")) {
                results.push(match);
                console.log(
                  `[processAiRecommendations] Found "${match.title}" in Supabase`,
                );
              } else {
                console.log(
                  `[processAiRecommendations] Skipping "${match.title}" - invalid poster URL`,
                );
              }
            } else {
              console.log(
                `[processAiRecommendations] Skipping "${match.title}" - no poster image available`,
              );
            }
          }
        } else {
          // Not found in Supabase, search OMDB
          console.log(
            `[processAiRecommendations] "${aiTitle.title}" not found in Supabase, searching OMDB`,
          );
          try {
            // If we have an IMDB ID, try to get content directly by ID
            if (aiTitle.imdb_id) {
              console.log(
                `[DEBUG] Getting content from OMDB by IMDB ID: "${aiTitle.imdb_id}"`,
              );
              const contentByImdbId = await getContentById(aiTitle.imdb_id);

              if (
                contentByImdbId &&
                contentByImdbId.title &&
                contentByImdbId.title !== "Unknown"
              ) {
                // Found in OMDB by IMDB ID
                contentByImdbId.aiRecommended = true;
                contentByImdbId.recommendationReason =
                  aiTitle.recommendationReason ||
                  `AI recommended based on similarity to "${originalContent.title}"`;

                // Only add items that have a poster image and valid title
                if (
                  contentByImdbId.poster_path &&
                  contentByImdbId.poster_path.trim() !== ""
                ) {
                  // Verify the poster URL is valid (not a 404)
                  if (!contentByImdbId.poster_path.includes("null")) {
                    results.push(contentByImdbId);
                    console.log(
                      `[processAiRecommendations] Found "${contentByImdbId.title}" in OMDB by IMDB ID`,
                    );
                  } else {
                    console.log(
                      `[processAiRecommendations] Skipping "${contentByImdbId.title}" - invalid poster URL`,
                    );
                  }
                } else {
                  console.log(
                    `[processAiRecommendations] Skipping "${contentByImdbId.title}" - no poster image available`,
                  );
                }
                continue; // Skip to next recommendation
              }
            }

            // If no IMDB ID or not found by IMDB ID, search by title and year
            console.log(`[DEBUG] Before searching OMDB for: "${query}"`);
            const omdbResults = await searchFromOmdb(query);
            console.log(
              `[DEBUG] OMDB search results for "${query}":", ${omdbResults ? omdbResults.length : 0} results`,
            );

            if (omdbResults && omdbResults.length > 0) {
              // Found in OMDB, add the first match
              const match = omdbResults[0];
              if (match && match.title && match.title !== "Unknown") {
                match.aiRecommended = true;
                // Preserve the AI's specific recommendation reason
                match.recommendationReason =
                  aiTitle.recommendationReason &&
                  aiTitle.recommendationReason !== "Similar in style and themes"
                    ? aiTitle.recommendationReason
                    : `AI recommended based on similarity to "${originalContent.title}"`;
                console.log(
                  `[processAiRecommendations] Setting reason for "${match.title}": ${match.recommendationReason}`,
                );

                // Only add items that have a poster image and valid title
                if (match.poster_path && match.poster_path.trim() !== "") {
                  // Verify the poster URL is valid (not a 404)
                  if (!match.poster_path.includes("null")) {
                    results.push(match);
                    console.log(
                      `[processAiRecommendations] Found "${match.title}" in OMDB`,
                    );
                  } else {
                    console.log(
                      `[processAiRecommendations] Skipping "${match.title}" - invalid poster URL`,
                    );
                  }
                } else {
                  console.log(
                    `[processAiRecommendations] Skipping "${match.title}" - no poster image available`,
                  );
                }
              } else {
                // If not found in OMDB, log the issue but don't create fallback items
                console.log(
                  `[processAiRecommendations] Could not find "${aiTitle.title}" in OMDB, skipping this recommendation`,
                );
              }
            } else {
              // If not found in OMDB, log the issue but don't create fallback items
              console.log(
                `[processAiRecommendations] Could not find "${aiTitle.title}" in OMDB, skipping this recommendation`,
              );
            }
          } catch (omdbError) {
            console.error(
              `[DEBUG] OMDB search error for "${aiTitle.title}":`,
              omdbError,
            );
            // Don't create fallback items, just log the error and continue
          }
        }
      } catch (error) {
        console.error(`[DEBUG] Error processing "${aiTitle.title}":`, error);
      }
    }
  } catch (importError) {
    console.error(
      "[DEBUG] Error importing searchContentInSupabase:",
      importError,
    );
  }

  // Final filter to ensure all items have both a valid title and a valid poster
  const filteredResults = results.filter((item) => {
    return (
      item &&
      item.title &&
      item.title.trim() !== "" &&
      item.title !== "Unknown" &&
      item.poster_path &&
      item.poster_path.trim() !== "" &&
      !item.poster_path.includes("null")
    );
  });

  console.log(
    `[processAiRecommendations] Processed ${filteredResults.length} recommendations successfully (filtered from ${results.length}, removed ${results.length - filteredResults.length})`,
  );
  console.log(
    "[DEBUG] Final results:",
    filteredResults.map((r) => r.title),
  );
  return filteredResults;
}

// Helper function to call the Netlify function for plot similarity
async function calculatePlotSimilarities(
  basePlot: string,
  candidatePlots: string[],
  baseContent?: ContentItem,
  candidateContents?: (ContentItem | null)[],
): Promise<number[] | null> {
  try {
    console.log(
      `[calculatePlotSimilarities] Calling similarity function with ${candidatePlots.length} plots`,
    );

    // Call the Netlify function
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
        `[calculatePlotSimilarities] Function returned status: ${response.status}`,
      );
      const errorText = await response.text();
      console.error(`[calculatePlotSimilarities] Error details: ${errorText}`);

      // Fallback to local calculation if function fails
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
      "[calculatePlotSimilarities] Error calling similarity function:",
      error,
    );
    // Fallback to local calculation if function fails
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

// Function to get trending content - prioritizes Supabase (with curated homepage content) over Netlify function
export async function getTrendingContent(
  type?: "movie" | "tv",
  limit = 8,
): Promise<ContentItem[]> {
  console.log(
    `[getTrendingContent] Fetching ${type || "all"} content, prioritizing curated content`,
  );

  // Add detailed logging to troubleshoot
  console.log(`[getTrendingContent] Checking if Supabase is configured`);
  const { isSupabaseConfigured, getTrendingContentFromSupabase } = await import(
    "./supabaseClient"
  );
  const supabaseConfigured = isSupabaseConfigured();
  console.log(
    `[getTrendingContent] Supabase configured: ${supabaseConfigured}`,
  );

  if (supabaseConfigured) {
    try {
      console.log(
        `[getTrendingContent] Calling getTrendingContentFromSupabase with type=${type}, limit=${limit}`,
      );
      // This will first check homepage_content table for curated content
      const supabaseResults = await getTrendingContentFromSupabase(type, limit);
      console.log(
        `[getTrendingContent] Supabase returned ${supabaseResults?.length || 0} results`,
      );

      if (supabaseResults && supabaseResults.length > 0) {
        console.log(
          `[getTrendingContent] Using results from Supabase (may include curated content)`,
        );
        if (supabaseResults.length > 0) {
          console.log(
            `[getTrendingContent] First result: ${supabaseResults[0].id}, ${supabaseResults[0].title}`,
          );
        }
        return supabaseResults;
      }

      console.log(
        `[getTrendingContent] No results from Supabase, falling back to Netlify function`,
      );
    } catch (error) {
      console.error(
        `[getTrendingContent] Error getting content from Supabase:`,
        error,
      );
      console.log(
        `[getTrendingContent] Falling back to Netlify function due to error`,
      );
    }
  }

  return getTrendingContentFallback(type, limit);
}

// Fallback function to get trending content using the regular Netlify function
async function getTrendingContentFallback(
  type?: "movie" | "tv",
  limit = 8,
): Promise<ContentItem[]> {
  console.log(
    `[getTrendingContentFallback] Fetching ${type || "all"} content using regular function`,
  );
  const startTime = performance.now();

  try {
    // Use the regular Netlify function as fallback
    const params = new URLSearchParams({
      trending: "true",
      limit: limit.toString(),
    });

    if (type) {
      params.append("type", type);
    }

    // Fetch content from the regular function
    console.log(
      `[getTrendingContentFallback] Calling Netlify function with params: ${params.toString()}`,
    );
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Function returned status: ${response.status}`);
    }

    const data = await response.json();
    const endTime = performance.now();
    console.log(
      `[getTrendingContentFallback] API fetch completed in ${endTime - startTime}ms`,
    );

    return processTrendingResults(data, limit);
  } catch (error) {
    console.error(
      `[getTrendingContentFallback] Error fetching content:`,
      error,
    );
    return [];
  }
}

// Process trending results from API
function processTrendingResults(data: any, limit: number): ContentItem[] {
  // Check if we have results in the expected format
  if (
    data &&
    data.results &&
    Array.isArray(data.results) &&
    data.results.length > 0
  ) {
    console.log(
      `[getTrendingContentFallback] Received ${data.results.length} results`,
    );

    // Format the results to match ContentItem format
    const formattedResults = data.results.map((item) => ({
      id: item.id || item.imdbID,
      title: item.title || item.Title,
      poster_path:
        item.poster_path || (item.Poster !== "N/A" ? item.Poster : ""),
      media_type: item.media_type || (item.Type === "movie" ? "movie" : "tv"),
      release_date: item.release_date || item.Year,
      vote_average: item.vote_average || 0,
      vote_count: item.vote_count || 0,
      genre_ids: item.genre_ids || [],
      overview: item.overview || "",
    }));

    // Filter out items with missing or invalid data
    const validResults = formattedResults.filter((item) => {
      return (
        item &&
        item.title &&
        item.title !== "Unknown" &&
        item.poster_path &&
        item.poster_path.trim() !== "" &&
        !item.poster_path.includes("null")
      );
    });

    console.log(
      `[getTrendingContentFallback] Filtered ${formattedResults.length - validResults.length} invalid items`,
    );

    return validResults;
  }

  return [];
}

// Helper function to update genre information for content items missing genres
export async function updateMissingGenres(): Promise<{
  updated: number;
  failed: number;
}> {
  console.log(
    "[updateMissingGenres] Starting to update content items with missing genres",
  );

  try {
    // Import Supabase client
    const { supabase } = await import("./supabaseClient");

    // Find content without genres
    const { data: contentWithoutGenres, error: findError } = await supabase.rpc(
      "find_content_without_genres",
    );

    if (findError) {
      console.error(
        "[updateMissingGenres] Error finding content without genres:",
        findError,
      );
      return { updated: 0, failed: 0 };
    }

    console.log(
      `[updateMissingGenres] Found ${contentWithoutGenres.length} content items without genres`,
    );

    let updatedCount = 0;
    let failedCount = 0;

    // Process each item in batches to avoid rate limiting
    for (let i = 0; i < contentWithoutGenres.length; i++) {
      const item = contentWithoutGenres[i];
      try {
        // Get updated content from OMDB
        console.log(
          `[updateMissingGenres] Processing ${i + 1}/${contentWithoutGenres.length}: ${item.title}`,
        );

        // Use the imdb_id if available, otherwise use the title
        let updatedContent;
        if (item.imdb_id) {
          updatedContent = await getContentById(item.imdb_id);
        } else {
          // Search by title and get the first result
          const searchResults = await searchContent(
            item.title,
            item.media_type as any,
          );
          updatedContent =
            searchResults.length > 0
              ? await getContentById(searchResults[0].id)
              : null;
        }

        if (
          updatedContent &&
          updatedContent.genre_strings &&
          updatedContent.genre_strings.length > 0
        ) {
          // Update the content in Supabase
          const { error: updateError } = await supabase.rpc(
            "update_content_genres",
            {
              p_id: item.id,
              p_genre_strings: updatedContent.genre_strings,
              p_genre_ids: updatedContent.genre_ids,
            },
          );

          if (updateError) {
            console.error(
              `[updateMissingGenres] Error updating genres for ${item.title}:`,
              updateError,
            );
            failedCount++;
          } else {
            console.log(
              `[updateMissingGenres] Successfully updated genres for ${item.title}`,
            );
            updatedCount++;
          }
        } else {
          console.log(
            `[updateMissingGenres] No genre information found for ${item.title}`,
          );
          failedCount++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (itemError) {
        console.error(
          `[updateMissingGenres] Error processing ${item.title}:`,
          itemError,
        );
        failedCount++;
      }
    }

    console.log(
      `[updateMissingGenres] Completed: Updated ${updatedCount} items, Failed ${failedCount} items`,
    );
    return { updated: updatedCount, failed: failedCount };
  } catch (error) {
    console.error(
      "[updateMissingGenres] Error updating missing genres:",
      error,
    );
    return { updated: 0, failed: 0 };
  }
}
