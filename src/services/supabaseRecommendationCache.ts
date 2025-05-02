import { ContentItem } from "@/types/omdb";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Service for caching recommendations in Supabase
 * This provides a more robust and persistent cache than localStorage
 */

/**
 * Cache recommendations in Supabase for future use
 * @param cacheKey A unique key for this set of recommendations
 * @param recommendations The recommendations to cache
 * @param expiryHours How long the cache should be valid (default: 24 hours)
 */
export async function cacheRecommendationsInSupabase(
  cacheKey: string,
  recommendations: ContentItem[],
  expiryHours: number = 24,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseRecommendationCache] Supabase not configured, skipping cache",
    );
    return false;
  }

  try {
    // Calculate expiry timestamp
    const expiryTimestamp = new Date();
    expiryTimestamp.setHours(expiryTimestamp.getHours() + expiryHours);

    // Add proper headers to prevent 406 error
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Store the cache entry
    const { error } = await supabase
      .from("recommendation_cache")
      .upsert({
        cache_key: cacheKey,
        recommendations: recommendations,
        created_at: new Date().toISOString(),
        expires_at: expiryTimestamp.toISOString(),
      })
      .select();

    if (error) {
      console.error(
        "[supabaseRecommendationCache] Error caching recommendations:",
        error,
      );
      return false;
    }

    console.log(
      `[supabaseRecommendationCache] Successfully cached ${recommendations.length} recommendations with key: ${cacheKey}`,
    );
    return true;
  } catch (error) {
    console.error(
      "[supabaseRecommendationCache] Error caching recommendations:",
      error,
    );
    return false;
  }
}

/**
 * Get cached recommendations from Supabase
 * @param cacheKey The unique key for the recommendations
 * @returns The cached recommendations or null if not found or expired
 */
export async function getCachedRecommendationsFromSupabase(
  cacheKey: string,
): Promise<ContentItem[] | null> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseRecommendationCache] Supabase not configured, skipping cache check",
    );
    return null;
  }

  try {
    // Add proper headers to prevent 406 error
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const { data, error } = await supabase
      .from("recommendation_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .gte("expires_at", new Date().toISOString()) // Only get non-expired cache entries
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        // PGRST116 is the "not found" error code
        console.error(
          "[supabaseRecommendationCache] Error getting cached recommendations:",
          error,
        );
      } else {
        console.log(
          `[supabaseRecommendationCache] No cache found for key: ${cacheKey}`,
        );
      }
      return null;
    }

    if (
      !data ||
      !data.recommendations ||
      !Array.isArray(data.recommendations)
    ) {
      console.log(
        `[supabaseRecommendationCache] Invalid cache data for key: ${cacheKey}`,
      );
      return null;
    }

    console.log(
      `[supabaseRecommendationCache] Found ${data.recommendations.length} cached recommendations for key: ${cacheKey}`,
    );
    return data.recommendations as ContentItem[];
  } catch (error) {
    console.error(
      "[supabaseRecommendationCache] Error getting cached recommendations:",
      error,
    );
    return null;
  }
}

/**
 * Clear expired cache entries from Supabase
 * This can be called periodically to clean up the database
 */
export async function clearExpiredCacheEntries(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseRecommendationCache] Supabase not configured, skipping cache cleanup",
    );
    return false;
  }

  try {
    // Add proper headers to prevent 406 error
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const { error, count } = await supabase
      .from("recommendation_cache")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("count");

    if (error) {
      console.error(
        "[supabaseRecommendationCache] Error clearing expired cache entries:",
        error,
      );
      return false;
    }

    console.log(
      `[supabaseRecommendationCache] Cleared ${count || 0} expired cache entries`,
    );
    return true;
  } catch (error) {
    console.error(
      "[supabaseRecommendationCache] Error clearing expired cache entries:",
      error,
    );
    return false;
  }
}

/**
 * Generate a cache key based on user preferences or search parameters
 * @param params The parameters to use for generating the cache key
 * @returns A unique cache key
 */
export function generateCacheKey(params: any): string {
  try {
    // Sort the keys to ensure consistent order
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        // Skip null or undefined values
        if (params[key] != null) {
          result[key] = params[key];
        }
        return result;
      }, {});

    // Create a string representation of the parameters
    const paramsString = JSON.stringify(sortedParams);

    // Create a simple hash of the string
    let hash = 0;
    for (let i = 0; i < paramsString.length; i++) {
      const char = paramsString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Return a prefixed hash string
    return `rec_${Math.abs(hash).toString(16)}`;
  } catch (error) {
    console.error(
      "[supabaseRecommendationCache] Error generating cache key:",
      error,
    );
    // Fallback to timestamp-based key
    return `rec_${Date.now().toString(16)}`;
  }
}
