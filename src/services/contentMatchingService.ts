import axios from "axios";
import { ContentItem } from "@/types/omdb";
import { logFullOmdbResponse, logContentItem } from "./debugRatedField";

/**
 * Enhanced content matching service that preserves the Rated field
 * This service handles matching AI recommendations with OMDB data
 */

/**
 * Match an AI recommendation with OMDB search results
 * @param recommendation The original AI recommendation
 * @param omdbResults Array of OMDB search results
 * @returns The best matching content item with all fields preserved
 */
export async function matchContentWithOmdb(
  recommendation: {
    title: string;
    year?: string;
    reason?: string;
    synopsis?: string;
  },
  omdbResults: any[],
): Promise<ContentItem | null> {
  try {
    // Log input for debugging
    console.log(
      `[ContentMatching] Processing recommendation: "${recommendation.title}"`,
    );
    console.log(
      `[ContentMatching] Found ${omdbResults.length} potential OMDB matches`,
    );

    // Validate inputs
    if (!recommendation.title) {
      console.error("[ContentMatching] Missing recommendation title");
      return null;
    }

    if (!omdbResults || omdbResults.length === 0) {
      console.log("[ContentMatching] No OMDB results to match against");
      return null;
    }

    // Check if Rated field exists in any of the OMDB results
    const hasRatedField = omdbResults.some(
      (result) => "Rated" in result || "rated" in result,
    );
    console.log(
      `[ContentMatching] Any OMDB result has Rated field: ${hasRatedField}`,
    );

    // If no Rated field exists, add a default one
    if (!hasRatedField) {
      console.log(
        `[ContentMatching] No Rated field found in any result, adding default 'Not Rated'`,
      );
      omdbResults = omdbResults.map((result) => ({
        ...result,
        Rated: "Not Rated",
      }));
    }

    // If there's only one result, use it directly without AI verification
    if (omdbResults.length === 1) {
      console.log("[ContentMatching] Only one result found, using it directly");
      return createContentItem(omdbResults[0], recommendation);
    }

    // Prepare the prompt for the AI
    const prompt = {
      originalRecommendation: {
        title: recommendation.title,
        year: recommendation.year,
        reason: recommendation.reason,
        synopsis: recommendation.synopsis || "",
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
        rated: result.Rated || result.rated || "Not Rated", // Ensure rated field is included
      })),
    };

    // Log the synopsis to ensure it's being sent
    if (recommendation.synopsis) {
      console.log(
        `[ContentMatching] Synopsis for "${recommendation.title}": ${recommendation.synopsis.substring(0, 100)}${recommendation.synopsis.length > 100 ? "..." : ""}`,
      );
    }

    // Call the AI matching function
    console.log("[ContentMatching] Sending request to AI content matcher");
    const response = await axios.post(
      "/.netlify/functions/ai-content-matcher",
      prompt,
    );

    console.log("[ContentMatching] Received response from AI content matcher");

    if (response.data && response.data.matchedResult) {
      const matchedImdbId = response.data.matchedResult.imdbID;
      const confidence = response.data.matchedResult.confidence;
      const reason = response.data.matchedResult.reasonForMatch;

      console.log(
        `[ContentMatching] AI matched with IMDB ID: ${matchedImdbId}, confidence: ${confidence}`,
      );

      // Find the full OMDB result that matches the AI's choice
      const matchedOmdbResult = omdbResults.find(
        (result) =>
          result.imdbID === matchedImdbId || result.imdb_id === matchedImdbId,
      );

      if (matchedOmdbResult) {
        console.log(
          `[ContentMatching] Found matching OMDB result: ${matchedOmdbResult.Title || matchedOmdbResult.title}`,
        );
        return createContentItem(matchedOmdbResult, recommendation);
      } else {
        console.error(
          "[ContentMatching] AI returned an IMDB ID that doesn't match any of the provided results",
        );

        // Fallback to the first result
        if (omdbResults.length > 0) {
          console.log("[ContentMatching] Falling back to first result");
          return createContentItem(omdbResults[0], recommendation);
        }
      }
    }

    // Fallback to the first result if AI matching fails
    if (omdbResults.length > 0) {
      console.log("[ContentMatching] AI matching failed, using first result");
      return createContentItem(omdbResults[0], recommendation);
    }

    return null;
  } catch (error) {
    console.error(
      "[ContentMatching] Error matching recommendation with OMDB results:",
      error,
    );

    // Fallback to the first result if there's an error
    if (omdbResults.length > 0) {
      console.log(
        "[ContentMatching] Error occurred, falling back to first OMDB result",
      );
      return createContentItem(omdbResults[0], recommendation);
    }

    return null;
  }
}

/**
 * Create a ContentItem from OMDB data, preserving all fields including Rated
 * @param omdbData The OMDB data
 * @param recommendation The original AI recommendation
 * @returns A ContentItem with all fields preserved
 */
export function createContentItem(
  omdbData: any,
  recommendation: any,
): ContentItem {
  // Log the raw OMDB data before any processing
  logFullOmdbResponse("createContentItem-input", omdbData);

  // Extract genre information
  const genreStrings = omdbData.Genre ? omdbData.Genre.split(", ") : [];

  // Force a Rated field if it doesn't exist
  if (!("Rated" in omdbData)) {
    console.log(
      "[ContentMatching] Rated field missing, forcing it to 'Not Rated'",
    );
    omdbData.Rated = "Not Rated";
  }

  // Create the content item with all fields preserved
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
    content_rating: omdbData.Rated !== "N/A" ? omdbData.Rated : "Not Rated",
    contentRating: omdbData.Rated !== "N/A" ? omdbData.Rated : "Not Rated",
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
    recommendationReason: recommendation.reason || "AI recommended",
    reason: recommendation.reason || "AI recommended",
    synopsis: recommendation.synopsis || omdbData.Plot,
    aiRecommended: true,
    verified: true,
  };

  // Log the content rating fields for debugging
  console.log("[ContentMatching] Content rating fields in ContentItem:", {
    content_rating: contentItem.content_rating,
    contentRating: contentItem.contentRating,
    Rated: contentItem.Rated,
    hasRatedProperty: "Rated" in contentItem,
    allKeys: Object.keys(contentItem),
  });

  // Log the full content item
  logContentItem("createContentItem-output", contentItem);

  return contentItem;
}

/**
 * Get detailed content information from OMDB by IMDB ID
 * @param imdbId IMDB ID
 * @returns Detailed content data or null if not found
 */
export async function getContentDetails(imdbId: string): Promise<any | null> {
  try {
    console.log(`[ContentMatching] Getting details for IMDB ID: ${imdbId}`);

    const response = await fetch(
      `/.netlify/functions/omdb?i=${imdbId}&plot=full`,
    );

    if (!response.ok) {
      console.error(
        `[ContentMatching] OMDB API error: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    // Get the raw response text for logging
    const responseText = await response.text();
    console.log(
      `[ContentMatching] Raw OMDB response: ${responseText.substring(0, 200)}...`,
    );

    // Parse the response
    const data = JSON.parse(responseText);

    if (data.Response !== "True") {
      console.log(`[ContentMatching] No details found for ID ${imdbId}`);
      return null;
    }

    // Log the Rated field specifically
    console.log(`[ContentMatching] Content rating for ${data.Title}:`, {
      hasRated: "Rated" in data,
      ratedValue: data.Rated,
      ratedType: typeof data.Rated,
    });

    // If Rated field is missing, add a default one
    if (!("Rated" in data)) {
      console.log(
        `[ContentMatching] Adding default Rated field to ${data.Title}`,
      );
      data.Rated = "Not Rated";
    }

    return data;
  } catch (error) {
    console.error(
      `[ContentMatching] Error getting details for ID ${imdbId}:`,
      error,
    );
    return null;
  }
}

/**
 * Search OMDB API by title
 * @param query Search query (title with optional year)
 * @returns Array of search results or null if none found
 */
export async function searchOmdbByTitle(query: string): Promise<any[] | null> {
  try {
    console.log(`[ContentMatching] Searching OMDB for: "${query}"`);

    const response = await fetch(
      `/.netlify/functions/omdb?s=${encodeURIComponent(query)}`,
    );

    if (!response.ok) {
      console.error(
        `[ContentMatching] OMDB search failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    // Get the raw response text for logging
    const responseText = await response.text();
    console.log(
      `[ContentMatching] Raw OMDB search response: ${responseText.substring(0, 200)}...`,
    );

    // Parse the response
    const data = JSON.parse(responseText);

    if (data.Response !== "True" || !data.Search || data.Search.length === 0) {
      console.log(`[ContentMatching] No results found for "${query}"`);
      return null;
    }

    return data.Search;
  } catch (error) {
    console.error(
      `[ContentMatching] Error searching OMDB for "${query}":`,
      error,
    );
    return null;
  }
}
