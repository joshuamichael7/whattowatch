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
    synopsis?: string; // Ensure synopsis is included
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

    // If there's only one result, use it directly without AI verification
    if (omdbResults.length === 1) {
      console.log(
        "[aiMatchingService] Only one result found, using it directly without AI verification",
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
        synopsis: originalRecommendation.synopsis || "", // Ensure synopsis is included even if empty
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
      `[matchRecommendationWithOmdbResults] Synopsis for "${originalRecommendation.title}": ${originalRecommendation.synopsis?.substring(0, 100)}${originalRecommendation.synopsis?.length > 100 ? "..." : ""}`,
    );

    // Call the AI matching function
    console.log(
      "[aiMatchingService] Sending request to AI content matcher with prompt:",
      JSON.stringify(prompt, null, 2),
    );
    const response = await axios.post(
      "/.netlify/functions/ai-content-matcher",
      prompt,
    );
    console.log(
      "[aiMatchingService] Received response from AI content matcher:",
      response.data,
    );

    if (response.data && response.data.matchedResult) {
      const matchedImdbId = response.data.matchedResult.imdbID;
      const confidence = response.data.matchedResult.confidence;
      const reason = response.data.matchedResult.reasonForMatch;
      console.log(
        `[aiMatchingService] AI matched with IMDB ID: ${matchedImdbId}, confidence: ${confidence}, reason: ${reason}`,
      );

      // Find the full OMDB result that matches the AI's choice
      // Check both imdbID and imdb_id fields since data might be in either format
      const matchedOmdbResult = omdbResults.find(
        (result) =>
          result.imdbID === matchedImdbId || result.imdb_id === matchedImdbId,
      );

      if (matchedOmdbResult) {
        console.log(
          `[aiMatchingService] Found matching OMDB result: ${matchedOmdbResult.Title || matchedOmdbResult.title} (${matchedOmdbResult.Year || matchedOmdbResult.year})`,
        );
        const contentItem = convertOmdbToContentItem(
          matchedOmdbResult,
          originalRecommendation,
        );
        console.log("[aiMatchingService] Converted content item:", contentItem);
        return contentItem;
      } else {
        console.error(
          "[aiMatchingService] AI returned an IMDB ID that doesn't match any of the provided results",
        );
        console.log("[aiMatchingService] AI returned IMDB ID:", matchedImdbId);
        console.log(
          "[aiMatchingService] Available OMDB results:",
          omdbResults.map((r) => ({
            imdbID: r.imdbID || r.imdb_id,
            title: r.Title || r.title,
            year: r.Year || r.year,
          })),
        );

        // Even if we can't find a direct match, try to find a close match by title
        // This helps in cases where the AI returned a correct ID but in a different format
        const sortedResults = [...omdbResults].sort((a, b) => {
          const aSimilarity = calculateTitleSimilarity(
            originalRecommendation.title,
            a.Title || a.title || "",
          );
          const bSimilarity = calculateTitleSimilarity(
            originalRecommendation.title,
            b.Title || b.title || "",
          );
          return bSimilarity - aSimilarity;
        });

        if (sortedResults.length > 0) {
          console.log("[aiMatchingService] Using best title match as fallback");
          return convertOmdbToContentItem(
            sortedResults[0],
            originalRecommendation,
          );
        }
      }
    }

    // Fallback: If AI matching fails, use the first result with highest title similarity
    console.log(
      "[aiMatchingService] Falling back to title similarity matching",
    );
    const sortedResults = [...omdbResults].sort((a, b) => {
      const aSimilarity = calculateTitleSimilarity(
        originalRecommendation.title,
        a.Title || a.title || "",
      );
      const bSimilarity = calculateTitleSimilarity(
        originalRecommendation.title,
        b.Title || b.title || "",
      );
      return bSimilarity - aSimilarity;
    });

    // Make sure we have a valid result before converting
    if (sortedResults.length > 0) {
      const bestMatch = sortedResults[0];
      console.log(
        `[aiMatchingService] Best match by title similarity: ${bestMatch.Title || bestMatch.title}`,
      );
      return convertOmdbToContentItem(bestMatch, originalRecommendation);
    }

    return null;
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
  // Handle different property casing (OMDB returns Title, but our app might use title)
  const title = omdbData.Title || omdbData.title || "Unknown Title";
  const imdbId = omdbData.imdbID || omdbData.imdb_id;
  const poster = omdbData.Poster || omdbData.poster_path || omdbData.poster;
  const plot = omdbData.Plot || omdbData.overview || omdbData.plot || "";
  // Determine media type with better detection for TV series
  let type = omdbData.Type || omdbData.media_type || "movie";

  // Check for TV series indicators in the year field (e.g., "2014–2015")
  const yearStr = omdbData.Year || "";
  if (
    yearStr.includes("–") ||
    yearStr.includes("-") ||
    yearStr.endsWith("��") ||
    yearStr.includes("present")
  ) {
    type = "tv";
    console.log(
      `[aiMatchingService] Detected TV series from year format: ${yearStr}`,
    );
  }

  // Normalize type values
  if (type.toLowerCase() === "series") {
    type = "tv";
  }

  // Log the raw OMDB data to see what fields are available
  console.log(
    `[aiMatchingService] OMDB data keys: ${Object.keys(omdbData).join(", ")}`,
  );

  // Log the entire OMDB data object to see all fields and values
  console.log("[aiMatchingService] Full OMDB data:", JSON.stringify(omdbData));

  // Check if we're getting the raw OMDB data directly
  if (omdbData.Response === "True") {
    console.log("[aiMatchingService] Direct OMDB API response detected");
  }

  // Explicitly log all fields that should be in the OMDB response
  console.log("[aiMatchingService] CRITICAL FIELDS CHECK:");
  console.log("- Title:", omdbData.Title || omdbData.title);
  console.log("- Year:", omdbData.Year || omdbData.year);
  console.log("- Rated:", omdbData.Rated);
  console.log("- Released:", omdbData.Released);
  console.log("- Runtime:", omdbData.Runtime);
  console.log("- Genre:", omdbData.Genre);
  console.log("- Director:", omdbData.Director);
  console.log("- Plot:", (omdbData.Plot || "").substring(0, 50) + "...");
  console.log("- Country:", omdbData.Country);
  console.log("- Language:", omdbData.Language);

  // Get the 'Rated' field from OMDB response exactly as is
  // Do not default to anything - show exactly what OMDB returns
  const rated = omdbData.Rated || "Not Rated";

  // Log the raw Rated field to debug
  console.log(
    `[aiMatchingService] Raw Rated field from OMDB: ${JSON.stringify(omdbData.Rated)}`,
  );

  console.log(`[aiMatchingService] Content rating being used: ${rated}`);
  console.log(`[aiMatchingService] Country: ${omdbData.Country || "N/A"}`);
  console.log(`[aiMatchingService] Language: ${omdbData.Language || "N/A"}`);

  // Extract genre information, ensuring we handle all possible formats
  let genreStrings: string[] = [];
  if (omdbData.Genre && typeof omdbData.Genre === "string") {
    genreStrings = omdbData.Genre.split(", ");
  } else if (omdbData.genre_strings && Array.isArray(omdbData.genre_strings)) {
    genreStrings = omdbData.genre_strings;
  } else if (omdbData.genres && Array.isArray(omdbData.genres)) {
    genreStrings = omdbData.genres.map((g: any) => g.name || g);
  }

  // Create a ContentItem object with all the extracted data
  const contentItem: ContentItem = {
    id: imdbId,
    title,
    year:
      omdbData.Year ||
      omdbData.year ||
      omdbData.release_date?.substring(0, 4) ||
      "",
    poster,
    plot,
    type,
    imdbID: imdbId,
    rated,
    runtime: omdbData.Runtime || omdbData.runtime || "",
    genre: omdbData.Genre || genreStrings.join(", ") || "",
    genre_strings: genreStrings,
    director: omdbData.Director || omdbData.director || "",
    actors: omdbData.Actors || omdbData.actors || "",
    language: omdbData.Language || omdbData.language || "",
    country: omdbData.Country || omdbData.country || "",
    awards: omdbData.Awards || omdbData.awards || "",
    writer: omdbData.Writer || omdbData.writer || "",
    // Include the original recommendation reason if available
    reason: originalRecommendation?.reason || "",
    // Include the original synopsis if available and if the plot is empty
    synopsis: plot || originalRecommendation?.synopsis || "",
  };

  return contentItem;
}

/**
 * Calculate similarity between two titles
 * @param title1 First title
 * @param title2 Second title
 * @returns Similarity score (0-1)
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  // Convert to lowercase for case-insensitive comparison
  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();

  // Exact match
  if (t1 === t2) return 1;

  // Check if one contains the other
  if (t1.includes(t2) || t2.includes(t1)) {
    // Calculate the ratio of the shorter string to the longer one
    const shorterLength = Math.min(t1.length, t2.length);
    const longerLength = Math.max(t1.length, t2.length);
    return (shorterLength / longerLength) * 0.9; // 0.9 as it's not an exact match
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(t1, t2);
  const maxLength = Math.max(t1.length, t2.length);

  // Convert distance to similarity score (1 - normalized distance)
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 * @param a First string
 * @param b Second string
 * @returns Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
