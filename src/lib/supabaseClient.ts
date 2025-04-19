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
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (...args) => {
      console.log("[SUPABASE] Fetch request:", args[0]);
      return fetch(...args);
    },
  },
});

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
      // Convert 'tv' to 'series' for database compatibility
      const mediaType = type === "movie" ? "movie" : "series";
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
    // First try to find by imdb_id
    const { data, error } = await supabase
      .from("content")
      .select("*")
      .eq("imdb_id", id);

    if (error) {
      console.error(
        "[supabaseClient] Error getting content by imdb_id:",
        error,
      );
      return null;
    }

    // If we found a match, return the first one
    if (data && data.length > 0) {
      console.log(`[supabaseClient] Found content by imdb_id: ${id}`);
      return data[0] as ContentItem;
    }

    // If no match by imdb_id, try by id
    const { data: idData, error: idError } = await supabase
      .from("content")
      .select("*")
      .eq("id", id);

    if (idError) {
      console.error("[supabaseClient] Error getting content by id:", idError);
      return null;
    }

    // If we found a match, return the first one
    if (idData && idData.length > 0) {
      console.log(`[supabaseClient] Found content by id: ${id}`);
      return idData[0] as ContentItem;
    }

    console.log(`[supabaseClient] No content found for id: ${id}`);
    return null;
  } catch (error) {
    console.error("[supabaseClient] Error getting content by ID:", error);
    return null;
  }
}

/**
 * Add content to Supabase database
 */
// Helper function to generate UUID
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
    // Ensure media_type is valid (must be 'movie' or 'series' for the database constraint)
    const mediaType =
      content.media_type === "tv" ? "series" : content.media_type;

    // Ensure genre_ids and genre_strings are arrays
    const safeContent = {
      ...content,
      media_type: mediaType,
      genre_ids: Array.isArray(content.genre_ids) ? content.genre_ids : [],
      genre_strings: Array.isArray(content.genre_strings)
        ? content.genre_strings
        : [],
    };

    // Check if content already exists by imdb_id
    const { data: existingContent, error: checkError } = await supabase
      .from("content")
      .select("id")
      .eq("imdb_id", content.imdb_id);

    if (checkError) {
      console.error(
        "[supabaseClient] Error checking for existing content:",
        checkError,
      );
    }

    if (existingContent && existingContent.length > 0) {
      // Content already exists, update it
      const { error: updateError } = await supabase
        .from("content")
        .update(safeContent)
        .eq("id", existingContent[0].id);

      if (updateError) {
        console.error("[supabaseClient] Error updating content:", updateError);
        return false;
      }

      return true;
    } else {
      // Content doesn't exist, insert it
      console.log("[supabaseClient] Inserting new content:", {
        id: safeContent.id,
        title: safeContent.title,
        imdb_id: safeContent.imdb_id,
        media_type: safeContent.media_type,
      });

      // Make sure we have all required fields and remove any fields that might cause issues
      const contentToInsert = {
        ...safeContent,
        id: safeContent.id || generateUUID(),
        created_at: safeContent.created_at || new Date().toISOString(),
        updated_at: safeContent.updated_at || new Date().toISOString(),
      };

      // Remove any fields that aren't in the database schema
      delete contentToInsert.ratings;
      delete contentToInsert.aiRecommended;
      delete contentToInsert.aiSimilarityScore;
      delete contentToInsert.recommendationReason;
      delete contentToInsert.isErrorFallback;
      delete contentToInsert.isTrendingFallback;
      delete contentToInsert.aiServiceUnavailable;
      delete contentToInsert.vectorDbRecommended;
      delete contentToInsert.plotSimilarity;
      delete contentToInsert.keywordSimilarity;
      delete contentToInsert.textSimilarity;
      delete contentToInsert.titleSimilarity;
      delete contentToInsert.combinedSimilarity;
      delete contentToInsert.keywords;
      delete contentToInsert.contentRating; // Use content_rating instead
      delete contentToInsert.poster; // Use poster_path instead
      delete contentToInsert.imdbID; // Use imdb_id instead

      const { error: insertError } = await supabase
        .from("content")
        .insert(contentToInsert);

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
 * @param type The media type to filter by ("movie" or "tv")
 * @param limit The maximum number of items to return
 * @returns A promise that resolves to an array of content items
 */
export async function getTrendingContentFromSupabase(
  type?: "movie" | "tv",
  limit: number = 8,
): Promise<ContentItem[]> {
  console.log(
    `[supabaseClient] Getting trending ${type || "all"} content, limit: ${limit}`,
  );

  if (!isSupabaseConfigured()) {
    console.warn(
      "[supabaseClient] Supabase not configured, skipping getTrendingContent",
    );
    return [];
  }

  console.log("[supabaseClient] Supabase URL:", supabaseUrl);
  console.log("[supabaseClient] Supabase key exists:", !!supabaseKey);

  try {
    // First, check if we have curated homepage content
    console.log("[supabaseClient] Checking for curated homepage content");

    // Convert 'tv' to 'series' for database compatibility if type is provided
    const mediaType = type ? (type === "tv" ? "series" : type) : undefined;

    // Get content IDs from homepage_content table, ordered by the 'order' column
    let homepageQuery = supabase
      .from("homepage_content")
      .select("content_id, order, media_type")
      .order("order", { ascending: true });

    // Apply media type filter if specified
    if (mediaType) {
      homepageQuery = homepageQuery.eq("media_type", mediaType);
    }

    const { data: homepageContentData, error: homepageContentError } =
      await homepageQuery;

    if (homepageContentError) {
      console.error(
        "[supabaseClient] Error getting homepage content:",
        homepageContentError,
      );
      // Continue with regular trending content if there's an error with homepage content
    } else if (homepageContentData && homepageContentData.length > 0) {
      console.log(
        `[supabaseClient] Found ${homepageContentData.length} curated homepage items`,
      );

      // Extract content IDs
      const contentIds = homepageContentData.map((item) => item.content_id);

      // Fetch the actual content items
      let contentQuery = supabase
        .from("content")
        .select("*")
        .in("id", contentIds);

      // Apply media type filter if specified
      if (mediaType) {
        contentQuery = contentQuery.eq("media_type", mediaType);
      }

      const { data: curatedContent, error: curatedContentError } =
        await contentQuery;

      if (curatedContentError) {
        console.error(
          "[supabaseClient] Error getting curated content:",
          curatedContentError,
        );
      } else if (curatedContent && curatedContent.length > 0) {
        console.log(
          `[supabaseClient] Retrieved ${curatedContent.length} curated content items`,
        );

        // Sort the content according to the order in homepage_content
        const orderedContent = curatedContent.sort((a, b) => {
          const aIndex = homepageContentData.findIndex(
            (item) => item.content_id === a.id,
          );
          const bIndex = homepageContentData.findIndex(
            (item) => item.content_id === b.id,
          );
          return aIndex - bIndex;
        });

        // If we have enough curated content, return it
        if (orderedContent.length >= limit) {
          return orderedContent.slice(0, limit) as ContentItem[];
        }

        // If we don't have enough curated content, we'll supplement with trending content
        console.log(
          `[supabaseClient] Not enough curated content (${orderedContent.length}/${limit}), supplementing with trending content`,
        );

        // Get additional trending content excluding the curated content IDs
        const remainingLimit = limit - orderedContent.length;
        const supplementalContent = await getSupplementalTrendingContent(
          mediaType,
          remainingLimit,
          contentIds,
        );

        // Combine curated and supplemental content
        return [...orderedContent, ...supplementalContent] as ContentItem[];
      }
    }

    // If we reach here, either there's no homepage content or we encountered an error
    // Fall back to the original trending content logic
    return getRegularTrendingContent(mediaType, limit);
  } catch (error) {
    console.error("[supabaseClient] Error getting trending content:", error);
    return [];
  }
}

/**
 * Get regular trending content from Supabase (original implementation)
 */
async function getRegularTrendingContent(
  mediaType?: string,
  limit: number = 8,
): Promise<ContentItem[]> {
  console.log("[supabaseClient] Getting regular trending content");

  try {
    console.log("[supabaseClient] Building query for content table");
    let query = supabase
      .from("content")
      .select("*")
      .order("popularity", { ascending: false });

    if (mediaType) {
      console.log(`[supabaseClient] Filtering by media_type: ${mediaType}`);
      query = query.eq("media_type", mediaType);
    }

    console.log("[supabaseClient] Executing query with limit:", limit);
    const { data, error } = await query.limit(limit);

    if (error) {
      console.error("[supabaseClient] Error getting trending content:", error);
      return [];
    }

    console.log(`[supabaseClient] Query returned ${data?.length || 0} results`);
    if (data && data.length > 0) {
      console.log("[supabaseClient] First result:", data[0].id, data[0].title);
    } else {
      console.log("[supabaseClient] No results found in content table");
      // Let's check if the table exists and has data
      try {
        const { count, error: countError } = await supabase
          .from("content")
          .select("*", { count: "exact", head: true });

        console.log(
          `[supabaseClient] Total count in content table: ${count}`,
          countError ? `Error: ${countError.message}` : "",
        );
      } catch (countErr) {
        console.error("[supabaseClient] Error counting content:", countErr);
      }
    }

    return data as ContentItem[];
  } catch (error) {
    console.error(
      "[supabaseClient] Error getting regular trending content:",
      error,
    );
    return [];
  }
}

/**
 * Get supplemental trending content, excluding specified content IDs
 */
async function getSupplementalTrendingContent(
  mediaType?: string,
  limit: number = 8,
  excludeIds: string[] = [],
): Promise<ContentItem[]> {
  console.log(
    `[supabaseClient] Getting supplemental trending content, limit: ${limit}`,
  );

  try {
    let query = supabase
      .from("content")
      .select("*")
      .order("popularity", { ascending: false });

    if (mediaType) {
      query = query.eq("media_type", mediaType);
    }

    // Exclude the content IDs that are already in the curated content
    if (excludeIds.length > 0) {
      query = query.not(
        "id",
        "in",
        `(${excludeIds.map((id) => `'${id}'`).join(",")})`,
      );
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      console.error(
        "[supabaseClient] Error getting supplemental trending content:",
        error,
      );
      return [];
    }

    console.log(
      `[supabaseClient] Supplemental query returned ${data?.length || 0} results`,
    );
    return data as ContentItem[];
  } catch (error) {
    console.error(
      "[supabaseClient] Error getting supplemental trending content:",
      error,
    );
    return [];
  }
}
