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
  Loader2,
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
import { verifyRecommendationWithOmdb } from "@/services/aiService";

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
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const hasRecommendations =
      localStorage.getItem("userRecommendations") !== null;

    const fromLocationState = location.state?.fromRecommendations === true;

    setFromRecommendations(hasRecommendations || fromLocationState);
  }, [location]);

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
      setVerificationStatus("Starting verification process...");

      try {
        let movieData;

        if (id.startsWith("tt")) {
          console.log(`Looking up content by IMDB ID: ${id}`);
          console.log(`Getting from OMDB by IMDB ID: ${id}`);
          const params = new URLSearchParams({
            i: id,
            plot: "full",
          });
          const response = await fetch(
            `/.netlify/functions/omdb?${params.toString()}`,
          );
          const data = await response.json();

          if (data && data.Response === "True") {
            movieData = {
              id: data.imdbID,
              imdb_id: data.imdbID,
              title: data.Title,
              poster_path: data.Poster !== "N/A" ? data.Poster : "",
              media_type: data.Type === "movie" ? "movie" : "tv",
              release_date: data.Released !== "N/A" ? data.Released : data.Year,
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
          }
        } else {
          const decodedTitle = decodeURIComponent(id);
          console.log(`Looking up content by title: ${decodedTitle}`);
          console.log(`Searching OMDB for: ${decodedTitle}`);

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
            console.log(
              `No match in Supabase, searching OMDB for: ${decodedTitle}`,
            );
            const searchResults = await searchContent(decodedTitle);

            if (searchResults && searchResults.length > 0) {
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

        setVerificationStatus("Verifying content details...");
        console.log(`Running verification for: ${movieData.title}`);

        // Check if we have original AI data with a synopsis
        const hasOriginalAiData =
          movieData.originalAiData && movieData.originalAiData.synopsis;

        console.log(
          `Media type for ${movieData.title}: ${movieData.media_type}`,
        );

        // If we have original AI data, use it for verification
        if (hasOriginalAiData) {
          console.log(
            `Using original AI data for verification: ${movieData.title}`,
          );
          // Make sure we're using the original synopsis from AI for verification
          movieData.synopsis = movieData.originalAiData.synopsis;
          // Use the original year from AI if available
          if (movieData.originalAiData.year) {
            movieData.year = movieData.originalAiData.year;
          }
          // Use the original media type from AI if available
          if (movieData.originalAiData?.media_type) {
            console.log(
              `Using original media type from AI data: ${movieData.originalAiData.media_type}`,
            );
            movieData.media_type = movieData.originalAiData.media_type;
          }
        }

        try {
          console.log("Movie data before verification:", {
            title: movieData.title,
            synopsis: movieData.synopsis || movieData.overview,
            year:
              movieData.year ||
              (movieData.release_date
                ? movieData.release_date.substring(0, 4)
                : null),
            mediaType: movieData.media_type,
          });

          const verifiedMovie = await verifyRecommendationWithOmdb(movieData);

          if (verifiedMovie && verifiedMovie.verified) {
            console.log(`Successfully verified: ${verifiedMovie.title}`);
            console.log("Verification details:", {
              originalTitle: movieData.title,
              verifiedTitle: verifiedMovie.title,
              similarityScore: verifiedMovie.similarityScore,
              imdbId: verifiedMovie.imdb_id,
            });
            setVerificationStatus("Recommendation verified");
            movieData = verifiedMovie;
          } else {
            console.log(
              `Could not verify: ${movieData.title}, using original data`,
            );
            setVerificationStatus("Using original recommendation data");
          }

          setMovie(movieData as ContentItem);
        } catch (verifyError) {
          console.error("Error verifying recommendation:", verifyError);
          setVerificationStatus("Verification failed, using original data");
          setMovie(movieData as ContentItem);
        }
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
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary animate-pulse-glow"></div>
          <p className="text-muted-foreground">
            {verificationStatus
              ? verificationStatus
              : "Loading content details..."}
          </p>
        </div>
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

        {verificationStatus && (
          <div className="mb-4 p-3 bg-primary/10 text-primary rounded-md">
            {verificationStatus}
            {movie.aiRecommended && (
              <span className="block text-sm mt-1">
                This is an AI-recommended title.{" "}
                {movie.verified
                  ? `Details have been verified with ${movie.similarityScore ? (movie.similarityScore * 100).toFixed(0) + "% " : ""}confidence.`
                  : "Some details may not be accurate."}
              </span>
            )}
          </div>
        )}

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
              {movie.aiRecommended && (
                <Badge variant="secondary" className="ml-2 bg-primary/20">
                  AI Recommended
                </Badge>
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
                  {typeof movie.runtime === "number"
                    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
                    : movie.runtime}
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
              <p className="text-muted-foreground">
                {movie.overview || movie.Plot || "No overview available."}
              </p>
            </div>

            {movie.recommendationReason && (
              <div className="mb-6 p-3 bg-primary/10 rounded-md">
                <h2 className="text-xl font-semibold mb-2 font-heading">
                  Why it was recommended
                </h2>
                <p className="text-muted-foreground">
                  {movie.recommendationReason}
                </p>
              </div>
            )}

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
