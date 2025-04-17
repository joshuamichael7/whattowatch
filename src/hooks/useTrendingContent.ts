import { useState, useEffect } from "react";
import { getTrendingContent } from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";

interface OmdbMovie {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
  imdbRating?: string;
}

interface UseTrendingContentResult {
  trendingMovies: OmdbMovie[];
  popularTVShows: OmdbMovie[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTrendingContent(): UseTrendingContentResult {
  const [trendingMovies, setTrendingMovies] = useState<OmdbMovie[]>([]);
  const [popularTVShows, setPopularTVShows] = useState<OmdbMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Function to trigger a refetch
  const refetch = () => setRefreshKey((prev) => prev + 1);

  useEffect(() => {
    const fetchContent = async () => {
      console.log("[useTrendingContent] Starting content fetch");
      const startTime = performance.now();
      console.log(
        "[useTrendingContent] Starting content fetch at",
        new Date().toISOString(),
      );
      setIsLoading(true);
      setError(null);

      try {
        // Fetch trending content using the edge function with a higher limit
        // to allow for filtering by rating and randomization
        console.log(
          "[useTrendingContent] Fetching trending movies using edge function",
        );
        const movieData = await getTrendingContent("movie", 12);
        console.log(
          `[useTrendingContent] Movie data type: ${typeof movieData}, isArray: ${Array.isArray(movieData)}`,
        );
        console.log(`[useTrendingContent] Received ${movieData.length} movies`);
        if (movieData.length > 0) {
          console.log(
            `[useTrendingContent] First movie: ${JSON.stringify(movieData[0])}`,
          );
        }

        // Sort movies by rating (highest first)
        const sortedMovies = [...movieData].sort((a, b) => {
          const ratingA = a.vote_average || 0;
          const ratingB = b.vote_average || 0;
          return ratingB - ratingA;
        });

        // Get a random selection of the top rated movies
        // This ensures different content on each refresh while still showing quality content
        const topRatedMovies = sortedMovies.slice(0, 8); // Take top 8 rated
        const selectedMovies = [];

        // Select 4 random movies from the top rated ones
        while (selectedMovies.length < 4 && topRatedMovies.length > 0) {
          const randomIndex = Math.floor(Math.random() * topRatedMovies.length);
          selectedMovies.push(topRatedMovies.splice(randomIndex, 1)[0]);
        }

        console.log(
          "[useTrendingContent] Fetching trending TV shows using edge function",
        );
        let tvData = [];
        try {
          tvData = await getTrendingContent("tv", 12);
          console.log(
            `[useTrendingContent] Received ${tvData.length} TV shows`,
          );
          if (tvData.length > 0) {
            console.log(
              `[useTrendingContent] First TV show: ${JSON.stringify(tvData[0])}`,
            );
          }
        } catch (tvErr) {
          console.warn(
            "[useTrendingContent] Error fetching TV shows, continuing with empty array:",
            tvErr,
          );
          // Don't rethrow - just continue with empty TV shows
        }

        // Sort TV shows by rating (highest first)
        const sortedTVShows = [...tvData].sort((a, b) => {
          const ratingA = a.vote_average || 0;
          const ratingB = b.vote_average || 0;
          return ratingB - ratingA;
        });

        // Get a random selection of the top rated TV shows
        const topRatedTVShows = sortedTVShows.slice(0, 8); // Take top 8 rated
        const selectedTVShows = [];

        // Select 4 random TV shows from the top rated ones
        while (selectedTVShows.length < 4 && topRatedTVShows.length > 0) {
          const randomIndex = Math.floor(
            Math.random() * topRatedTVShows.length,
          );
          selectedTVShows.push(topRatedTVShows.splice(randomIndex, 1)[0]);
        }

        // Simple transformation to match the component's expected format
        const formattedMovies = selectedMovies.map((movie) => ({
          Title: movie.title || "Unknown Title",
          Year: movie.release_date || "Unknown Year",
          imdbID:
            movie.id || `unknown-${Math.random().toString(36).substring(2, 9)}`,
          Type: "movie",
          Poster: movie.poster_path || "",
          imdbRating:
            movie.vote_average !== undefined
              ? movie.vote_average.toString()
              : "0",
        }));

        const formattedShows = selectedTVShows.map((show) => ({
          Title: show.title || "Unknown Title",
          Year: show.release_date || show.first_air_date || "Unknown Year",
          imdbID:
            show.id || `unknown-${Math.random().toString(36).substring(2, 9)}`,
          Type: "series",
          Poster: show.poster_path || "",
          imdbRating:
            show.vote_average !== undefined
              ? show.vote_average.toString()
              : "0",
        }));

        console.log(
          `[useTrendingContent] Formatted ${formattedMovies.length} movies and ${formattedShows.length} TV shows`,
        );

        // Update state with the fetched content
        setTrendingMovies(formattedMovies);
        setPopularTVShows(formattedShows);

        const endTime = performance.now();
        console.log(
          `[useTrendingContent] Total fetch and processing time: ${endTime - startTime}ms`,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
        console.error("[useTrendingContent] Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [refreshKey]); // Refetch when refreshKey changes

  return { trendingMovies, popularTVShows, isLoading, error, refetch };
}
