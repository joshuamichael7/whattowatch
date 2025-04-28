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
  streamingOn: string[];
  recommendationReason: string;
  runtime?: string;
  contentRating?: string;
  content_rating?: string;
  imdb_id?: string; // Added to support direct IMDB ID links
  imdb_url?: string; // Added to support direct IMDB URL links
}

interface RecommendationGridProps {
  recommendations?: RecommendationItem[];
  isLoading?: boolean;
  onFilterChange?: (filters: any) => void;
  useDirectApi?: boolean;
  onFeedbackSubmit?: (itemId: string, isPositive: boolean) => void;
  userId?: string;
  userPreferences?: any;
}

const RecommendationGrid = ({
  recommendations = defaultRecommendations,
  isLoading = false,
  onFilterChange = () => {},
  useDirectApi = false,
  onFeedbackSubmit = () => {},
  userId,
  userPreferences,
}: RecommendationGridProps) => {
  const [selectedItem, setSelectedItem] = useState<RecommendationItem | null>(
    null,
  );
  const [loadedItems, setLoadedItems] =
    useState<RecommendationItem[]>(recommendations);
  const [sortBy, setSortBy] = useState("relevance");
  const [filterVisible, setFilterVisible] = useState(false);
  const [ratingFilter, setRatingFilter] = useState([0, 10]);
  const [yearFilter, setYearFilter] = useState([1950, 2023]);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const fetchAdditionalDetails = async (itemId: string) => {
      try {
        const details = await getContentById(itemId);
        console.log(
          "Fetched details using useDirectApi:",
          useDirectApi,
          details,
        );
      } catch (error) {
        console.error("Error fetching details:", error);
      }
    };

    if (recommendations.length > 0 && selectedItem) {
      fetchAdditionalDetails(selectedItem.id);
    }
  }, [selectedItem, useDirectApi]);

  useEffect(() => {
    if (userId && userPreferences) {
      console.log(`Loading recommendations for user ${userId}`);
      console.log("User preferences:", userPreferences);

      // Here you would typically fetch personalized recommendations
      // based on the user's preferences
    }
  }, [userId, userPreferences]);

  const handleFilterApply = () => {
    onFilterChange({
      rating: ratingFilter,
      year: yearFilter,
      type: typeFilter,
    });
    setFilterVisible(false);
  };

  const getPosterImage = (item: RecommendationItem) => {
    console.log(`Getting poster for ${item.title}:`, {
      poster: item.poster,
      poster_path: item.poster_path,
    });

    if (item.poster && item.poster !== "N/A" && !item.poster.includes("null")) {
      console.log(`Using poster: ${item.poster}`);
      return item.poster;
    }
    if (
      item.poster_path &&
      item.poster_path !== "N/A" &&
      !item.poster_path.includes("null")
    ) {
      console.log(`Using poster_path: ${item.poster_path}`);
      return item.poster_path;
    }

    console.log(`No valid poster found for ${item.title}, using placeholder`);
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

      {recommendations.length === 0 ? (
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
          {recommendations.map((rec) => (
            <Card
              key={rec.id || rec.title} // Use title as fallback if id is null
              className="overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow"
            >
              <Link
                to={`/${rec.type}/${rec.imdb_id || encodeURIComponent(rec.title)}`}
                className="flex flex-col h-full"
                state={{
                  recommendation: {
                    ...rec,
                    imdb_url: rec.imdb_url, // Ensure imdb_url is passed in state
                  },
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
                    {rec.title}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <span>{rec.year}</span>
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
                    {rec.genres &&
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
                    {rec.genres &&
                      Array.isArray(rec.genres) &&
                      rec.genres.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{rec.genres.length - 2}
                        </Badge>
                      )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {rec.synopsis || rec.overview || "No synopsis available"}
                  </p>
                  {(rec.recommendationReason || rec.reason) && (
                    <p className="text-xs text-primary-foreground mt-1 bg-primary/10 p-1 rounded line-clamp-2 font-medium">
                      {rec.recommendationReason || rec.reason}
                    </p>
                  )}
                  {rec.imdb_id && (
                    <p className="text-xs text-muted-foreground mt-1">
                      IMDB: {rec.imdb_id}
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
                                {selectedItem.recommendationReason ||
                                  selectedItem.reason ||
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
                                  to={`/${selectedItem.type}/${selectedItem.imdb_id || selectedItem.id || encodeURIComponent(selectedItem.title)}`}
                                  state={{
                                    recommendation: {
                                      ...selectedItem,
                                      imdb_url: selectedItem.imdb_url, // Ensure imdb_url is passed in state
                                    },
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
