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
  const exactMatch = findExactTitleMatch(searchResults, queryTitle, queryYear);

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
}

// Generate a UUID for the id field
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Convert OMDB data to our format
function formatOMDBData(data: any): ContentItem {
  // Extract genres as an array
  const genreStrings = data.Genre ? data.Genre.split(", ") : [];

  // Generate genre IDs using a simple hash
  const genreIds =
    genreStrings.length > 0
      ? genreStrings.map((genre: string) => {
          let hash = 0;
          for (let i = 0; i < genre.length; i++) {
            hash = (hash << 5) - hash + genre.charCodeAt(i);
            hash |= 0;
          }
          return Math.abs(hash % 100);
        })
      : [];

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
    const contentItem = formatOMDBData(data);

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

    console.log(
      `[getTrendingContentFallback] Returning ${formattedResults.length} formatted results`,
    );
    return formattedResults.slice(0, limit);
  }
  // Check if we have results in the Search format (OMDB API format)
  else if (
    data &&
    data.Search &&
    Array.isArray(data.Search) &&
    data.Search.length > 0
  ) {
    console.log(
      `[getTrendingContentFallback] Received ${data.Search.length} results in Search format`,
    );

    // Format the results to match ContentItem format
    const formattedResults = data.Search.map((item: any) => ({
      id: item.imdbID,
      title: item.Title,
      poster_path: item.Poster !== "N/A" ? item.Poster : "",
      media_type: item.Type === "movie" ? "movie" : "tv",
      release_date: item.Year,
      vote_average: item.imdbRating ? parseFloat(item.imdbRating) : 0,
      vote_count: 0, // Not available in this format
      genre_ids: [],
      overview: "",
      recommendationReason: `Trending ${item.Type === "movie" ? "movie" : "TV show"}`,
    }));

    console.log(
      `[getTrendingContentFallback] Returning ${formattedResults.length} formatted results from Search`,
    );
    return formattedResults.slice(0, limit);
  }

  // If we reach here, we didn't find any usable results
  console.log(
    `[getTrendingContentFallback] No usable results found in response, data:`,
    data,
  );

  // Return empty array instead of throwing an error
  return [];
}

// This function is no longer needed in the simplified implementation
export function initializeContentCache(): void {
  console.log(
    "[initializeContentCache] Cache initialization disabled in simplified implementation",
  );
  // No-op in simplified implementation
}
