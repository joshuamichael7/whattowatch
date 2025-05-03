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

    // Convert recommendations to ContentItem format
    const recommendations: ContentItem[] = [];

    // Process each AI recommendation
    for (const item of data.titles) {
      // Skip items without title
      if (!item.title) {
        console.log(
          `[getSimilarContentTitles] Skipping item with missing title`,
        );
        continue;
      }

      console.log(`[getSimilarContentTitles] Processing "${item.title}"`);

      try {
        // Search OMDB for potential matches
        const searchResponse = await fetch(
          `/.netlify/functions/omdb?s=${encodeURIComponent(item.title)}`,
        );
        if (!searchResponse.ok) {
          console.error(
            `[getSimilarContentTitles] OMDB search failed for "${item.title}": ${searchResponse.status}`,
          );
          continue;
        }

        const searchData = await searchResponse.json();
        console.log(
          `[getSimilarContentTitles] OMDB search for "${item.title}":`,
          searchData.Response === "True"
            ? `Found ${searchData.Search?.length} results`
            : "No results",
        );

        if (
          searchData.Response !== "True" ||
          !searchData.Search ||
          searchData.Search.length === 0
        ) {
          console.log(
            `[getSimilarContentTitles] No OMDB results for "${item.title}", trying simplified search`,
          );

          // Try simplified search with just the first word
          const simplifiedTitle = item.title.split(" ")[0];
          if (simplifiedTitle && simplifiedTitle.length > 2) {
            const simplifiedResponse = await fetch(
              `/.netlify/functions/omdb?s=${encodeURIComponent(simplifiedTitle)}`,
            );
            if (simplifiedResponse.ok) {
              const simplifiedData = await simplifiedResponse.json();

              if (
                simplifiedData.Response === "True" &&
                simplifiedData.Search &&
                simplifiedData.Search.length > 0
              ) {
                console.log(
                  `[getSimilarContentTitles] Found ${simplifiedData.Search.length} results with simplified search "${simplifiedTitle}"`,
                );

                // Find best match among simplified results
                const bestMatch = await findBestMatch(
                  item,
                  simplifiedData.Search,
                );

                if (bestMatch) {
                  // Create ContentItem from best match
                  const contentItem: ContentItem = {
                    id: bestMatch.imdbID || item.title,
                    imdb_id: bestMatch.imdbID,
                    title: bestMatch.Title || item.title,
                    poster_path:
                      bestMatch.Poster && bestMatch.Poster !== "N/A"
                        ? bestMatch.Poster
                        : "",
                    media_type: bestMatch.Type === "movie" ? "movie" : "tv",
                    vote_average: bestMatch.imdbRating
                      ? parseFloat(bestMatch.imdbRating)
                      : 0,
                    vote_count: bestMatch.imdbVotes
                      ? parseInt(bestMatch.imdbVotes.replace(/,/g, ""))
                      : 0,
                    genre_ids: [],
                    overview: bestMatch.Plot || item.synopsis || "",
                    synopsis: item.synopsis || bestMatch.Plot || "",
                    recommendationReason:
                      item.recommendationReason ||
                      item.reason ||
                      `Similar to ${title}`,
                    year: bestMatch.Year || item.year,
                    aiRecommended: true,
                  };

                  recommendations.push(contentItem);
                  console.log(
                    `[getSimilarContentTitles] Added "${contentItem.title}" from simplified search`,
                  );
                }
              }
            }
          }

          // If we still couldn't find a match, add the original AI recommendation
          if (
            !recommendations.some(
              (r) => r.title.toLowerCase() === item.title.toLowerCase(),
            )
          ) {
            const fallbackItem: ContentItem = {
              id: item.title,
              title: item.title,
              poster_path: item.poster || "",
              media_type: mediaType,
              vote_average: parseFloat(item.rating || "0") || 0,
              vote_count: 0,
              genre_ids: [],
              overview: item.synopsis || "",
              synopsis: item.synopsis || "",
              recommendationReason:
                item.recommendationReason ||
                item.reason ||
                `Similar to ${title}`,
              year: item.year,
              aiRecommended: true,
              needsVerification: true,
              originalAiData: item,
            };

            recommendations.push(fallbackItem);
            console.log(
              `[getSimilarContentTitles] Added original AI recommendation for "${item.title}" as fallback`,
            );
          }
        } else {
          // We have OMDB search results, find the best match
          const bestMatch = await findBestMatch(item, searchData.Search);

          if (bestMatch) {
            // Create ContentItem from best match
            const contentItem: ContentItem = {
              id: bestMatch.imdbID || item.title,
              imdb_id: bestMatch.imdbID,
              title: bestMatch.Title || item.title,
              poster_path:
                bestMatch.Poster && bestMatch.Poster !== "N/A"
                  ? bestMatch.Poster
                  : "",
              media_type: bestMatch.Type === "movie" ? "movie" : "tv",
              vote_average: bestMatch.imdbRating
                ? parseFloat(bestMatch.imdbRating)
                : 0,
              vote_count: bestMatch.imdbVotes
                ? parseInt(bestMatch.imdbVotes.replace(/,/g, ""))
                : 0,
              genre_ids: [],
              overview: bestMatch.Plot || item.synopsis || "",
              synopsis: item.synopsis || bestMatch.Plot || "",
              recommendationReason:
                item.recommendationReason ||
                item.reason ||
                `Similar to ${title}`,
              year: bestMatch.Year || item.year,
              aiRecommended: true,
            };

            recommendations.push(contentItem);
            console.log(
              `[getSimilarContentTitles] Added "${contentItem.title}" from OMDB search`,
            );
          }
        }
      } catch (error) {
        console.error(
          `[getSimilarContentTitles] Error processing "${item.title}":`,
          error,
        );

        // Add the original AI recommendation as fallback
        const fallbackItem: ContentItem = {
          id: item.title,
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
          needsVerification: true,
          originalAiData: item,
        };

        recommendations.push(fallbackItem);
        console.log(
          `[getSimilarContentTitles] Added original AI recommendation for "${item.title}" due to error`,
        );
      }

      // Stop once we have enough recommendations
      if (recommendations.length >= limit) {
        break;
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
/**
 * Get personalized recommendations based on user preferences
 * @param preferences User preferences object
 * @param limit Maximum number of recommendations to return
 * @param forceAi Whether to force using AI recommendations (default: true)
 * @returns Array of content items as recommendations
 */
export async function getPersonalizedRecommendations(
  preferences: any,
  limit: number = 10,
  forceAi: boolean = true,
): Promise<ContentItem[]> {
  try {
    console.log(
      `[getPersonalizedRecommendations] Getting recommendations based on preferences`,
    );

    // If we have AI recommendations from the quiz and if the AI call was successful
    if (
      preferences.isAiRecommendationSuccess &&
      preferences.aiRecommendations &&
      preferences.aiRecommendations.length > 0
    ) {
      console.log(
        "Using AI recommendations from quiz",
        preferences.aiRecommendations,
      );
    }

    // Call the Netlify function to get personalized recommendations
    // Always use AI for personalized recommendations
    const response = await fetch("/.netlify/functions/ai-recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences,
        limit: limit * 2, // Request more items than needed to account for filtering
        forceAi: true, // Always force AI for personalized recommendations
        // Always skip IMDB IDs from the AI - we'll verify ourselves
        skipImdbId: true,
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

    // Log the raw recommendations from the API with full details
    console.log("========== RAW AI RECOMMENDATIONS ==========");
    console.log(JSON.stringify(data.recommendations.slice(0, 3), null, 2));
    console.log("===========================================");

    // Convert recommendations to ContentItem format and prepare for verification
    const rawRecommendations = [];

    for (const item of data.recommendations) {
      // Skip items without title
      if (!item.title) {
        console.log(
          `[getPersonalizedRecommendations] Skipping item with missing title`,
        );
        continue;
      }

      // Log each item's fields for debugging
      console.log(`Processing recommendation: ${item.title}`, {
        title: item.title,
        year: item.year,
        synopsis: item.synopsis || "No synopsis available",
        reason: item.reason,
        recommendationReason: item.recommendationReason,
        contentRating: item.contentRating || item.content_rating,
      });

      // Make sure we capture the synopsis from the AI recommendation
      const synopsis = item.synopsis || "";

      // Determine content rating - for TV shows, default to TV-14 if not specified
      // This helps with filtering when the API doesn't return content ratings
      let contentRating = item.contentRating || item.content_rating;
      if (!contentRating && item.type === "tv") {
        // Default TV shows to TV-14 unless explicitly rated otherwise
        contentRating = "TV-14";
      }

      rawRecommendations.push({
        id: item.title, // Use title as ID since we don't have IMDB ID yet
        title: item.title,
        year: item.year,
        synopsis: synopsis, // Ensure we capture the synopsis
        overview: synopsis, // Also store as overview
        reason:
          item.reason ||
          item.recommendationReason ||
          "Matches your preferences",
        recommendationReason:
          item.recommendationReason ||
          item.reason ||
          "Matches your preferences",
        type: item.type || "movie",
        rating: item.rating || "0",
        poster: item.poster || "",
        contentRating: contentRating,
        content_rating: contentRating,
      });

      // Stop once we have enough recommendations
      if (rawRecommendations.length >= limit) {
        break;
      }
    }

    console.log(
      `[getPersonalizedRecommendations] Processing ${rawRecommendations.length} recommendations for verification`,
    );

    // Process all recommendations upfront
    const verifiedRecommendations =
      await verifyAllRecommendations(rawRecommendations);

    console.log(
      `[getPersonalizedRecommendations] Returning ${verifiedRecommendations.length} verified recommendations`,
    );
    return verifiedRecommendations;
  } catch (error) {
    console.error(
      "[getPersonalizedRecommendations] Error getting personalized recommendations:",
      error,
    );
    return [];
  }
}

/**
 * Verify all recommendations upfront before displaying them
 * @param recommendations Raw recommendations from AI
 * @returns Verified ContentItem[] with OMDB data
 */
async function verifyAllRecommendations(
  recommendations: any[],
): Promise<ContentItem[]> {
  const verifiedItems: ContentItem[] = [];
  const failedItems: any[] = [];

  // Process recommendations in batches to avoid overwhelming the API
  const batchSize = 3;
  const batches = [];

  for (let i = 0; i < recommendations.length; i += batchSize) {
    batches.push(recommendations.slice(i, i + batchSize));
  }

  console.log(
    `[verifyAllRecommendations] Processing ${batches.length} batches of recommendations`,
  );

  for (const [batchIndex, batch] of batches.entries()) {
    console.log(
      `[verifyAllRecommendations] Processing batch ${batchIndex + 1} of ${batches.length}`,
    );

    // Process each batch sequentially to avoid rate limiting
    const batchResults = await Promise.all(
      batch.map(async (recommendation) => {
        try {
          console.log(
            `[verifyAllRecommendations] Processing "${recommendation.title}"`,
          );

          // Step 1: Search OMDB for potential matches by title
          const searchQuery = recommendation.year
            ? `${recommendation.title} ${recommendation.year}`
            : recommendation.title;

          console.log(
            `[verifyAllRecommendations] Searching OMDB for "${searchQuery}"`,
          );

          const searchResponse = await fetch(
            `/.netlify/functions/omdb?s=${encodeURIComponent(searchQuery)}`,
          );

          if (!searchResponse.ok) {
            console.error(
              `[verifyAllRecommendations] OMDB search failed for "${searchQuery}": ${searchResponse.status}`,
            );
            return { success: false, recommendation };
          }

          const searchData = await searchResponse.json();
          let searchResults = [];

          if (
            searchData.Response !== "True" ||
            !searchData.Search ||
            searchData.Search.length === 0
          ) {
            console.log(
              `[verifyAllRecommendations] No results found for "${searchQuery}", trying without year`,
            );

            // Try without year if no results
            if (recommendation.year) {
              const fallbackResponse = await fetch(
                `/.netlify/functions/omdb?s=${encodeURIComponent(recommendation.title)}`,
              );

              if (!fallbackResponse.ok) {
                console.error(
                  `[verifyAllRecommendations] Fallback OMDB search failed for "${recommendation.title}": ${fallbackResponse.status}`,
                );
                return { success: false, recommendation };
              }

              const fallbackData = await fallbackResponse.json();

              if (
                fallbackData.Response !== "True" ||
                !fallbackData.Search ||
                fallbackData.Search.length === 0
              ) {
                console.log(
                  `[verifyAllRecommendations] No results found for "${recommendation.title}" even without year`,
                );
                return { success: false, recommendation };
              }

              searchResults = fallbackData.Search;
            } else {
              console.log(
                `[verifyAllRecommendations] No results found for "${recommendation.title}"`,
              );
              return { success: false, recommendation };
            }
          } else {
            searchResults = searchData.Search;
          }

          console.log(
            `[verifyAllRecommendations] Found ${searchResults.length} potential matches for "${recommendation.title}"`,
          );

          // Step 2: Get detailed info for potential matches (limit to top 5)
          const potentialMatches = [];
          const maxMatches = Math.min(5, searchResults.length);

          for (let i = 0; i < maxMatches; i++) {
            const match = searchResults[i];
            try {
              const detailResponse = await fetch(
                `/.netlify/functions/omdb?i=${match.imdbID}&plot=full`,
              );

              if (!detailResponse.ok) continue;

              const detailData = await detailResponse.json();
              if (detailData.Response === "True") {
                potentialMatches.push({
                  title: detailData.Title,
                  year: detailData.Year,
                  type: detailData.Type,
                  imdbID: detailData.imdbID,
                  plot: detailData.Plot,
                  actors: detailData.Actors,
                  director: detailData.Director,
                  genre: detailData.Genre,
                  poster: detailData.Poster !== "N/A" ? detailData.Poster : "",
                });
              }
            } catch (error) {
              console.error(
                `[verifyAllRecommendations] Error getting details for ${match.imdbID}:`,
                error,
              );
            }
          }

          if (potentialMatches.length === 0) {
            console.log(
              `[verifyAllRecommendations] No detailed matches found for "${recommendation.title}"`,
            );
            return { success: false, recommendation };
          }

          console.log(
            `[verifyAllRecommendations] Got ${potentialMatches.length} detailed matches for "${recommendation.title}"`,
          );

          // Step 3: If there's only one potential match, use it directly without AI verification
          if (potentialMatches.length === 1) {
            console.log(
              `[verifyAllRecommendations] Only one potential match found for "${recommendation.title}", using it directly`,
            );

            // Create a ContentItem from the single match
            const singleMatch = potentialMatches[0];
            const contentItem = {
              id: singleMatch.imdbID,
              imdb_id: singleMatch.imdbID,
              title: singleMatch.title,
              poster_path:
                singleMatch.poster !== "N/A" ? singleMatch.poster : "",
              media_type: singleMatch.type === "movie" ? "movie" : "tv",
              vote_average: 0,
              vote_count: 0,
              genre_ids: [],
              genre_strings: singleMatch.genre
                ? singleMatch.genre.split(", ")
                : [],
              overview: singleMatch.plot || "",
              synopsis: recommendation.synopsis || singleMatch.plot || "",
              recommendationReason: recommendation.recommendationReason,
              reason: recommendation.reason,
              aiRecommended: true,
              verified: true,
            };

            return { success: true, item: contentItem };
          }

          // For multiple potential matches, use AI to find the best match
          console.log(
            `[verifyAllRecommendations] Using AI to match "${recommendation.title}" with ${potentialMatches.length} potential matches`,
          );

          // Log the synopsis being sent to the AI for matching
          console.log(
            `[verifyAllRecommendations] Synopsis for "${recommendation.title}": ${recommendation.synopsis?.substring(0, 100)}${recommendation.synopsis?.length > 100 ? "..." : ""}`,
          );

          const aiMatchResponse = await matchRecommendationWithOmdbResults(
            {
              title: recommendation.title,
              year: recommendation.year,
              reason: recommendation.reason,
              synopsis: recommendation.synopsis, // Make sure to include synopsis
            },
            potentialMatches,
          );

          if (!aiMatchResponse) {
            console.log(
              `[verifyAllRecommendations] AI couldn't find a match for "${recommendation.title}"`,
            );
            return { success: false, recommendation };
          }

          console.log(
            `[verifyAllRecommendations] AI matched "${recommendation.title}" with "${aiMatchResponse.title}" (${aiMatchResponse.imdb_id})`,
          );

          // Step 4: Add the verified recommendation to our results
          // Preserve the original recommendation reason
          aiMatchResponse.recommendationReason =
            recommendation.recommendationReason;
          aiMatchResponse.reason = recommendation.reason;
          aiMatchResponse.aiRecommended = true;
          aiMatchResponse.verified = true;

          return { success: true, item: aiMatchResponse };
        } catch (error) {
          console.error(
            `[verifyAllRecommendations] Error processing "${recommendation.title}":`,
            error,
          );
          return { success: false, recommendation };
        }
      }),
    );

    // Process batch results
    for (const result of batchResults) {
      if (result.success) {
        verifiedItems.push(result.item);
      } else {
        failedItems.push(result.recommendation);
      }
    }

    // Add a small delay between batches to avoid rate limiting
    if (batchIndex < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(
    `[verifyAllRecommendations] Successfully verified ${verifiedItems.length} items`,
  );
  console.log(
    `[verifyAllRecommendations] Failed to verify ${failedItems.length} items`,
  );

  return verifiedItems;
}

/**
 * Calculate similarity between two text strings
 * @param text1 First text string
 * @param text2 Second text string
 * @returns Similarity score between 0 and 1
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  // Normalize texts: lowercase, remove punctuation, extra spaces
  const normalize = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const normalizedText1 = normalize(text1);
  const normalizedText2 = normalize(text2);

  // Create word sets
  const words1 = new Set(
    normalizedText1.split(/\s+/).filter((w) => w.length > 2),
  );
  const words2 = new Set(
    normalizedText2.split(/\s+/).filter((w) => w.length > 2),
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  // Calculate intersection
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  // Jaccard similarity: intersection / union
  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

/**
 * Verify a recommendation by comparing AI data with OMDB results
 * @param item The recommendation item to verify
 * @returns A verified ContentItem with OMDB data or the original item if verification fails
 */
export async function verifyRecommendationWithOmdb(
  item: ContentItem,
): Promise<ContentItem | null> {
  try {
    console.log(`[verifyRecommendationWithOmdb] Verifying "${item.title}"`);

    // Get the AI data
    const aiTitle = item.title;
    const aiSynopsis = item.synopsis || item.overview || "";
    const aiYear =
      item.year ||
      (item.release_date ? item.release_date.substring(0, 4) : null);
    const aiReason = item.recommendationReason || item.reason;
    const aiImdbId = item.imdb_id || null;
    const aiImdbUrl = item.imdb_url || null;

    console.log(
      `[verifyRecommendationWithOmdb] AI data: Title="${aiTitle}", Year=${aiYear || "unknown"}, IMDB ID=${aiImdbId || "none"}, IMDB URL=${aiImdbUrl || "none"}`,
    );

    // Extract IMDB ID from URL if available
    let extractedImdbId = null;
    if (aiImdbUrl) {
      const urlMatch = aiImdbUrl.match(/\/title\/(tt\d+)/i);
      if (urlMatch && urlMatch[1]) {
        extractedImdbId = urlMatch[1];
        console.log(
          `[verifyRecommendationWithOmdb] Extracted IMDB ID from URL: ${extractedImdbId}`,
        );
      }
    }

    // Check if the IDs don't match and log a warning
    if (aiImdbId && extractedImdbId && aiImdbId !== extractedImdbId) {
      console.warn(
        `[verifyRecommendationWithOmdb] WARNING: IMDB ID mismatch between provided ID (${aiImdbId}) and URL-extracted ID (${extractedImdbId})`,
      );
    }

    // ALWAYS try direct IMDB ID lookup first if available
    if (aiImdbId || extractedImdbId) {
      const imdbIds = [aiImdbId, extractedImdbId].filter(Boolean) as string[];
      const uniqueImdbIds = [...new Set(imdbIds)];

      console.log(
        `[verifyRecommendationWithOmdb] Attempting lookup with ${uniqueImdbIds.length} unique IMDB IDs: ${uniqueImdbIds.join(", ")}`,
      );

      for (const imdbId of uniqueImdbIds) {
        console.log(
          `[verifyRecommendationWithOmdb] Trying direct IMDB ID lookup: ${imdbId}`,
        );
        const response = await fetch(
          `/.netlify/functions/omdb?i=${imdbId}&plot=full`,
        );

        if (!response.ok) {
          console.error(
            `[verifyRecommendationWithOmdb] OMDB API error for IMDB ID ${imdbId}: ${response.status} ${response.statusText}`,
          );
          continue; // Try next IMDB ID if available
        }

        const data = await response.json();
        if (data && data.Response === "True") {
          // For IMDB ID lookups, we trust the result more but still verify the title
          const similarity = calculateTitleSimilarity(aiTitle, data.Title);
          console.log(
            `[verifyRecommendationWithOmdb] Title similarity for "${data.Title}" (${imdbId}): ${similarity.toFixed(2)}`,
          );

          // Create the content item regardless of similarity score
          const contentItem = convertOmdbToContentItem(data);
          contentItem.recommendationReason = aiReason || "Recommended for you";
          contentItem.reason = aiReason || "Recommended for you";
          contentItem.synopsis = aiSynopsis || data.Plot;
          contentItem.verified = true;
          contentItem.similarityScore = similarity;
          contentItem.imdb_url = aiImdbUrl; // Preserve the original IMDB URL

          // If similarity is high, it's a confident match
          if (similarity >= 0.8) {
            console.log(
              `[verifyRecommendationWithOmdb] Found good match by IMDB ID: "${data.Title}" (${similarity.toFixed(2)})`,
            );
          } else {
            // Even with low similarity, we trust the IMDB ID but mark it as low confidence
            console.log(
              `[verifyRecommendationWithOmdb] Using IMDB match despite lower similarity score: "${data.Title}" (${similarity.toFixed(2)})`,
            );
            contentItem.lowConfidenceMatch = true;
          }

          // Return the content item from IMDB ID lookup regardless of similarity
          // This prioritizes IMDB ID over title matching
          return contentItem;
        } else {
          console.log(
            `[verifyRecommendationWithOmdb] IMDB ID ${imdbId} returned no valid data: ${JSON.stringify(data)}`,
          );
        }
      }
    }

    // If IMDB ID lookup failed or had low similarity, search by title
    console.log(
      `[verifyRecommendationWithOmdb] IMDB ID lookup failed or had low similarity. Searching by title: "${aiTitle}"${aiYear ? ` (${aiYear})` : ""}`,
    );
    const searchQuery = aiYear ? `${aiTitle} ${aiYear}` : aiTitle;
    const response = await fetch(
      `/.netlify/functions/omdb?s=${encodeURIComponent(searchQuery)}`,
    );

    if (!response.ok) {
      console.error(
        `[verifyRecommendationWithOmdb] OMDB search failed: ${response.status} ${response.statusText}`,
      );

      // Return the original item with verification status
      console.log(
        `[verifyRecommendationWithOmdb] Returning original item with verification status due to API error`,
      );
      return {
        ...item,
        verified: false,
        similarityScore: 0,
        needsUserSelection: true,
        verificationError: `API error: ${response.status} ${response.statusText}`,
        imdb_url: aiImdbUrl, // Preserve the IMDB URL
      };
    }

    const data = await response.json();

    if (data.Response !== "True" || !data.Search || data.Search.length === 0) {
      console.log(
        `[verifyRecommendationWithOmdb] No results found for "${aiTitle}"${aiYear ? ` (${aiYear})` : ""}`,
      );

      // Try a more lenient search without the year
      if (aiYear) {
        console.log(
          `[verifyRecommendationWithOmdb] Trying search without year: "${aiTitle}"`,
        );
        const altResponse = await fetch(
          `/.netlify/functions/omdb?s=${encodeURIComponent(aiTitle)}`,
        );

        if (!altResponse.ok) {
          console.error(
            `[verifyRecommendationWithOmdb] Alternative search failed: ${altResponse.status} ${altResponse.statusText}`,
          );
          return {
            ...item,
            verified: false,
            similarityScore: 0,
            needsUserSelection: true,
            verificationError: `API error: ${altResponse.status} ${altResponse.statusText}`,
            imdb_url: aiImdbUrl, // Preserve the IMDB URL
          };
        }

        const altData = await altResponse.json();
        if (
          altData.Response === "True" &&
          altData.Search &&
          altData.Search.length > 0
        ) {
          console.log(
            `[verifyRecommendationWithOmdb] Found ${altData.Search.length} results without year for "${aiTitle}"`,
          );

          // If we have multiple results, let the user choose
          if (altData.Search.length > 1) {
            console.log(
              `[verifyRecommendationWithOmdb] Multiple results found (${altData.Search.length}), returning for user selection`,
            );
            return {
              ...item,
              verified: false,
              similarityScore: 0,
              needsUserSelection: true,
              potentialMatches: altData.Search.slice(0, 5), // Limit to top 5
              imdb_url: aiImdbUrl, // Preserve the IMDB URL
            };
          }

          // If only one result, get full details
          console.log(
            `[verifyRecommendationWithOmdb] Single result found, getting full details for ${altData.Search[0].imdbID}`,
          );
          const detailResponse = await fetch(
            `/.netlify/functions/omdb?i=${altData.Search[0].imdbID}&plot=full`,
          );
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            if (detailData && detailData.Response === "True") {
              const contentItem = convertOmdbToContentItem(detailData);
              contentItem.recommendationReason =
                aiReason || "Recommended for you";
              contentItem.reason = aiReason || "Recommended for you";
              contentItem.synopsis = aiSynopsis || detailData.Plot;
              contentItem.verified = true;
              contentItem.similarityScore = 0.5; // Medium confidence
              contentItem.imdb_url = aiImdbUrl; // Preserve the IMDB URL

              console.log(
                `[verifyRecommendationWithOmdb] Using single result match: "${contentItem.title}" with medium confidence`,
              );
              return contentItem;
            } else {
              console.error(
                `[verifyRecommendationWithOmdb] Failed to get details for single result: ${JSON.stringify(detailData)}`,
              );
            }
          } else {
            console.error(
              `[verifyRecommendationWithOmdb] Failed to fetch details for single result: ${detailResponse.status} ${detailResponse.statusText}`,
            );
          }
        }
      }

      // Try a fuzzy search with just the first few words of the title
      const firstFewWords = aiTitle.split(" ").slice(0, 2).join(" ");
      if (firstFewWords.length > 3 && firstFewWords !== aiTitle) {
        console.log(
          `[verifyRecommendationWithOmdb] Trying fuzzy search with first few words: "${firstFewWords}"`,
        );
        const fuzzyResponse = await fetch(
          `/.netlify/functions/omdb?s=${encodeURIComponent(firstFewWords)}`,
        );

        if (fuzzyResponse.ok) {
          const fuzzyData = await fuzzyResponse.json();
          if (
            fuzzyData.Response === "True" &&
            fuzzyData.Search &&
            fuzzyData.Search.length > 0
          ) {
            console.log(
              `[verifyRecommendationWithOmdb] Found ${fuzzyData.Search.length} results with fuzzy search`,
            );
            return {
              ...item,
              verified: false,
              similarityScore: 0,
              needsUserSelection: true,
              potentialMatches: fuzzyData.Search.slice(0, 5), // Limit to top 5
              fuzzySearch: true,
              imdb_url: aiImdbUrl, // Preserve the IMDB URL
            };
          }
        }
      }

      // As a last resort, return the original item with verification status
      console.log(
        `[verifyRecommendationWithOmdb] All search attempts failed, returning original item with verification status`,
      );
      return {
        ...item,
        verified: false,
        similarityScore: 0,
        needsUserSelection: true,
        verificationError: "No matching content found",
        imdb_url: aiImdbUrl, // Preserve the IMDB URL
      };
    }

    console.log(
      `[verifyRecommendationWithOmdb] Found ${data.Search.length} results for "${aiTitle}"${aiYear ? ` (${aiYear})` : ""}`,
    );

    // Calculate similarity for all results and sort by similarity
    const scoredResults = data.Search.map((result) => {
      const similarity = calculateTitleSimilarity(aiTitle, result.Title);
      return { result, similarity };
    }).sort((a, b) => b.similarity - a.similarity);

    console.log(
      `[verifyRecommendationWithOmdb] Top 3 matches by similarity:`,
      scoredResults
        .slice(0, 3)
        .map(
          (item) =>
            `"${item.result.Title}" (${item.result.Year}) - Score: ${item.similarity.toFixed(2)}`,
        ),
    );

    // If we have results with high similarity, use the best one
    const highSimilarityMatches = scoredResults.filter(
      (item) => item.similarity > 0.8,
    );

    if (highSimilarityMatches.length > 0) {
      const bestMatch = highSimilarityMatches[0];
      console.log(
        `[verifyRecommendationWithOmdb] Using best match with high similarity: "${bestMatch.result.Title}" (${bestMatch.similarity.toFixed(2)})`,
      );

      // Get full details for the best match
      const detailResponse = await fetch(
        `/.netlify/functions/omdb?i=${bestMatch.result.imdbID}&plot=full`,
      );

      if (detailResponse.ok) {
        const detailData = await detailResponse.json();
        if (detailData && detailData.Response === "True") {
          const contentItem = convertOmdbToContentItem(detailData);
          contentItem.recommendationReason = aiReason || "Recommended for you";
          contentItem.reason = aiReason || "Recommended for you";
          contentItem.synopsis = aiSynopsis || detailData.Plot;
          contentItem.verified = true;
          contentItem.similarityScore = bestMatch.similarity;
          contentItem.imdb_url = aiImdbUrl; // Preserve the IMDB URL

          return contentItem;
        }
      }
    }

    // If we have multiple potential matches but none with high similarity, let the user choose
    console.log(
      `[verifyRecommendationWithOmdb] No high similarity matches found, returning top results for user selection`,
    );
    return {
      ...item,
      verified: false,
      similarityScore:
        scoredResults.length > 0 ? scoredResults[0].similarity : 0,
      needsUserSelection: true,
      potentialMatches: data.Search.slice(0, 5), // Limit to top 5
      imdb_url: aiImdbUrl, // Preserve the IMDB URL
    };
  } catch (error) {
    console.error(
      "[verifyRecommendationWithOmdb] Error verifying recommendation:",
      error,
    );
    // Return the original item with error information
    return {
      ...item,
      verified: false,
      similarityScore: 0,
      needsUserSelection: true,
      verificationError:
        error instanceof Error
          ? error.message
          : "Unknown error during verification",
      imdb_url: item.imdb_url, // Preserve the IMDB URL
    };
  }
}

/**
 * Calculate similarity between two titles
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;

  // Normalize titles: lowercase, remove special characters
  const normalize = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const normalizedTitle1 = normalize(title1);
  const normalizedTitle2 = normalize(title2);

  // Check for exact match
  if (normalizedTitle1 === normalizedTitle2) return 1.0;

  // Check for suspicious titles that contain multiple titles
  if (
    title1.includes(",") ||
    title1.includes(";") ||
    title1.includes("|") ||
    title2.includes(",") ||
    title2.includes(";") ||
    title2.includes("|") ||
    title1.length > 50 ||
    title2.length > 50
  ) {
    console.log(
      `[calculateTitleSimilarity] Suspicious title detected, reducing similarity score`,
    );
    return 0.5; // Reduce similarity for suspicious titles
  }

  // Check if one is an exact substring of the other (only for short titles)
  // This helps with cases like "Signal" vs "Smoke Signals"
  if (normalizedTitle1.length > 3 && normalizedTitle2.length > 3) {
    // Only consider exact substring matches if the titles are significantly different in length
    // This prevents "Signal" from matching with "Smoke Signals"
    const lengthRatio =
      Math.min(normalizedTitle1.length, normalizedTitle2.length) /
      Math.max(normalizedTitle1.length, normalizedTitle2.length);

    // If one title is less than 70% the length of the other, don't consider substring matches
    if (lengthRatio < 0.7) {
      if (
        normalizedTitle1.includes(normalizedTitle2) ||
        normalizedTitle2.includes(normalizedTitle1)
      ) {
        // Reduce similarity score for partial matches
        return 0.7;
      }
    }
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
 * Convert OMDB data to ContentItem format
 */
function convertOmdbToContentItem(omdbData: any): ContentItem {
  return {
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
    genre_strings: omdbData.Genre ? omdbData.Genre.split(", ") : [],
    overview: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
    content_rating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
    year: omdbData.Year,
    release_date:
      omdbData.Released !== "N/A" ? omdbData.Released : omdbData.Year,
    runtime: omdbData.Runtime !== "N/A" ? omdbData.Runtime : "",
    director: omdbData.Director !== "N/A" ? omdbData.Director : "",
    actors: omdbData.Actors !== "N/A" ? omdbData.Actors : "",
    poster: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
    contentRating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
  };
}

/**
 * Find the best match for an AI recommendation from OMDB search results
 * @param aiItem The AI recommendation item
 * @param omdbResults Array of OMDB search results
 * @returns The best matching OMDB result or null if no good match found
 */
async function findBestMatch(aiItem: any, omdbResults: any[]): Promise<any> {
  if (!omdbResults || omdbResults.length === 0) return null;

  // Get the synopsis from the AI item
  const aiSynopsis = aiItem.synopsis || aiItem.overview || "";
  const aiTitle = aiItem.title || "";

  // We can now proceed without synopsis
  if (!aiSynopsis) {
    console.log(
      `[findBestMatch] No synopsis available for \"${aiTitle}\", can't compare`,
    );
    console.error(
      `[findBestMatch] CRITICAL ERROR: Missing synopsis for \"${aiTitle}\"`,
    );
    // Return null to indicate verification failed - no fallbacks!
    return null;
  }

  // If we have a synopsis, proceed with normal matching logic
  console.log(
    `[findBestMatch] Using synopsis for "${aiTitle}": "${aiSynopsis.substring(0, 100)}..."`,
  );

  console.log(
    `[findBestMatch] Finding best match for "${aiTitle}" among ${omdbResults.length} results`,
  );

  // Get full details for each candidate to compare plots
  const detailedCandidates: ContentItem[] = [];

  // Check all candidates to ensure we don't miss the right match
  const maxCandidates = omdbResults.length;

  for (let i = 0; i < maxCandidates; i++) {
    const candidate = omdbResults[i];
    try {
      const details = await getFullDetails(candidate.imdbID);
      if (details && details.Plot && details.Plot !== "N/A") {
        // Get the AI synopsis to compare
        const aiSynopsisToCompare = aiSynopsis;
        const omdbPlot = details.Plot;

        // Calculate similarity between AI synopsis and OMDB plot
        const similarity = calculateTextSimilarity(
          aiSynopsisToCompare,
          omdbPlot,
        );

        console.log(
          `[findBestMatch] "${details.Title}" (${details.Year}) - Similarity: ${similarity.toFixed(2)}`,
        );
        console.log(
          `[findBestMatch] Comparing:\nAI Synopsis: "${aiSynopsisToCompare.substring(0, 100)}..."\nOMDB Plot: "${omdbPlot.substring(0, 100)}..."`,
        );

        detailedCandidates.push({
          id: details.imdbID,
          imdb_id: details.imdbID,
          title: details.Title,
          poster_path: details.Poster !== "N/A" ? details.Poster : "",
          media_type: details.Type === "movie" ? "movie" : "tv",
          vote_average:
            details.imdbRating !== "N/A" ? parseFloat(details.imdbRating) : 0,
          vote_count:
            details.imdbVotes !== "N/A"
              ? parseInt(details.imdbVotes.replace(/,/g, ""))
              : 0,
          genre_ids: [],
          genre_strings: details.Genre?.split(", ") || [],
          overview: details.Plot,
          content_rating: details.Rated !== "N/A" ? details.Rated : "",
          year: details.Year,
          similarityScore: similarity,
          recommendationReason:
            aiItem.recommendationReason || aiItem.reason || null,
          reason: aiItem.reason || aiItem.recommendationReason || null,
        });
      }
    } catch (error) {
      console.error(
        `[findBestMatch] Error getting details for ${candidate.imdbID}:`,
        error,
      );
    }
  }

  // Sort by similarity score
  detailedCandidates.sort(
    (a, b) => (b.similarityScore || 0) - (a.similarityScore || 0),
  );

  // Return the best match if it exists
  if (detailedCandidates.length > 0) {
    console.log(
      `[findBestMatch] Best match: "${detailedCandidates[0].title}" with score ${detailedCandidates[0].similarityScore}`,
    );
    return detailedCandidates[0];
  }

  return null;
}

/**
 * Find the best match by comparing synopsis with plot from OMDB
 * @param aiTitle The title from AI recommendation
 * @param aiSynopsis The synopsis from AI recommendation
 * @param aiYear The year from AI recommendation (optional)
 * @param omdbResults Array of OMDB search results
 * @returns The best matching ContentItem or null if no good match found
 */
async function findBestMatchWithSynopsis(
  aiTitle: string,
  aiSynopsis: string,
  aiYear: string | null,
  omdbResults: any[],
): Promise<ContentItem | null> {
  if (!omdbResults || omdbResults.length === 0) return null;

  console.log(
    `[findBestMatchWithSynopsis] Finding best match for "${aiTitle}" among ${omdbResults.length} results`,
  );

  // First, check if we're looking for a Korean drama/show
  const knownKdramas = [
    "Vagabond",
    "Healer",
    "City Hunter",
    "Signal",
    "Kingdom",
    "Extracurricular",
    "The K2",
    "Lawless Lawyer",
    "Strangers from Hell",
    "Mouse",
    "Taxi Driver",
    "Through the Darkness",
    "Defendant",
    "Remember: War of the Son",
  ];

  const isLikelySeries =
    aiSynopsis.toLowerCase().includes("series") ||
    aiSynopsis.toLowerCase().includes("episode") ||
    aiSynopsis.toLowerCase().includes("season");

  // Force media type to TV for known K-dramas
  if (knownKdramas.includes(aiTitle)) {
    console.log(
      `[findBestMatchWithSynopsis] Forcing media type to TV for known K-drama: ${aiTitle}`,
    );
    // This will help prioritize TV series in the search results
    return "tv";
  }

  // Then filter by year if available
  let candidates = omdbResults;
  if (aiYear && candidates.length > 1) {
    const yearMatches = candidates.filter((result) => {
      // Handle year ranges like "2019–2022" in TV shows
      const resultYear = result.Year.split("–")[0];
      return resultYear === aiYear.toString();
    });

    if (yearMatches.length > 0) {
      console.log(
        `[findBestMatchWithSynopsis] Found ${yearMatches.length} year matches for ${aiYear}`,
      );
      candidates = yearMatches;
    }
  }

  // Get full details for each candidate to compare plots
  const detailedCandidates: ContentItem[] = [];

  // Limit to top 5 candidates to avoid too many API calls
  const maxCandidates = Math.min(candidates.length, 5);

  for (let i = 0; i < maxCandidates; i++) {
    const candidate = candidates[i];
    try {
      const details = await getFullDetails(candidate.imdbID);
      if (details && details.Plot && details.Plot !== "N/A") {
        const similarity = calculateTextSimilarity(aiSynopsis, details.Plot);
        console.log(
          `[findBestMatchWithSynopsis] "${details.Title}" (${details.Year}) - Similarity: ${similarity.toFixed(2)}`,
        );
        console.log(
          `[findBestMatchWithSynopsis] Comparing:\nAI Synopsis: "${aiSynopsis.substring(0, 100)}..."\nOMDB Plot: "${details.Plot.substring(0, 100)}..."`,
        );
        detailedCandidates.push({
          id: details.imdbID,
          imdb_id: details.imdbID,
          title: details.Title,
          poster_path: details.Poster !== "N/A" ? details.Poster : "",
          media_type: details.Type === "movie" ? "movie" : "tv",
          vote_average:
            details.imdbRating !== "N/A" ? parseFloat(details.imdbRating) : 0,
          vote_count:
            details.imdbVotes !== "N/A"
              ? parseInt(details.imdbVotes.replace(/,/g, ""))
              : 0,
          genre_ids: [],
          genre_strings: details.Genre?.split(", ") || [],
          overview: details.Plot,
          content_rating: details.Rated !== "N/A" ? details.Rated : "",
          year: details.Year,
          similarityScore: similarity,
        });
      }
    } catch (error) {
      console.error(
        `[findBestMatchWithSynopsis] Error getting details for ${candidate.imdbID}:`,
        error,
      );
    }
  }

  // Sort by similarity score
  detailedCandidates.sort(
    (a, b) => (b.similarityScore || 0) - (a.similarityScore || 0),
  );

  // Return the best match if it exists
  if (detailedCandidates.length > 0) {
    console.log(
      `[findBestMatchWithSynopsis] Best match: "${detailedCandidates[0].title}" with score ${detailedCandidates[0].similarityScore}`,
    );
    return detailedCandidates[0];
  }

  // If no detailed candidates were found, fall back to the first result
  if (candidates.length > 0) {
    try {
      const details = await getFullDetails(candidates[0].imdbID);
      if (details) {
        return {
          id: details.imdbID,
          imdb_id: details.imdbID,
          title: details.Title,
          poster_path: details.Poster !== "N/A" ? details.Poster : "",
          media_type: details.Type === "movie" ? "movie" : "tv",
          vote_average:
            details.imdbRating !== "N/A" ? parseFloat(details.imdbRating) : 0,
          vote_count:
            details.imdbVotes !== "N/A"
              ? parseInt(details.imdbVotes.replace(/,/g, ""))
              : 0,
          genre_ids: [],
          genre_strings: details.Genre?.split(", ") || [],
          overview: details.Plot,
          content_rating: details.Rated !== "N/A" ? details.Rated : "",
          year: details.Year,
          similarityScore: 0,
        };
      }
    } catch (error) {
      console.error(
        `[findBestMatchWithSynopsis] Error getting fallback details:`,
        error,
      );
    }
  }

  return null;
}

/**
 * Get full details for a content item by IMDB ID
 * @param imdbId The IMDB ID
 * @returns Full content details
 */
async function getFullDetails(imdbId: string): Promise<any> {
  try {
    const params = new URLSearchParams({
      i: imdbId,
      plot: "full",
    });

    const response = await fetch(
      `/.netlify/functions/omdb?${params.toString()}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    return data && data.Response === "True" ? data : null;
  } catch (error) {
    console.error("Error getting full details:", error);
    return null;
  }
}

// Import the AI matching service
import { matchRecommendationWithOmdbResults } from "./aiMatchingService";

// Import the Supabase cache service
import {
  cacheRecommendationsInSupabase,
  getCachedRecommendationsFromSupabase,
  generateCacheKey,
} from "./supabaseRecommendationCache";

/**
 * Start background processing of recommendations
 * This function will continue running even if the component unmounts
 * and includes improved error handling and Supabase caching
 */
export const startBackgroundProcessing = async () => {
  console.log(
    `[RecommendationProcessingService] Starting background processing`,
  );

  // Create a worker-like function that will continue running even if component unmounts
  const backgroundWorker = async () => {
    try {
      // Get pending recommendations from localStorage
      const pendingRecsString = localStorage.getItem(
        "pendingRecommendationsToProcess",
      );
      if (!pendingRecsString) {
        console.log(
          "[RecommendationProcessingService] No pending recommendations to process",
        );
        return;
      }

      const pendingRecs = JSON.parse(pendingRecsString);
      console.log(
        `[RecommendationProcessingService] Found ${pendingRecs.length} pending recommendations to process`,
      );

      // Process each recommendation one by one
      for (const rec of pendingRecs) {
        try {
          // Process the recommendation
          const processedItem = await verifyRecommendationWithOmdb(rec);

          // Add a small delay between API calls to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (itemError) {
          console.error(
            `[RecommendationProcessingService] Error processing item ${rec.title}:`,
            itemError,
          );
          // Continue with next item instead of failing the entire batch
          continue;
        }
      }

      console.log(
        `[RecommendationProcessingService] Completed background processing for recommendations.`,
      );
    } catch (error) {
      console.error(
        "[RecommendationProcessingService] Background worker error:",
        error,
      );
    }
  };

  // Start the background worker and don't wait for it to complete
  backgroundWorker().catch((error) => {
    console.error(
      "[RecommendationProcessingService] Background worker error:",
      error,
    );
  });
};
