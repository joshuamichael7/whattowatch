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
import WhatToWatch from "./dashboard/WhatToWatch";
import SimilarContent from "./dashboard/SimilarContent";

// Add a global preferences variable to store the latest quiz preferences
declare global {
  interface Window {
    preferences?: PreferenceResults;
  }
}

interface PreferenceResults {
  genres: string[];
  mood: string;
  viewingTime: number;
  favoriteContent: string[];
  contentToAvoid: string[];
  ageRating: string;
  aiRecommendations?: Array<{ title: string; reason: string; year?: string }>;
  isAiRecommendationSuccess?: boolean;
  aiRecommendationError?: string | null;
  // For compatibility with the updated PreferenceQuiz component
  moods?: string[];
  ageRatings?: string[];
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

  // Mock function to generate recommendations when AI fails
  const generateMockRecommendations = (preferences: any): ContentItem[] => {
    // This is a placeholder function that would normally generate mock recommendations
    // based on the user's preferences when AI recommendations fail
    console.log(
      "Generating mock recommendations based on preferences:",
      preferences,
    );

    // Return an empty array for now - in a real implementation, this would return
    // a set of fallback recommendations based on the user's preferences
    return [];
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Dashboard header */}
      <header className="bg-white shadow-sm p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Your Dashboard</h1>
          <div className="flex space-x-2">
            {user ? (
              <Link to="/profile">
                <Button variant="outline">Profile</Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button>Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow p-4">
        <div className="max-w-7xl mx-auto">
          {/* Tabs */}
          <div className="flex border-b mb-6">
            <button
              className={`px-4 py-2 font-medium ${activeTab === "discover" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
              onClick={() => setActiveTab("discover")}
            >
              Discover
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === "what-to-watch" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
              onClick={() => setActiveTab("what-to-watch")}
            >
              What to Watch
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === "similar-content" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
              onClick={() => setActiveTab("similar-content")}
            >
              Similar Content
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === "recommendations" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500"}`}
              onClick={() => setActiveTab("recommendations")}
            >
              Recommendations
            </button>
          </div>

          {/* Tab content */}
          <div className="mt-4">
            {activeTab === "discover" && (
              <Discover
                onStartQuiz={() => setActiveTab("what-to-watch")}
                onStartSimilarSearch={() => setActiveTab("similar-content")}
              />
            )}
            {activeTab === "what-to-watch" && (
              <WhatToWatch
                onSubmit={handleWhatToWatchSubmit}
                isLoading={isLoading}
                maturityLevel={filters.maturityLevel}
                initialGenres={[]}
              />
            )}
            {activeTab === "similar-content" && (
              <SimilarContent
                onSelectItem={() => {}}
                useDirectApi={useDirectApi}
              />
            )}
            {activeTab === "recommendations" && (
              <div>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-12">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                    <p className="text-lg text-gray-600">
                      Finding the perfect content for you...
                    </p>
                  </div>
                ) : recommendations.length > 0 ? (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold">
                        Your Recommendations
                      </h2>
                      <ContentFilters
                        filters={filters}
                        setFilters={(newFilters) => {
                          setFilters(newFilters);
                          // Apply the new filters to all recommendations
                          const filteredRecommendations =
                            applyFiltersToRecommendations(
                              allRecommendations,
                              newFilters,
                            );
                          setRecommendations(filteredRecommendations);
                        }}
                      />
                    </div>
                    <RecommendationGrid items={recommendations} />
                  </div>
                ) : (
                  <div className="text-center p-12 bg-white rounded-lg shadow">
                    <p className="text-lg text-gray-600 mb-4">
                      No recommendations found based on your preferences.
                    </p>
                    <p className="text-gray-500 mb-6">
                      Try adjusting your preferences or explore our trending
                      content.
                    </p>
                    <Button
                      onClick={() => setActiveTab("what-to-watch")}
                      className="mr-4"
                    >
                      Update Preferences
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("discover")}
                    >
                      Explore Trending
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
