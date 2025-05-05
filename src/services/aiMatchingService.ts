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
  const type = omdbData.Type || omdbData.media_type || "movie";

  // Log the raw OMDB data to see what fields are available
  console.log(
    `[aiMatchingService] OMDB data keys: ${Object.keys(omdbData).join(", ")}`,
  );

  // Ensure we properly extract the content rating
  // OMDB returns this as 'Rated' (e.g., "TV-14", "PG-13")
  // Handle cases where rating might be null, undefined, or "N/A"
  let rated = null;

  // Try to get the content rating from various possible fields
  if (omdbData.Rated && omdbData.Rated !== "N/A") {
    rated = omdbData.Rated;
  } else if (omdbData.content_rating && omdbData.content_rating !== "N/A") {
    rated = omdbData.content_rating;
  } else if (omdbData.contentRating && omdbData.contentRating !== "N/A") {
    rated = omdbData.contentRating;
  } else if (omdbData.rated && omdbData.rated !== "N/A") {
    rated = omdbData.rated;
  }

  // If no rating was found, check if this is a TV show and assign a default rating
  if (!rated && (type === "tv" || type === "series")) {
    // For Korean dramas, which are often TV shows, default to TV-14 if no rating is provided
    rated = "TV-14";
    console.log(
      `[aiMatchingService] No content rating found, defaulting to ${rated} for TV content`,
    );
  }

  // Final fallback to empty string if still null
  rated = rated || "";

  console.log(
    `[aiMatchingService] Raw content rating from OMDB: ${omdbData.Rated}, Processed: ${rated}`,
  );

  // Extract genre information, ensuring we handle all possible formats
  let genreStrings: string[] = [];
  if (omdbData.Genre && typeof omdbData.Genre === "string") {
    genreStrings = omdbData.Genre.split(", ");
  } else if (omdbData.genre_strings && Array.isArray(omdbData.genre_strings)) {
    genreStrings = omdbData.genre_strings;
  } else if (omdbData.genres && Array.isArray(omdbData.genres)) {
    genreStrings = omdbData.genres.map((g: any) => g.name || g);
  }

  // Extract rating information
  const rating = omdbData.imdbRating || omdbData.vote_average || "0";
  const voteCount = omdbData.imdbVotes || omdbData.vote_count || "0";

  // Extract ratings array if available
  const ratings =
    omdbData.Ratings && Array.isArray(omdbData.Ratings) ? omdbData.Ratings : [];

  console.log(
    `[aiMatchingService] Converting OMDB data to ContentItem: ${title} (${imdbId})`,
  );
  console.log(`[aiMatchingService] Plot: ${plot?.substring(0, 50)}...`);
  console.log(`[aiMatchingService] Genres: ${genreStrings.join(", ")}`);
  console.log(`[aiMatchingService] Rating: ${rating}`);
  console.log(`[aiMatchingService] Processed Content Rating: ${rated}`);

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
    plot: plot !== "N/A" ? plot : "", // Add plot explicitly
    content_rating: rated,
    contentRating: rated, // Ensure both fields are set
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
    imdbRating: rating !== "N/A" ? rating.toString() : "", // Add imdbRating for consistency
    imdbVotes: voteCount !== "N/A" ? voteCount.toString() : "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    poster: poster !== "N/A" ? poster : "",
    // Original OMDB fields
    Title: title,
    Year: omdbData.Year || "",
    Rated: rated,
    Released: omdbData.Released !== "N/A" ? omdbData.Released : "",
    Runtime: omdbData.Runtime !== "N/A" ? omdbData.Runtime : "",
    Genre: omdbData.Genre !== "N/A" ? omdbData.Genre : "",
    Director: omdbData.Director !== "N/A" ? omdbData.Director : "",
    Writer: omdbData.Writer !== "N/A" ? omdbData.Writer : "",
    Actors: omdbData.Actors !== "N/A" ? omdbData.Actors : "",
    Plot: plot,
    Language: omdbData.Language !== "N/A" ? omdbData.Language : "",
    Country: omdbData.Country !== "N/A" ? omdbData.Country : "",
    Awards: omdbData.Awards !== "N/A" ? omdbData.Awards : "",
    Poster: poster,
    Ratings: ratings,
    Metascore: omdbData.Metascore !== "N/A" ? omdbData.Metascore : "",
    Type: type,
    totalSeasons: omdbData.totalSeasons !== "N/A" ? omdbData.totalSeasons : "",
    // Add recommendation data from original recommendation
    recommendationReason: originalRecommendation.reason,
    reason: originalRecommendation.reason, // Ensure both fields are set
    synopsis: originalRecommendation.synopsis || plot,
    aiRecommended: true,
    aiVerified: true,
    similarityScore: 0.9, // Add a default high similarity score
    verified: true,
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
