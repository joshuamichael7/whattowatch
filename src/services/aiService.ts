import axios from "axios";
import { getEnvVar } from "../lib/utils";
import { ContentItem } from "../types/omdb";

/**
 * Helper function to validate a recommendation by title only
 * @param title The title to validate
 * @param year Optional year to validate
 * @returns True if the title is valid, false otherwise
 */
async function validateRecommendationByTitleOnly(
  title: string,
  year?: string,
): Promise<boolean> {
  try {
    if (!title) {
      console.log("[validateRecommendationByTitleOnly] Missing title");
      return false;
    }

    console.log(
      `[validateRecommendationByTitleOnly] Validating title: "${title}"${year ? ` (${year})` : ""}`,
    );

    // Construct search query with title only - don't include year to maximize chances of finding a match
    let searchQuery = title;

    // Search by title
    const response = await fetch(
      `/.netlify/functions/omdb?s=${encodeURIComponent(searchQuery)}`,
    );
    if (!response.ok) {
      console.error(
        `[validateRecommendationByTitleOnly] Error searching by title: ${response.status}`,
      );
      // Return true anyway to avoid filtering out recommendations due to API errors
      return true;
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
        `[validateRecommendationByTitleOnly] No results found for title: "${title}", trying alternative search`,
      );

      // Try a more lenient search by taking just the first word or first few characters
      const simplifiedTitle = title.split(" ")[0];
      if (simplifiedTitle && simplifiedTitle.length > 2) {
        const altResponse = await fetch(
          `/.netlify/functions/omdb?s=${encodeURIComponent(simplifiedTitle)}`,
        );
        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (
            altData.Response === "True" &&
            altData.Search &&
            altData.Search.length > 0
          ) {
            console.log(
              `[validateRecommendationByTitleOnly] Found results with simplified search: ${simplifiedTitle}`,
            );
            return true;
          }
        }
      }

      // If we still can't find anything, just accept the recommendation anyway
      console.log(
        `[validateRecommendationByTitleOnly] No results found, but accepting recommendation anyway: "${title}"`,
      );
      return true;
    }

    console.log(
      `[validateRecommendationByTitleOnly] Found ${data.Search.length} results for "${title}"`,
    );
    return true;
  } catch (error) {
    console.error(
      `[validateRecommendationByTitleOnly] Error validating title:`,
      error,
    );
    // Return true on error to avoid filtering out recommendations due to technical issues
    return true;
  }
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
      `[getSimilarContentTitles] Received ${data.titles.length} recommendations`,
    );

    // Convert recommendations to ContentItem format without validation
    const recommendations: ContentItem[] = [];
    const validationPromises: Promise<boolean>[] = [];
    const validItems: any[] = [];

    // First, validate all recommendations
    for (const item of data.titles) {
      // Skip items without title
      if (!item.title) {
        console.log(
          `[getSimilarContentTitles] Skipping item with missing title`,
        );
        continue;
      }

      // Validate the recommendation
      const validationPromise = validateRecommendation({
        title: item.title,
        year: item.year,
        synopsis: item.synopsis,
      }).then((isValid) => {
        if (isValid) {
          validItems.push(item);
        }
        return isValid;
      });

      validationPromises.push(validationPromise);
    }

    // Wait for all validations to complete
    await Promise.all(validationPromises);

    console.log(
      `[getSimilarContentTitles] ${validItems.length} items passed validation`,
    );

    // Convert valid items to ContentItem format
    for (const item of validItems) {
      const imdbId = item.imdb_id || item.imdbID || generateUUID();

      // Convert to ContentItem format
      recommendations.push({
        id: imdbId,
        title: item.title,
        poster_path: item.poster || "",
        media_type: mediaType,
        vote_average: parseFloat(item.rating || "0") || 0,
        vote_count: 0,
        genre_ids: [],
        overview: item.synopsis || "",
        synopsis: item.synopsis || "",
        recommendationReason:
          item.recommendationReason || item.reason || `Similar to ${title}`,
        year: item.year,
        aiRecommended: true,
      });

      // Stop once we have enough recommendations
      if (recommendations.length >= limit) {
        break;
      }
    }

    // If we don't have enough recommendations, include some unvalidated ones
    if (
      recommendations.length < limit &&
      data.titles.length > validItems.length
    ) {
      console.log(
        `[getSimilarContentTitles] Adding unvalidated recommendations to meet minimum count`,
      );

      for (const item of data.titles) {
        // Skip items that were already validated and added
        if (validItems.includes(item)) continue;

        // Skip items without title
        if (!item.title) continue;

        const imdbId = item.imdb_id || item.imdbID || generateUUID();

        // Convert to ContentItem format
        recommendations.push({
          id: imdbId,
          title: item.title,
          poster_path: item.poster || "",
          media_type: mediaType,
          vote_average: parseFloat(item.rating || "0") || 0,
          vote_count: 0,
          genre_ids: [],
          overview: item.synopsis || "",
          synopsis: item.synopsis || "",
          recommendationReason:
            item.recommendationReason || item.reason || `Similar to ${title}`,
          year: item.year,
          aiRecommended: true,
        });

        // Stop once we have enough recommendations
        if (recommendations.length >= limit) {
          break;
        }
      }
    }

    console.log(
      `[getSimilarContentTitles] Returning ${recommendations.length} recommendations`,
    );
    return recommendations;
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
      `[getPersonalizedRecommendations] Received ${data.recommendations.length} recommendations`,
    );

    // Add more logging to see what we're getting from the API
    console.log(
      `[getPersonalizedRecommendations] First few recommendations:`,
      data.recommendations.slice(0, 3).map((r) => ({
        title: r.title,
        year: r.year,
      })),
    );

    // Log the raw recommendations from the API with full details
    console.log("========== RAW AI RECOMMENDATIONS ==========");
    console.log(JSON.stringify(data.recommendations, null, 2));
    console.log("===========================================");

    // Convert recommendations to ContentItem format
    const recommendations: ContentItem[] = [];

    for (const item of data.recommendations) {
      // Skip items without title
      if (!item.title) {
        console.log(
          `[getPersonalizedRecommendations] Skipping item with missing title`,
        );
        continue;
      }

      const imdbId = item.imdb_id || item.imdbID || generateUUID();

      // Log each item's fields for debugging
      console.log(`Processing recommendation: ${item.title}`, {
        title: item.title,
        year: item.year,
        synopsis: item.synopsis,
        reason: item.reason,
        imdb_id: imdbId,
      });

      // Convert to ContentItem format
      recommendations.push({
        id: imdbId,
        title: item.title,
        poster_path: item.poster || "",
        media_type: item.type === "movie" ? "movie" : "tv",
        vote_average: parseFloat(item.rating || "0") || 0,
        vote_count: 0,
        genre_ids: [],
        overview: item.synopsis || "",
        synopsis: item.synopsis || "",
        recommendationReason: item.reason || "Matches your preferences",
        year: item.year,
        aiRecommended: true,
      });

      // Stop once we have enough recommendations
      if (recommendations.length >= limit) {
        break;
      }
    }

    console.log(
      `[getPersonalizedRecommendations] Returning ${recommendations.length} recommendations`,
    );
    return recommendations;
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
