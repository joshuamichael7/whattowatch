import React, { useState, useEffect } from "react";
import * as omdbClient from "@/lib/omdbClient";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PlayCircle, X, Loader2 } from "lucide-react";
import PreferenceFinder from "./PreferenceQuiz";
import RecommendationGrid from "./RecommendationGrid";
import ContentFilters from "./ContentFilters";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ContentItem } from "@/types/omdb";

// Import the new components
import Discover from "./dashboard/Discover";
import SimilarContent from "./dashboard/SimilarContent";

// Add a global preferences variable to store the latest quiz preferences
declare global {
  interface Window {
    preferences?: PreferenceResults;
  }
}

interface PreferenceResults {
  genres: string[];
  mood?: string;
  moods?: string[];
  viewingTime: number;
  favoriteContent: string | string[];
  contentToAvoid: string | string[];
  ageRating?: string;
  ageRatings?: string[];
  aiRecommendations?: Array<{ title: string; reason: string; year?: string }>;
  isAiRecommendationSuccess?: boolean;
  aiRecommendationError?: string | null;
  languagePreference?: string;
  releaseYearRange?: { min: number; max: number };
}

interface ContentFilterOptions {
  maturityLevel: string;
  familyFriendly: boolean;
  contentWarnings: string[];
  excludedGenres: string[];
  acceptedRatings?: string[];
}

const Dashboard = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState("discover");
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [allRecommendations, setAllRecommendations] = useState<ContentItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [useDirectApi, setUseDirectApi] = useState(false);
  // Define default ratings
  const defaultRatings = ["G", "PG", "PG-13", "TV-Y", "TV-PG", "TV-14"];

  const [filters, setFilters] = useState<ContentFilterOptions>({
    maturityLevel: profile?.content_rating_limit || "PG-13",
    familyFriendly: false,
    contentWarnings: [],
    excludedGenres: profile?.preferred_genres ? [] : [],
    // Initialize with default ratings
    acceptedRatings: defaultRatings,
  });

  // Update filters with proper ratings after component mounts
  useEffect(() => {
    if (profile?.content_rating_limit) {
      const ratings = getRatingsUpToLevel(profile.content_rating_limit);
      setFilters((prev) => ({
        ...prev,
        acceptedRatings: ratings,
      }));
    }
  }, [profile]);

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

      // Process content ratings for consistency
      if (response) {
        // Normalize content rating field
        if (response.Rated && !response.content_rating) {
          response.content_rating = response.Rated;
        }

        // Ensure we have a contentRating field for UI consistency
        if (response.content_rating && !response.contentRating) {
          response.contentRating = response.content_rating;
        }

        // If we have a content_rating but no Rated, set Rated
        if (response.content_rating && !response.Rated) {
          response.Rated = response.content_rating;
        }
      }

      return response;
    } catch (error) {
      console.error(`Error getting content details for ID: ${id}`, error);
      return null;
    }
  };

  // Handle What to Watch submission
  const handleWhatToWatchSubmit = async (preferences: {
    genres: string[];
    mood: string;
    viewingTime: number;
    favoriteContent: string[];
    contentToAvoid: string[];
    ageRating: string;
  }) => {
    setIsLoading(true);
    setActiveTab("recommendations");

    // Update filters with the selected age rating
    if (preferences.ageRating) {
      const selectedAgeRating = preferences.ageRating;
      console.log(
        "Setting maturity level from What to Watch:",
        selectedAgeRating,
      );

      // Get appropriate ratings based on the selected age rating
      const acceptedRatings = getRatingsUpToLevel(selectedAgeRating);
      console.log("Accepted ratings from What to Watch:", acceptedRatings);

      // Update filters with the selected ratings
      setFilters((prevFilters) => ({
        ...prevFilters,
        maturityLevel: selectedAgeRating,
        acceptedRatings: acceptedRatings,
      }));
    }

    try {
      // Use Netlify function instead of direct API call
      // Request more recommendations to ensure we have enough after filtering
      const response = await fetch("/.netlify/functions/ai-recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ preferences, limit: 20 }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const aiRecs = data.recommendations || [];

      if (aiRecs && aiRecs.length > 0) {
        console.log("AI recommendations received:", aiRecs);

        // Convert AI recommendations to ContentItem format
        const aiBasedRecommendations = await Promise.all(
          aiRecs.map(async (rec) => {
            try {
              // Search for the title
              const searchResults = await searchContent(rec.title, "all");

              if (searchResults && searchResults.length > 0) {
                // Find exact title match with year if available - no fuzzy matching
                const exactMatch = searchResults.find((item) => {
                  // Basic title match (case-insensitive)
                  const titleMatches =
                    item.title.toLowerCase() === rec.title.toLowerCase();

                  // If we have a year from the AI recommendation, use it for additional filtering
                  if (rec.year && titleMatches) {
                    const itemYear = item.release_date
                      ? parseInt(item.release_date.substring(0, 4))
                      : null;
                    return titleMatches && itemYear === parseInt(rec.year);
                  }

                  return titleMatches;
                });

                // Use exact match if found, otherwise use first result
                const firstResult = exactMatch || searchResults[0];
                console.log(
                  `Using ${exactMatch ? "exact match" : "first result"} for "${rec.title}": ${firstResult.title}`,
                );

                // Get detailed content
                const detailedContent = await getContentById(firstResult.id);

                if (detailedContent) {
                  // Log detailed content for debugging
                  console.log(`Got detailed content for "${rec.title}":`, {
                    id: detailedContent.id,
                    title: detailedContent.title,
                    contentRating: detailedContent.content_rating,
                    poster: detailedContent.Poster,
                    poster_path: detailedContent.poster_path,
                  });

                  // Fix poster path if it's missing
                  let posterPath = detailedContent.poster_path;
                  if (
                    !posterPath &&
                    detailedContent.Poster &&
                    detailedContent.Poster !== "N/A"
                  ) {
                    posterPath = detailedContent.Poster;
                    console.log(`Using Poster as poster_path: ${posterPath}`);
                  }

                  // Store the content regardless of rating - we'll filter it later
                  // This ensures we have R-rated content available when the user changes filters
                  const contentRating = detailedContent.content_rating || "";
                  if (contentRating) {
                    console.log(
                      `Content rating for "${rec.title}": ${contentRating}`,
                    );
                  }

                  const contentItem: ContentItem = {
                    ...detailedContent,
                    poster_path: posterPath,
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

        // Filter out null results
        const validRecommendations = aiBasedRecommendations.filter(
          (item) => item !== null,
        ) as ContentItem[];

        if (validRecommendations.length > 0) {
          // Store all recommendations in state
          setAllRecommendations(validRecommendations);
          // Apply current filters to the recommendations
          const filteredRecommendations = applyFiltersToRecommendations(
            validRecommendations,
            filters,
          );
          setRecommendations(filteredRecommendations);
          setIsLoading(false);
          return;
        }
      }

      // Fallback to mock recommendations if AI recommendations failed
      console.log(
        "No valid AI recommendations found, falling back to mock data",
      );
      const mockRecommendations = generateMockRecommendations(preferences);
      setAllRecommendations(mockRecommendations);
      setRecommendations(mockRecommendations);
    } catch (error) {
      console.error("Error processing recommendations:", error);
      // Fallback to mock recommendations
      const mockRecommendations = generateMockRecommendations(preferences);
      setAllRecommendations(mockRecommendations);
      setRecommendations(mockRecommendations);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get ratings up to a certain level
  const getRatingsUpToLevel = (maxLevel: string) => {
    const movieRatings = ["G", "PG", "PG-13", "R"];
    const tvRatings = ["TV-Y", "TV-PG", "TV-14", "TV-MA"];

    // Default ratings if no valid maxLevel is provided
    if (!maxLevel) {
      return ["G", "PG", "PG-13", "TV-Y", "TV-PG", "TV-14"];
    }

    // Find the index of the max level in movie ratings
    const movieIndex = movieRatings.indexOf(maxLevel);
    // Find the index of the max level in TV ratings
    const tvIndex = tvRatings.indexOf(maxLevel);

    let selectedRatings: string[] = [];

    // If it's a movie rating
    if (movieIndex >= 0) {
      selectedRatings = [...movieRatings.slice(0, movieIndex + 1)];
      // Add TV ratings based on approximate equivalence
      if (maxLevel === "G") selectedRatings.push("TV-Y");
      if (maxLevel === "PG" || maxLevel === "G") selectedRatings.push("TV-PG");
      if (maxLevel === "PG-13" || maxLevel === "PG" || maxLevel === "G")
        selectedRatings.push("TV-14");
      if (maxLevel === "R")
        selectedRatings = [...selectedRatings, ...tvRatings];
    }
    // If it's a TV rating
    else if (tvIndex >= 0) {
      selectedRatings = [...tvRatings.slice(0, tvIndex + 1)];
      // Add movie ratings based on approximate equivalence
      if (maxLevel === "TV-Y") selectedRatings.push("G");
      if (maxLevel === "TV-PG") selectedRatings.push(...["G", "PG"]);
      if (maxLevel === "TV-14") selectedRatings.push(...["G", "PG", "PG-13"]);
      if (maxLevel === "TV-MA")
        selectedRatings = [...selectedRatings, ...movieRatings];
    }
    // If it's not a recognized rating, return default ratings
    else {
      selectedRatings = ["G", "PG", "PG-13", "TV-Y", "TV-PG", "TV-14"];
    }

    console.log(`Generated ratings for ${maxLevel}:`, selectedRatings);
    return selectedRatings;
  };

  // Handle quiz completion
  const handleQuizComplete = async (preferences: PreferenceResults) => {
    setIsLoading(true);
    setActiveTab("recommendations");

    // Store preferences for later use when changing filters
    window.preferences = preferences;

    // Update filters with age ratings from quiz
    if (preferences.ageRatings && preferences.ageRatings.length > 0) {
      const selectedAgeRating = preferences.ageRatings[0] || "PG-13";
      console.log("Setting maturity level from quiz:", selectedAgeRating);

      // Get appropriate ratings based on the selected age rating
      const acceptedRatings = getRatingsUpToLevel(selectedAgeRating);
      console.log("Accepted ratings from quiz:", acceptedRatings);

      // Update filters with the selected ratings
      setFilters((prevFilters) => ({
        ...prevFilters,
        maturityLevel: selectedAgeRating,
        acceptedRatings: acceptedRatings,
      }));
    } else if (preferences.ageRating) {
      // Handle legacy format where ageRating is a single string
      const selectedAgeRating = preferences.ageRating || "PG-13";
      console.log(
        "Setting maturity level from quiz (legacy format):",
        selectedAgeRating,
      );

      // Get appropriate ratings based on the selected age rating
      const acceptedRatings = getRatingsUpToLevel(selectedAgeRating);
      console.log(
        "Accepted ratings from quiz (legacy format):",
        acceptedRatings,
      );

      // Update filters with the selected ratings
      setFilters((prevFilters) => ({
        ...prevFilters,
        maturityLevel: selectedAgeRating,
        acceptedRatings: acceptedRatings,
      }));
    }

    // Log the current filters for debugging
    console.log("Current filters after updating from quiz:", filters);

    // Track if we're using fallback data
    let usingFallbackData = false;
    let errorMessage = "";

    try {
      // Check if we have AI recommendations from the quiz and if the AI call was successful
      if (
        preferences.isAiRecommendationSuccess &&
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
                // Find exact title match with year if available - no fuzzy matching
                const exactMatch = searchResults.find((item) => {
                  // Basic title match (case-insensitive)
                  const titleMatches =
                    item.title.toLowerCase() === rec.title.toLowerCase();

                  // If we have a year from the AI recommendation, use it for additional filtering
                  if (rec.year && titleMatches) {
                    const itemYear = item.release_date
                      ? parseInt(item.release_date.substring(0, 4))
                      : null;
                    return titleMatches && itemYear === parseInt(rec.year);
                  }

                  return titleMatches;
                });

                // Use exact match if found, otherwise use first result
                const firstResult = exactMatch || searchResults[0];
                console.log(
                  `Using ${exactMatch ? "exact match" : "first result"} for "${rec.title}": ${firstResult.title}`,
                );

                // Get detailed content
                const detailedContent = await getContentById(firstResult.id);

                if (detailedContent) {
                  console.log(`Got detailed content for "${rec.title}":`, {
                    id: detailedContent.id,
                    title: detailedContent.title,
                    type: detailedContent.media_type,
                    contentRating: detailedContent.content_rating,
                    poster: detailedContent.Poster,
                    poster_path: detailedContent.poster_path,
                  });

                  // Fix poster path if it's missing
                  let posterPath = detailedContent.poster_path;
                  if (
                    !posterPath &&
                    detailedContent.Poster &&
                    detailedContent.Poster !== "N/A"
                  ) {
                    posterPath = detailedContent.Poster;
                    console.log(`Using Poster as poster_path: ${posterPath}`);
                  }

                  // Store the content regardless of rating - we'll filter it later
                  // This ensures we have R-rated content available when the user changes filters
                  const contentRating = detailedContent.content_rating || "";
                  if (contentRating) {
                    console.log(
                      `Content rating for "${rec.title}": ${contentRating}`,
                    );
                  }

                  const contentItem: ContentItem = {
                    ...detailedContent,
                    poster_path: posterPath,
                    recommendationReason:
                      rec.reason || "AI recommended based on your preferences",
                    aiRecommended: true,
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
          (item) => item !== null,
        ) as ContentItem[];

        console.log(
          `Found ${validRecommendations.length} valid recommendations from AI`,
        );

        if (validRecommendations.length > 0) {
          // Store all recommendations in state
          setAllRecommendations(validRecommendations);
          // Apply current filters to the recommendations
          const filteredRecommendations = applyFiltersToRecommendations(
            validRecommendations,
            filters,
          );
          setRecommendations(filteredRecommendations);
          setIsLoading(false);
          return;
        } else {
          // If we couldn't find any valid recommendations despite having AI recommendations
          usingFallbackData = true;
          errorMessage =
            "Could not find detailed information for AI recommendations. Using alternative recommendations.";
        }
      } else if (preferences.aiRecommendationError) {
        // If there was an error with the AI recommendations
        usingFallbackData = true;
        errorMessage = preferences.aiRecommendationError;
      } else {
        // If there were no AI recommendations
        usingFallbackData = true;
        errorMessage =
          "No AI recommendations available. Using alternative recommendations.";
      }

      console.log(
        "No valid AI recommendations found, falling back to mock data",
      );
      // Fallback to mock recommendations if AI recommendations failed or weren't available
      const mockRecommendations = generateMockRecommendations(preferences);

      // Mark these as fallback recommendations
      const markedRecommendations = mockRecommendations.map((item) => ({
        ...item,
        isErrorFallback: true,
        recommendationReason:
          item.recommendationReason || "Based on your selected preferences",
      }));

      setAllRecommendations(markedRecommendations);
      setRecommendations(markedRecommendations);
    } catch (error) {
      console.error("Error processing recommendations:", error);
      // Fallback to mock recommendations
      console.log("Error occurred, falling back to mock data");
      usingFallbackData = true;
      errorMessage =
        "An error occurred while processing recommendations. Using alternative recommendations.";

      const mockRecommendations = generateMockRecommendations(preferences);
      // Mark these as error fallback recommendations
      const markedRecommendations = mockRecommendations.map((item) => ({
        ...item,
        isErrorFallback: true,
        recommendationReason:
          item.recommendationReason || "Based on your selected preferences",
      }));

      setAllRecommendations(markedRecommendations);
      setRecommendations(markedRecommendations);
    } finally {
      setIsLoading(false);

      // If we're using fallback data, show a toast or notification
      if (usingFallbackData && errorMessage) {
        console.warn("Using fallback recommendations:", errorMessage);
        // Here you could add a toast notification if you have a toast system
      }
    }
  };

  // Helper function to apply filters to recommendations
  const applyFiltersToRecommendations = (
    items: ContentItem[],
    currentFilters: ContentFilterOptions,
  ) => {
    console.log("Applying filters to recommendations:", currentFilters);
    console.log("Number of items before filtering:", items.length);

    const filteredItems = items.filter((item) => {
      // Get the content rating
      const contentRating = item.content_rating || item.Rated || "";

      // Check if the content rating is in the accepted ratings
      const isAcceptedRating =
        !currentFilters.acceptedRatings ||
        currentFilters.acceptedRatings.includes(contentRating);

      // Return true if the content rating is accepted
      return isAcceptedRating;
    });

    console.log("Number of items after filtering:", filteredItems.length);
    return filteredItems;
  };

  // Generate mock recommendations for fallback
  const generateMockRecommendations = (
    preferences: PreferenceResults,
  ): ContentItem[] => {
    // Create some mock data based on preferences
    return [];
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Dashboard header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-0">
              Your Entertainment Dashboard
            </h1>
            <div className="flex space-x-2">
              <Button
                variant={activeTab === "discover" ? "default" : "outline"}
                onClick={() => setActiveTab("discover")}
                className="text-sm"
              >
                Discover
              </Button>
              <Button
                variant={activeTab === "what-to-watch" ? "default" : "outline"}
                onClick={() => setActiveTab("what-to-watch")}
                className="text-sm"
              >
                What to Watch
              </Button>
              <Button
                variant={activeTab === "similar" ? "default" : "outline"}
                onClick={() => setActiveTab("similar")}
                className="text-sm"
              >
                Find Similar
              </Button>
              {recommendations.length > 0 && (
                <Button
                  variant={
                    activeTab === "recommendations" ? "default" : "outline"
                  }
                  onClick={() => setActiveTab("recommendations")}
                  className="text-sm"
                >
                  Recommendations
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-grow container mx-auto px-4 py-8">
        {/* Loading indicator */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Finding perfect matches...</p>
            </div>
          </div>
        )}

        {/* Discover tab */}
        {activeTab === "discover" && (
          <Discover
            onStartQuiz={() => setActiveTab("what-to-watch")}
            onStartSimilarSearch={() => setActiveTab("similar")}
          />
        )}

        {/* What to Watch tab */}
        {activeTab === "what-to-watch" && (
          <PreferenceFinder onComplete={handleQuizComplete} />
        )}

        {/* Similar Content tab */}
        {activeTab === "similar" && (
          <SimilarContent
            onSelectItem={(item) => console.log("Selected item:", item)}
            useDirectApi={useDirectApi}
          />
        )}

        {/* Recommendations tab */}
        {activeTab === "recommendations" && recommendations.length > 0 && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/4 lg:w-1/5">
              <ContentFilters
                initialFilters={filters}
                onFilterChange={(newFilters) => {
                  setFilters(newFilters);
                  // Apply the new filters to all recommendations
                  const filteredRecommendations = applyFiltersToRecommendations(
                    allRecommendations,
                    newFilters,
                  );
                  setRecommendations(filteredRecommendations);
                }}
              />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-6">Your Recommendations</h2>
              <RecommendationGrid recommendations={recommendations} />
            </div>
          </div>
        )}

        {/* Empty recommendations state */}
        {activeTab === "recommendations" && recommendations.length === 0 && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">No Recommendations Yet</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Use the "What to Watch" or "Find Similar" features to get
              personalized recommendations.
            </p>
            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => setActiveTab("what-to-watch")}
                className="flex items-center"
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                Take the Quiz
              </Button>
              <Button variant="outline" onClick={() => setActiveTab("similar")}>
                Find Similar Content
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
