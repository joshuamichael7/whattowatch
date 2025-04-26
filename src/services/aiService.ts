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

      // Don't generate UUID, just use the title as the ID if no IMDB ID is available
      const imdbId = item.imdb_id || item.imdbID || null;

      // Log each item's fields for debugging
      console.log(`Processing recommendation: ${item.title}`, {
        title: item.title,
        year: item.year,
        synopsis: item.synopsis,
        reason: item.reason,
        imdb_id: imdbId,
      });

      recommendations.push({
        id: imdbId, // Only use IMDB ID if available, otherwise null
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
  try {
    console.log(`[verifyRecommendationWithOmdb] Verifying "${item.title}"`);

    // Get the original AI data if available
    const aiTitle = item.title;
    const aiSynopsis = item.synopsis || item.overview || "";
    const aiYear =
      item.year ||
      (item.release_date ? item.release_date.substring(0, 4) : null);
    const aiReason = item.recommendationReason || item.reason;

    console.log(
      `[verifyRecommendationWithOmdb] AI data: Title="${aiTitle}", Year=${aiYear || "unknown"}, Synopsis="${aiSynopsis.substring(0, 50)}..."`,
    );

    // Search OMDB by title
    const searchQuery = aiYear ? `${aiTitle} ${aiYear}` : aiTitle;
    console.log(
      `[verifyRecommendationWithOmdb] Searching OMDB for: "${searchQuery}" with synopsis: "${aiSynopsis.substring(0, 50)}..."`,
    );
    console.log(
      `[verifyRecommendationWithOmdb] VERIFICATION PROCESS RUNNING - This is not just grabbing the first result`,
    );

    // 1. Search OMDB for the title
    const response = await fetch(
      `/.netlify/functions/omdb?s=${encodeURIComponent(searchQuery)}`,
    );

    if (!response.ok) {
      console.error(
        `[verifyRecommendationWithOmdb] OMDB search failed: ${response.status}`,
      );
      return {
        ...item,
        verified: false,
        similarityScore: 0,
      };
    }

    const data = await response.json();

    if (data.Response !== "True" || !data.Search || data.Search.length === 0) {
      console.log(
        `[verifyRecommendationWithOmdb] No results found for "${aiTitle}"`,
      );

      // Try a more lenient search without the year
      if (aiYear) {
        console.log(
          `[verifyRecommendationWithOmdb] Trying search without year: "${aiTitle}"`,
        );
        const altResponse = await fetch(
          `/.netlify/functions/omdb?s=${encodeURIComponent(aiTitle)}`,
        );

        if (altResponse.ok) {
          const altData = await altResponse.json();
          if (
            altData.Response === "True" &&
            altData.Search &&
            altData.Search.length > 0
          ) {
            console.log(
              `[verifyRecommendationWithOmdb] Found ${altData.Search.length} results without year`,
            );
            // Continue with these results
            const bestMatch = await findBestMatch(item, altData.Search);
            if (bestMatch) {
              return {
                ...item,
                ...bestMatch,
                recommendationReason:
                  aiReason || bestMatch.recommendationReason,
                verified: true,
                similarityScore: bestMatch.similarityScore || 0,
              };
            }
          }
        }
      }

      return {
        ...item,
        verified: false,
        similarityScore: 0,
      };
    }

    console.log(
      `[verifyRecommendationWithOmdb] Found ${data.Search.length} results for "${aiTitle}"`,
    );

    // 2. Find the best match based on title, year, and synopsis similarity
    const bestMatch = await findBestMatch(item, data.Search);

    if (bestMatch && bestMatch.similarityScore > 0.1) {
      console.log(
        `[verifyRecommendationWithOmdb] Best match: "${bestMatch.title}" with similarity score ${bestMatch.similarityScore}`,
      );
      return {
        ...item,
        ...bestMatch,
        recommendationReason: aiReason || bestMatch.recommendationReason,
        verified: true,
        similarityScore: bestMatch.similarityScore || 0,
      };
    }

    console.log(
      `[verifyRecommendationWithOmdb] No good match found, using original data`,
    );
    return {
      ...item,
      verified: false,
      similarityScore: 0,
    };
  } catch (error) {
    console.error("Error verifying recommendation:", error);
    return {
      ...item,
      verified: false,
      similarityScore: 0,
    };
  }
}

/**
 * Find the best match for an AI recommendation from OMDB search results
 * @param aiItem The AI recommendation item
 * @param omdbResults Array of OMDB search results
 * @returns The best matching OMDB result or null if no good match found
 */
async function findBestMatch(aiItem: any, omdbResults: any[]): Promise<any> {
  if (!omdbResults || omdbResults.length === 0) return null;

  const aiTitle = aiItem.title;
  const aiSynopsis = aiItem.synopsis || aiItem.overview || "";
  const aiYear = aiItem.year;

  console.log(
    `[findBestMatch] Finding best match for "${aiTitle}" among ${omdbResults.length} results`,
  );

  // First, filter by year if available
  let candidates = omdbResults;
  if (aiYear) {
    const yearMatches = omdbResults.filter((result) => {
      // Handle year ranges like "2019–2022" in TV shows
      const resultYear = result.Year.split("–")[0];
      return resultYear === aiYear.toString();
    });

    if (yearMatches.length > 0) {
      console.log(
        `[findBestMatch] Found ${yearMatches.length} year matches for ${aiYear}`,
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
          `[findBestMatch] "${details.Title}" (${details.Year}) - Similarity: ${similarity.toFixed(2)}`,
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
          recommendationReason:
            aiItem.recommendationReason || aiItem.reason || null,
        };
      }
    } catch (error) {
      console.error(`[findBestMatch] Error getting fallback details:`, error);
    }
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

  // First, filter by year if available
  let candidates = omdbResults;
  if (aiYear) {
    const yearMatches = omdbResults.filter((result) => {
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
