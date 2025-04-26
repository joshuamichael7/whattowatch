import axios from "axios";
import { getEnvVar } from "../lib/utils";
import { ContentItem } from "../types/omdb";

/**
 * Helper function to validate a recommendation against OMDB data
 * @param recommendation The recommendation to validate
 * @returns True if the recommendation is valid, false otherwise
 */
async function validateRecommendationWithOmdb(recommendation: {
  title: string;
  year?: string;
  imdb_id?: string;
  reason?: string;
}): Promise<boolean> {
  try {
    if (!recommendation.title) {
      console.log(
        "[validateRecommendationWithOmdb] Missing title in recommendation",
      );
      return false;
    }

    // First, try to validate by IMDB ID if available
    if (recommendation.imdb_id && recommendation.imdb_id.startsWith("tt")) {
      console.log(
        `[validateRecommendationWithOmdb] Validating by IMDB ID: ${recommendation.imdb_id}`,
      );

      // Fetch content by IMDB ID
      const response = await fetch(
        `/.netlify/functions/omdb?i=${recommendation.imdb_id}&plot=short`,
      );
      if (!response.ok) {
        console.error(
          `[validateRecommendationWithOmdb] Error fetching by IMDB ID: ${response.status}`,
        );
        return false;
      }

      const data = await response.json();

      // Check if the response is valid
      if (data.Response === "False" || !data.Title) {
        console.log(
          `[validateRecommendationWithOmdb] Invalid IMDB ID: ${recommendation.imdb_id}`,
        );
        return false;
      }

      // Check if the title from OMDB matches the recommendation title
      const isTitleMatch = await checkTitleMatch(
        data.Title,
        recommendation.title,
      );
      if (!isTitleMatch) {
        console.log(
          `[validateRecommendationWithOmdb] Title mismatch: OMDB "${data.Title}" vs Recommendation "${recommendation.title}"`,
        );
        return false;
      }

      // If year is provided, check if it matches
      if (
        recommendation.year &&
        data.Year &&
        recommendation.year !== data.Year
      ) {
        console.log(
          `[validateRecommendationWithOmdb] Year mismatch: OMDB ${data.Year} vs Recommendation ${recommendation.year}`,
        );
        return false;
      }

      console.log(
        `[validateRecommendationWithOmdb] Valid recommendation: "${recommendation.title}" (${recommendation.imdb_id})`,
      );
      return true;
    }

    // If no IMDB ID or validation by ID failed, try by title
    console.log(
      `[validateRecommendationWithOmdb] Validating by title: "${recommendation.title}"`,
    );

    // Construct search query with title and year if available
    let searchQuery = recommendation.title;
    if (recommendation.year) {
      searchQuery += ` ${recommendation.year}`;
    }

    // Search by title
    const response = await fetch(
      `/.netlify/functions/omdb?s=${encodeURIComponent(searchQuery)}`,
    );
    if (!response.ok) {
      console.error(
        `[validateRecommendationWithOmdb] Error searching by title: ${response.status}`,
      );
      return false;
    }

    const data = await response.json();

    // Check if the search returned results
    if (
      data.Response === "False" ||
      !data.Search ||
      !Array.isArray(data.Search) ||
      data.Search.length === 0
    ) {
      console.log(
        `[validateRecommendationWithOmdb] No results found for title: "${recommendation.title}"`,
      );
      return false;
    }

    // Find the best match in search results
    const bestMatch = findBestTitleMatch(
      data.Search,
      recommendation.title,
      recommendation.year,
    );
    if (!bestMatch) {
      console.log(
        `[validateRecommendationWithOmdb] No good match found for title: "${recommendation.title}"`,
      );
      return false;
    }

    console.log(
      `[validateRecommendationWithOmdb] Valid recommendation: "${recommendation.title}" matched with "${bestMatch.Title}" (${bestMatch.imdbID})`,
    );
    return true;
  } catch (error) {
    console.error(
      `[validateRecommendationWithOmdb] Error validating recommendation:`,
      error,
    );
    return false;
  }
}

/**
 * Helper function to check if two titles match (with some flexibility)
 * @param title1 First title
 * @param title2 Second title
 * @returns True if the titles match, false otherwise
 */
async function checkTitleMatch(
  title1: string,
  title2: string,
): Promise<boolean> {
  if (!title1 || !title2) return false;

  // Normalize titles: lowercase, remove special characters, trim whitespace
  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " ") // Replace multiple spaces with a single space
      .trim();
  };

  const normalizedTitle1 = normalizeTitle(title1);
  const normalizedTitle2 = normalizeTitle(title2);

  // Check for exact match first
  if (normalizedTitle1 === normalizedTitle2) {
    console.log(
      `[checkTitleMatch] Exact match found between "${title1}" and "${title2}"`,
    );
    return true;
  }

  // Check if one title is contained within the other (for partial matches)
  if (
    normalizedTitle1.includes(normalizedTitle2) ||
    normalizedTitle2.includes(normalizedTitle1)
  ) {
    console.log(
      `[checkTitleMatch] Partial match found between "${title1}" and "${title2}"`,
    );
    return true;
  }

  // Calculate similarity for close matches
  const maxLength = Math.max(normalizedTitle1.length, normalizedTitle2.length);
  if (maxLength === 0) return false;

  // Simple Levenshtein distance calculation for similarity
  const distance = levenshteinDistance(normalizedTitle1, normalizedTitle2);
  const similarity = 1 - distance / maxLength;

  // Consider it a match if similarity is above threshold (e.g., 0.8 or 80% similar)
  const isMatch = similarity > 0.8;
  if (isMatch) {
    console.log(
      `[checkTitleMatch] Close match found between "${title1}" and "${title2}" (similarity: ${similarity.toFixed(2)})`,
    );
  }
  return isMatch;
}

/**
 * Helper function to calculate Levenshtein distance between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns The Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix of size (m+1) x (n+1)
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize the first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
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

/**
 * Find the best title match in search results
 * @param results Search results from OMDB
 * @param queryTitle The title to match
 * @param queryYear Optional year to match
 * @returns The best matching item or null if no good match found
 */
function findBestTitleMatch(
  results: any[],
  queryTitle: string,
  queryYear?: string,
): any | null {
  if (!results || !Array.isArray(results) || results.length === 0) return null;

  // First try to find an exact title match with year if provided
  if (queryYear) {
    const exactMatchWithYear = results.find((item) => {
      const titleMatches =
        item.Title.toLowerCase() === queryTitle.toLowerCase();
      return titleMatches && item.Year === queryYear;
    });
    if (exactMatchWithYear) return exactMatchWithYear;
  }

  // Then try to find an exact title match without considering year
  const exactMatch = results.find(
    (item) => item.Title.toLowerCase() === queryTitle.toLowerCase(),
  );
  if (exactMatch) return exactMatch;

  // If no exact match, try to find a close match
  for (const item of results) {
    const normalizeTitle = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, "") // Remove special characters
        .replace(/\s+/g, " ") // Replace multiple spaces with a single space
        .trim();
    };

    const normalizedItemTitle = normalizeTitle(item.Title);
    const normalizedQueryTitle = normalizeTitle(queryTitle);

    // Check for partial matches
    if (
      normalizedItemTitle.includes(normalizedQueryTitle) ||
      normalizedQueryTitle.includes(normalizedItemTitle)
    ) {
      return item;
    }
  }

  // If still no match, calculate similarity for each result
  let bestMatch = null;
  let bestSimilarity = 0;

  for (const item of results) {
    const normalizeTitle = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, "") // Remove special characters
        .replace(/\s+/g, " ") // Replace multiple spaces with a single space
        .trim();
    };

    const normalizedItemTitle = normalizeTitle(item.Title);
    const normalizedQueryTitle = normalizeTitle(queryTitle);

    const maxLength = Math.max(
      normalizedItemTitle.length,
      normalizedQueryTitle.length,
    );
    if (maxLength === 0) continue;

    const distance = levenshteinDistance(
      normalizedItemTitle,
      normalizedQueryTitle,
    );
    const similarity = 1 - distance / maxLength;

    if (similarity > bestSimilarity && similarity > 0.7) {
      bestSimilarity = similarity;
      bestMatch = item;
    }
  }

  // Only return if similarity is above threshold
  if (bestSimilarity > 0.7) {
    console.log(
      `[findBestTitleMatch] Found match with similarity ${bestSimilarity.toFixed(2)}: "${bestMatch.Title}"`,
    );
    return bestMatch;
  }

  return null;
}

/**
 * Get similar content titles using Gemini AI via Netlify function
 * @param title The title of the content to find similar items for
 * @param overview The plot/overview of the content
 * @param mediaType The type of media (movie or tv)
 * @param limit The number of similar titles to request
 * @returns An array of similar content titles with reasoning
 */
export async function getSimilarContentTitles(
  title: string,
  overview: string,
  mediaType: "movie" | "tv" = "movie",
  limit: number = 10,
): Promise<ContentItem[]> {
  try {
    console.log(
      `[getSimilarContentTitles] Finding similar content to "${title}"`,
    );

    // Call the Netlify function to get similar content
    const response = await fetch("/.netlify/functions/similar-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        overview,
        mediaType,
        limit: limit * 2, // Request more items than needed to account for filtering
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Similar content function returned status: ${response.status}`,
      );
    }

    const data = await response.json();

    if (!data || !data.titles || !Array.isArray(data.titles)) {
      console.error(
        "[getSimilarContentTitles] Invalid response format from similar-content function",
      );
      return [];
    }

    console.log(
      `[getSimilarContentTitles] Received ${data.titles.length} recommendations, validating...`,
    );

    // Validate each recommendation against OMDB
    const validatedRecommendations: ContentItem[] = [];

    for (const item of data.titles) {
      // Skip items without title or IMDB ID
      if (!item.title || (!item.imdb_id && !item.imdbID)) {
        console.log(
          `[getSimilarContentTitles] Skipping item with missing title or IMDB ID`,
        );
        continue;
      }

      const imdbId = item.imdb_id || item.imdbID;

      // Validate the recommendation
      const isValid = await validateRecommendationWithOmdb({
        title: item.title,
        year: item.year,
        imdb_id: imdbId,
        reason: item.recommendationReason || item.reason,
      });

      if (isValid) {
        // Convert to ContentItem format
        validatedRecommendations.push({
          id: imdbId,
          title: item.title,
          poster_path: item.poster || "",
          media_type: mediaType,
          vote_average: parseFloat(item.rating || "0") || 0,
          vote_count: 0,
          genre_ids: [],
          overview: item.synopsis || "",
          recommendationReason:
            item.recommendationReason || item.reason || `Similar to ${title}`,
          year: item.year,
          aiRecommended: true,
        });

        // Stop once we have enough valid recommendations
        if (validatedRecommendations.length >= limit) {
          break;
        }
      }
    }

    console.log(
      `[getSimilarContentTitles] Returning ${validatedRecommendations.length} validated recommendations`,
    );
    return validatedRecommendations;
  } catch (error) {
    console.error(
      "[getSimilarContentTitles] Error getting similar content:",
      error,
    );
    return [];
  }
}

/**
 * Get personalized recommendations based on user preferences
 * @param preferences User preferences object
 * @param limit Maximum number of recommendations to return
 * @returns Array of content items as recommendations
 */
export async function getPersonalizedRecommendations(
  preferences: any,
  limit: number = 10,
): Promise<ContentItem[]> {
  try {
    console.log(
      `[getPersonalizedRecommendations] Getting recommendations based on preferences`,
    );

    // Call the Netlify function to get personalized recommendations
    const response = await fetch("/.netlify/functions/ai-recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences,
        limit: limit * 2, // Request more items than needed to account for filtering
      }),
    });

    if (!response.ok) {
      throw new Error(
        `AI recommendations function returned status: ${response.status}`,
      );
    }

    const data = await response.json();

    if (
      !data ||
      !data.recommendations ||
      !Array.isArray(data.recommendations)
    ) {
      console.error(
        "[getPersonalizedRecommendations] Invalid response format from ai-recommendations function",
      );
      return [];
    }

    console.log(
      `[getPersonalizedRecommendations] Received ${data.recommendations.length} recommendations, validating...`,
    );

    // Validate each recommendation against OMDB
    const validatedRecommendations: ContentItem[] = [];

    // Add more logging to see what we're getting from the API
    console.log(
      `[getPersonalizedRecommendations] First few recommendations:`,
      data.recommendations.slice(0, 3).map((r) => ({
        title: r.title,
        year: r.year,
        imdb_id: r.imdb_id || r.imdbID,
      })),
    );

    for (const item of data.recommendations) {
      // Skip items without title
      if (!item.title) {
        console.log(
          `[getPersonalizedRecommendations] Skipping item with missing title`,
        );
        continue;
      }

      const imdbId = item.imdb_id || item.imdbID;

      // Validate the recommendation
      const isValid = await validateRecommendationWithOmdb({
        title: item.title,
        year: item.year,
        imdb_id: imdbId,
        director: item.director,
        actors: item.actors,
        reason: item.reason,
      });

      if (isValid) {
        // Convert to ContentItem format
        validatedRecommendations.push({
          id: imdbId || generateUUID(),
          title: item.title,
          poster_path: item.poster || "",
          media_type: item.type === "movie" ? "movie" : "tv",
          vote_average: parseFloat(item.rating || "0") || 0,
          vote_count: 0,
          genre_ids: [],
          overview: item.synopsis || "",
          recommendationReason: item.reason || "Matches your preferences",
          year: item.year,
          aiRecommended: true,
        });

        // Stop once we have enough valid recommendations
        if (validatedRecommendations.length >= limit) {
          break;
        }
      }
    }

    console.log(
      `[getPersonalizedRecommendations] Returning ${validatedRecommendations.length} validated recommendations`,
    );
    return validatedRecommendations;
  } catch (error) {
    console.error(
      "[getPersonalizedRecommendations] Error getting personalized recommendations:",
      error,
    );
    return [];
  }
}

/**
 * Generate a UUID for the id field when IMDB ID is not available
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
