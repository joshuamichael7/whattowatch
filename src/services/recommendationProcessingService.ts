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
export const storeRecommendationsForProcessing = (recommendations: any[]) => {
  try {
    // Get processed recommendations
    const processedRecommendations = getProcessedRecommendations();

    // Store only recommendations that haven't been processed yet and aren't currently processing
    const unprocessedRecs = recommendations.filter(
      (rec) =>
        !processedRecommendations[rec.id] && !processingRecommendations[rec.id],
    );

    if (unprocessedRecs.length > 0) {
      localStorage.setItem(
        "pendingRecommendationsToProcess",
        JSON.stringify(unprocessedRecs),
      );
      console.log(
        `[RecommendationProcessingService] Stored ${unprocessedRecs.length} recommendations for background processing`,
      );
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
  const MAX_RETRIES = 2;

  // Skip if we've already processed this recommendation
  const processedRecommendations = getProcessedRecommendations();
  if (processedRecommendations[rec.id]) {
    console.log(
      `[RecommendationProcessingService] Skipping already processed recommendation: ${rec.title}`,
    );
    return processedRecommendations[rec.id];
  }

  // Skip if this recommendation is currently being processed
  if (processingRecommendations[rec.id]) {
    console.log(
      `[RecommendationProcessingService] Skipping recommendation that's already being processed: ${rec.title}`,
    );
    return null;
  }

  // Mark this recommendation as being processed
  processingRecommendations[rec.id] = true;
  updateProcessingRecommendationsStorage();

  try {
    // Convert recommendation to ContentItem format for verification
    const contentItem: ContentItem = {
      id: rec.id,
      title: rec.title,
      poster_path: rec.poster || rec.poster_path || "",
      media_type: rec.type === "movie" ? "movie" : "tv",
      vote_average: rec.rating || 0,
      vote_count: 0,
      genre_ids: [],
      overview: rec.synopsis || "",
      synopsis: rec.synopsis || "",
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

    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), 15000); // 15 second timeout
    });

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
      console.log(
        `[RecommendationProcessingService] Successfully processed recommendation: ${rec.title}`,
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
      // Store a minimal version to prevent repeated processing attempts
      const fallbackItem: ContentItem = {
        ...contentItem,
        verified: false,
        processingFailed: true,
        failureReason: "Verification returned null",
      };

      // Store with shorter expiry (12 hours) so we can retry sooner
      updateProcessedRecommendations(rec.id, fallbackItem, 12);
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
    `[RecommendationProcessingService] Starting background processing`,
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
