import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "./utils";
import { ContentItem } from "../types/omdb";

// Get Supabase URL and key from environment variables
// Use VITE_ prefixed variables for client-side access
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Log environment variables for debugging (will be removed in production)
console.log("VITE_SUPABASE_URL exists:", !!import.meta.env.VITE_SUPABASE_URL);
console.log(
  "VITE_SUPABASE_ANON_KEY exists:",
  !!import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// Create Supabase client with environment variables
export const supabase = createClient(supabaseUrl, supabaseKey);

// Log connection details for debugging
console.log("[SUPABASE] Client initialized with URL:", supabaseUrl);
console.log("[SUPABASE] Anon key exists:", !!supabaseKey);

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  const configured = Boolean(supabaseUrl && supabaseKey);
  console.log("Supabase configured:", configured);
  return configured;
};

/**
 * Cache recommendations in Supabase for future use
 */
export async function cacheRecommendations(
  cacheKey: string,
  recommendations: ContentItem[],
  expiryHours: number = 24,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn("[supabaseClient] Supabase not configured, skipping cache");
    return false;
  }

  try {
    // Calculate expiry timestamp
    const expiryTimestamp = new Date();
    expiryTimestamp.setHours(expiryTimestamp.getHours() + expiryHours);

    // Store the cache entry
    const { error } = await supabase.from("recommendation_cache").upsert({
      cache_key: cacheKey,
      recommendations: recommendations,
      created_at: new Date().toISOString(),
      expires_at: expiryTimestamp.toISOString(),
    });

    if (error) {
      console.error("[supabaseClient] Error caching recommendations:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[supabaseClient] Error caching recommendations:", error);
    return false;
  }
}

/**
 * Get cached recommendations from Supabase
 */
export async function getCachedRecommendations(
  cacheKey: string,
): Promise<ContentItem[] | null> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseClient] Supabase not configured, skipping cache check",
    );
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("recommendation_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .gte("expires_at", new Date().toISOString()) // Only get non-expired cache entries
      .single();

    if (error || !data) {
      return null;
    }

    return data.recommendations as ContentItem[];
  } catch (error) {
    console.error(
      "[supabaseClient] Error getting cached recommendations:",
      error,
    );
    return null;
  }
}

/**
 * Add content similarity relationship to Supabase
 */
export async function addContentSimilarity(
  sourceId: string,
  targetId: string,
  similarityScore: number,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseClient] Supabase not configured, skipping similarity addition",
    );
    return false;
  }

  try {
    // Check if the relationship already exists
    const { data: existingRelation } = await supabase
      .from("content_similarities")
      .select("*")
      .eq("source_id", sourceId)
      .eq("target_id", targetId)
      .single();

    if (existingRelation) {
      // Update existing relationship with new score
      const { error } = await supabase
        .from("content_similarities")
        .update({
          similarity_score: similarityScore,
          updated_at: new Date().toISOString(),
        })
        .eq("source_id", sourceId)
        .eq("target_id", targetId);

      if (error) {
        console.error(
          "[supabaseClient] Error updating content similarity:",
          error,
        );
        return false;
      }
    } else {
      // Create new relationship
      const { error } = await supabase.from("content_similarities").insert({
        source_id: sourceId,
        target_id: targetId,
        similarity_score: similarityScore,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error(
          "[supabaseClient] Error inserting content similarity:",
          error,
        );
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[supabaseClient] Error managing content similarity:", error);
    return false;
  }
}

/**
 * Search for content in Supabase database
 */
export async function searchContentInSupabase(
  query: string,
  type?: "movie" | "series" | "all",
): Promise<ContentItem[]> {
  if (!isSupabaseConfigured()) {
    console.warn("[supabaseClient] Supabase not configured, skipping search");
    return [];
  }

  try {
    let supabaseQuery = supabase
      .from("content")
      .select("*")
      .ilike("title", `%${query}%`);

    // Apply type filter if specified
    if (type && type !== "all") {
      const mediaType = type === "movie" ? "movie" : "tv";
      supabaseQuery = supabaseQuery.eq("media_type", mediaType);
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error("[supabaseClient] Error searching content:", error);
      return [];
    }

    return data as ContentItem[];
  } catch (error) {
    console.error("[supabaseClient] Error searching content:", error);
    return [];
  }
}

/**
 * Get content by ID from Supabase
 */
export async function getContentByIdFromSupabase(
  id: string,
): Promise<ContentItem | null> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseClient] Supabase not configured, skipping getContentById",
    );
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[supabaseClient] Error getting content by ID:", error);
      return null;
    }

    return data as ContentItem;
  } catch (error) {
    console.error("[supabaseClient] Error getting content by ID:", error);
    return null;
  }
}

/**
 * Add content to Supabase database
 */
export async function addContentToSupabase(
  content: ContentItem,
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseClient] Supabase not configured, skipping addContent",
    );
    return false;
  }

  try {
    // Check if content already exists
    const { data: existingContent } = await supabase
      .from("content")
      .select("id")
      .eq("id", content.id)
      .single();

    if (existingContent) {
      // Content already exists, update it
      const { error: updateError } = await supabase
        .from("content")
        .update(content)
        .eq("id", content.id);

      if (updateError) {
        console.error("[supabaseClient] Error updating content:", updateError);
        return false;
      }

      return true;
    } else {
      // Content doesn't exist, insert it
      const { error: insertError } = await supabase
        .from("content")
        .insert(content);

      if (insertError) {
        console.error("[supabaseClient] Error inserting content:", insertError);
        return false;
      }

      return true;
    }
  } catch (error) {
    console.error("[supabaseClient] Error adding content:", error);
    return false;
  }
}

/**
 * Get similar content from Supabase based on genre, actors, etc.
 */
export async function getSimilarContentFromSupabase(
  contentId: string,
  limit: number = 10,
): Promise<ContentItem[]> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseClient] Supabase not configured, skipping getSimilarContent",
    );
    return [];
  }

  try {
    // First get the content details to find genres
    const content = await getContentByIdFromSupabase(contentId);

    if (!content) {
      console.warn(`[supabaseClient] Content with ID ${contentId} not found`);
      return [];
    }

    // Get content with similar genres
    let query = supabase
      .from("content")
      .select("*")
      .neq("id", contentId) // Exclude the original content
      .eq("media_type", content.media_type); // Same media type

    // If we have genre information, use it for filtering
    if (content.genre_strings && content.genre_strings.length > 0) {
      // Use the first genre for filtering (could be improved to use multiple genres)
      const primaryGenre = content.genre_strings[0];

      // Find content that contains this genre
      query = query.contains("genre_strings", [primaryGenre]);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error("[supabaseClient] Error getting similar content:", error);
      return [];
    }

    return data as ContentItem[];
  } catch (error) {
    console.error("[supabaseClient] Error getting similar content:", error);
    return [];
  }
}

/**
 * Get trending content from Supabase
 */
export async function getTrendingContentFromSupabase(
  type?: "movie" | "tv",
  limit: number = 8,
): Promise<ContentItem[]> {
  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseClient] Supabase not configured, skipping getTrendingContent",
    );
    return [];
  }

  try {
    let query = supabase
      .from("content")
      .select("*")
      .order("popularity", { ascending: false });

    if (type) {
      query = query.eq("media_type", type);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error("[supabaseClient] Error getting trending content:", error);
      return [];
    }

    return data as ContentItem[];
  } catch (error) {
    console.error("[supabaseClient] Error getting trending content:", error);
    return [];
  }
}
