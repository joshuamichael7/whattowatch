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
  const { selectedRecommendation } = useRecommendations();
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
        // First check if we have this movie in the RecommendationContext
        if (
          selectedRecommendation &&
          (selectedRecommendation.id === id ||
            selectedRecommendation.title === decodeURIComponent(id))
        ) {
          console.log(
            "Using movie data from RecommendationContext:",
            selectedRecommendation,
          );
          setMovie(selectedRecommendation);

          // Set verification status based on recommendation data
          if (selectedRecommendation.aiRecommended) {
            setVerificationStatus(
              selectedRecommendation.verified
                ? `Content verified with ${(selectedRecommendation.similarityScore || 0) * 100}% confidence`
                : "AI recommended content",
            );
          } else {
            setVerificationStatus("Using data from recommendations");
          }

          setIsLoading(false);
          return;
        }

        // If not in context, proceed with regular fetching
        let movieData;
        let verifiedMovie = null;

        // First, check if this is from an AI recommendation that needs verification
        if (!id.startsWith("tt")) {
          // If not an IMDB ID, it's likely a title that needs verification
          const decodedTitle = decodeURIComponent(id);
          console.log(`Looking up content by title: ${decodedTitle}`);
          console.log(`Searching OMDB for: ${decodedTitle}`);

          // Get search results
          const searchResults = await searchContent(decodedTitle);

          if (searchResults && searchResults.length > 0) {
            console.log(
              `Found ${searchResults.length} results in OMDB for title search`,
            );

            // Create a temporary movie data object for verification
            const tempMovieData = {
              title: decodedTitle,
              synopsis: "", // We might not have a synopsis yet
              overview: "",
              media_type: "movie", // Default to movie, will be updated during verification
            };

            setVerificationStatus("Verifying content with OMDB...");

            // Try to verify with the first search result
            try {
              // Get full details for the first result to use for verification
              const firstResult = await getContentById(searchResults[0].id);

              if (firstResult) {
                // Get the original AI synopsis from the URL parameter if available
                const urlParams = new URLSearchParams(window.location.search);
                const aiSynopsis = urlParams.get("synopsis");

                // Only use AI-provided synopsis - never use unrelated content's overview
                const contextSynopsis =
                  selectedRecommendation?.synopsis ||
                  selectedRecommendation?.overview ||
                  "";
                tempMovieData.synopsis = contextSynopsis || aiSynopsis || "";
                tempMovieData.overview = contextSynopsis || aiSynopsis || "";

                console.log(
                  `Using synopsis for verification: "${tempMovieData.synopsis?.substring(0, 50)}..."`,
                );

                console.log("Verifying content with OMDB first...");
                verifiedMovie =
                  await verifyRecommendationWithOmdb(tempMovieData);

                if (
                  verifiedMovie &&
                  verifiedMovie.verified &&
                  verifiedMovie.imdb_id
                ) {
                  console.log(`Successfully verified: ${verifiedMovie.title}`);
                  console.log("Verification details:", {
                    originalTitle: decodedTitle,
                    verifiedTitle: verifiedMovie.title,
                    similarityScore: verifiedMovie.similarityScore,
                    imdbId: verifiedMovie.imdb_id,
                  });

                  setVerificationStatus("Content verified, loading details...");

                  // Now that we have a verified IMDB ID, use it to get the full details
                  console.log(
                    `Loading full details using verified IMDB ID: ${verifiedMovie.imdb_id}`,
                  );
                  movieData = await getContentById(verifiedMovie.imdb_id);
                } else {
                  console.log(
                    `Could not verify: ${decodedTitle}, using first search result`,
                  );
                  setVerificationStatus(
                    "Could not verify content, using best match",
                  );
                  movieData = searchResults[0];
                }
              } else {
                console.log(
                  `No details found for first search result, using basic search result`,
                );
                movieData = searchResults[0];
              }
            } catch (verifyError) {
              console.error("Error during verification:", verifyError);
              setVerificationStatus(
                "Verification failed, using search results",
              );
              movieData = searchResults[0];
            }
          } else {
            throw new Error("Content not found");
          }
        } else {
          // If it's already an IMDB ID, just get the content directly
          console.log(`Looking up content by IMDB ID: ${id}`);
          movieData = await getContentById(id);

          if (!movieData) {
            throw new Error("Content not found");
          }
        }

        // Set the movie data
        setMovie(movieData as ContentItem);

        // Update verification status for display
        if (verifiedMovie && verifiedMovie.verified) {
          setVerificationStatus(
            `Content verified with ${(verifiedMovie.similarityScore || 0) * 100}% confidence`,
          );
        } else if (id.startsWith("tt")) {
          setVerificationStatus("Using IMDB data directly");
        } else {
          setVerificationStatus("Using best available match");
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
  }, [id, selectedRecommendation]);

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
