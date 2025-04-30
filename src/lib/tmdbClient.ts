import axios from "axios";
import {
  ContentItem,
  TmdbMovieDetails,
  TmdbSearchResponse,
} from "@/types/omdb";

// Base URL for TMDB API
const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

// Get API key from environment variables
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY;
  if (!apiKey) {
    console.error("TMDB API key not found in environment variables");
    return "";
  }
  return apiKey;
};

// Rate limiting implementation
const rateLimiter = {
  queue: [] as (() => void)[],
  processing: false,
  lastRequestTime: 0,
  requestsInWindow: 0,
  windowSize: 10000, // 10 seconds
  maxRequestsPerWindow: 40, // 40 requests per 10 seconds

  enqueue(fn: () => void) {
    this.queue.push(fn);
    this.processQueue();
  },

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    const now = Date.now();
    const timeElapsed = now - this.lastRequestTime;

    // Reset counter if window has passed
    if (timeElapsed > this.windowSize) {
      this.requestsInWindow = 0;
      this.lastRequestTime = now;
    }

    // If we've hit the rate limit, wait until the window resets
    if (this.requestsInWindow >= this.maxRequestsPerWindow) {
      const waitTime = this.windowSize - timeElapsed;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.requestsInWindow = 0;
        this.lastRequestTime = Date.now();
      }
    }

    // Process the next request
    const nextFn = this.queue.shift();
    if (nextFn) {
      this.requestsInWindow++;
      this.lastRequestTime = Date.now();
      nextFn();
    }

    this.processing = false;

    // Continue processing if there are more items
    if (this.queue.length > 0) {
      this.processQueue();
    }
  },
};

// Helper function to make API calls with rate limiting
async function makeApiCall<T>(
  endpoint: string,
  params: Record<string, any> = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    rateLimiter.enqueue(async () => {
      try {
        const apiKey = getApiKey();
        if (!apiKey) {
          reject(new Error("TMDB API key not found"));
          return;
        }

        const response = await axios.get(`${TMDB_API_BASE_URL}${endpoint}`, {
          params: { ...params, api_key: apiKey },
          headers: {
            "Content-Type": "application/json",
          },
        });

        resolve(response.data);
      } catch (error) {
        console.error(`Error calling TMDB API at ${endpoint}:`, error);
        reject(error);
      }
    });
  });
}

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
    const endpoint = `/search/${type}`;
    const data = await makeApiCall<TmdbSearchResponse>(endpoint, {
      query,
      include_adult: false,
      language: "en-US",
      page: 1,
    });

    return data.results.map((item) => transformTmdbSearchResult(item));
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
    const endpoint = `/movie/${id}`;
    const data = await makeApiCall<TmdbMovieDetails>(endpoint, {
      append_to_response: "credits,watch/providers",
      language: "en-US",
    });

    return transformTmdbMovieDetails(data);
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
    const endpoint = `/tv/${id}`;
    const data = await makeApiCall(endpoint, {
      append_to_response: "credits,watch/providers",
      language: "en-US",
    });

    return transformTmdbTvDetails(data);
  } catch (error) {
    console.error(`Error getting TV show with ID ${id}:`, error);
    return null;
  }
}

/**
 * Transform TMDB search result to ContentItem format
 */
function transformTmdbSearchResult(item: any): ContentItem {
  const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");

  return {
    id: item.id.toString(),
    title: mediaType === "tv" ? item.name : item.title,
    poster_path: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "",
    backdrop_path: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : "",
    media_type: mediaType,
    release_date: item.release_date || item.first_air_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    genre_ids: item.genre_ids || [],
    overview: item.overview || "",
    popularity: item.popularity || 0,
    tmdb_id: item.id.toString(),
  };
}

/**
 * Transform TMDB movie details to ContentItem format
 */
function transformTmdbMovieDetails(movie: TmdbMovieDetails): ContentItem {
  // Extract US streaming providers if available
  const usProviders = movie["watch/providers"]?.results?.US || {};
  const streamingProviders: Record<string, any> = {};

  // Process streaming options (flatrate, rent, buy)
  if (usProviders.flatrate) {
    usProviders.flatrate.forEach((provider: any) => {
      streamingProviders[provider.provider_name] =
        `https://www.themoviedb.org/movie/${movie.id}/watch`;
    });
  }

  // Extract top cast (first 10 actors)
  const actors =
    movie.credits?.cast
      ?.slice(0, 10)
      ?.map((actor: any) => actor.name)
      ?.join(", ") || "";

  // Extract director
  const director =
    movie.credits?.crew
      ?.filter((person: any) => person.job === "Director")
      ?.map((person: any) => person.name)
      ?.join(", ") || "";

  // Extract writers (Screenplay, Writer, Story)
  const writer =
    movie.credits?.crew
      ?.filter((person: any) =>
        ["Screenplay", "Writer", "Story"].includes(person.job),
      )
      ?.map((person: any) => person.name)
      ?.join(", ") || "";

  // Extract genre names
  const genreStrings = movie.genres?.map((genre) => genre.name) || [];

  return {
    id: movie.id.toString(),
    tmdb_id: movie.id.toString(),
    imdb_id: movie.imdb_id,
    title: movie.title,
    poster_path: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "",
    backdrop_path: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
      : "",
    media_type: "movie",
    release_date: movie.release_date,
    vote_average: movie.vote_average || 0,
    vote_count: movie.vote_count || 0,
    genre_ids: movie.genres?.map((genre) => genre.id) || [],
    genre_strings: genreStrings,
    overview: movie.overview || "",
    runtime: movie.runtime || 0,
    content_rating: "", // TMDB doesn't provide content rating directly
    streaming_providers:
      Object.keys(streamingProviders).length > 0 ? streamingProviders : null,
    popularity: movie.popularity || 0,
    year: movie.release_date ? movie.release_date.substring(0, 4) : "",
    plot: movie.overview || "",
    director,
    actors,
    writer,
    language: movie.original_language,
    country:
      movie.production_countries?.map((country) => country.name)?.join(", ") ||
      "",
    tagline: movie.tagline || "",
  };
}

/**
 * Transform TMDB TV show details to ContentItem format
 */
function transformTmdbTvDetails(show: any): ContentItem {
  // Extract US streaming providers if available
  const usProviders = show["watch/providers"]?.results?.US || {};
  const streamingProviders: Record<string, any> = {};

  // Process streaming options (flatrate, rent, buy)
  if (usProviders.flatrate) {
    usProviders.flatrate.forEach((provider: any) => {
      streamingProviders[provider.provider_name] =
        `https://www.themoviedb.org/tv/${show.id}/watch`;
    });
  }

  // Extract top cast (first 10 actors)
  const actors =
    show.credits?.cast
      ?.slice(0, 10)
      ?.map((actor: any) => actor.name)
      ?.join(", ") || "";

  // Extract creators
  const director =
    show.created_by?.map((person: any) => person.name)?.join(", ") || "";

  // Extract genre names
  const genreStrings = show.genres?.map((genre: any) => genre.name) || [];

  return {
    id: show.id.toString(),
    tmdb_id: show.id.toString(),
    imdb_id: show.external_ids?.imdb_id || "",
    title: show.name,
    poster_path: show.poster_path
      ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
      : "",
    backdrop_path: show.backdrop_path
      ? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
      : "",
    media_type: "tv",
    first_air_date: show.first_air_date,
    vote_average: show.vote_average || 0,
    vote_count: show.vote_count || 0,
    genre_ids: show.genres?.map((genre: any) => genre.id) || [],
    genre_strings: genreStrings,
    overview: show.overview || "",
    runtime: show.episode_run_time?.[0] || 0,
    content_rating: "", // TMDB doesn't provide content rating directly
    streaming_providers:
      Object.keys(streamingProviders).length > 0 ? streamingProviders : null,
    popularity: show.popularity || 0,
    year: show.first_air_date ? show.first_air_date.substring(0, 4) : "",
    plot: show.overview || "",
    director, // Using creators as directors for TV shows
    actors,
    language: show.original_language,
    country: show.origin_country?.join(", ") || "",
    tagline: show.tagline || "",
    number_of_seasons: show.number_of_seasons || 0,
    number_of_episodes: show.number_of_episodes || 0,
  };
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
    const endpoint = `/trending/${mediaType}/${timeWindow}`;
    const data = await makeApiCall<TmdbSearchResponse>(endpoint);

    return data.results
      .slice(0, limit)
      .map((item) => transformTmdbSearchResult(item));
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
    const endpoint = "/movie/changes";
    const params: Record<string, any> = {};

    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await makeApiCall<{ results: { id: number }[] }>(
      endpoint,
      params,
    );

    return data.results.map((item) => item.id);
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
    const endpoint = "/tv/changes";
    const params: Record<string, any> = {};

    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const data = await makeApiCall<{ results: { id: number }[] }>(
      endpoint,
      params,
    );

    return data.results.map((item) => item.id);
  } catch (error) {
    console.error("Error getting TV changes:", error);
    return [];
  }
}
