import axios from "axios";
import { ContentItem } from "@/types/omdb";

/**
 * Search for movies or TV shows
 * @param query Search query
 * @param type Content type (movie, tv, or multi)
 * @returns Search results
 */
export async function searchContent(
  query: string,
  type: "movie" | "tv" | "multi" = "multi",
): Promise<ContentItem[]> {
  try {
    const response = await axios.get("/.netlify/functions/tmdb", {
      params: {
        operation: "search",
        query,
        type,
      },
    });

    return response.data.results || [];
  } catch (error) {
    console.error(`Error searching for "${query}":`, error);
    return [];
  }
}

/**
 * Get detailed information about a movie
 * @param id TMDB movie ID
 * @returns Movie details
 */
export async function getMovieById(
  id: number | string,
): Promise<ContentItem | null> {
  try {
    const response = await axios.get("/.netlify/functions/tmdb", {
      params: {
        operation: "movie",
        id,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error getting movie with ID ${id}:`, error);
    return null;
  }
}

/**
 * Get detailed information about a TV show
 * @param id TMDB TV show ID
 * @returns TV show details
 */
export async function getTvShowById(
  id: number | string,
): Promise<ContentItem | null> {
  try {
    const response = await axios.get("/.netlify/functions/tmdb", {
      params: {
        operation: "tv",
        id,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error getting TV show with ID ${id}:`, error);
    return null;
  }
}

/**
 * Get trending movies or TV shows
 * @param mediaType Media type (movie, tv, or all)
 * @param timeWindow Time window (day or week)
 * @returns List of trending content
 */
export async function getTrending(
  mediaType: "movie" | "tv" | "all" = "all",
  timeWindow: "day" | "week" = "week",
  limit: number = 20,
): Promise<ContentItem[]> {
  try {
    const response = await axios.get("/.netlify/functions/tmdb", {
      params: {
        operation: "trending",
        mediaType,
        timeWindow,
        limit,
      },
    });

    return response.data.results || [];
  } catch (error) {
    console.error(`Error getting trending ${mediaType}:`, error);
    return [];
  }
}

/**
 * Get daily or weekly changes for movies
 * @param startDate Optional start date (YYYY-MM-DD)
 * @param endDate Optional end date (YYYY-MM-DD)
 * @returns List of changed movie IDs
 */
export async function getMovieChanges(
  startDate?: string,
  endDate?: string,
): Promise<number[]> {
  try {
    const params: Record<string, any> = {
      operation: "movie_changes",
    };

    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get("/.netlify/functions/tmdb", { params });

    return response.data.results || [];
  } catch (error) {
    console.error("Error getting movie changes:", error);
    return [];
  }
}

/**
 * Get daily or weekly changes for TV shows
 * @param startDate Optional start date (YYYY-MM-DD)
 * @param endDate Optional end date (YYYY-MM-DD)
 * @returns List of changed TV show IDs
 */
export async function getTvChanges(
  startDate?: string,
  endDate?: string,
): Promise<number[]> {
  try {
    const params: Record<string, any> = {
      operation: "tv_changes",
    };

    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await axios.get("/.netlify/functions/tmdb", { params });

    return response.data.results || [];
  } catch (error) {
    console.error("Error getting TV changes:", error);
    return [];
  }
}

/**
 * Search for multiple movies by their IDs
 * @param ids Array of TMDB movie IDs
 * @returns Array of ContentItem objects
 */
export async function searchMoviesByIds(ids: number[]): Promise<ContentItem[]> {
  try {
    const results: ContentItem[] = [];

    // Process in smaller batches to avoid rate limiting
    const batchSize = 20;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const promises = batch.map((id) => getMovieById(id));
      const batchResults = await Promise.all(promises);

      // Filter out null results and add to results array
      results.push(
        ...(batchResults.filter((item) => item !== null) as ContentItem[]),
      );
    }

    return results;
  } catch (error) {
    console.error(`Error searching for movies by IDs:`, error);
    return [];
  }
}

/**
 * Search for multiple TV shows by their IDs
 * @param ids Array of TMDB TV show IDs
 * @returns Array of ContentItem objects
 */
export async function searchTvShowsByIds(
  ids: number[],
): Promise<ContentItem[]> {
  try {
    const results: ContentItem[] = [];

    // Process in smaller batches to avoid rate limiting
    const batchSize = 20;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const promises = batch.map((id) => getTvShowById(id));
      const batchResults = await Promise.all(promises);

      // Filter out null results and add to results array
      results.push(
        ...(batchResults.filter((item) => item !== null) as ContentItem[]),
      );
    }

    return results;
  } catch (error) {
    console.error(`Error searching for TV shows by IDs:`, error);
    return [];
  }
}
