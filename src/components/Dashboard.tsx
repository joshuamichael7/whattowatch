import React, { useState, useEffect } from "react";
import * as omdbClient from "@/lib/omdbClient";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlayCircle, Search, ListFilter } from "lucide-react";
import PreferenceFinder from "./PreferenceQuiz";
import SimilarContentSearch from "./SimilarContentSearch";
import RecommendationGrid from "./RecommendationGrid";
import ContentFilters from "./ContentFilters";
import { Link } from "react-router-dom";

import { ContentItem } from "@/types/omdb";

interface PreferenceResults {
  genres: string[];
  mood: string;
  viewingTime: number;
  favoriteContent: string[];
  contentToAvoid: string[];
  ageRating: string;
  aiRecommendations?: Array<{ title: string; reason: string }>;
}

interface ContentFilterOptions {
  maturityLevel: string;
  familyFriendly: boolean;
  contentWarnings: string[];
  excludedGenres: string[];
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("discover");
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [useDirectApi, setUseDirectApi] = useState(false);
  const [filters, setFilters] = useState<ContentFilterOptions>({
    maturityLevel: "PG",
    familyFriendly: false,
    contentWarnings: [],
    excludedGenres: [],
  });

  useEffect(() => {
    // Check if we should use direct API calls or Netlify functions
    const useDirectApiFlag = import.meta.env.VITE_USE_DIRECT_API === "true";
    setUseDirectApi(useDirectApiFlag);
  }, []);

  // Function to search for content by title
  const searchContent = async (title: string, type: string = "all") => {
    try {
      console.log(`Searching for content with title: ${title}, type: ${type}`);
      const results = await omdbClient.searchContent(title, type);
      return results || [];
    } catch (error) {
      console.error(`Error searching for content with title: ${title}`, error);
      return [];
    }
  };

  // Function to get content details by ID
  const getContentById = async (id: string) => {
    try {
      console.log(`Getting content details for ID: ${id}`);
      const response = await omdbClient.getContentById(id);
      return response;
    } catch (error) {
      console.error(`Error getting content details for ID: ${id}`, error);
      return null;
    }
  };

  // Handle quiz completion
  const handleQuizComplete = async (preferences: PreferenceResults) => {
    setIsLoading(true);
    setActiveTab("recommendations");

    try {
      // Check if we have AI recommendations from the quiz
      if (
        preferences.aiRecommendations &&
        preferences.aiRecommendations.length > 0
      ) {
        console.log(
          "Using AI recommendations from quiz",
          preferences.aiRecommendations,
        );

        // Convert AI recommendations to ContentItem format
        const aiBasedRecommendations = await Promise.all(
          preferences.aiRecommendations.map(async (rec) => {
            try {
              console.log(`Processing AI recommendation: ${rec.title}`);
              // Search for the title
              const searchResults = await searchContent(rec.title, "all");

              if (searchResults && searchResults.length > 0) {
                console.log(
                  `Found ${searchResults.length} search results for "${rec.title}"`,
                );
                // Get the first result (most relevant)
                const firstResult = searchResults[0];

                // Get detailed content
                const detailedContent = await getContentById(firstResult.id);

                if (detailedContent) {
                  console.log(`Got detailed content for "${rec.title}":`, {
                    id: detailedContent.id,
                    title: detailedContent.title,
                    type: detailedContent.media_type,
                  });

                  const contentItem: ContentItem = {
                    ...detailedContent,
                    recommendationReason:
                      rec.reason || "AI recommended based on your preferences",
                  };
                  return contentItem;
                }
              }
              return null;
            } catch (err) {
              console.error(
                `Error processing AI recommendation "${rec.title}":`,
                err,
              );
              return null;
            }
          }),
        );

        // Filter out null results and limit to reasonable number
        const validRecommendations = aiBasedRecommendations.filter(
          Boolean,
        ) as ContentItem[];

        console.log(
          `Found ${validRecommendations.length} valid recommendations from AI`,
        );

        if (validRecommendations.length > 0) {
          setRecommendations(validRecommendations);
          setIsLoading(false);
          return;
        }
      }

      console.log(
        "No valid AI recommendations found, falling back to mock data",
      );
      // Fallback to mock recommendations if AI recommendations failed or weren't available
      const mockRecommendations = generateMockRecommendations(preferences);
      setRecommendations(mockRecommendations);
    } catch (error) {
      console.error("Error processing recommendations:", error);
      // Fallback to mock recommendations
      console.log("Error occurred, falling back to mock data");
      const mockRecommendations = generateMockRecommendations(preferences);
      setRecommendations(mockRecommendations);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle similar content selection
  const handleSimilarContentSelect = (item: any) => {
    setIsLoading(true);
    setActiveTab("recommendations");

    // Simulate API call to get recommendations based on selected item
    setTimeout(() => {
      // In a real app, this would be an API call that uses the selected item
      // to find similar content
      const mockRecommendations = generateMockRecommendations({
        genres: item.genre_ids.map((id: number) => {
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
            27: "Horror",
          };
          return genreMap[id] || "Drama";
        }),
        mood: "thoughtful",
        viewingTime: 120,
        favoriteContent: [item.title],
        contentToAvoid: [],
        ageRating: "PG-13",
      });
      setRecommendations(mockRecommendations);
      setIsLoading(false);
    }, 2000);
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: ContentFilterOptions) => {
    setFilters(newFilters);

    // In a real app, this would trigger a re-fetch of recommendations
    // with the new filters applied
    if (recommendations.length > 0) {
      setIsLoading(true);
      setTimeout(() => {
        // Apply filters to existing recommendations
        const filteredRecommendations = recommendations.filter((item) => {
          // Filter by maturity level
          if (newFilters.maturityLevel === "G" && item.contentRating !== "G") {
            return false;
          }

          // Filter by excluded genres
          if (
            newFilters.excludedGenres.some((genre) =>
              item.genres.includes(genre),
            )
          ) {
            return false;
          }

          return true;
        });

        setRecommendations(filteredRecommendations);
        setIsLoading(false);
      }, 1000);
    }
  };

  // Mock function to generate recommendations based on preferences
  const generateMockRecommendations = (
    preferences: Partial<PreferenceResults>,
  ): ContentItem[] => {
    // This would be replaced with actual recommendation logic or API call
    const baseRecommendations = [
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
    ];

    // Filter based on preferences
    return baseRecommendations.filter((item) => {
      // Filter by genre preferences
      if (preferences.genres && preferences.genres.length > 0) {
        if (!item.genres.some((genre) => preferences.genres?.includes(genre))) {
          return false;
        }
      }

      // Filter by content to avoid
      if (
        preferences.contentToAvoid &&
        preferences.contentToAvoid.includes(item.title)
      ) {
        return false;
      }

      // Filter by age rating
      if (preferences.ageRating) {
        const ratingOrder = [
          "G",
          "PG",
          "PG-13",
          "R",
          "TV-Y",
          "TV-PG",
          "TV-14",
          "TV-MA",
        ];
        const preferredIndex = ratingOrder.indexOf(preferences.ageRating);
        const itemIndex = ratingOrder.indexOf(item.contentRating || "PG-13");

        if (itemIndex > preferredIndex) {
          return false;
        }
      }

      return true;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex items-center">
            <PlayCircle className="h-6 w-6 text-primary mr-2" />
            <h1 className="text-xl font-bold">MovieMatch</h1>
          </div>
          <nav className="flex flex-1 items-center justify-end space-x-4">
            <Button
              variant={activeTab === "discover" ? "default" : "ghost"}
              onClick={() => setActiveTab("discover")}
            >
              Discover
            </Button>
            <Button
              variant={activeTab === "quiz" ? "default" : "ghost"}
              onClick={() => setActiveTab("quiz")}
            >
              Find Preferences
            </Button>
            <Button
              variant={activeTab === "similar" ? "default" : "ghost"}
              onClick={() => setActiveTab("similar")}
            >
              Find Similar
            </Button>
            <Button
              variant={activeTab === "recommendations" ? "default" : "ghost"}
              onClick={() => setActiveTab("recommendations")}
              disabled={recommendations.length === 0}
            >
              Recommendations
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/plot-similarity-test">Plot Similarity Test</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {activeTab === "discover" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">
                Discover your next favorite movie or show
              </h1>
              <p className="text-xl text-muted-foreground">
                Get personalized recommendations based on your preferences and
                favorites.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
              <div className="bg-muted/40 rounded-lg p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <ListFilter className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-semibold">
                  Find Your Preferences
                </h2>
                <p className="text-muted-foreground">
                  Answer a few questions about your taste to get personalized
                  recommendations.
                </p>
                <Button
                  size="lg"
                  onClick={() => setActiveTab("quiz")}
                  className="mt-4"
                >
                  Get Started
                </Button>
              </div>

              <div className="bg-muted/40 rounded-lg p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Search className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-semibold">Find Similar Content</h2>
                <p className="text-muted-foreground">
                  Search for a movie or show you love to find similar content
                  you might enjoy.
                </p>
                <Button
                  size="lg"
                  onClick={() => setActiveTab("similar")}
                  className="mt-4"
                >
                  Search Now
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "quiz" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-4xl mx-auto"
          >
            <PreferenceFinder onComplete={handleQuizComplete} />
          </motion.div>
        )}

        {activeTab === "similar" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SimilarContentSearch
              onSelectItem={handleSimilarContentSelect}
              useDirectApi={useDirectApi}
            />
          </motion.div>
        )}

        {activeTab === "recommendations" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3 lg:w-1/4">
                <ContentFilters
                  onFilterChange={handleFilterChange}
                  initialFilters={filters}
                />
              </div>
              <div className="flex-1">
                <RecommendationGrid
                  recommendations={recommendations}
                  isLoading={isLoading}
                  onFilterChange={() => {}}
                  useDirectApi={useDirectApi}
                />
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
