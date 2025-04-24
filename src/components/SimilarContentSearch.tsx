import React, { useState, useEffect, useMemo } from "react";
import { Search, X, Film, Tv, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  searchContent,
  getContentById,
  getSimilarContent,
} from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";

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

interface SimilarContentSearchProps {
  onSelectItem?: (item: ContentItem) => void;
  useDirectApi?: boolean;
  initialSelectedItem?: ContentItem | null;
}

const SimilarContentSearch = ({
  onSelectItem = () => {},
  useDirectApi = true, // Always use direct API
  initialSelectedItem = null,
}: SimilarContentSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [similarContent, setSimilarContent] = useState<ContentItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(
    initialSelectedItem,
  );
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isUsingAi, setIsUsingAi] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsItem, setDetailsItem] = useState<ContentItem | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    console.log("[DEBUG] handleSearch started with query:", searchQuery);
    setIsSearching(true);
    setError(null);

    try {
      console.log(
        "[DEBUG] Before calling searchContent with enhanced search strategy",
      );
      const results = await searchContent(searchQuery, "all");
      console.log(
        "[DEBUG] After calling searchContent, results:",
        results ? results.length : "null",
      );

      if (!results) {
        console.error("[DEBUG] Search results are null or undefined");
        setSearchResults([]);
        setError("An error occurred while searching. Please try again.");
        return;
      }

      setSearchResults(results);
      if (results.length === 0) {
        console.log("[DEBUG] No search results found");
        setError("No results found. Try a different search term.");
      }
    } catch (error) {
      console.error("[DEBUG] Search error:", error);
      setSearchResults([]);
      setError("An error occurred while searching. Please try again.");
    } finally {
      console.log("[DEBUG] handleSearch completed");
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (initialSelectedItem) {
      getSimilarContentForItem(initialSelectedItem);
    } else if (selectedItem && similarContent.length === 0) {
      // If we have a selected item from localStorage but no similar content yet, fetch it
      getSimilarContentForItem(selectedItem);
    }
  }, [initialSelectedItem]);

  const getSimilarContentForItem = async (item: ContentItem) => {
    console.log("[DEBUG] getSimilarContentForItem started with item:", {
      id: item.id,
      title: item.title,
      media_type: item.media_type,
      overview: item.overview ? item.overview.substring(0, 50) + "..." : "none",
      imdb_id: item.imdbID || "none",
      hasGenres: item.genre_strings && item.genre_strings.length > 0,
      genres: item.genre_strings ? item.genre_strings.join(", ") : "none",
    });

    setSelectedItem(item);
    setIsSearching(true);
    setError(null);
    setAiError(null);

    const canUseAi = item.overview && item.title;
    console.log("[DEBUG] canUseAi:", canUseAi);
    setIsUsingAi(canUseAi);

    if (canUseAi) {
      setIsAiLoading(true);
    }

    try {
      console.log(
        `[SimilarContentSearch] Getting similar content for: ${item.title} (${item.media_type}), ID: ${item.id}, IMDB ID: ${item.imdbID || "unknown"}`,
      );

      console.log(
        `[SimilarContentSearch] Using AI for recommendations: ${canUseAi}`,
      );

      // Check if item has genres
      const hasGenres =
        item.genre_strings &&
        Array.isArray(item.genre_strings) &&
        item.genre_strings.length > 0;

      if (!hasGenres) {
        console.log(
          "[DEBUG] Item doesn't have genres, will try to fetch them from OMDB",
        );
      }

      console.log("[DEBUG] Before calling getSimilarContent");
      const similarItems = await getSimilarContent(
        item.id,
        useDirectApi,
        12,
        canUseAi,
        true,
      );
      console.log(
        "[DEBUG] After calling getSimilarContent, received:",
        similarItems ? similarItems.length : "null",
      );

      if (!similarItems || !Array.isArray(similarItems)) {
        console.error(
          "[DEBUG] similarItems is null, undefined, or not an array",
        );
        setSimilarContent([]);
        setError("Failed to retrieve similar content. Please try again.");
        return;
      }

      // Ensure we have valid items with required fields
      const validItems = similarItems.filter((item) => {
        return item && item.title && item.id;
      });

      if (validItems.length === 0 && similarItems.length > 0) {
        console.error("[DEBUG] No valid items found in similarItems");
        setSimilarContent([]);
        setError("Failed to retrieve valid similar content. Please try again.");
        return;
      }

      console.log(
        `[SimilarContentSearch] Found ${similarItems.length} similar items`,
      );

      const aiRecommendations = similarItems.filter(
        (item) => item.aiRecommended,
      );

      console.log(
        `[SimilarContentSearch] Found ${aiRecommendations.length} AI-recommended items`,
      );

      if (canUseAi && aiRecommendations.length === 0) {
        console.log(
          "[DEBUG] No AI recommendations found despite canUseAi=true",
        );
        setAiError(
          "AI recommendations were not available or could not be found in our database. Please try a different title.",
        );
      } else if (aiRecommendations.length > 0) {
        console.log(
          "[SimilarContentSearch] Successfully received AI recommendations",
        );
      }

      console.log("[DEBUG] Before setting similarContent state");
      try {
        setSimilarContent(Array.isArray(similarItems) ? similarItems : []);
        console.log("[DEBUG] After setting similarContent state");
      } catch (error) {
        console.error("[DEBUG] Error setting similarContent state:", error);
        setSimilarContent([]);
      }

      if (similarItems.length === 0) {
        console.log("[DEBUG] No similar items found");
        setError("No similar content found. Please try a different title.");
      }

      onSelectItem(item);
    } catch (error) {
      console.error("[DEBUG] Error getting similar content:", error);
      setSimilarContent([]);
      setError("Failed to find similar content. Please try again.");
      if (canUseAi) {
        setAiError(
          "AI recommendation service is currently unavailable. Please try again later or try a different title.",
        );
      }
    } finally {
      console.log("[DEBUG] getSimilarContentForItem completed");
      setIsSearching(false);
      setIsAiLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
    setAiError(null);
  };

  const clearSelection = () => {
    setSelectedItem(null);
    setSimilarContent([]);
    setError(null);
    setAiError(null);
    setIsUsingAi(false);
  };

  const openDetailsDialog = (item: ContentItem) => {
    setDetailsItem(item);
    setShowDetailsDialog(true);
  };

  const filteredContent = React.useMemo(() => {
    try {
      if (!similarContent || !Array.isArray(similarContent)) {
        console.log(
          "[DEBUG] similarContent is not an array or is null",
          similarContent,
        );
        return [];
      }

      // First filter out any null or undefined items
      const validItems = similarContent.filter(
        (item) => item !== null && item !== undefined,
      );

      // Then apply the tab filter
      return activeTab === "all"
        ? validItems
        : validItems.filter((item) => item && item.media_type === activeTab);
    } catch (error) {
      console.error("[DEBUG] Error filtering content:", error);
      return [];
    }
  }, [similarContent, activeTab]);

  console.log("[DEBUG] SimilarContentSearch rendering with state:", {
    isSearching,
    selectedItem: selectedItem ? selectedItem.title : null,
    similarContent: similarContent.length,
    error,
    aiError,
  });

  return (
    <div className="w-full max-w-7xl mx-auto bg-background p-4 md:p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Find Similar Content</h2>
        <p className="text-muted-foreground mb-4">
          Search for your favorite movie or TV show to discover similar content
          you might enjoy.
        </p>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search for a movie or TV show..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pr-10"
            />
            {searchQuery && (
              <button
                className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={clearSearch}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </div>

        {error && !isSearching && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {searchResults.length > 0 && !selectedItem && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <h3 className="text-lg font-medium mb-2">Search Results</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => getSimilarContentForItem(item)}
                >
                  <div className="aspect-[2/3] relative">
                    <img
                      src={item.poster_path}
                      alt={item.title}
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary">
                        {item.media_type === "movie" ? (
                          <Film className="h-3 w-3 mr-1" />
                        ) : (
                          <Tv className="h-3 w-3 mr-1" />
                        )}
                        {item.media_type === "movie" ? "Movie" : "TV"}
                      </Badge>
                    </div>
                  </div>
                  <CardHeader className="p-3">
                    <CardTitle className="text-base truncate">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardFooter className="p-3 pt-0 text-sm text-muted-foreground">
                    {item.release_date
                      ? new Date(item.release_date).getFullYear()
                      : item.first_air_date
                        ? new Date(item.first_air_date).getFullYear()
                        : "Unknown"}
                    <span className="ml-auto flex items-center">
                      ★{" "}
                      {item.vote_average ? item.vote_average.toFixed(1) : "N/A"}
                    </span>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {selectedItem && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">
              Similar to "{selectedItem.title}"
            </h3>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-2" /> Clear
            </Button>
          </div>

          <Card className="mb-6">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/4 lg:w-1/5">
                <div className="aspect-[2/3] relative">
                  <img
                    src={selectedItem.poster_path}
                    alt={selectedItem.title}
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
              <div className="p-4 md:p-6 flex-1">
                <div className="flex items-center mb-2">
                  <h2 className="text-2xl font-bold">{selectedItem.title}</h2>
                  <Badge variant="outline" className="ml-3">
                    {selectedItem.media_type === "movie" ? (
                      <Film className="h-3 w-3 mr-1" />
                    ) : (
                      <Tv className="h-3 w-3 mr-1" />
                    )}
                    {selectedItem.media_type === "movie"
                      ? "Movie"
                      : "TV Series"}
                  </Badge>
                </div>

                <div className="flex items-center text-sm text-muted-foreground mb-4">
                  <span>
                    {selectedItem.release_date
                      ? new Date(selectedItem.release_date).getFullYear()
                      : selectedItem.first_air_date
                        ? new Date(selectedItem.first_air_date).getFullYear()
                        : "Unknown"}
                  </span>
                  <span className="mx-2">•</span>
                  <span className="flex items-center">
                    ★{" "}
                    {selectedItem.vote_average
                      ? selectedItem.vote_average.toFixed(1)
                      : "N/A"}
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {selectedItem.genre_ids &&
                  Array.isArray(selectedItem.genre_ids) ? (
                    selectedItem.genre_ids.map((genreId) => (
                      <Badge key={genreId} variant="secondary">
                        {genreMap[genreId] || "Genre"}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">Unknown Genre</Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground line-clamp-3">
                  {selectedItem.overview}
                </p>
              </div>
            </div>
          </Card>

          {isUsingAi && (
            <div
              className={`mb-4 p-3 rounded-md ${aiError ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : "bg-primary/10 text-primary"}`}
            >
              {isAiLoading ? (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>Finding AI-powered recommendations...</span>
                </div>
              ) : aiError ? (
                <div className="flex items-center">
                  <span>{aiError}</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <span>
                    Showing AI-powered recommendations based on content analysis
                  </span>
                </div>
              )}
            </div>
          )}

          {isSearching ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-lg">Finding similar content...</span>
            </div>
          ) : similarContent && similarContent.length > 0 ? (
            <>
              <div className="mb-4">
                <Tabs defaultValue="all" onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="movie">Movies</TabsTrigger>
                    <TabsTrigger value="tv">TV Shows</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {filteredContent &&
                Array.isArray(filteredContent) &&
                filteredContent.length > 0 &&
                filteredContent.some((item) => item && item.aiRecommended) && (
                  <div className="mb-8">
                    <div className="flex items-center mb-4">
                      <h3 className="text-xl font-semibold">
                        AI Recommendations
                      </h3>
                      <Badge variant="outline" className="ml-3 bg-primary/10">
                        Based on content analysis
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {filteredContent
                        .filter((item) => item && item.aiRecommended)
                        .map((item, index) => {
                          if (!item) return null;
                          return (
                            <Card
                              key={item.id || index}
                              className="overflow-hidden hover:shadow-md transition-shadow border-primary/20 cursor-pointer"
                              onClick={() => openDetailsDialog(item)}
                            >
                              <div className="aspect-[2/3] relative">
                                <img
                                  src={item.poster_path}
                                  alt={item.title}
                                  className="object-cover w-full h-full"
                                />
                                <div className="absolute top-2 right-2">
                                  <Badge variant="secondary">
                                    {item.media_type === "movie" ? (
                                      <Film className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Tv className="h-3 w-3 mr-1" />
                                    )}
                                    {item.media_type === "movie"
                                      ? "Movie"
                                      : "TV"}
                                  </Badge>
                                </div>
                                <div className="absolute top-2 left-2">
                                  <Badge className="bg-primary text-primary-foreground">
                                    AI Pick
                                  </Badge>
                                </div>
                              </div>
                              <CardContent className="p-4">
                                <h3 className="font-semibold mb-1 truncate">
                                  {item.title}
                                </h3>
                                <div className="flex items-center text-sm text-muted-foreground mb-2">
                                  <span>
                                    {item.release_date
                                      ? new Date(
                                          item.release_date,
                                        ).getFullYear()
                                      : item.first_air_date
                                        ? new Date(
                                            item.first_air_date,
                                          ).getFullYear()
                                        : "Unknown"}
                                  </span>
                                  <span className="mx-2">•</span>
                                  <span className="flex items-center">
                                    ★{" "}
                                    {item.vote_average
                                      ? item.vote_average.toFixed(1)
                                      : "N/A"}
                                  </span>
                                </div>
                                <div className="mb-3 flex flex-wrap gap-1">
                                  {item.genre_ids &&
                                    item.genre_ids
                                      .slice(0, 2)
                                      .map((genreId) => (
                                        <Badge
                                          key={genreId}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {genreMap[genreId] || "Genre"}
                                        </Badge>
                                      ))}
                                  {item.genre_ids &&
                                    item.genre_ids.length > 2 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        +{item.genre_ids.length - 2}
                                      </Badge>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <p className="line-clamp-3">
                                    {item.overview || ""}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                )}

              {filteredContent &&
                Array.isArray(filteredContent) &&
                filteredContent.length > 0 &&
                !filteredContent.some((item) => item && item.aiRecommended) && (
                  <div className="mb-8">
                    <div className="flex items-center mb-4">
                      <h3 className="text-xl font-semibold">Similar Content</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {filteredContent.map((item, index) => {
                        if (!item) return null;
                        return (
                          <Card
                            key={item.id || index}
                            className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => openDetailsDialog(item)}
                          >
                            <div className="aspect-[2/3] relative">
                              <img
                                src={item.poster_path}
                                alt={item.title}
                                className="object-cover w-full h-full"
                              />
                              <div className="absolute top-2 right-2">
                                <Badge variant="secondary">
                                  {item.media_type === "movie" ? (
                                    <Film className="h-3 w-3 mr-1" />
                                  ) : (
                                    <Tv className="h-3 w-3 mr-1" />
                                  )}
                                  {item.media_type === "movie" ? "Movie" : "TV"}
                                </Badge>
                              </div>
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-semibold mb-1 truncate">
                                {item.title}
                              </h3>
                              <div className="flex items-center text-sm text-muted-foreground mb-2">
                                <span>
                                  {item.release_date
                                    ? new Date(item.release_date).getFullYear()
                                    : item.first_air_date
                                      ? new Date(
                                          item.first_air_date,
                                        ).getFullYear()
                                      : "Unknown"}
                                </span>
                                <span className="mx-2">•</span>
                                <span className="flex items-center">
                                  ★{" "}
                                  {item.vote_average
                                    ? item.vote_average.toFixed(1)
                                    : "N/A"}
                                </span>
                              </div>
                              <div className="mb-3 flex flex-wrap gap-1">
                                {item.genre_ids &&
                                  item.genre_ids.slice(0, 2).map((genreId) => (
                                    <Badge
                                      key={genreId}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {genreMap[genreId] || "Genre"}
                                    </Badge>
                                  ))}
                                {item.genre_ids &&
                                  item.genre_ids.length > 2 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{item.genre_ids.length - 2}
                                    </Badge>
                                  )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p className="line-clamp-3">
                                  {item.overview || ""}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-muted-foreground mb-4">
                <Film className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">No similar content found</p>
              </div>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                We couldn't find any similar content for this title. Try
                searching for a different movie or TV show.
              </p>
              <Button onClick={clearSelection} variant="outline">
                <X className="h-4 w-4 mr-2" /> Clear Selection
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {showDetailsDialog && detailsItem && (
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="sm:max-w-[600px] bg-background">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {detailsItem.title}
              </DialogTitle>
              <DialogDescription className="flex items-center">
                <span>
                  {detailsItem.release_date
                    ? new Date(detailsItem.release_date).getFullYear()
                    : detailsItem.first_air_date
                      ? new Date(detailsItem.first_air_date).getFullYear()
                      : "Unknown"}
                </span>
                {detailsItem.content_rating && (
                  <Badge variant="outline" className="ml-2">
                    {detailsItem.content_rating}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4 mt-2">
              <div className="aspect-[2/3] relative max-w-[180px] w-full mx-auto md:mx-0">
                <img
                  src={detailsItem.poster_path}
                  alt={detailsItem.title}
                  className="object-cover w-full h-full rounded-md border border-border"
                />
              </div>
              <div className="flex flex-col">
                <div className="mb-4">
                  <h4 className="font-medium mb-1 text-foreground">Overview</h4>
                  <p className="text-sm text-muted-foreground">
                    {detailsItem.overview || "No overview available."}
                  </p>
                </div>
                {detailsItem.genre_ids && detailsItem.genre_ids.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-1 text-foreground">Genres</h4>
                    <div className="flex flex-wrap gap-1">
                      {detailsItem.genre_ids.map((genreId) => (
                        <Badge key={genreId} variant="secondary">
                          {genreMap[genreId] || "Genre"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {detailsItem.recommendationReason && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-1 text-foreground">
                      Why it's recommended
                    </h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                      {detailsItem.recommendationReason}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDetailsDialog(false)}
              >
                Close
              </Button>
              <Button asChild>
                <Link
                  to={`/${detailsItem.media_type}/${detailsItem.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Details
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Clean up localStorage when component unmounts
const SimilarContentSearchWithCleanup = (props: SimilarContentSearchProps) => {
  const Component = SimilarContentSearch;

  useEffect(() => {
    // This effect will run when the component is unmounted
    return () => {
      // Uncomment the following line if you want to clear localStorage on unmount
      // localStorage.removeItem("similarContentSearchQuery");
      // localStorage.removeItem("similarContentSearchResults");
      // localStorage.removeItem("similarContentSelectedItem");
      // localStorage.removeItem("similarContentSimilarContent");
      // localStorage.removeItem("similarContentActiveTab");
    };
  }, []);

  return <Component {...props} />;
};

export default SimilarContentSearchWithCleanup;
