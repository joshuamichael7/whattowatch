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
import {
  getMovieById,
  getTvShowById,
  searchContent,
  getContentById,
} from "@/lib/tmdbClientProxy";
import { supabase } from "@/lib/supabaseClient";
import { ContentItem } from "@/types/omdb";
import MovieDetailPageHeader from "@/components/MovieDetailPageHeader";
import MovieDetailPageFooter from "@/components/MovieDetailPageFooter";
import SimilarContentCarousel from "@/components/SimilarContentCarousel";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { verifyRecommendationWithOmdb } from "@/services/aiService";
import { useRecommendations } from "@/contexts/RecommendationContext";
import RecommendationMatcher from "@/components/RecommendationMatcher";

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
  const { selectedRecommendation, setSelectedRecommendation } =
    useRecommendations();
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    null,
  );
  const [potentialMatches, setPotentialMatches] = useState<any[]>([]);
  const [needsUserSelection, setNeedsUserSelection] = useState(false);
  const locationState = location.state;

  useEffect(() => {
    const hasRecommendations =
      localStorage.getItem("userRecommendations") !== null;

    const fromLocationState = location.state?.fromRecommendations === true;

    setFromRecommendations(hasRecommendations || fromLocationState);
  }, [location]);

  const handleSelectMatch = async (selectedMatch: any) => {
    setIsLoading(true);
    try {
      let contentDetails;
      const contentType = selectedMatch.media_type;
      if (contentType === "movie") {
        contentDetails = await getMovieById(selectedMatch.id);
      } else if (contentType === "tv") {
        contentDetails = await getTvShowById(selectedMatch.id);
      }
      if (contentDetails) {
        // Add recommendation reason from original recommendation if available
        if (
          locationState?.recommendation?.reason ||
          locationState?.recommendation?.recommendationReason
        ) {
          contentDetails.recommendationReason =
            locationState.recommendation.reason ||
            locationState.recommendation.recommendationReason;
        }

        // Add synopsis from original recommendation if available and if OMDB doesn't have one
        if (
          (locationState?.recommendation?.synopsis ||
            locationState?.recommendation?.overview) &&
          (!contentDetails.overview || contentDetails.overview.trim() === "")
        ) {
          contentDetails.synopsis =
            locationState.recommendation.synopsis ||
            locationState.recommendation.overview;
        }

        setMovie(contentDetails);
        setNeedsUserSelection(false);
        setVerificationStatus("User selected content match");
      } else {
        throw new Error("Failed to load selected content details");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load selected content",
      );
    } finally {
      setIsLoading(false);
    }
  };

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
        // Get recommendation data from location state
        const locationRecommendation = location.state?.recommendation;
        const aiImdbId = locationRecommendation?.imdb_id;
        const aiTitle = locationRecommendation?.title || decodeURIComponent(id);
        const aiYear = locationRecommendation?.year || null;
        const aiSynopsis =
          locationRecommendation?.synopsis ||
          locationRecommendation?.overview ||
          "";

        console.log("AI recommendation data:", {
          title: aiTitle,
          year: aiYear,
          imdb_id: aiImdbId,
          synopsis: aiSynopsis?.substring(0, 50) + "...",
        });

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

        // PRIORITY 1: If we have an IMDB ID from AI recommendation, use it directly
        if (aiImdbId && aiImdbId.startsWith("tt")) {
          console.log(
            `Using AI-provided IMDB ID: ${aiImdbId} for title: ${aiTitle}`,
          );

          // For IMDB IDs, we need to use a different approach since TMDB doesn't support direct IMDB ID lookup
          // We'll search by title and year instead
          const searchResults = await searchContent(aiTitle, "multi", {
            year: aiYear,
          });
          const imdbContent =
            searchResults && searchResults.length > 0 ? searchResults[0] : null;

          if (imdbContent) {
            // Check if the title from IMDB matches the AI-provided title
            const titleMatches =
              imdbContent.title.toLowerCase().includes(aiTitle.toLowerCase()) ||
              aiTitle.toLowerCase().includes(imdbContent.title.toLowerCase());

            console.log(
              `IMDB title: "${imdbContent.title}", AI title: "${aiTitle}", match: ${titleMatches}`,
            );

            if (titleMatches) {
              // IMDB ID is correct, use this content
              console.log(
                `IMDB ID ${aiImdbId} verified for "${aiTitle}", using IMDB data`,
              );
              movieData = imdbContent;
              setVerificationStatus("IMDB ID verified, using official data");
            } else {
              // IMDB ID doesn't match title - we need to search by title
              console.log(
                `IMDB ID ${aiImdbId} returned title "${imdbContent.title}" which doesn't match "${aiTitle}". Searching by title.`,
              );

              // Search by title to see if we have multiple options
              const searchResults = await searchContent(aiTitle, "multi", {
                year: aiYear,
              });

              if (searchResults && searchResults.length > 1) {
                // Only show selection screen if we have multiple results for the title search
                console.log(
                  `Multiple results found for "${aiTitle}", showing selection screen`,
                );
                setPotentialMatches([imdbContent, ...searchResults]);
                setNeedsUserSelection(true);
                setIsLoading(false);
                return;
              } else if (searchResults && searchResults.length === 1) {
                // If exactly one result from title search, use that
                console.log(
                  `Single result found for title "${aiTitle}": ${searchResults[0].title}. Using this instead of IMDB ID result.`,
                );
                const contentType = searchResults[0].media_type;
                if (contentType === "movie") {
                  movieData = await getMovieById(searchResults[0].id);
                } else if (contentType === "tv") {
                  movieData = await getTvShowById(searchResults[0].id);
                }
                setVerificationStatus(
                  "Using title match instead of incorrect IMDB ID",
                );
              } else {
                // If no results from title search, fall back to the IMDB content we already have
                console.log(
                  `No results found for title "${aiTitle}". Using IMDB data despite title mismatch: ${imdbContent.title}`,
                );
                movieData = imdbContent;
                setVerificationStatus(
                  "Using IMDB data (note: title may differ from recommendation)",
                );
              }
            }
          } else {
            console.log(
              `IMDB ID ${aiImdbId} not found, falling back to title search`,
            );
            // Fall back to title search
          }
        }

        // PRIORITY 2: If we don't have movie data yet, check if URL parameter is an IMDB ID
        if (!movieData && id.startsWith("tt")) {
          // If it's already an IMDB ID, just get the content directly from OMDB
          console.log(`Looking up content by IMDB ID from URL: ${id}`);
          // Since we're using TMDB now, we can't directly query by IMDB ID
          // We'll need to search by title instead
          const searchResults = await searchContent(decodeURIComponent(id));
          if (searchResults && searchResults.length > 0) {
            const contentType = searchResults[0].media_type;
            if (contentType === "movie") {
              movieData = await getMovieById(searchResults[0].id);
            } else if (contentType === "tv") {
              movieData = await getTvShowById(searchResults[0].id);
            }
          }

          if (!movieData) {
            throw new Error("Content not found");
          }

          setVerificationStatus("Using IMDB data directly");
        }
        // PRIORITY 3: If we still don't have movie data, search by title and year if available
        else if (!movieData) {
          // If not an IMDB ID, it's likely a title that needs verification
          const decodedTitle = aiTitle || decodeURIComponent(id);
          console.log(
            `Looking up content by title: ${decodedTitle}${aiYear ? ` (${aiYear})` : ""}`,
          );

          // Search by title and year if available
          let searchResults;
          let exactMatch = null;

          if (aiYear) {
            console.log(
              `Searching TMDB for: ${decodedTitle} with year ${aiYear}`,
            );
            searchResults = await searchContent(decodedTitle, "multi", {
              year: aiYear,
            });

            // Check for exact title match with year
            exactMatch = searchResults?.find((item) => {
              const itemTitle = item.title || item.name || "";
              const itemYear = item.release_date
                ? new Date(item.release_date).getFullYear().toString()
                : item.first_air_date
                  ? new Date(item.first_air_date).getFullYear().toString()
                  : "";

              return (
                itemTitle.toLowerCase() === decodedTitle.toLowerCase() &&
                itemYear === aiYear
              );
            });

            // If no results with year, try without year
            if (!searchResults || searchResults.length === 0) {
              console.log(
                `No results found with year ${aiYear}, trying without year restriction`,
              );
              searchResults = await searchContent(decodedTitle);
            }
          } else {
            console.log(`Searching TMDB for: ${decodedTitle} without year`);
            searchResults = await searchContent(decodedTitle);

            // Check for exact title match
            exactMatch = searchResults?.find((item) => {
              const itemTitle = item.title || item.name || "";
              return itemTitle.toLowerCase() === decodedTitle.toLowerCase();
            });
          }

          if (searchResults && searchResults.length > 0) {
            console.log(
              `Found ${searchResults.length} results in TMDB for title search`,
            );

            // If we have an exact match, use it directly
            if (exactMatch) {
              console.log(
                `Found exact match for "${decodedTitle}": ${exactMatch.title || exactMatch.name}`,
              );
              const contentType = exactMatch.media_type;
              if (contentType === "movie") {
                movieData = await getMovieById(exactMatch.id);
              } else if (contentType === "tv") {
                movieData = await getTvShowById(exactMatch.id);
              }
              setVerificationStatus("Using exact title match");
            }
            // If we have multiple results and no exact match, show selection screen
            else if (searchResults.length > 1) {
              console.log(
                `Multiple results found for "${decodedTitle}", showing selection screen`,
              );

              // Sort results by relevance - exact title matches first, then by popularity
              searchResults.sort((a, b) => {
                const aTitle = (a.title || a.name || "").toLowerCase();
                const bTitle = (b.title || b.name || "").toLowerCase();
                const titleLower = decodedTitle.toLowerCase();

                // Exact title matches come first
                if (aTitle === titleLower && bTitle !== titleLower) return -1;
                if (bTitle === titleLower && aTitle !== titleLower) return 1;

                // Then sort by popularity
                return (b.popularity || 0) - (a.popularity || 0);
              });

              setPotentialMatches(searchResults);
              setNeedsUserSelection(true);
              setIsLoading(false);
              return;
            } else {
              // Only one result, use it
              console.log(
                `Single result found for "${decodedTitle}", using it: ${searchResults[0].title || searchResults[0].name}`,
              );
              const contentType = searchResults[0].media_type;
              if (contentType === "movie") {
                movieData = await getMovieById(searchResults[0].id);
              } else if (contentType === "tv") {
                movieData = await getTvShowById(searchResults[0].id);
              }
              setVerificationStatus("Using single match from title search");
            }
          } else {
            // Try a fuzzy search as a last resort
            console.log(
              `No exact matches found for "${decodedTitle}", trying fuzzy search`,
            );

            // Remove any year info from title and try again
            const titleWithoutYear = decodedTitle.replace(
              /\s*\([0-9]{4}\)$/,
              "",
            );
            if (titleWithoutYear !== decodedTitle) {
              searchResults = await searchContent(titleWithoutYear);

              if (searchResults && searchResults.length > 0) {
                console.log(
                  `Found ${searchResults.length} results with fuzzy search`,
                );
                setPotentialMatches(searchResults);
                setNeedsUserSelection(true);
                setIsLoading(false);
                return;
              }
            }

            throw new Error(
              `Content not found for "${decodedTitle}". Please try a different search.`,
            );
          }
        }

        // Set the movie data
        setMovie(movieData as ContentItem);

        // If we have AI recommendation data, add it to the movie data
        if (locationRecommendation) {
          setMovie((prev) => {
            if (!prev) return movieData as ContentItem;
            return {
              ...prev,
              recommendationReason:
                locationRecommendation.reason ||
                locationRecommendation.recommendationReason,
              synopsis:
                prev.synopsis || prev.plot || locationRecommendation.synopsis,
              aiRecommended: true,
            };
          });
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (needsUserSelection) {
    return (
      <div className="min-h-screen bg-background font-body">
        <MovieDetailPageHeader title="Select Content" />
        <div className="container py-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6 transition-all hover:shadow-md"
          >
            <div className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </div>
          </Button>

          <RecommendationMatcher
            recommendation={{
              title: decodeURIComponent(id),
              year: locationState?.recommendation?.year,
              imdb_id: locationState?.recommendation?.imdb_id,
              imdb_url: locationState?.recommendation?.imdb_url,
              reason:
                locationState?.recommendation?.recommendationReason ||
                locationState?.recommendation?.reason,
              synopsis:
                locationState?.recommendation?.synopsis ||
                locationState?.recommendation?.overview,
              type: locationState?.recommendation?.media_type,
            }}
            potentialMatches={potentialMatches}
            onSelectMatch={handleSelectMatch}
            onCancel={() => {
              if (fromRecommendations) {
                navigate("/", { state: { fromContentSelection: true } });
              } else {
                navigate(-1);
              }
            }}
            isLoading={isLoading}
          />
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="container py-12 text-center min-h-[50vh] font-body">
        <MovieDetailPageHeader title="Error" />
        <div className="flex flex-col items-center justify-center gap-6 mt-12">
          <h2 className="text-2xl font-bold mb-4 font-heading">
            Content Not Found
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {error ||
              "We couldn't find the content you're looking for. It may have been removed or is temporarily unavailable."}
          </p>
          <div className="flex gap-4">
            <Button asChild>
              <Link to="/">Back to Home</Link>
            </Button>
            {fromRecommendations && (
              <Button variant="outline" asChild>
                <Link to="/" state={{ fromContentError: true }}>
                  Back to Recommendations
                </Link>
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                // Try to search for the content again with a different approach
                setIsLoading(true);
                setError(null);
                const decodedTitle = decodeURIComponent(id);
                searchContent(decodedTitle, "multi").then((results) => {
                  if (results && results.length > 0) {
                    setPotentialMatches(results);
                    setNeedsUserSelection(true);
                  } else {
                    setError(
                      `No results found for "${decodedTitle}". Please try a different search.`,
                    );
                  }
                  setIsLoading(false);
                });
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
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
              <h2 className="text-xl font-semibold mb-2 font-heading">Plot</h2>
              <p className="text-muted-foreground">
                {movie.plot || movie.synopsis || "No plot available."}
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
          contentId={movie.imdb_id || id || ""}
          mediaType={movie.media_type || "movie"}
          limit={8}
        />
      </div>

      <MovieDetailPageFooter />
    </div>
  );
};

export default MovieDetailPage;
