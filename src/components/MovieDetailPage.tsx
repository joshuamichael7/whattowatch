import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  Film,
  ExternalLink,
  Heart,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getContentById, searchContent } from "@/lib/omdbClient";
import { supabase } from "@/lib/supabaseClient";
import { ContentItem } from "@/types/omdb";
import MovieDetailPageHeader from "@/components/MovieDetailPageHeader";
import MovieDetailPageFooter from "@/components/MovieDetailPageFooter";
import SimilarContentCarousel from "@/components/SimilarContentCarousel";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";

const genreMap: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

const MovieDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [movie, setMovie] = useState<ContentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromRecommendations, setFromRecommendations] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Check if user came from recommendations page
  useEffect(() => {
    // Check if there are recommendations in localStorage
    const hasRecommendations =
      localStorage.getItem("userRecommendations") !== null;

    // Check if the location state indicates we came from recommendations
    const fromLocationState = location.state?.fromRecommendations === true;

    setFromRecommendations(hasRecommendations || fromLocationState);
  }, [location]);

  // Check if movie is in user's watchlist
  useEffect(() => {
    const checkWatchlist = async () => {
      if (!isAuthenticated || !user || !movie) return;

      try {
        const { data } = await supabase
          .from("watchlist")
          .select("*")
          .eq("user_id", user.id)
          .eq("content_id", movie.id)
          .single();

        setIsInWatchlist(!!data);
      } catch (error) {
        console.error("Error checking watchlist:", error);
      }
    };

    checkWatchlist();
  }, [movie, user, isAuthenticated]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      try {
        // Check if id is an IMDB ID (starts with tt) or a title
        let movieData;

        if (id.startsWith("tt")) {
          console.log(`Looking up content by IMDB ID: ${id}`);
          // First try to get from Supabase by IMDB ID
          const { data: supabaseResults } = await supabase
            .from("content")
            .select("*")
            .eq("imdb_id", id)
            .limit(1);

          if (supabaseResults && supabaseResults.length > 0) {
            console.log(`Found content in Supabase by IMDB ID: ${id}`);
            movieData = supabaseResults[0];
          } else {
            // If not found in Supabase, get from OMDB directly
            console.log(
              `No match in Supabase, getting from OMDB by IMDB ID: ${id}`,
            );
            // Use the OMDB API directly with the i parameter
            const params = new URLSearchParams({
              i: id,
              plot: "full",
            });
            const response = await fetch(
              `/.netlify/functions/omdb?${params.toString()}`,
            );
            const data = await response.json();

            if (data && data.Response === "True") {
              // Format the OMDB data
              movieData = {
                id: data.imdbID,
                imdb_id: data.imdbID,
                title: data.Title,
                poster_path: data.Poster !== "N/A" ? data.Poster : "",
                media_type: data.Type === "movie" ? "movie" : "tv",
                release_date:
                  data.Released !== "N/A" ? data.Released : data.Year,
                vote_average:
                  data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : 0,
                vote_count:
                  data.imdbVotes !== "N/A"
                    ? parseInt(data.imdbVotes.replace(/,/g, ""))
                    : 0,
                genre_ids: [],
                genre_strings: data.Genre?.split(", ") || [],
                overview: data.Plot !== "N/A" ? data.Plot : "",
                content_rating: data.Rated !== "N/A" ? data.Rated : "",
              };

              // Store in Supabase for future use
              try {
                console.log(`Storing content in Supabase: ${movieData.title}`);
                await supabase.from("content").insert({
                  id: movieData.id,
                  imdb_id: movieData.imdb_id,
                  title: movieData.title,
                  overview: movieData.overview,
                  poster_path: movieData.poster_path,
                  release_date: movieData.release_date,
                  vote_average: movieData.vote_average,
                  vote_count: movieData.vote_count,
                  media_type: movieData.media_type,
                  genre_strings: movieData.genre_strings,
                  content_rating: movieData.content_rating,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
              } catch (storeError) {
                console.error("Error storing content in Supabase:", storeError);
                // Continue even if storage fails
              }
            }
          }
        } else {
          // If it's not an IMDB ID, assume it's a title
          const decodedTitle = decodeURIComponent(id);
          console.log(`Looking up content by title: ${decodedTitle}`);

          // Try to find exact match in Supabase first
          const { data: supabaseResults } = await supabase
            .from("content")
            .select("*")
            .ilike("title", decodedTitle)
            .limit(1);

          if (supabaseResults && supabaseResults.length > 0) {
            console.log(
              `Found exact match in Supabase for title: ${decodedTitle}`,
            );
            movieData = supabaseResults[0];
          } else {
            // If not found in Supabase, search OMDB
            console.log(
              `No match in Supabase, searching OMDB for: ${decodedTitle}`,
            );
            const searchResults = await searchContent(decodedTitle);

            if (searchResults && searchResults.length > 0) {
              // Get the first result's full details
              console.log(
                `Found ${searchResults.length} results in OMDB, getting details for first match`,
              );
              movieData = await getContentById(searchResults[0].id);
            }
          }
        }

        if (!movieData) {
          throw new Error("Content not found");
        }

        setMovie(movieData as ContentItem);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load content details",
        );
        console.error("Error fetching content details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id]);

  const handleAddToWatchlist = async (movie: ContentItem) => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add items to your watchlist",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isInWatchlist) {
        // Remove from watchlist
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", movie.id);

        if (error) throw error;

        setIsInWatchlist(false);
        toast({
          title: "Removed from watchlist",
          description: `${movie.title} has been removed from your watchlist`,
        });
      } else {
        // Add to watchlist
        const { error } = await supabase.from("watchlist").insert({
          user_id: user.id,
          content_id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path,
          media_type: movie.media_type,
          added_at: new Date().toISOString(),
        });

        if (error) throw error;

        setIsInWatchlist(true);
        toast({
          title: "Added to watchlist",
          description: `${movie.title} has been added to your watchlist`,
        });
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
      toast({
        title: "Error",
        description: "There was a problem updating your watchlist",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container py-12 flex justify-center items-center min-h-[50vh] font-body">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary animate-pulse-glow"></div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="container py-12 text-center min-h-[50vh] font-body">
        <h2 className="text-2xl font-bold mb-4 font-heading">Error</h2>
        <p className="text-muted-foreground mb-6">
          {error || "Movie not found"}
        </p>
        <Button asChild>
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <MovieDetailPageHeader title="MovieMatch" />

      <div className="relative w-full h-[40vh] overflow-hidden bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="absolute inset-0 opacity-60">
          {movie.poster_path && (
            <img
              src={movie.poster_path}
              alt=""
              className="w-full h-full object-cover filter blur-3xl scale-110"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
      </div>

      <div className="container py-8">
        <Button
          variant="ghost"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
          className="mb-6 transition-all hover:shadow-md"
        >
          <div className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </div>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
          <div>
            <div className="rounded-lg overflow-hidden shadow-lg transition-all hover:shadow-xl">
              {movie.poster_path ? (
                <img
                  src={movie.poster_path}
                  alt={movie.title}
                  className="w-full h-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-muted flex items-center justify-center">
                  <Film className="h-16 w-16 text-muted-foreground opacity-20" />
                </div>
              )}
            </div>

            <div className="mt-6 space-y-4">
              <Button
                className={`w-full transition-all hover:shadow-md ${isInWatchlist ? "" : "animate-pulse-glow"}`}
                variant={isInWatchlist ? "secondary" : "default"}
                onClick={() => handleAddToWatchlist(movie)}
              >
                <Heart
                  className={`mr-2 h-4 w-4 ${isInWatchlist ? "fill-current" : ""}`}
                />
                {isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
              </Button>
              <Button
                className="w-full transition-all hover:shadow-md"
                variant="outline"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              {fromRecommendations ? (
                <Button
                  className="w-full transition-all hover:shadow-md"
                  variant="secondary"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Recommendations
                </Button>
              ) : (
                <Button
                  className="w-full transition-all hover:shadow-md"
                  variant="secondary"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center mb-2">
              <Badge variant="outline" className="mr-2">
                <Film className="mr-1 h-3 w-3" />
                {movie.media_type === "movie" ? "Movie" : "TV Show"}
              </Badge>
              {movie.content_rating && (
                <Badge variant="secondary">{movie.content_rating}</Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-2 font-heading">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center text-sm text-muted-foreground mb-6">
              {movie.release_date && (
                <span className="flex items-center mr-4">
                  <Calendar className="mr-1 h-4 w-4" />
                  {new Date(movie.release_date).getFullYear()}
                </span>
              )}
              {movie.runtime && (
                <span className="flex items-center mr-4">
                  <Clock className="mr-1 h-4 w-4" />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              )}
              <span className="flex items-center">
                <Star className="mr-1 h-4 w-4 fill-yellow-500 text-yellow-500" />
                {movie.vote_average.toFixed(1)}/10
                <span className="text-xs ml-1">({movie.vote_count} votes)</span>
              </span>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2 font-heading">
                Overview
              </h2>
              <p className="text-muted-foreground">{movie.overview}</p>
            </div>

            {movie.genre_strings && movie.genre_strings.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2 font-heading">
                  Genres
                </h2>
                <div className="flex flex-wrap gap-2">
                  {movie.genre_strings.map((genre) => (
                    <Badge key={genre}>{genre}</Badge>
                  ))}
                </div>
              </div>
            )}

            {movie.streaming_providers && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2 font-heading">
                  Where to Watch
                </h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    movie.streaming_providers as Record<string, any>,
                  ).map(([provider, url]) => (
                    <Button
                      key={provider}
                      variant="outline"
                      asChild
                      className="transition-all hover:shadow-md"
                    >
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {provider}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Separator className="my-8" />
        <SimilarContentCarousel
          contentId={id || ""}
          mediaType={movie.media_type || "movie"}
          limit={8}
        />
      </div>

      <MovieDetailPageFooter />
    </div>
  );
};

export default MovieDetailPage;
