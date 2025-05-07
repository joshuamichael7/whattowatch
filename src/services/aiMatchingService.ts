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
      "[DataIntegrityTester] Matching recommendation with OMDB results",
    );
    console.log(
      `[DataIntegrityTester] Original recommendation: ${originalRecommendation.title} (${originalRecommendation.year || "unknown year"})`,
    );
    console.log(
      `[DataIntegrityTester] Found ${omdbResults.length} potential OMDB matches`,
    );

    // If there's only one result, use it directly without AI verification
    if (omdbResults.length === 1) {
      console.log(
        "[DataIntegrityTester] Only one result found, using it directly",
      );
      return convertOmdbToContentItem(omdbResults[0], originalRecommendation);
    }

    // If there are no results, return null
    if (omdbResults.length === 0) {
      console.log("[DataIntegrityTester] No results found");
      return null;
    }

    // Prepare the prompt for the AI
    const prompt = {
      originalRecommendation: {
        title: originalRecommendation.title,
        year: originalRecommendation.year,
        reason: originalRecommendation.reason,
        synopsis: originalRecommendation.synopsis || "",
      },
      omdbResults: omdbResults.map((result) => ({
        title: result.Title || result.title,
        year: result.Year || result.year,
        type: result.Type || result.media_type,
        imdbID: result.imdbID || result.imdb_id,
        plot: result.Plot || result.overview || result.plot,
        actors: result.Actors || result.actors,
        director: result.Director || result.director,
        genre:
          result.Genre ||
          (result.genre_strings ? result.genre_strings.join(", ") : ""),
      })),
    };

    // Log the synopsis to ensure it's being sent
    console.log(
      `[DataIntegrityTester] Synopsis for "${originalRecommendation.title}": ${originalRecommendation.synopsis?.substring(0, 100)}${originalRecommendation.synopsis?.length > 100 ? "..." : ""}`,
    );

    // Call the AI matching function
    console.log("[DataIntegrityTester] Sending request to AI content matcher");
    const response = await axios.post(
      "/.netlify/functions/ai-content-matcher",
      prompt,
    );
    console.log(
      "[DataIntegrityTester] Received response from AI content matcher:",
      response.data,
    );

    if (response.data && response.data.matchedResult) {
      const matchedImdbId = response.data.matchedResult.imdbID;
      const confidence = response.data.matchedResult.confidence;
      const reason = response.data.matchedResult.reasonForMatch;
      console.log(
        `[DataIntegrityTester] AI matched with IMDB ID: ${matchedImdbId}, confidence: ${confidence}, reason: ${reason}`,
      );

      // Find the full OMDB result that matches the AI's choice
      const matchedOmdbResult = omdbResults.find(
        (result) =>
          result.imdbID === matchedImdbId || result.imdb_id === matchedImdbId,
      );

      if (matchedOmdbResult) {
        console.log(
          `[DataIntegrityTester] Found matching OMDB result: ${matchedOmdbResult.Title || matchedOmdbResult.title}`,
        );
        return convertOmdbToContentItem(
          matchedOmdbResult,
          originalRecommendation,
        );
      } else {
        console.error(
          "[DataIntegrityTester] AI returned an IMDB ID that doesn't match any of the provided results",
        );

        // Fallback to the first result
        if (omdbResults.length > 0) {
          console.log("[DataIntegrityTester] Falling back to first result");
          return convertOmdbToContentItem(
            omdbResults[0],
            originalRecommendation,
          );
        }
      }
    }

    // Fallback to the first result if AI matching fails
    if (omdbResults.length > 0) {
      console.log(
        "[DataIntegrityTester] AI matching failed, using first result",
      );
      return convertOmdbToContentItem(omdbResults[0], originalRecommendation);
    }

    return null;
  } catch (error) {
    console.error(
      "[DataIntegrityTester] Error matching recommendation with OMDB results:",
      error,
    );

    // Fallback to the first result if there's an error
    if (omdbResults.length > 0) {
      console.log(
        "[DataIntegrityTester] Error occurred, falling back to first OMDB result",
      );
      return convertOmdbToContentItem(omdbResults[0], originalRecommendation);
    }

    return null;
  }
}

/**
 * Convert OMDB data to ContentItem format - Directly copied from DataIntegrityTester
 */
function convertOmdbToContentItem(
  omdbData: any,
  originalRecommendation: any,
): ContentItem {
  // Extract genre information
  const genreStrings = omdbData.Genre ? omdbData.Genre.split(", ") : [];

  // Create the content item
  const contentItem: ContentItem = {
    id: omdbData.imdbID,
    imdb_id: omdbData.imdbID,
    title: omdbData.Title,
    poster_path: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
    media_type: omdbData.Type === "movie" ? "movie" : "tv",
    vote_average:
      omdbData.imdbRating !== "N/A" ? parseFloat(omdbData.imdbRating) : 0,
    vote_count:
      omdbData.imdbVotes !== "N/A"
        ? parseInt(omdbData.imdbVotes.replace(/,/g, ""))
        : 0,
    genre_ids: [],
    genre_strings: genreStrings,
    overview: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
    content_rating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
    contentRating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
    Rated: omdbData.Rated, // Preserve original OMDB field
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
    imdb_rating: omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "",
    imdbRating: omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "",
    imdbVotes: omdbData.imdbVotes !== "N/A" ? omdbData.imdbVotes : "",
    poster: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
    plot: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
    recommendationReason: originalRecommendation.reason || "AI recommended",
    reason: originalRecommendation.reason || "AI recommended",
    synopsis: originalRecommendation.synopsis || omdbData.Plot,
    aiRecommended: true,
    verified: true,
  };

  // Log the content rating fields for debugging
  console.log("Content rating fields in ContentItem:", {
    content_rating: contentItem.content_rating,
    contentRating: contentItem.contentRating,
    Rated: contentItem.Rated,
  });

  return contentItem;
}

/**
 * Calculate similarity between two titles - Simple utility function
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
