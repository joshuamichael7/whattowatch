import { supabase } from "./supabaseClient";
import { ContentItem } from "../types/omdb";
import { isSupabaseConfigured } from "./supabaseClient";

/**
 * Search for content in Supabase database with improved matching
 */
export async function searchContentWithImprovedMatching(
  query: string,
  type?: "movie" | "series" | "all",
): Promise<ContentItem[]> {
  if (!isSupabaseConfigured()) {
    console.warn("[improvedSearch] Supabase not configured, skipping search");
    return [];
  }

  try {
    // Clean the query to remove special characters that might cause issues
    const cleanedQuery = query.replace(/[\"\'\'\:\;\(\)\[\]\{\}]/g, "").trim();
    console.log(
      `[improvedSearch] Searching for: "${cleanedQuery}" (original: "${query}")`,
    );

    // First try exact title match
    let exactMatchQuery = supabase
      .from("content")
      .select("*")
      .ilike("title", cleanedQuery);

    // Apply type filter if specified
    if (type && type !== "all") {
      // Convert 'tv' to 'series' for database compatibility
      const mediaType = type === "movie" ? "movie" : "series";
      exactMatchQuery = exactMatchQuery.eq("media_type", mediaType);
    }

    const { data: exactMatches, error: exactMatchError } =
      await exactMatchQuery;

    if (exactMatchError) {
      console.error(
        "[improvedSearch] Error searching for exact match:",
        exactMatchError,
      );
    } else if (exactMatches && exactMatches.length > 0) {
      console.log(
        `[improvedSearch] Found ${exactMatches.length} exact matches for "${cleanedQuery}"`,
      );
      return exactMatches as ContentItem[];
    }

    // If no exact matches, try partial match
    let partialMatchQuery = supabase
      .from("content")
      .select("*")
      .ilike("title", `%${cleanedQuery}%`);

    // Apply type filter if specified
    if (type && type !== "all") {
      // Convert 'tv' to 'series' for database compatibility
      const mediaType = type === "movie" ? "movie" : "series";
      partialMatchQuery = partialMatchQuery.eq("media_type", mediaType);
    }

    const { data, error } = await partialMatchQuery;

    if (error) {
      console.error("[improvedSearch] Error searching content:", error);
      return [];
    }

    // If we have results, sort them by title similarity to the query
    if (data && data.length > 0) {
      // Sort results by how closely they match the query
      data.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const queryLower = cleanedQuery.toLowerCase();

        // Exact matches first
        if (aTitle === queryLower && bTitle !== queryLower) return -1;
        if (bTitle === queryLower && aTitle !== queryLower) return 1;

        // Then starts with matches
        if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower))
          return -1;
        if (bTitle.startsWith(queryLower) && !aTitle.startsWith(queryLower))
          return 1;

        // Then contains matches
        const aContains = aTitle.includes(queryLower);
        const bContains = bTitle.includes(queryLower);
        if (aContains && !bContains) return -1;
        if (bContains && !aContains) return 1;

        // Default to alphabetical
        return aTitle.localeCompare(bTitle);
      });
    }

    return data as ContentItem[];
  } catch (error) {
    console.error("[improvedSearch] Error searching content:", error);
    return [];
  }
}
