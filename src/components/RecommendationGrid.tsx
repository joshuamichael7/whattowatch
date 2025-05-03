import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Film,
  Tv,
  Star,
  Info,
  ExternalLink,
  Clock,
  Filter,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { getContentById } from "@/lib/omdbClient";
import { ContentItem, genreMap } from "@/types/omdb";
import UserFeedbackButton from "./UserFeedbackButton";
import WatchlistButton from "./WatchlistButton";
import { ContentFilterOptions } from "./ContentFilters";
import { useAuth } from "@/contexts/AuthContext";
// Recommendation processing is now handled by the dedicated service
// import { verifyRecommendationWithOmdb } from "@/services/aiService";

interface RecommendationItem {
  id: string;
  title: string;
  type: "movie" | "tv";
  year: string;
  poster?: string;
  poster_path?: string;
  Poster?: string; // Added for OMDB API compatibility
  rating: number;
  genres: string[];
  synopsis: string;
  overview?: string; // Added for compatibility with ContentItem
  streamingOn: string[];
  recommendationReason: string;
  reason?: string; // Alternative field for recommendation reason
  runtime?: string;
  contentRating?: string;
  content_rating?: string;
  imdb_id?: string; // Added to support direct IMDB ID links
  imdb_url?: string; // Added to support direct IMDB URL links
  verified?: boolean; // Flag to indicate if the recommendation is pre-verified
  needsVerification?: boolean; // Flag to indicate if verification is needed
}

interface RecommendationGridProps {
  recommendations?: RecommendationItem[];
  isLoading?: boolean;
  onFilterChange?: (filters: any) => void;
  useDirectApi?: boolean;
  onFeedbackSubmit?: (itemId: string, isPositive: boolean) => void;
  userId?: string;
  userPreferences?: any;
  contentFilterOptions?: ContentFilterOptions;
}

const RecommendationGrid = ({
  recommendations = defaultRecommendations,
  isLoading = false,
  onFilterChange = () => {},
  useDirectApi = false,
  onFeedbackSubmit = () => {},
  userId,
  userPreferences,
  contentFilterOptions,
}: RecommendationGridProps) => {
  // Get user profile from AuthContext to access content rating preferences
  const { profile } = useAuth();
  const [selectedItem, setSelectedItem] = useState<RecommendationItem | null>(
    null,
  );
  const [loadedItems, setLoadedItems] =
    useState<RecommendationItem[]>(recommendations);
  const [filteredRecommendations, setFilteredRecommendations] =
    useState<RecommendationItem[]>(recommendations);
  const [sortBy, setSortBy] = useState("relevance");
  const [filterVisible, setFilterVisible] = useState(false);
  const [ratingFilter, setRatingFilter] = useState([0, 10]);
  const [yearFilter, setYearFilter] = useState([1950, 2023]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [processedRecommendations, setProcessedRecommendations] = useState<
    Record<string, ContentItem>
  >(() => {
    // Load any previously processed recommendations from localStorage
    try {
      const stored = localStorage.getItem("processedRecommendations");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading processed recommendations:", error);
      return {};
    }
  });

  // Track which recommendations are currently being processed
  const [processingRecommendations, setProcessingRecommendations] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const stored = localStorage.getItem("processingRecommendations");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading processing recommendations:", error);
      return {};
    }
  });

  useEffect(() => {
    const fetchAdditionalDetails = async (itemId: string) => {
      // Skip fetching if the item is already in processedRecommendations
      if (processedRecommendations[itemId]) {
        console.log(
          "Using pre-processed details for item:",
          itemId,
          processedRecommendations[itemId],
        );
        return;
      }

      try {
        const details = await getContentById(itemId);
        console.log(
          "Fetched details using useDirectApi:",
          useDirectApi,
          details,
        );

        // Add the fetched details to processedRecommendations
        if (details) {
          setProcessedRecommendations((prev) => ({
            ...prev,
            [itemId]: details,
          }));
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      }
    };

    if (recommendations.length > 0 && selectedItem) {
      fetchAdditionalDetails(selectedItem.id);
    }
  }, [selectedItem, useDirectApi, processedRecommendations]);

  // Background processing for recommendations using the dedicated service
  useEffect(() => {
    if (!recommendations || recommendations.length === 0) return;

    // Import the recommendation processing service
    import("@/services/recommendationProcessingService")
      .then(async (service) => {
        // First check if we have cached recommendations
        const cacheParams = {
          type: typeFilter,
          rating: ratingFilter,
          year: yearFilter,
          userId: userId || "anonymous",
          count: recommendations.length,
        };

        try {
          // Check if recommendations are already pre-verified
          const preVerifiedItems = recommendations.filter(
            (rec) => rec.verified === true,
          );

          if (preVerifiedItems.length === recommendations.length) {
            console.log(
              `[RecommendationGrid] All ${preVerifiedItems.length} recommendations are pre-verified, skipping processing`,
            );

            // Convert pre-verified recommendations to ContentItem format
            const preVerifiedContentItems = preVerifiedItems.reduce(
              (acc, item) => {
                if (item.id) {
                  acc[item.id] = {
                    ...item,
                    id: item.id,
                    title: item.title,
                    media_type: item.type,
                    poster_path: item.poster || item.poster_path,
                    vote_average: item.rating || 0,
                    overview: item.synopsis || item.overview || "",
                    genre_strings: item.genres || [],
                    year: item.year,
                    imdb_id: item.imdb_id,
                    content_rating: item.content_rating || item.contentRating,
                    contentRating: item.contentRating || item.content_rating,
                  };
                }
                return acc;
              },
              {},
            );

            setProcessedRecommendations(preVerifiedContentItems);
            return;
          }

          // Skip cache check - we're processing directly
          console.log(
            `[RecommendationGrid] Processing ${recommendations.length} recommendations directly`,
          );

          // Store recommendations for background processing
          service.storeRecommendationsForProcessing(recommendations);

          // Start the background processing
          service.startBackgroundProcessing();

          // Load any previously processed recommendations
          const processedRecs = service.getProcessedRecommendations();

          // Make sure content ratings are properly set in processed recommendations
          const updatedProcessedRecs = { ...processedRecs };
          Object.keys(updatedProcessedRecs).forEach((id) => {
            const item = updatedProcessedRecs[id];
            if (item.content_rating && !item.contentRating) {
              item.contentRating = item.content_rating;
            } else if (item.contentRating && !item.content_rating) {
              item.content_rating = item.contentRating;
            }
          });

          setProcessedRecommendations(updatedProcessedRecs);
        } catch (error) {
          console.error("[RecommendationGrid] Error checking cache:", error);

          // Fallback to standard processing
          service.storeRecommendationsForProcessing(recommendations);
          service.startBackgroundProcessing();
          const processedRecs = service.getProcessedRecommendations();
          setProcessedRecommendations(processedRecs);
        }
      })
      .catch((error) => {
        console.error(
          "[RecommendationGrid] Error importing recommendation processing service:",
          error,
        );
      });

    // No cleanup function needed as we want processing to continue
    // even if the component unmounts
  }, [recommendations, typeFilter, ratingFilter, yearFilter, userId]);

  // Filter recommendations based on content rating preferences
  useEffect(() => {
    if (!recommendations || recommendations.length === 0) return;

    // Get content rating preferences from user profile or passed contentFilterOptions
    const userContentFilters = profile?.content_filters || contentFilterOptions;

    if (
      userContentFilters?.acceptedRatings &&
      userContentFilters.acceptedRatings.length > 0
    ) {
      console.log(
        "Filtering by accepted ratings:",
        userContentFilters.acceptedRatings,
      );

      // Filter recommendations based on content rating
      const filtered = recommendations.filter((rec) => {
        // Check both in the original recommendation and in processed recommendations
        const originalRating = rec.contentRating || rec.content_rating;
        const processedRating =
          rec.id && processedRecommendations[rec.id]
            ? processedRecommendations[rec.id].contentRating ||
              processedRecommendations[rec.id].content_rating
            : null;

        const rating = processedRating || originalRating;

        // If no rating is available, include the recommendation
        if (!rating) return true;

        // Log the rating for debugging
        console.log(`Content rating for ${rec.title}: ${rating}`);

        // Check if the rating is in the accepted ratings list
        const isAccepted = userContentFilters.acceptedRatings?.includes(rating);

        // If not accepted, log it
        if (!isAccepted) {
          console.log(`Filtering out "${rec.title}" with rating ${rating}`);
        }

        return isAccepted;
      });

      console.log(
        `Filtered ${recommendations.length - filtered.length} items based on content rating`,
      );
      setFilteredRecommendations(filtered);
    } else {
      // If no content rating preferences, use all recommendations
      setFilteredRecommendations(recommendations);
    }

    // Additional user preferences handling
    if (userId && userPreferences) {
      console.log(`Loading recommendations for user ${userId}`);
      console.log("User preferences:", userPreferences);
    }
  }, [
    recommendations,
    profile,
    contentFilterOptions,
    userId,
    userPreferences,
    processedRecommendations,
  ]);

  const handleFilterApply = () => {
    onFilterChange({
      rating: ratingFilter,
      year: yearFilter,
      type: typeFilter,
    });
    setFilterVisible(false);
  };

  const getPosterImage = (item: RecommendationItem) => {
    // Check if we have a processed version with better poster data
    if (item.id && processedRecommendations[item.id]?.poster_path) {
      const processedItem = processedRecommendations[item.id];
      if (
        processedItem.poster_path &&
        processedItem.poster_path !== "N/A" &&
        !processedItem.poster_path.includes("null")
      ) {
        return processedItem.poster_path;
      }
    }

    // Fall back to the original logic
    if (item.poster && item.poster !== "N/A" && !item.poster.includes("null")) {
      return item.poster;
    }
    if (
      item.poster_path &&
      item.poster_path !== "N/A" &&
      !item.poster_path.includes("null")
    ) {
      return item.poster_path;
    }

    // Check if there's a Poster field (OMDB format)
    if (item.Poster && item.Poster !== "N/A" && !item.Poster.includes("null")) {
      return item.Poster;
    }

    return "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80";
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-background font-body">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary animate-pulse-glow"></div>
          <p className="text-muted-foreground">
            Finding the perfect recommendations for you...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-background p-4 md:p-6 font-body">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold font-heading">
          {userId
            ? `Recommended for ${userPreferences?.display_name || "You"}`
            : "Recommended for You"}
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setFilterVisible(!filterVisible)}
          >
            <Filter size={16} />
            Filters
          </Button>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="rating">Rating (High to Low)</SelectItem>
              <SelectItem value="year">Year (Newest)</SelectItem>
              <SelectItem value="title">Title (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filterVisible && (
        <div className="mb-6 p-4 border rounded-lg">
          <h3 className="text-lg font-medium mb-4 font-heading">
            Refine Results
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-medium font-heading">Content Type</h4>
              <Tabs
                defaultValue={typeFilter}
                onValueChange={setTypeFilter}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="movie">Movies</TabsTrigger>
                  <TabsTrigger value="tv">TV Shows</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <h4 className="text-sm font-medium font-heading">Rating</h4>
                <span className="text-sm text-muted-foreground">
                  {ratingFilter[0]} - {ratingFilter[1]}
                </span>
              </div>
              <Slider
                defaultValue={ratingFilter}
                min={0}
                max={10}
                step={0.5}
                onValueChange={setRatingFilter}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <h4 className="text-sm font-medium font-heading">Year</h4>
                <span className="text-sm text-muted-foreground">
                  {yearFilter[0]} - {yearFilter[1]}
                </span>
              </div>
              <Slider
                defaultValue={yearFilter}
                min={1950}
                max={2023}
                step={1}
                onValueChange={setYearFilter}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4 gap-2">
            <Button variant="outline" onClick={() => setFilterVisible(false)}>
              Cancel
            </Button>
            <Button onClick={handleFilterApply}>Apply Filters</Button>
          </div>
        </div>
      )}

      {filteredRecommendations.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-xl font-medium mb-2 font-heading">
            No recommendations found
          </h3>
          <p className="text-muted-foreground">
            Try adjusting your preferences or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 font-body">
          {filteredRecommendations.map((rec) => (
            <Card
              key={rec.id || rec.title} // Use title as fallback if id is null
              className="overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow"
            >
              <Link
                to={`/${rec.type}/${processedRecommendations[rec.id]?.imdb_id || rec.imdb_id || encodeURIComponent(processedRecommendations[rec.id]?.title || rec.title)}`}
                className="flex flex-col h-full"
                state={{
                  recommendation: {
                    ...rec,
                    title: processedRecommendations[rec.id]?.title || rec.title,
                    imdb_id:
                      processedRecommendations[rec.id]?.imdb_id || rec.imdb_id,
                    imdb_url:
                      processedRecommendations[rec.id]?.imdb_url ||
                      rec.imdb_url,
                    synopsis:
                      processedRecommendations[rec.id]?.synopsis ||
                      rec.synopsis ||
                      processedRecommendations[rec.id]?.overview ||
                      rec.overview,
                    overview:
                      processedRecommendations[rec.id]?.overview ||
                      rec.overview ||
                      processedRecommendations[rec.id]?.synopsis ||
                      rec.synopsis,
                    reason: rec.reason || rec.recommendationReason,
                    poster_path:
                      processedRecommendations[rec.id]?.poster_path ||
                      rec.poster_path ||
                      rec.poster,
                    media_type:
                      processedRecommendations[rec.id]?.media_type || rec.type,
                    vote_average:
                      processedRecommendations[rec.id]?.vote_average ||
                      rec.rating ||
                      0,
                    genre_ids:
                      processedRecommendations[rec.id]?.genre_ids || [],
                    genre_strings:
                      processedRecommendations[rec.id]?.genre_strings ||
                      rec.genres,
                    content_rating:
                      processedRecommendations[rec.id]?.content_rating ||
                      rec.contentRating ||
                      rec.content_rating,
                    contentRating:
                      processedRecommendations[rec.id]?.contentRating ||
                      processedRecommendations[rec.id]?.content_rating ||
                      rec.contentRating ||
                      rec.content_rating,
                    year: processedRecommendations[rec.id]?.year || rec.year,
                    verified:
                      processedRecommendations[rec.id]?.verified || false,
                  },
                  processedContent: processedRecommendations[rec.id],
                  fromRecommendations: true,
                }}
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                  <img
                    src={getPosterImage(rec)}
                    alt={`${rec.title} poster`}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80";
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant={rec.type === "movie" ? "default" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {rec.type === "movie" ? (
                        <Film size={12} />
                      ) : (
                        <Tv size={12} />
                      )}
                      {rec.type === "movie" ? "Movie" : "TV"}
                    </Badge>
                  </div>
                  {rec.needsVerification && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className="bg-background/70">
                        AI Recommended
                      </Badge>
                    </div>
                  )}
                </div>

                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-base line-clamp-1 font-heading">
                    {processedRecommendations[rec.id]?.title || rec.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <span>
                      {processedRecommendations[rec.id]?.year || rec.year}
                    </span>
                    {rec.rating > 0 && (
                      <span className="flex items-center">
                        <Star
                          size={14}
                          className="fill-yellow-400 text-yellow-400 mr-1"
                        />
                        {rec.rating.toFixed(1)}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-3 pt-2 flex-grow">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {/* Use processed genres if available */}
                    {processedRecommendations[rec.id]?.genre_strings &&
                      Array.isArray(
                        processedRecommendations[rec.id].genre_strings,
                      ) &&
                      processedRecommendations[rec.id].genre_strings
                        .slice(0, 2)
                        .map((genre) => (
                          <Badge
                            key={genre}
                            variant="outline"
                            className="text-xs"
                          >
                            {genre}
                          </Badge>
                        ))}
                    {processedRecommendations[rec.id]?.genre_strings &&
                      Array.isArray(
                        processedRecommendations[rec.id].genre_strings,
                      ) &&
                      processedRecommendations[rec.id].genre_strings.length >
                        2 && (
                        <Badge variant="outline" className="text-xs">
                          +
                          {processedRecommendations[rec.id].genre_strings
                            .length - 2}
                        </Badge>
                      )}
                    {/* Fallback to original genres if processed not available */}
                    {!processedRecommendations[rec.id]?.genre_strings &&
                      rec.genres &&
                      Array.isArray(rec.genres) &&
                      rec.genres.slice(0, 2).map((genre) => (
                        <Badge
                          key={genre}
                          variant="outline"
                          className="text-xs"
                        >
                          {genre}
                        </Badge>
                      ))}
                    {!processedRecommendations[rec.id]?.genre_strings &&
                      rec.genres &&
                      Array.isArray(rec.genres) &&
                      rec.genres.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{rec.genres.length - 2}
                        </Badge>
                      )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {processedRecommendations[rec.id]?.overview ||
                      rec.synopsis ||
                      rec.overview ||
                      "No synopsis available"}
                  </p>
                  <p className="text-xs text-primary-foreground mt-1 bg-primary/10 p-1 rounded line-clamp-2 font-medium">
                    {rec.recommendationReason ||
                      rec.reason ||
                      "Matches your preferences"}
                  </p>
                  {(processedRecommendations[rec.id]?.imdb_id ||
                    rec.imdb_id) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      IMDB:{" "}
                      {processedRecommendations[rec.id]?.imdb_id || rec.imdb_id}
                    </p>
                  )}
                </CardContent>
              </Link>

              <CardFooter className="p-3 pt-0">
                <div className="flex gap-2 w-full mb-2">
                  <UserFeedbackButton
                    contentId={rec.id}
                    isPositive={true}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    showText={false}
                    onFeedbackSubmitted={(success) => {
                      if (success) onFeedbackSubmit(rec.id, true);
                    }}
                  />
                  <UserFeedbackButton
                    contentId={rec.id}
                    isPositive={false}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    showText={false}
                    onFeedbackSubmitted={(success) => {
                      if (success) onFeedbackSubmit(rec.id, false);
                    }}
                  />
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setSelectedItem(rec)}
                    >
                      <Info size={16} className="mr-2" />
                      Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    {selectedItem && (
                      <>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 font-heading">
                            {selectedItem.title}
                            <Badge
                              variant={
                                selectedItem.type === "movie"
                                  ? "default"
                                  : "secondary"
                              }
                              className="ml-2"
                            >
                              {selectedItem.type === "movie"
                                ? "Movie"
                                : "TV Show"}
                            </Badge>
                          </DialogTitle>
                          <DialogDescription className="flex items-center gap-3">
                            <span>{selectedItem.year}</span>
                            {(selectedItem.contentRating ||
                              selectedItem.content_rating) && (
                              <Badge variant="outline">
                                {selectedItem.contentRating ||
                                  selectedItem.content_rating}
                              </Badge>
                            )}
                            {selectedItem.runtime && (
                              <span className="flex items-center gap-1">
                                <Clock size={14} />
                                {selectedItem.runtime}
                              </span>
                            )}
                            {selectedItem.rating > 0 && (
                              <span className="flex items-center gap-1">
                                <Star
                                  size={14}
                                  className="fill-yellow-400 text-yellow-400"
                                />
                                {selectedItem.rating.toFixed(1)}/10
                              </span>
                            )}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 mt-4">
                          <div className="aspect-[2/3] overflow-hidden rounded-md bg-muted">
                            <img
                              src={getPosterImage(selectedItem)}
                              alt={`${selectedItem.title} poster`}
                              className="object-cover w-full h-full"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80";
                              }}
                            />
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-1 font-heading">
                                Synopsis
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {selectedItem.overview ||
                                  "No description available"}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-medium mb-1 font-heading">
                                Genres
                              </h4>
                              <div className="flex flex-wrap gap-1">
                                {selectedItem.genres &&
                                  Array.isArray(selectedItem.genres) &&
                                  selectedItem.genres.map((genre) => (
                                    <Badge key={genre} variant="outline">
                                      {genre}
                                    </Badge>
                                  ))}
                              </div>
                            </div>

                            {selectedItem.streamingOn &&
                              selectedItem.streamingOn.length > 0 && (
                                <div>
                                  <h4 className="font-medium mb-1 font-heading">
                                    Available on
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {selectedItem.streamingOn.map((service) => (
                                      <Badge key={service}>{service}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                            <div>
                              <h4 className="font-medium mb-1 font-heading">
                                Why we recommend this
                              </h4>
                              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md italic font-body">
                                {selectedItem.reason ||
                                  selectedItem.recommendationReason ||
                                  "Matches your preferences"}
                              </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <WatchlistButton
                                contentId={selectedItem.id}
                                variant="outline"
                                className="flex items-center gap-2"
                              />
                              <Button
                                className="flex items-center gap-2"
                                asChild
                              >
                                <Link
                                  to={`/${selectedItem.type}/${processedRecommendations[selectedItem.id]?.imdb_id || selectedItem.imdb_id || selectedItem.id || encodeURIComponent(processedRecommendations[selectedItem.id]?.title || selectedItem.title)}`}
                                  state={{
                                    recommendation: {
                                      ...selectedItem,
                                      title:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.title || selectedItem.title,
                                      imdb_id:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.imdb_id || selectedItem.imdb_id,
                                      imdb_url:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.imdb_url || selectedItem.imdb_url,
                                      synopsis:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.synopsis ||
                                        selectedItem.synopsis ||
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.overview ||
                                        selectedItem.overview,
                                      overview:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.overview ||
                                        selectedItem.overview ||
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.synopsis ||
                                        selectedItem.synopsis,
                                      reason:
                                        selectedItem.reason ||
                                        selectedItem.recommendationReason,
                                      poster_path:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.poster_path ||
                                        selectedItem.poster_path ||
                                        selectedItem.poster,
                                      media_type:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.media_type || selectedItem.type,
                                      vote_average:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.vote_average ||
                                        selectedItem.rating ||
                                        0,
                                      genre_ids:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.genre_ids || [],
                                      genre_strings:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.genre_strings || selectedItem.genres,
                                      content_rating:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.content_rating ||
                                        selectedItem.contentRating ||
                                        selectedItem.content_rating,
                                      contentRating:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.contentRating ||
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.content_rating ||
                                        selectedItem.contentRating ||
                                        selectedItem.content_rating,
                                      year:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.year || selectedItem.year,
                                      verified:
                                        processedRecommendations[
                                          selectedItem.id
                                        ]?.verified || false,
                                    },
                                    processedContent:
                                      processedRecommendations[selectedItem.id],
                                    fromRecommendations: true,
                                  }}
                                >
                                  <ExternalLink size={16} />
                                  View Details
                                </Link>
                              </Button>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <UserFeedbackButton
                                contentId={selectedItem.id}
                                isPositive={true}
                                variant="outline"
                                className="flex items-center gap-2"
                                onFeedbackSubmitted={(success) => {
                                  if (success)
                                    onFeedbackSubmit(selectedItem.id, true);
                                }}
                              />
                              <UserFeedbackButton
                                contentId={selectedItem.id}
                                isPositive={false}
                                variant="outline"
                                className="flex items-center gap-2"
                                onFeedbackSubmitted={(success) => {
                                  if (success)
                                    onFeedbackSubmit(selectedItem.id, false);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const defaultRecommendations: RecommendationItem[] = [
  {
    id: "1",
    title: "Inception",
    type: "movie",
    year: "2010",
    poster:
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
    rating: 8.8,
    genres: ["Sci-Fi", "Action", "Thriller"],
    synopsis:
      "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    streamingOn: ["Netflix", "HBO Max"],
    recommendationReason:
      "Because you enjoyed mind-bending sci-fi movies with complex plots",
    runtime: "2h 28m",
    contentRating: "PG-13",
  },
  {
    id: "2",
    title: "Stranger Things",
    type: "tv",
    year: "2016",
    poster:
      "https://images.unsplash.com/photo-1560759226-14da22a643ef?w=800&q=80",
    rating: 8.7,
    genres: ["Drama", "Fantasy", "Horror"],
    synopsis:
      "When a young boy disappears, his mother, a police chief, and his friends must confront terrifying supernatural forces in order to get him back.",
    streamingOn: ["Netflix"],
    recommendationReason:
      "Based on your interest in supernatural themes and 80s nostalgia",
    contentRating: "TV-14",
  },
  {
    id: "3",
    title: "The Shawshank Redemption",
    type: "movie",
    year: "1994",
    poster:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80",
    rating: 9.3,
    genres: ["Drama"],
    synopsis:
      "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    streamingOn: ["Amazon Prime", "HBO Max"],
    recommendationReason:
      "Matches your preference for powerful character-driven dramas",
    runtime: "2h 22m",
    contentRating: "R",
  },
  {
    id: "4",
    title: "Breaking Bad",
    type: "tv",
    year: "2008",
    poster:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=800&q=80",
    rating: 9.5,
    genres: ["Crime", "Drama", "Thriller"],
    synopsis:
      "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
    streamingOn: ["Netflix", "AMC+"],
    recommendationReason:
      "Based on your interest in complex characters and crime dramas",
    contentRating: "TV-MA",
  },
  {
    id: "5",
    title: "Parasite",
    type: "movie",
    year: "2019",
    poster:
      "https://images.unsplash.com/photo-1611523658822-385aa008324c?w=800&q=80",
    rating: 8.6,
    genres: ["Drama", "Thriller", "Comedy"],
    synopsis:
      "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
    streamingOn: ["Hulu"],
    recommendationReason:
      "Matches your interest in thought-provoking international films",
    runtime: "2h 12m",
    contentRating: "R",
  },
  {
    id: "6",
    title: "The Mandalorian",
    type: "tv",
    year: "2019",
    poster:
      "https://images.unsplash.com/photo-1518744386442-2d48ac47a7eb?w=800&q=80",
    rating: 8.7,
    genres: ["Action", "Adventure", "Sci-Fi"],
    synopsis:
      "The travels of a lone bounty hunter in the outer reaches of the galaxy, far from the authority of the New Republic.",
    streamingOn: ["Disney+"],
    recommendationReason:
      "Based on your interest in space adventures and Star Wars content",
    contentRating: "TV-14",
  },
  {
    id: "7",
    title: "Knives Out",
    type: "movie",
    year: "2019",
    poster:
      "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=800&q=80",
    rating: 7.9,
    genres: ["Comedy", "Crime", "Drama"],
    synopsis:
      "A detective investigates the death of a patriarch of an eccentric, combative family.",
    streamingOn: ["Amazon Prime"],
    recommendationReason:
      "Matches your preference for clever mysteries with humor",
    runtime: "2h 10m",
    contentRating: "PG-13",
  },
  {
    id: "8",
    title: "The Queen's Gambit",
    type: "tv",
    year: "2020",
    poster:
      "https://images.unsplash.com/photo-1580541631950-7282082b03fe?w=800&q=80",
    rating: 8.6,
    genres: ["Drama"],
    synopsis:
      "Orphaned at the tender age of nine, prodigious introvert Beth Harmon discovers and masters the game of chess in 1960s USA. But child stardom comes at a price.",
    streamingOn: ["Netflix"],
    recommendationReason:
      "Based on your interest in character-driven period dramas",
    contentRating: "TV-MA",
  },
];

export default RecommendationGrid;
