import React, { useState, useEffect } from "react";
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
  searchContent,
  getContentById,
  getSimilarContent,
} from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";

// Genre mapping
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
  useDirectApi = false,
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

  // Handle search function using OMDB API
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      // Use the appropriate API method based on the useDirectApi flag
      const results = await searchContent(searchQuery, "all");
      setSearchResults(results);
      if (results.length === 0) {
        setError("No results found. Try a different search term.");
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      setError("An error occurred while searching. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Effect to load similar content when initialSelectedItem is provided
  useEffect(() => {
    if (initialSelectedItem) {
      getSimilarContentForItem(initialSelectedItem);
    }
  }, [initialSelectedItem]);

  // Function to find similar content based on genre and type
  const getSimilarContentForItem = async (item: ContentItem) => {
    setSelectedItem(item);
    setIsSearching(true);
    setError(null);
    setAiError(null);

    // Check if we have enough information to use AI recommendations
    const canUseAi = item.overview && item.title;
    setIsUsingAi(canUseAi);

    if (canUseAi) {
      setIsAiLoading(true);
    }

    try {
      // Get similar content based on the selected item, using the appropriate API method
      console.log(
        `[SimilarContentSearch] Getting similar content for: ${item.title} (${item.media_type}), ID: ${item.id}`,
      );

      console.log(
        `[SimilarContentSearch] Using AI for recommendations: ${canUseAi}`,
      );

      const similarItems = await getSimilarContent(
        item.id,
        useDirectApi,
        12, // Increased from default 8 to 12 for more diverse recommendations
        canUseAi, // Use AI if we have enough information
        true, // Use vector DB if available
      );

      console.log(
        `[SimilarContentSearch] Found ${similarItems.length} similar items`,
      );

      // Check if we got AI recommendations
      const aiRecommendations = similarItems.filter(
        (item) => item.aiRecommended,
      );
      if (canUseAi && aiRecommendations.length === 0) {
        setAiError(
          "AI recommendations were not available. Showing alternative recommendations.",
        );
      }

      setSimilarContent(similarItems);

      if (similarItems.length === 0) {
        setError("No similar content found based on this title's genre.");
      }

      onSelectItem(item);
    } catch (error) {
      console.error("Error getting similar content:", error);
      setSimilarContent([]);
      setError("Failed to find similar content. Please try again.");
      if (canUseAi) {
        setAiError(
          "AI service is currently unavailable. Please try again later.",
        );
      }
    } finally {
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

  const filteredContent =
    activeTab === "all"
      ? similarContent
      : similarContent.filter((item) => item.media_type === activeTab);

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

        {/* Error Message */}
        {error && !isSearching && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {/* Search Results */}
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
                      onError={(e) => {
                        // Hide the image if it fails to load
                        e.currentTarget.style.display = "none";
                      }}
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
                      ★ {item.vote_average.toFixed(1)}
                    </span>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Selected Item and Similar Content */}
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
                    onError={(e) => {
                      // Hide the image if it fails to load
                      e.currentTarget.style.display = "none";
                    }}
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
                    ★ {selectedItem.vote_average.toFixed(1)}
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {selectedItem.genre_ids.map((genreId) => (
                    <Badge key={genreId} variant="secondary">
                      {genreMap[genreId] || "Genre"}
                    </Badge>
                  ))}
                </div>

                <p className="text-muted-foreground">{selectedItem.overview}</p>

                <div className="mt-4">
                  <Button asChild>
                    <Link to={`/${selectedItem.media_type}/${selectedItem.id}`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* AI Status Indicator */}
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
          ) : similarContent.length > 0 ? (
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredContent.map((item) => (
                  <Card
                    key={item.id}
                    className="overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <Link to={`/${item.media_type}/${item.id}`}>
                      <div className="aspect-[2/3] relative">
                        <img
                          src={item.poster_path}
                          alt={item.title}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            // Hide the image if it fails to load
                            e.currentTarget.style.display = "none";
                          }}
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
                                ? new Date(item.first_air_date).getFullYear()
                                : "Unknown"}
                          </span>
                          <span className="mx-2">•</span>
                          <span className="flex items-center">
                            ★ {item.vote_average.toFixed(1)}
                          </span>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-1">
                          {item.genre_ids.slice(0, 2).map((genreId) => (
                            <Badge
                              key={genreId}
                              variant="outline"
                              className="text-xs"
                            >
                              {genreMap[genreId] || "Genre"}
                            </Badge>
                          ))}
                          {item.genre_ids.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{item.genre_ids.length - 2}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {item.overview || item.recommendationReason || ""}
                        </p>
                        {item.aiRecommended && (
                          <div className="mt-2">
                            <Badge
                              variant="outline"
                              className="bg-primary/10 text-xs"
                            >
                              AI Recommended
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {error ||
                "No similar content found. Try searching for a different title."}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default SimilarContentSearch;
