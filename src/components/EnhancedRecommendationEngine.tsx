import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Brain, Database } from "lucide-react";
import { getPersonalizedRecommendations } from "@/services/aiService";
import { querySimilarContent } from "@/services/vectorService";
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
  const [activeTab, setActiveTab] = useState<"ai" | "vector" | "hybrid">(
    "hybrid",
  );
  const [aiRecommendations, setAiRecommendations] = useState<
    Array<{ title: string; reason: string }>
  >([]);
  const [vectorRecommendations, setVectorRecommendations] = useState<
    ContentItem[]
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
      // Step 1: Generate AI recommendations if preferences are provided
      if (preferences) {
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
        }
      }

      // Step 2: Generate vector-based recommendations if content ID is provided
      if (contentId) {
        setStatusMessage("Querying vector database for similar content...");
        setProgress(70);

        // Get similar content IDs from vector database
        const similarIds = await querySimilarContent(
          contentId,
          undefined,
          limit,
        );

        if (similarIds.length > 0) {
          setStatusMessage("Fetching details for vector recommendations...");

          // Fetch content details for each ID
          const vectorItems = await Promise.all(
            similarIds.map(async (id) => {
              try {
                const content = await getContentById(id);
                return content
                  ? ({
                      ...content,
                      recommendationReason:
                        "Similar content based on vector similarity",
                      recommendationSource: "vector",
                    } as ContentItem)
                  : null;
              } catch (err) {
                console.error(`Error fetching content for ID ${id}:`, err);
                return null;
              }
            }),
          );

          const validVectorItems = vectorItems.filter(Boolean) as ContentItem[];
          setVectorRecommendations(validVectorItems);
          setProgress(90);

          // If we have both AI and vector recommendations, combine them
          if (recommendations.length > 0) {
            // Combine and deduplicate
            const combinedRecs = [...recommendations];

            for (const vectorItem of validVectorItems) {
              if (!combinedRecs.some((item) => item.id === vectorItem.id)) {
                combinedRecs.push(vectorItem as ContentItem);
              }
            }

            setRecommendations(combinedRecs.slice(0, limit));
          } else {
            setRecommendations(validVectorItems);
          }
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
    activeTab === "hybrid"
      ? recommendations
      : recommendations.filter(
          (item) => item.recommendationSource === activeTab,
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
                defaultValue="hybrid"
                onValueChange={(value) => setActiveTab(value as any)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="hybrid" className="flex items-center">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Hybrid
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center">
                    <Brain className="mr-2 h-4 w-4" />
                    AI
                  </TabsTrigger>
                  <TabsTrigger value="vector" className="flex items-center">
                    <Database className="mr-2 h-4 w-4" />
                    Vector
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="hybrid" className="mt-4">
                  <h3 className="text-lg font-medium mb-2">
                    Hybrid Recommendations
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Combined recommendations from both AI and vector similarity
                  </p>
                  <RecommendationList
                    recommendations={filteredRecommendations}
                  />
                </TabsContent>

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

                <TabsContent value="vector" className="mt-4">
                  <h3 className="text-lg font-medium mb-2">
                    Vector Similarity Recommendations
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Recommendations based on content vector similarity
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
                        <Database className="mr-1 h-3 w-3" />
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
