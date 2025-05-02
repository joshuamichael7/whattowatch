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
import { useRecommendations } from "@/contexts/RecommendationContext";
import RecommendationMatcher from "@/components/RecommendationMatcher";
import { matchRecommendationWithOmdbResults } from "@/services/aiMatchingService";

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

  useEffect(() => {
    const checkWatchlist = async () => {
      if (!isAuthenticated || !user || !movie || !movie.id) return;

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

  const handleSelectMatch = async (selectedMatch: any) => {
    setIsLoading(true);
    try {
      const contentDetails = await getContentById(
        selectedMatch.imdbID || selectedMatch.id,
      );
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

  // Helper function to process AI matching results
  const processAiMatchingResults = async (
    aiTitle: string,
    aiYear: string | undefined,
    aiReason: string | undefined,
    aiSynopsis: string,
    detailedResults: any[],
  ) => {
    setVerificationStatus("Using AI to find the best match...");
    try {
      console.log(
        "[MovieDetailPage] Detailed results for AI matching:",
        detailedResults.map((r) => ({
          id: r.id,
          imdb_id: r.imdb_id,
          title: r.title,
          year: r.year,
          media_type: r.media_type,
        })),
      );

      const aiMatchedContent = await matchRecommendationWithOmdbResults(
        {
          title: aiTitle,
          year: aiYear,
          reason: aiReason,
          synopsis: aiSynopsis,
          overview: aiSynopsis, // Include synopsis as overview as well for redundancy
        },
        detailedResults,
      );

      if (aiMatchedContent) {
        // Make sure we have a valid ID for the movie
        if (!aiMatchedContent.id && aiMatchedContent.imdb_id) {
          aiMatchedContent.id = aiMatchedContent.imdb_id;
        }
        console.log("[MovieDetailPage] AI matched content:", {
          id: aiMatchedContent.id,
          imdb_id: aiMatchedContent.imdb_id,
          title: aiMatchedContent.title,
          year: aiMatchedContent.year,
          media_type: aiMatchedContent.media_type,
          overview: aiMatchedContent.overview?.substring(0, 50) + "...",
        });
        setMovie(aiMatchedContent);
        setVerificationStatus(
          "AI found the best match for this recommendation",
        );
        return true;
      } else {
        // If AI matching fails, show all options for user selection
        console.log("[MovieDetailPage] AI matching failed to return a match");
        console.log(
          "[MovieDetailPage] Setting potential matches for user selection",
        );
        setPotentialMatches(detailedResults);
        setNeedsUserSelection(true);
        setVerificationStatus("Please select the correct match manually");
        return false;
      }
    } catch (error) {
      console.error("[MovieDetailPage] Error during AI matching:", error);
      console.log(
        "[MovieDetailPage] Setting potential matches for user selection after error",
      );
      setPotentialMatches(detailedResults);
      setNeedsUserSelection(true);
      setVerificationStatus(
        "AI matching failed. Please select the correct match manually",
      );
      return false;
    }
  };

  // Helper function to get detailed results from search results
  const getDetailedResults = async (searchResults: any[]) => {
    const detailedResults = [];
    const originalResults = searchResults.slice(0, 5);

    for (const result of originalResults) {
      try {
        const details = await getContentById(result.id);
        if (details) detailedResults.push(details);
      } catch (error) {
        console.error(`Error getting details for ${result.id}:`, error);
        // If we can't get details, use the search result directly
        detailedResults.push(result);
      }
    }

    return detailedResults;
  };

  useEffect(() => {
    const fetchMovieDetails = async () => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      // Log the state to help with debugging
      console.log("[MovieDetailPage] Location state:", {
        hasProcessedContent: !!location.state?.processedContent,
        hasRecommendation: !!location.state?.recommendation,
        fromRecommendations: !!location.state?.fromRecommendations,
      });

      setVerificationStatus("Starting verification process...");

      // Check if we're coming from a recommendation that's still being processed
      const isProcessingRecommendation =
        location.state?.recommendation &&
        !location.state?.processedContent &&
        location.state?.recommendation.aiRecommended;

      try {
        // Get recommendation data from location state
        const locationRecommendation = location.state?.recommendation;
        const processedContent = location.state?.processedContent;
        const aiTitle = locationRecommendation?.title || decodeURIComponent(id);
        const aiYear = locationRecommendation?.year;
        const aiReason =
          locationRecommendation?.reason ||
          locationRecommendation?.recommendationReason;
        const aiSynopsis =
          locationRecommendation?.synopsis ||
          locationRecommendation?.overview ||
          "";

        console.log("AI recommendation data:", {
          title: aiTitle,
          year: aiYear,
          synopsis: aiSynopsis?.substring(0, 50) + "...",
        });

        // First check if we have pre-processed content from RecommendationGrid
        if (processedContent) {
          console.log("Using pre-processed content data:", processedContent);
          setMovie(processedContent);

          // Set verification status based on pre-processed data
          if (processedContent.aiRecommended) {
            setVerificationStatus(
              processedContent.verified
                ? `Content verified with ${(processedContent.similarityScore || 0) * 100}% confidence`
                : "AI recommended content",
            );
          } else {
            setVerificationStatus("Using pre-processed data");
          }

          // Store this processed content in localStorage to avoid redundant processing
          try {
            const storedProcessed =
              localStorage.getItem("processedRecommendations") || "{}";
            const processedItems = JSON.parse(storedProcessed);
            processedItems[id] = processedContent;
            localStorage.setItem(
              "processedRecommendations",
              JSON.stringify(processedItems),
            );
            console.log(
              "[MovieDetailPage] Updated processedRecommendations in localStorage",
            );
          } catch (err) {
            console.error(
              "[MovieDetailPage] Error updating localStorage:",
              err,
            );
          }

          setIsLoading(false);
          return;
        }

        // Check if we have this content in localStorage processed recommendations
        try {
          const storedProcessed = localStorage.getItem(
            "processedRecommendations",
          );
          if (storedProcessed) {
            const processedItems = JSON.parse(storedProcessed);
            // Try to find by ID or by title
            const matchedItem =
              processedItems[id] ||
              Object.values(processedItems).find(
                (item: any) => item.title === decodeURIComponent(id),
              );

            if (matchedItem) {
              console.log("Using stored processed content data:", matchedItem);
              setMovie(matchedItem);

              // Set verification status based on stored data
              if (matchedItem.aiRecommended) {
                setVerificationStatus(
                  matchedItem.verified
                    ? `Content verified with ${(matchedItem.similarityScore || 0) * 100}% confidence`
                    : "AI recommended content",
                );
              } else {
                setVerificationStatus("Using stored processed data");
              }

              setIsLoading(false);
              return;
            }
          }
        } catch (error) {
          console.error(
            "Error checking localStorage for processed content:",
            error,
          );
        }

        // If this is a recommendation that's still being processed in the background,
        // show a more specific message
        if (isProcessingRecommendation) {
          setVerificationStatus("Preparing recommendation details...");
        }

        // Next check if we have this movie in the RecommendationContext
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

        // If not in context, proceed with the new multistep approach
        if (locationRecommendation) {
          // Check if we have a recommendation but it's not being processed
          // This is to prevent duplicate processing when navigating from RecommendationGrid
          // Also check if background processing is happening for this recommendation
          const pendingProcessing = localStorage.getItem(
            "pendingRecommendationsToProcess",
          );
          const isPendingProcessing = pendingProcessing
            ? JSON.parse(pendingProcessing).some(
                (rec: any) =>
                  rec.id === locationRecommendation.id ||
                  rec.title === locationRecommendation.title,
              )
            : false;

          if (
            (location.state?.fromRecommendations &&
              !isProcessingRecommendation) ||
            isPendingProcessing
          ) {
            console.log(
              "Using recommendation data from location state without processing",
            );
            // Create a basic movie object from the recommendation data
            const movieFromRec: ContentItem = {
              id: locationRecommendation.id || id,
              imdb_id:
                locationRecommendation.imdb_id || id.startsWith("tt")
                  ? id
                  : undefined,
              title: locationRecommendation.title || decodeURIComponent(id),
              poster_path:
                locationRecommendation.poster ||
                locationRecommendation.poster_path,
              media_type:
                locationRecommendation.type === "movie" ? "movie" : "tv",
              vote_average: locationRecommendation.rating || 0,
              vote_count: 0,
              genre_ids: [],
              overview:
                locationRecommendation.synopsis ||
                locationRecommendation.overview ||
                "",
              synopsis:
                locationRecommendation.synopsis ||
                locationRecommendation.overview ||
                "",
              recommendationReason:
                locationRecommendation.reason ||
                locationRecommendation.recommendationReason ||
                "",
              reason:
                locationRecommendation.reason ||
                locationRecommendation.recommendationReason ||
                "",
              release_date: locationRecommendation.year,
              year: locationRecommendation.year,
              aiRecommended: true,
            };

            setMovie(movieFromRec);
            setVerificationStatus(
              isPendingProcessing
                ? "Using recommendation data (background processing in progress)"
                : "Using recommendation data",
            );
            setIsLoading(false);
            return;
          }
          setVerificationStatus("Searching for title matches in OMDB...");

          // Step 1: Search OMDB by title to get potential matches
          const searchQuery = aiTitle + (aiYear ? ` ${aiYear}` : "");
          console.log(`Looking up content by title: ${searchQuery}`);

          const searchResults = await searchContent(searchQuery);

          if (!searchResults || searchResults.length === 0) {
            // Try a more relaxed search without year
            console.log("No results found with year, trying without year");
            const relaxedResults = await searchContent(aiTitle);

            if (!relaxedResults || relaxedResults.length === 0) {
              throw new Error(`No content found matching "${aiTitle}"`);
            }

            // Get detailed info for each search result
            setVerificationStatus(
              "Found potential matches, getting details...",
            );
            const detailedResults = await getDetailedResults(relaxedResults);

            // If we have at least one detailed result, proceed with AI matching
            if (detailedResults.length > 0) {
              // Step 2: Use AI to match the original recommendation with OMDB results
              const matchSuccess = await processAiMatchingResults(
                aiTitle,
                aiYear,
                aiReason,
                aiSynopsis,
                detailedResults,
              );

              if (!matchSuccess) {
                // If AI matching fails and we're showing user selection, return early
                return;
              }
            } else {
              // No detailed results available
              throw new Error(`No content found matching "${aiTitle}"`);
            }
          } else {
            // Get detailed info for each search result
            setVerificationStatus(
              "Found potential matches, getting details...",
            );
            const detailedResults = await getDetailedResults(searchResults);

            // If we have at least one detailed result, proceed with AI matching
            if (detailedResults.length > 0) {
              // Step 2: Use AI to match the original recommendation with OMDB results
              const matchSuccess = await processAiMatchingResults(
                aiTitle,
                aiYear,
                aiReason,
                aiSynopsis,
                detailedResults,
              );

              if (!matchSuccess) {
                // If AI matching fails and we're showing user selection, return early
                return;
              }
            } else {
              // No detailed results available
              throw new Error(`No content found matching "${aiTitle}"`);
            }
          }
        }
        // If no recommendation data, just look up by ID directly
        else if (id.startsWith("tt")) {
          // If it's already an IMDB ID, just get the content directly from OMDB
          console.log(`Looking up content by IMDB ID from URL: ${id}`);
          const movieData = await getContentById(id);

          if (!movieData) {
            throw new Error("Content not found");
          }

          setMovie(movieData);
          setVerificationStatus("Using IMDB data directly");
        }
        // If not an IMDB ID, search by title
        else {
          const decodedTitle = decodeURIComponent(id);
          console.log(`Looking up content by title: ${decodedTitle}`);

          const searchResults = await searchContent(decodedTitle);

          if (searchResults && searchResults.length > 0) {
            // Only one result, use it
            if (searchResults.length === 1) {
              console.log(
                `Single result found for "${decodedTitle}", using it: ${searchResults[0].title}`,
              );
              const movieData = await getContentById(searchResults[0].id);
              setMovie(movieData);
              setVerificationStatus("Using single match from title search");
            }
            // Multiple results, use AI to find the best match
            else {
              console.log(
                `Multiple results found for "${decodedTitle}", using AI to find best match`,
              );

              // Get detailed info for each search result
              setVerificationStatus(
                "Found potential matches, getting details...",
              );
              const detailedResults = await getDetailedResults(searchResults);

              // If we have at least one detailed result, proceed with AI matching
              if (detailedResults.length > 0) {
                // Use AI to match
                const matchSuccess = await processAiMatchingResults(
                  decodedTitle,
                  undefined,
                  undefined,
                  "",
                  detailedResults,
                );

                if (!matchSuccess) {
                  // If AI matching fails and we're showing user selection, return early
                  return;
                }
              } else {
                throw new Error(`No content found matching "${decodedTitle}"`);
              }
            }
          } else {
            throw new Error(`No content found matching "${decodedTitle}"`);
          }
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
      // Add proper headers to prevent 406 error
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (isInWatchlist) {
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("content_id", movie.id)
          .select();

        if (error) throw error;

        setIsInWatchlist(false);
        toast({
          title: "Removed from watchlist",
          description: `${movie.title} has been removed from your watchlist`,
        });
      } else {
        const { error } = await supabase
          .from("watchlist")
          .insert({
            user_id: user.id,
            content_id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            media_type: movie.media_type,
            added_at: new Date().toISOString(),
          })
          .select();

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
          {locationState?.recommendation && (
            <p className="text-sm text-muted-foreground mt-2">
              Preparing details for "{locationState.recommendation.title}"
            </p>
          )}
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
            }}
            potentialMatches={potentialMatches}
            onSelectMatch={handleSelectMatch}
            onCancel={() => navigate(-1)}
          />
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
              {(movie.content_rating || movie.contentRating || movie.Rated) && (
                <Badge variant="secondary" className="mr-2 font-bold">
                  {movie.content_rating || movie.contentRating || movie.Rated}
                </Badge>
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
