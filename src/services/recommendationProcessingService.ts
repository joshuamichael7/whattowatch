import { ContentItem } from "@/types/omdb";
import { verifyRecommendationWithOmdb } from "@/services/aiService";

/**
 * Service for processing recommendations in the background
 * This service handles the processing, error handling, and caching of recommendations
 * It ensures that processing continues even when the user navigates away from the component
 */

// Store for tracking which recommendations are currently being processed
let processingRecommendations: Record<string, boolean> = {};

// Initialize processing recommendations from localStorage
try {
  const stored = localStorage.getItem("processingRecommendations");
  if (stored) {
    processingRecommendations = JSON.parse(stored);
  }
} catch (error) {
  console.error("Error loading processing recommendations:", error);
}

/**
 * Update the processing recommendations in localStorage
 */
const updateProcessingRecommendationsStorage = () => {
  try {
    localStorage.setItem(
      "processingRecommendations",
      JSON.stringify(processingRecommendations),
    );
  } catch (err) {
    console.error(
      "Error updating processing recommendations in localStorage:",
      err,
    );
  }
};

/**
 * Get processed recommendations from localStorage with expiration handling
 * and automatic cleanup of expired items
 */
export const getProcessedRecommendations = (): Record<string, ContentItem> => {
  try {
    const stored = localStorage.getItem("processedRecommendations");
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    const now = new Date();
    let hasExpiredItems = false;

    // Filter out expired items
    const valid = Object.entries(parsed).reduce((acc, [key, value]) => {
      // Check if item has expiration metadata
      if (value._metadata?.expiresAt) {
        const expiryDate = new Date(value._metadata.expiresAt);
        if (expiryDate > now) {
          acc[key] = value;
        } else {
          hasExpiredItems = true;
          console.log(
            `[RecommendationProcessingService] Item expired: ${value.title || key}`,
          );
        }
      } else {
        // No expiration data, keep it
        acc[key] = value;
      }
      return acc;
    }, {});

    // If we removed expired items, update localStorage
    if (hasExpiredItems) {
      console.log(
        `[RecommendationProcessingService] Removed expired items from cache`,
      );
      localStorage.setItem("processedRecommendations", JSON.stringify(valid));
    }

    return valid;
  } catch (error) {
    console.error(
      "[RecommendationProcessingService] Error loading processed recommendations:",
      error,
    );
    return {};
  }
};

/**
 * Update processed recommendations in localStorage with improved error handling
 * and cache expiration management
 */
export const updateProcessedRecommendations = (
  id: string,
  item: ContentItem,
  expiryHours: number = 24,
) => {
  try {
    const currentProcessed = getProcessedRecommendations();

    // Calculate expiry timestamp
    const expiryTimestamp = new Date();
    expiryTimestamp.setHours(expiryTimestamp.getHours() + expiryHours);

    // Add metadata to the item
    const itemWithMetadata = {
      ...item,
      _metadata: {
        processedAt: new Date().toISOString(),
        expiresAt: expiryTimestamp.toISOString(),
        version: "1.0",
      },
    };

    const updated = {
      ...currentProcessed,
      [id]: itemWithMetadata,
    };

    // Store in localStorage with a try-catch to handle quota exceeded errors
    try {
      localStorage.setItem("processedRecommendations", JSON.stringify(updated));
    } catch (storageError) {
      console.warn(
        "Storage quota exceeded, clearing older items",
        storageError,
      );
      // If storage is full, remove older items
      const oldestItems = Object.entries(updated)
        .sort((a, b) => {
          const aDate =
            a[1]._metadata?.processedAt || new Date(0).toISOString();
          const bDate =
            b[1]._metadata?.processedAt || new Date(0).toISOString();
          return new Date(aDate).getTime() - new Date(bDate).getTime();
        })
        .slice(0, Math.floor(Object.keys(updated).length / 3)); // Remove oldest third

      // Create new object without the oldest items
      const reducedCache = { ...updated };
      oldestItems.forEach(([key]) => delete reducedCache[key]);

      // Try storing the reduced cache
      localStorage.setItem(
        "processedRecommendations",
        JSON.stringify(reducedCache),
      );
    }

    return updated;
  } catch (err) {
    console.error("Error storing processed recommendations:", err);
    return null;
  }
};

/**
 * Store recommendations for background processing
 */
export const storeRecommendationsForProcessing = async (
  recommendations: any[],
) => {
  try {
    // Get processed recommendations
    const processedRecommendations = getProcessedRecommendations();

    // Store only recommendations that haven't been processed yet and aren't currently processing
    const unprocessedRecs = recommendations.filter(
      (rec) =>
        !processedRecommendations[rec.id] && !processingRecommendations[rec.id],
    );

    if (unprocessedRecs.length > 0) {
      // Ensure each recommendation has a unique ID
      const recsWithIds = unprocessedRecs.map((rec) => {
        if (!rec.id) {
          rec.id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        // Ensure synopsis is preserved in both fields for redundancy
        if (rec.synopsis && !rec.overview) {
          rec.overview = rec.synopsis;
        } else if (rec.overview && !rec.synopsis) {
          rec.synopsis = rec.overview;
        }

        // Ensure reason is preserved in both fields for redundancy
        if (rec.reason && !rec.recommendationReason) {
          rec.recommendationReason = rec.reason;
        } else if (rec.recommendationReason && !rec.reason) {
          rec.reason = rec.recommendationReason;
        }

        return rec;
      });

      // Store in localStorage
      localStorage.setItem(
        "pendingRecommendationsToProcess",
        JSON.stringify(recsWithIds),
      );
      console.log(
        `[RecommendationProcessingService] Stored ${recsWithIds.length} recommendations for background processing`,
      );

      // Process the first 3 recommendations immediately to make them available faster
      if (recsWithIds.length > 0) {
        const initialBatchSize = Math.min(3, recsWithIds.length);
        console.log(
          `[RecommendationProcessingService] Immediately processing first ${initialBatchSize} recommendations`,
        );

        // Process first batch in parallel
        const processingPromises = [];

        for (let i = 0; i < initialBatchSize; i++) {
          const rec = recsWithIds[i];
          console.log(
            `[RecommendationProcessingService] Starting immediate processing for: ${rec.title}`,
          );

          const promise = processRecommendation(rec).then((result) => {
            if (result) {
              console.log(
                `[RecommendationProcessingService] Immediate processing complete for: ${rec.title}`,
              );
            } else {
              console.log(
                `[RecommendationProcessingService] Immediate processing failed for: ${rec.title}`,
              );
            }
            return result;
          });

          processingPromises.push(promise);
        }

        // Wait for all initial processing to complete
        Promise.allSettled(processingPromises).then((results) => {
          const successCount = results.filter(
            (r) => r.status === "fulfilled" && r.value,
          ).length;
          console.log(
            `[RecommendationProcessingService] Initial batch processing complete. Success: ${successCount}/${initialBatchSize}`,
          );
        });
      }
    }
    return unprocessedRecs.length;
  } catch (error) {
    console.error("Error storing recommendations for processing:", error);
    return 0;
  }
};

/**
 * Process a single recommendation with enhanced error handling and retry logic
 */
export const processRecommendation = async (
  rec: any,
  retryCount: number = 0,
): Promise<ContentItem | null> => {
  console.log(
    `[RecommendationProcessingService] 🔄 processRecommendation CALLED for ${rec.title} at ${new Date().toISOString()}`,
  );
  const MAX_RETRIES = 2;

  // ALWAYS use the title as the tracking ID - NEVER use IMDB IDs from AI recommendations as they're unreliable
  // We only get reliable IMDB IDs after matching with OMDB
  if (!rec.id) {
    rec.id = rec.title;
    console.log(
      `[RecommendationProcessingService] Using title as identifier for recommendation: ${rec.title}`,
    );
  }

  // CRITICAL: Check if we've already processed this recommendation
  const processedRecommendations = getProcessedRecommendations();
  if (processedRecommendations[rec.id]) {
    console.log(
      `[RecommendationProcessingService] ⚠️ Found already processed recommendation: ${rec.title}`,
    );
    // CRITICAL: Return the processed recommendation instead of skipping
    return processedRecommendations[rec.id];
  }

  // CRITICAL: Force processing even if it's already being processed
  // This ensures we don't get stuck recommendations
  if (processingRecommendations[rec.id]) {
    console.log(
      `[RecommendationProcessingService] ⚠️ Recommendation ${rec.title} is already being processed, but FORCING processing anyway`,
    );
    // Continue processing instead of returning null
    // CRITICAL: Delete the processing flag to ensure we can process it again
    delete processingRecommendations[rec.id];
    updateProcessingRecommendationsStorage();
  }

  console.log(
    `[RecommendationProcessingService] 🔄 FORCE PROCESSING recommendation: ${rec.title} (ID: ${rec.id})`,
  );

  // Mark this recommendation as being processed
  processingRecommendations[rec.id] = true;
  updateProcessingRecommendationsStorage();

  // CRITICAL: Log that processing has started with timestamp
  const startTime = new Date();
  console.log(
    `[RecommendationProcessingService] ⚡ STARTED PROCESSING: ${rec.title} (ID: ${rec.id}) at ${startTime.toISOString()}`,
  );

  try {
    // Log the full recommendation object to help with debugging
    console.log(
      `[RecommendationProcessingService] Processing recommendation:`,
      {
        id: rec.id,
        title: rec.title,
        year: rec.year,
        imdb_id: rec.imdb_id,
        imdb_url: rec.imdb_url,
        synopsis: rec.synopsis ? rec.synopsis.substring(0, 50) + "..." : "none",
        overview: rec.overview ? rec.overview.substring(0, 50) + "..." : "none",
        reason: rec.reason || rec.recommendationReason || "none",
      },
    );

    // Convert recommendation to ContentItem format for verification
    const contentItem: ContentItem = {
      id: rec.id,
      title: rec.title,
      poster_path: rec.poster || rec.poster_path || "",
      media_type: rec.type === "movie" ? "movie" : "tv",
      vote_average: rec.rating || 0,
      vote_count: 0,
      genre_ids: [],
      overview: rec.overview || rec.synopsis || "",
      synopsis: rec.synopsis || rec.overview || "",
      recommendationReason: rec.recommendationReason || rec.reason || "",
      reason: rec.reason || rec.recommendationReason || "",
      year: rec.year,
      imdb_id: rec.imdb_id,
      imdb_url: rec.imdb_url,
      aiRecommended: true,
      // Preserve content rating if available
      content_rating: rec.contentRating || rec.content_rating || "",
      contentRating: rec.contentRating || rec.content_rating || "",
    };

    console.log(
      `[RecommendationProcessingService] Processing recommendation: ${rec.title}${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ""}`,
    );

    // CRITICAL: Add timeout to prevent hanging
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("Verification timeout")), 10000); // 10 second timeout
    });

    // Get the AI data
    const aiTitle = contentItem.title;
    const aiSynopsis = contentItem.synopsis || contentItem.overview || "";
    const aiYear =
      contentItem.year ||
      (contentItem.release_date
        ? contentItem.release_date.substring(0, 4)
        : null);
    const aiReason = contentItem.recommendationReason || contentItem.reason;
    const aiImdbId = contentItem.imdb_id || null;
    const aiImdbUrl = contentItem.imdb_url || null;

    // Race between the actual request and the timeout
    const verifiedItem = await Promise.race([
      verifyRecommendationWithOmdb(contentItem),
      timeoutPromise,
    ]).catch(async (error) => {
      console.warn(
        `[RecommendationProcessingService] Error during verification: ${error.message}`,
      );

      // Implement retry logic for recoverable errors
      if (
        retryCount < MAX_RETRIES &&
        (error.message.includes("timeout") ||
          error.message.includes("network") ||
          error.message.includes("429") || // Too many requests
          error.message.includes("503"))
      ) {
        // Service unavailable

        console.log(
          `[RecommendationProcessingService] Retrying after error: ${error.message}`,
        );

        // Wait before retrying (exponential backoff)
        const backoffTime = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffTime));

        // Remove from processing to allow retry
        delete processingRecommendations[rec.id];
        updateProcessingRecommendationsStorage();

        // Retry the processing
        return processRecommendation(rec, retryCount + 1);
      }

      return null;
    });

    if (verifiedItem) {
      const endTime = new Date();
      const processingTime = (endTime.getTime() - startTime.getTime()) / 1000;
      console.log(
        `[RecommendationProcessingService] ✅ SUCCESSFULLY PROCESSED: ${rec.title} in ${processingTime.toFixed(2)}s`,
      );
      // Preserve the original recommendation reason if it exists
      if (rec.recommendationReason || rec.reason) {
        verifiedItem.recommendationReason =
          rec.recommendationReason || rec.reason;
      }

      // Preserve content rating from original recommendation if OMDB didn't provide one
      if (
        (rec.contentRating || rec.content_rating) &&
        (!verifiedItem.content_rating || verifiedItem.content_rating === "")
      ) {
        verifiedItem.content_rating = rec.contentRating || rec.content_rating;
        verifiedItem.contentRating = rec.contentRating || rec.content_rating;
      }

      // If OMDB provided a rating (Rated field), make sure it's copied to our standard fields
      if (
        verifiedItem.Rated &&
        (!verifiedItem.content_rating || verifiedItem.content_rating === "")
      ) {
        verifiedItem.content_rating = verifiedItem.Rated;
        verifiedItem.contentRating = verifiedItem.Rated;
      }

      // Update processed recommendations in localStorage with 48-hour expiry
      updateProcessedRecommendations(rec.id, verifiedItem, 48);

      // Update pending recommendations in localStorage
      try {
        const pendingRecs = JSON.parse(
          localStorage.getItem("pendingRecommendationsToProcess") || "[]",
        );
        const updatedPendingRecs = pendingRecs.filter(
          (pendingRec) => pendingRec.id !== rec.id,
        );
        localStorage.setItem(
          "pendingRecommendationsToProcess",
          JSON.stringify(updatedPendingRecs),
        );
      } catch (err) {
        console.error(
          "[RecommendationProcessingService] Error updating pending recommendations:",
          err,
        );
      }

      return verifiedItem;
    }

    // If verification failed but wasn't a network error (already handled in catch)
    if (retryCount === 0) {
      // CRITICAL: Create a usable fallback item with all available data
      const fallbackItem: ContentItem = {
        ...contentItem,
        id: rec.id,
        title: rec.title,
        poster_path: rec.poster || rec.poster_path || "",
        media_type: rec.type === "movie" ? "movie" : "tv",
        vote_average: rec.rating || 0,
        vote_count: 0,
        genre_ids: [],
        overview: rec.synopsis || rec.overview || "",
        synopsis: rec.synopsis || rec.overview || "",
        recommendationReason: rec.recommendationReason || rec.reason || "",
        reason: rec.reason || rec.recommendationReason || "",
        year: rec.year,
        verified: false,
        processingFailed: true,
        failureReason: "Verification returned null",
        // Ensure we have all the fields from the original recommendation
        imdb_id: rec.imdb_id,
        imdb_url: rec.imdb_url,
        content_rating: rec.contentRating || rec.content_rating || "",
        contentRating: rec.contentRating || rec.content_rating || "",
        aiRecommended: true,
      };

      console.log(
        `[RecommendationProcessingService] ⚠️ Using fallback item for ${rec.title} with all available data`,
      );

      // Store with shorter expiry (12 hours) so we can retry sooner
      updateProcessedRecommendations(rec.id, fallbackItem, 12);

      // CRITICAL: Return the fallback item instead of null
      return fallbackItem;
    }

    return null;
  } catch (error) {
    console.error(
      `[RecommendationProcessingService] Error processing recommendation ${rec.title}:`,
      error,
    );

    // For non-retryable errors, store a minimal version to prevent repeated processing attempts
    if (retryCount === MAX_RETRIES) {
      const fallbackItem: ContentItem = {
        id: rec.id,
        title: rec.title,
        poster_path: rec.poster || rec.poster_path || "",
        media_type: rec.type === "movie" ? "movie" : "tv",
        vote_average: rec.rating || 0,
        vote_count: 0,
        genre_ids: [],
        overview: rec.synopsis || "",
        synopsis: rec.synopsis || "",
        verified: false,
        processingFailed: true,
        failureReason: error.message || "Unknown error",
        recommendationReason: rec.recommendationReason || rec.reason || "",
        year: rec.year,
        content_rating: rec.contentRating || rec.content_rating || "",
        contentRating: rec.contentRating || rec.content_rating || "",
        aiRecommended: true,
      };

      // Store with shorter expiry (6 hours)
      updateProcessedRecommendations(rec.id, fallbackItem, 6);
    }

    return null;
  } finally {
    // Mark this recommendation as no longer being processed
    delete processingRecommendations[rec.id];
    updateProcessingRecommendationsStorage();
  }
};

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
    `[RecommendationProcessingService] 🔄 STARTING BACKGROUND PROCESSING at ${new Date().toISOString()}`,
  );

  // Log to console for tracking background processing
  const logBackgroundProcessing = (
    message: string,
    type: "info" | "error" | "success" = "info",
  ) => {
    try {
      const now = new Date();
      const timestamp = now.toISOString();

      // Log to console with appropriate styling based on type
      if (type === "error") {
        console.error(`[BackgroundProcessing ${timestamp}] ${message}`);
      } else if (type === "success") {
        console.log(
          `%c[BackgroundProcessing ${timestamp}] ${message}`,
          "color: green; font-weight: bold",
        );
      } else {
        console.log(
          `%c[BackgroundProcessing ${timestamp}] ${message}`,
          "color: blue",
        );
      }
    } catch (err) {
      console.error("Error logging to console:", err);
    }
  };

  console.group("Background Processing Started");
  logBackgroundProcessing("Starting background processing", "info");

  // CRITICAL: Process ALL pending recommendations immediately
  try {
    const pendingRecsString = localStorage.getItem(
      "pendingRecommendationsToProcess",
    );
    if (pendingRecsString) {
      const pendingRecs = JSON.parse(pendingRecsString);
      if (pendingRecs.length > 0) {
        logBackgroundProcessing(
          `🚀 FORCE PROCESSING ALL ${pendingRecs.length} RECOMMENDATIONS IMMEDIATELY`,
          "info",
        );

        // Process ALL recommendations in parallel
        pendingRecs.forEach((rec: any) => {
          if (!rec.id) {
            rec.id = rec.title; // ALWAYS use title, NEVER use IMDB ID from AI recommendations
          }

          logBackgroundProcessing(
            `⚡ Starting immediate processing for: ${rec.title} (ID: ${rec.id})`,
            "info",
          );

          // Process without awaiting to maximize parallelism
          processRecommendation(rec)
            .then((result) => {
              if (result) {
                logBackgroundProcessing(
                  `✅ Processing COMPLETE for: ${rec.title}`,
                  "success",
                );

                // Remove from pending list immediately
                try {
                  const currentPendingStr = localStorage.getItem(
                    "pendingRecommendationsToProcess",
                  );
                  if (currentPendingStr) {
                    const currentPending = JSON.parse(currentPendingStr);
                    const updatedPending = currentPending.filter(
                      (item: any) => item.id !== rec.id,
                    );
                    localStorage.setItem(
                      "pendingRecommendationsToProcess",
                      JSON.stringify(updatedPending),
                    );
                    logBackgroundProcessing(
                      `Removed ${rec.title} from pending list. ${updatedPending.length} remaining.`,
                      "info",
                    );
                  }
                } catch (err) {
                  console.error("Error updating pending list:", err);
                }
              } else {
                logBackgroundProcessing(
                  `❌ Processing FAILED for: ${rec.title}`,
                  "error",
                );
              }
            })
            .catch((err) => {
              logBackgroundProcessing(
                `❌ ERROR processing ${rec.title}: ${err.message}`,
                "error",
              );
            });
        });
      }
    }
  } catch (error) {
    logBackgroundProcessing(
      `Error in immediate processing: ${error.message}`,
      "error",
    );
  }

  // Create a worker-like function that will continue running even if component unmounts
  const backgroundWorker = async () => {
    try {
      // Get pending recommendations from localStorage
      const pendingRecsString = localStorage.getItem(
        "pendingRecommendationsToProcess",
      );
      if (!pendingRecsString) {
        logBackgroundProcessing(
          "No pending recommendations to process",
          "info",
        );
        return;
      }

      const pendingRecs = JSON.parse(pendingRecsString);
      logBackgroundProcessing(
        `Found ${pendingRecs.length} pending recommendations to process`,
        "info",
      );

      // Track successfully processed recommendations for Supabase caching
      const processedItems: ContentItem[] = [];

      // Process each recommendation one by one to avoid overwhelming the API
      for (const rec of pendingRecs) {
        try {
          logBackgroundProcessing(
            `Processing recommendation: ${rec.title}`,
            "info",
          );

          // Process with retry logic
          const processedItem = await processRecommendation(rec);

          if (processedItem) {
            processedItems.push(processedItem);
            logBackgroundProcessing(
              `Successfully processed recommendation: ${rec.title}`,
              "success",
            );
          } else {
            logBackgroundProcessing(
              `Failed to process recommendation: ${rec.title}`,
              "error",
            );
          }

          // Add a small delay between API calls to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (itemError) {
          logBackgroundProcessing(
            `Error processing item ${rec.title}: ${itemError.message}`,
            "error",
          );
          // Continue with next item instead of failing the entire batch
          continue;
        }
      }

      // Cache successfully processed recommendations in Supabase if we have any
      if (processedItems.length > 0) {
        try {
          logBackgroundProcessing(
            `Caching ${processedItems.length} processed recommendations in Supabase`,
            "info",
          );

          // Generate a cache key based on the first item's properties
          const firstItem = pendingRecs[0];
          const cacheKey = generateCacheKey({
            type: firstItem.type,
            genres: firstItem.genres,
            timestamp: new Date().toISOString().split("T")[0], // Daily cache key
          });

          // Cache in Supabase with 48-hour expiry
          await cacheRecommendationsInSupabase(cacheKey, processedItems, 48);

          logBackgroundProcessing(
            `Successfully cached recommendations in Supabase with key: ${cacheKey}`,
            "success",
          );
        } catch (cacheError) {
          logBackgroundProcessing(
            `Error caching in Supabase: ${cacheError.message}`,
            "error",
          );
          // Non-critical error, continue execution
        }
      }

      logBackgroundProcessing(
        `Completed background processing. Successfully processed: ${processedItems.length}/${pendingRecs.length}`,
        "success",
      );
      console.groupEnd();
    } catch (error) {
      logBackgroundProcessing(
        `Background worker error: ${error.message}`,
        "error",
      );
    }
  };

  // Start the background worker and don't wait for it to complete
  backgroundWorker().catch((error) => {
    logBackgroundProcessing(
      `Background worker error: ${error.message}`,
      "error",
    );
    console.groupEnd();
  });
};

/**
 * Check for cached recommendations in both localStorage and Supabase
 * @param params Parameters to generate a cache key
 * @returns Cached recommendations if available
 */
export const checkCachedRecommendations = async (
  params: any,
): Promise<ContentItem[] | null> => {
  try {
    // First check localStorage
    const localCache = getProcessedRecommendations();
    if (Object.keys(localCache).length > 0) {
      console.log(
        `[RecommendationProcessingService] Found ${Object.keys(localCache).length} items in local cache`,
      );
      return Object.values(localCache);
    }

    // If not in localStorage, check Supabase
    const cacheKey = generateCacheKey(params);
    const supabaseCache = await getCachedRecommendationsFromSupabase(cacheKey);

    if (supabaseCache && supabaseCache.length > 0) {
      console.log(
        `[RecommendationProcessingService] Found ${supabaseCache.length} items in Supabase cache`,
      );

      // Store in localStorage for faster access next time
      supabaseCache.forEach((item) => {
        if (item.id) {
          updateProcessedRecommendations(item.id, item);
        }
      });

      return supabaseCache;
    }

    return null;
  } catch (error) {
    console.error(
      "[RecommendationProcessingService] Error checking cached recommendations:",
      error,
    );
    return null;
  }
};
