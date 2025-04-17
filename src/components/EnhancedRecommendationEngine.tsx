import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Brain } from "lucide-react";
import { getPersonalizedRecommendations } from "@/services/aiService";
import { getContentById } from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";

interface EnhancedRecommendationEngineProps {
  preferences?: {
    genres: string[];
    mood: string;
    viewingTime: number;
    favoriteContent: string[];
    contentToAvoid: string[];
    ageRating: string;
  };
  contentId?: string;
  limit?: number;
  onRecommendationsGenerated?: (recommendations: ContentItem[]) => void;
}

const EnhancedRecommendationEngine: React.FC<
  EnhancedRecommendationEngineProps
> = ({
  preferences,
  contentId,
  limit = 10,
  onRecommendationsGenerated = () => {},
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [activeTab, setActiveTab] = useState<"ai" | "database">("ai");
  const [aiRecommendations, setAiRecommendations] = useState<
    Array<{ title: string; reason: string }>
  >([]);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Generate recommendations based on preferences or content ID
  const generateRecommendations = async () => {
    if (!preferences && !contentId) {
      setError("Either preferences or a content ID must be provided");
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStatusMessage("Initializing recommendation engine...");

    try {
      // Step 1: Check Supabase for cached recommendations if preferences are provided
      if (preferences) {
        setStatusMessage("Checking for cached recommendations...");
        setProgress(5);

        // Generate a cache key based on preferences
        const cacheKey = generateCacheKey(preferences);

        try {
          // Import dynamically to avoid circular dependencies
          const { getCachedRecommendations } = await import(
            "../lib/supabaseClient"
          );
          const cachedRecs = await getCachedRecommendations(cacheKey);

          if (cachedRecs && cachedRecs.length > 0) {
            setStatusMessage("Found cached recommendations");
            setProgress(50);
            setRecommendations(cachedRecs);
            setProgress(100);
            setStatusMessage("Cached recommendations loaded successfully");
            onRecommendationsGenerated(cachedRecs);
            setIsLoading(false);
            return;
          }
        } catch (cacheError) {
          console.error("Error checking recommendation cache:", cacheError);
          // Continue with normal recommendation flow if cache check fails
        }

        // If no cached recommendations, proceed with AI recommendations
        setStatusMessage(
          "Generating AI recommendations based on preferences...",
        );
        setProgress(10);

        const aiRecs = await getPersonalizedRecommendations(preferences, limit);
        setAiRecommendations(aiRecs);
        setProgress(40);

        // Convert AI recommendations to ContentItems
        if (aiRecs.length > 0) {
          setStatusMessage("Fetching details for AI recommendations...");
          const aiContentItems = await fetchContentDetailsForTitles(
            aiRecs.map((rec) => rec.title),
          );

          // Add recommendation reasons to content items
          const aiContentWithReasons = aiContentItems.map((item) => {
            const matchingRec = aiRecs.find(
              (rec) => rec.title.toLowerCase() === item.title.toLowerCase(),
            );
            return {
              ...item,
              recommendationReason: matchingRec?.reason || "AI recommended",
              recommendationSource: "ai",
            };
          });

          setProgress(60);
          setRecommendations(aiContentWithReasons);

          // Cache the AI recommendations for future use
          try {
            const { cacheRecommendations } = await import(
              "../lib/supabaseClient"
            );
            await cacheRecommendations(cacheKey, aiContentWithReasons);
            console.log("Successfully cached AI recommendations");
          } catch (cacheError) {
            console.error("Error caching AI recommendations:", cacheError);
            // Continue even if caching fails
          }
        }
      }

      // Step 2: Check Supabase for similar content if content ID is provided
      if (contentId) {
        setStatusMessage("Checking database for similar content...");
        setProgress(70);

        try {
          // Get similar content from Supabase
          const { getSimilarContentFromSupabase } = await import(
            "../lib/supabaseClient"
          );
          const supabaseResults = await getSimilarContentFromSupabase(
            contentId,
            limit,
          );

          if (supabaseResults && supabaseResults.length > 0) {
            setStatusMessage("Found similar content in database");
            const supabaseItems = supabaseResults.map((item) => ({
              ...item,
              recommendationReason: "Similar content from our database",
              recommendationSource: "database",
            }));

            setProgress(90);

            // If we already have AI recommendations, combine them
            if (recommendations.length > 0) {
              // Combine and deduplicate
              const combinedRecs = [...recommendations];

              for (const dbItem of supabaseItems) {
                if (!combinedRecs.some((item) => item.id === dbItem.id)) {
                  combinedRecs.push(dbItem);
                }
              }

              setRecommendations(combinedRecs.slice(0, limit));
            } else {
              setRecommendations(supabaseItems);
            }
          } else {
            // If no similar content found in Supabase, use the OMDB API
            setStatusMessage("Finding similar content via OMDB API...");

            // Get the original content details
            const originalContent = await getContentById(contentId);

            if (originalContent) {
              // Use the title and genre to find similar content
              const { searchContent } = await import("@/lib/omdbClient");
              const searchResults = await searchContent(
                originalContent.genre_strings
                  ? `${originalContent.genre_strings[0]} ${originalContent.title.split(" ")[0]}`
                  : originalContent.title,
                originalContent.media_type,
              );

              if (searchResults.length > 0) {
                const similarItems = searchResults
                  .filter((item) => item.id !== contentId) // Filter out the original content
                  .map((item) => ({
                    ...item,
                    recommendationReason: `Similar to ${originalContent.title}`,
                    recommendationSource: "database",
                  }));

                setRecommendations(similarItems.slice(0, limit));
              }
            }
          }
        } catch (dbError) {
          console.error(
            "Error fetching similar content from database:",
            dbError,
          );
          setError(
            "Could not retrieve similar content. Please try again later.",
          );
        }
      }

      setProgress(100);
      setStatusMessage("Recommendations generated successfully");

      // If we have recommendations, call the callback
      if (recommendations.length > 0) {
        onRecommendationsGenerated(recommendations);
      } else {
        setError(
          "No recommendations could be generated. Try adjusting your preferences or selecting a different content item.",
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while generating recommendations",
      );
      console.error("Error generating recommendations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to generate a cache key from preferences
  const generateCacheKey = (prefs: any): string => {
    const { genres, mood, viewingTime, ageRating } = prefs;
    const genresStr = genres.sort().join(",");
    return `${genresStr}|${mood}|${viewingTime}|${ageRating}`;
  };

  // Helper function to fetch content details for a list of titles
  const fetchContentDetailsForTitles = async (
    titles: string[],
  ): Promise<ContentItem[]> => {
    const contentItems: ContentItem[] = [];

    for (const title of titles) {
      try {
        // Search for the title
        const { searchContent } = await import("@/lib/omdbClient");
        const searchResults = await searchContent(title, "all");

        if (searchResults.length > 0) {
          // Get the first result (most relevant)
          const firstResult = searchResults[0];

          // Get detailed content
          const detailedContent = await getContentById(firstResult.id);

          if (detailedContent) {
            contentItems.push(detailedContent);
          }
        }
      } catch (err) {
        console.error(`Error fetching content for title "${title}":`, err);
      }
    }

    return contentItems;
  };

  // Filter recommendations based on active tab
  const filteredRecommendations =
    activeTab === "ai"
      ? recommendations.filter((item) => item.recommendationSource === "ai")
      : recommendations.filter(
          (item) => item.recommendationSource === "database",
        );

  return (
    <div className="w-full bg-background p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-primary" />
            Enhanced Recommendation Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="mb-6">
            <Button
              onClick={generateRecommendations}
              disabled={isLoading || (!preferences && !contentId)}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Recommendations...
                </>
              ) : (
                "Generate Recommendations"
              )}
            </Button>

            {isLoading && (
              <div className="mt-4">
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-in-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusMessage}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
                {error}
              </div>
            )}
          </div>

          {/* Results */}
          {recommendations.length > 0 && (
            <div>
              <Tabs
                defaultValue="ai"
                onValueChange={(value) => setActiveTab(value as any)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="ai" className="flex items-center">
                    <Brain className="mr-2 h-4 w-4" />
                    AI Recommendations
                  </TabsTrigger>
                  <TabsTrigger value="database" className="flex items-center">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Similar Content
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="ai" className="mt-4">
                  <h3 className="text-lg font-medium mb-2">
                    AI-Powered Recommendations
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Recommendations generated using Gemini AI based on your
                    preferences
                  </p>
                  <RecommendationList
                    recommendations={filteredRecommendations}
                    showAIReasons={true}
                  />
                </TabsContent>

                <TabsContent value="database" className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Similar Content</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Recommendations based on content similarity from our
                    database
                  </p>
                  <RecommendationList
                    recommendations={filteredRecommendations}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface RecommendationListProps {
  recommendations: ContentItem[];
  showAIReasons?: boolean;
}

const RecommendationList: React.FC<RecommendationListProps> = ({
  recommendations,
  showAIReasons = false,
}) => {
  if (recommendations.length === 0) {
    return (
      <p className="text-center text-muted-foreground">
        No recommendations available
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="w-1/6">
                <img
                  src={item.poster_path}
                  alt={item.title}
                  className="w-full rounded-md object-cover aspect-[2/3]"
                  onError={(e) => {
                    // Hide the image if it fails to load
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <div className="flex items-center gap-2 mt-1 mb-2">
                  <Badge variant="outline">
                    {item.media_type === "movie" ? "Movie" : "TV Show"}
                  </Badge>
                  {item.release_date && (
                    <span className="text-sm text-muted-foreground">
                      {new Date(item.release_date).getFullYear()}
                    </span>
                  )}
                  {item.vote_average > 0 && (
                    <span className="text-sm flex items-center">
                      <span className="text-yellow-500 mr-1">★</span>
                      {item.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>

                {item.overview && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {item.overview}
                  </p>
                )}

                {item.recommendationReason && (
                  <div className="mt-2">
                    <Badge variant="secondary" className="font-normal">
                      {item.recommendationSource === "ai" ? (
                        <Brain className="mr-1 h-3 w-3" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      {item.recommendationReason}
                    </Badge>
                  </div>
                )}

                {item.genre_strings && item.genre_strings.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.genre_strings.slice(0, 3).map((genre, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                    {item.genre_strings.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{item.genre_strings.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EnhancedRecommendationEngine;
