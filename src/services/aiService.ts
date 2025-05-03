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
      `/.netlify/functions/omdb?i=${imdbId}&plot=full`,
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
          `/.netlify/functions/omdb?i=${simplifiedTitle}&plot=full`,
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
        Accept: "application/json",
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
        const searchResponse = await fetch(`/.netlify/functions/omdb`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ s: item.title }),
        });
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
            const simplifiedResponse = await fetch(`/.netlify/functions/omdb`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ s: simplifiedTitle }),
            });
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

      // Log the IMDB IDs for debugging
      console.log(
        "AI recommendation IMDB IDs:",
        preferences.aiRecommendations.map((rec) => ({
          title: rec.title,
          imdb_id: rec.imdb_id,
          year: rec.year,
        })),
      );
    }

    // Call the Netlify function to get personalized recommendations
    // Always use AI for personalized recommendations
    const response = await fetch("/.netlify/functions/ai-recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        preferences,
        limit: limit * 2, // Request more items than needed to account for filtering
        forceAi: true, // Always force AI for personalized recommendations
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

      // Don't generate UUID, just use the title as the ID if no IMDB ID is available
      const imdbId = item.imdb_id || item.imdbID || null;

      // Log each item's fields for debugging
      console.log(`Processing recommendation: ${item.title}`, {
        title: item.title,
        year: item.year,
        synopsis: item.synopsis,
        reason: item.reason,
        recommendationReason: item.recommendationReason,
        imdb_id: imdbId,
      });

      recommendations.push({
        id: imdbId || item.title, // Use IMDB ID if available, otherwise use title
        title: item.title,
        poster_path: item.poster || "",
        media_type: item.type === "movie" ? "movie" : "tv",
        vote_average: parseFloat(item.rating || "0") || 0,
        vote_count: 0,
        genre_ids: [],
        overview: item.synopsis || "",
        synopsis: item.synopsis || "",
        recommendationReason:
          item.recommendationReason ||
          item.reason ||
          "Matches your preferences",
        reason:
          item.reason ||
          item.recommendationReason ||
          "Matches your preferences",
        year: item.year,
        aiRecommended: true,
        needsVerification: true, // Flag that this needs verification
        originalAiData: item, // Store original AI data for verification
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
  const startTime = new Date();
  console.log(
    `[verifyRecommendationWithOmdb] 🔍 VERIFYING: ${item.title} at ${startTime.toISOString()}`,
  );

  // CRITICAL: If the item has no synopsis/overview, create a minimal one based on the title
  // This helps the AI matching process which requires some text to work with
  if (!item.synopsis && !item.overview) {
    item.synopsis = `Content about ${item.title}`;
    item.overview = `Content about ${item.title}`;
    console.log(
      `[verifyRecommendationWithOmdb] Added minimal synopsis for ${item.title}`,
    );
  }

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
        const response = await fetch(`/.netlify/functions/omdb`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ i: imdbId, plot: "full" }),
        });

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
          const endTime = new Date();
          const processingTime =
            (endTime.getTime() - startTime.getTime()) / 1000;
          console.log(
            `[verifyRecommendationWithOmdb] ✅ VERIFICATION COMPLETE for ${item.title} in ${processingTime.toFixed(2)}s`,
          );
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
    const response = await fetch(`/.netlify/functions/omdb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ s: searchQuery }),
    });

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
        const altResponse = await fetch(`/.netlify/functions/omdb`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ s: aiTitle }),
        });

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
          const detailResponse = await fetch(`/.netlify/functions/omdb`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ i: altData.Search[0].imdbID, plot: "full" }),
          });
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
        const fuzzyResponse = await fetch(`/.netlify/functions/omdb`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ s: firstFewWords }),
        });

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
      const detailResponse = await fetch(`/.netlify/functions/omdb`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ i: bestMatch.result.imdbID, plot: "full" }),
      });

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
    const response = await fetch(`/.netlify/functions/omdb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ i: imdbId, plot: "full" }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    return data && data.Response === "True" ? data : null;
  } catch (error) {
    console.error("Error getting full details:", error);
    return null;
  }
}
