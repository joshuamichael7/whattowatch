import axios from "axios";
import { ContentItem } from "@/types/omdb";

/**
 * Ask the AI to match the original recommendation with OMDB search results
 * @param originalRecommendation The original AI recommendation
 * @param omdbResults The search results from OMDB
 * @returns The best matching content item
 */
export async function matchRecommendationWithOmdbResults(
  originalRecommendation: {
    title: string;
    year?: string;
    reason?: string;
    synopsis?: string;
  },
  omdbResults: any[],
): Promise<ContentItem | null> {
  try {
    console.log(
      "[aiMatchingService] Matching recommendation with OMDB results",
    );
    console.log(
      `[aiMatchingService] Original recommendation: ${originalRecommendation.title} (${originalRecommendation.year || "unknown year"})`,
    );
    console.log(
      `[aiMatchingService] Found ${omdbResults.length} potential OMDB matches`,
    );

    // If there's only one result, return it immediately
    if (omdbResults.length === 1) {
      console.log(
        "[aiMatchingService] Only one result found, returning it directly",
      );
      return convertOmdbToContentItem(omdbResults[0], originalRecommendation);
    }

    // If there are no results, return null
    if (omdbResults.length === 0) {
      console.log("[aiMatchingService] No results found");
      return null;
    }

    // Prepare the prompt for the AI
    const prompt = {
      originalRecommendation: {
        title: originalRecommendation.title,
        year: originalRecommendation.year,
        reason: originalRecommendation.reason,
        synopsis: originalRecommendation.synopsis,
      },
      omdbResults: omdbResults.map((result) => ({
        title: result.Title,
        year: result.Year,
        type: result.Type,
        imdbID: result.imdbID,
        plot: result.Plot,
        actors: result.Actors,
        director: result.Director,
        genre: result.Genre,
      })),
    };

    // Call the AI matching function
    const response = await axios.post(
      "/.netlify/functions/ai-content-matcher",
      prompt,
    );

    if (response.data && response.data.matchedResult) {
      const matchedImdbId = response.data.matchedResult.imdbID;
      console.log(
        `[aiMatchingService] AI matched with IMDB ID: ${matchedImdbId}`,
      );

      // Find the full OMDB result that matches the AI's choice
      const matchedOmdbResult = omdbResults.find(
        (result) => result.imdbID === matchedImdbId,
      );

      if (matchedOmdbResult) {
        console.log(
          `[aiMatchingService] Found matching OMDB result: ${matchedOmdbResult.Title} (${matchedOmdbResult.Year})`,
        );
        return convertOmdbToContentItem(
          matchedOmdbResult,
          originalRecommendation,
        );
      } else {
        console.error(
          "[aiMatchingService] AI returned an IMDB ID that doesn't match any of the provided results",
        );
      }
    }

    // Fallback: If AI matching fails, use the first result with highest title similarity
    console.log(
      "[aiMatchingService] Falling back to title similarity matching",
    );
    const sortedResults = [...omdbResults].sort((a, b) => {
      const aSimilarity = calculateTitleSimilarity(
        originalRecommendation.title,
        a.Title,
      );
      const bSimilarity = calculateTitleSimilarity(
        originalRecommendation.title,
        b.Title,
      );
      return bSimilarity - aSimilarity;
    });

    return convertOmdbToContentItem(sortedResults[0], originalRecommendation);
  } catch (error) {
    console.error(
      "[aiMatchingService] Error matching recommendation with OMDB results:",
      error,
    );

    // Fallback to the first result if there's an error
    if (omdbResults.length > 0) {
      console.log(
        "[aiMatchingService] Error occurred, falling back to first OMDB result",
      );
      return convertOmdbToContentItem(omdbResults[0], originalRecommendation);
    }

    return null;
  }
}

/**
 * Convert OMDB data to ContentItem format
 */
function convertOmdbToContentItem(
  omdbData: any,
  originalRecommendation: any,
): ContentItem {
  return {
    id: omdbData.imdbID,
    imdb_id: omdbData.imdbID,
    title: omdbData.Title,
    poster_path: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
    media_type: omdbData.Type === "movie" ? "movie" : "tv",
    vote_average:
      omdbData.imdbRating !== "N/A" ? parseFloat(omdbData.imdbRating) : 0,
    vote_count:
      omdbData.imdbVotes && omdbData.imdbVotes !== "N/A"
        ? parseInt(omdbData.imdbVotes.replace(/,/g, ""))
        : 0,
    genre_ids: [],
    genre_strings: omdbData.Genre ? omdbData.Genre.split(", ") : [],
    overview: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
    content_rating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
    year: omdbData.Year,
    release_date:
      omdbData.Released !== "N/A" ? omdbData.Released : omdbData.Year,
    runtime: omdbData.Runtime !== "N/A" ? omdbData.Runtime : "",
    director: omdbData.Director !== "N/A" ? omdbData.Director : "",
    actors: omdbData.Actors !== "N/A" ? omdbData.Actors : "",
    writer: omdbData.Writer !== "N/A" ? omdbData.Writer : "",
    language: omdbData.Language !== "N/A" ? omdbData.Language : "",
    country: omdbData.Country !== "N/A" ? omdbData.Country : "",
    awards: omdbData.Awards !== "N/A" ? omdbData.Awards : "",
    metascore: omdbData.Metascore !== "N/A" ? omdbData.Metascore : "",
    production: omdbData.Production !== "N/A" ? omdbData.Production : "",
    website: omdbData.Website !== "N/A" ? omdbData.Website : "",
    boxOffice: omdbData.BoxOffice !== "N/A" ? omdbData.BoxOffice : "",
    imdb_rating: omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    poster: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
    contentRating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
    // Add recommendation data from original recommendation
    recommendationReason: originalRecommendation.reason,
    synopsis: originalRecommendation.synopsis || omdbData.Plot,
    aiRecommended: true,
    aiVerified: true,
  };
}

/**
 * Calculate similarity between two titles
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;

  const normalize = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const normalizedTitle1 = normalize(title1);
  const normalizedTitle2 = normalize(title2);

  if (normalizedTitle1 === normalizedTitle2) return 1.0;

  // Check if one title contains the other
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

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}
