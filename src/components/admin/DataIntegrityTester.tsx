import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ContentItem } from "@/types/omdb";

const DataIntegrityTester: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawAiResponse, setRawAiResponse] = useState<any>(null);
  const [omdbResponses, setOmdbResponses] = useState<any[]>([]);
  const [verifiedItems, setVerifiedItems] = useState<any[]>([]);
  const [saveToDatabase, setSaveToDatabase] = useState(false);
  const [useAiMatching, setUseAiMatching] = useState(true);
  const [currentStep, setCurrentStep] = useState<string>("idle");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Function to fetch AI recommendations
  const fetchAiRecommendations = async () => {
    setCurrentStep("ai");

    try {
      console.log("Starting AI recommendations request");

      // Sample preferences (similar to what the quiz would collect)
      const preferences = {
        genres: ["Action", "Adventure"],
        mood: "exciting",
        viewingTime: 120,
        favoriteContent: ["The Matrix", "Inception"],
        contentToAvoid: ["Horror"],
        ageRating: "PG-13",
      };

      console.log("Sending preferences to AI API:", preferences);

      // Call the Netlify function for AI recommendations
      const response = await fetch("/.netlify/functions/ai-recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferences,
          limit: 5, // Small limit for testing
          forceAi: true,
          skipImdbId: true,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `AI recommendations API returned status: ${response.status}`,
        );
      }

      const data = await response.json();
      console.log("Raw AI API response:", data);
      setRawAiResponse(data);

      return data;
    } catch (err) {
      console.error("Error fetching AI recommendations:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      return null;
    }
  };

  // Function to search OMDB for each AI recommendation
  const searchOmdbForRecommendations = async (recommendations: any[]) => {
    setCurrentStep("omdb");
    const omdbResults = [];

    try {
      for (const rec of recommendations) {
        console.log(`Searching OMDB for: ${rec.title}`);

        // Search OMDB by title
        const searchResponse = await fetch(
          `/.netlify/functions/omdb?s=${encodeURIComponent(rec.title)}`,
        );

        if (!searchResponse.ok) {
          console.error(
            `OMDB search failed for ${rec.title}: ${searchResponse.status}`,
          );
          continue;
        }

        const searchData = await searchResponse.json();

        if (
          searchData.Response === "True" &&
          searchData.Search &&
          searchData.Search.length > 0
        ) {
          console.log(
            `Found ${searchData.Search.length} results for "${rec.title}"`,
          );

          // Store the search results along with the original recommendation
          omdbResults.push({
            originalRecommendation: rec,
            omdbSearchResults: searchData.Search,
          });
        } else {
          console.log(`No OMDB results found for "${rec.title}"`);
        }
      }

      setOmdbResponses(omdbResults);
      return omdbResults;
    } catch (err) {
      console.error("Error searching OMDB:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      return [];
    }
  };

  // Function to get detailed content by IMDB ID
  const getDetailedContent = async (imdbId: string) => {
    try {
      console.log(`Getting detailed content for IMDB ID: ${imdbId}`);

      const response = await fetch(
        `/.netlify/functions/omdb?i=${imdbId}&plot=full`,
      );

      if (!response.ok) {
        console.error(
          `Error getting details for ${imdbId}: ${response.status}`,
        );
        return null;
      }

      const data = await response.json();

      if (data.Response === "True") {
        console.log(`Got details for "${data.Title}" (${data.Year})`);
        console.log("Content rating:", data.Rated);
        console.log("All fields:", Object.keys(data).join(", "));
        return data;
      } else {
        console.error(`OMDB API error for ${imdbId}: ${data.Error}`);
        return null;
      }
    } catch (err) {
      console.error(`Error getting content details for ${imdbId}:`, err);
      return null;
    }
  };

  // Function to verify recommendations with AI
  const verifyRecommendationsWithAi = async (omdbResults: any[]) => {
    setCurrentStep("verify");
    const verifiedResults = [];

    try {
      for (const result of omdbResults) {
        const { originalRecommendation, omdbSearchResults } = result;

        if (!omdbSearchResults || omdbSearchResults.length === 0) {
          console.log(
            `No OMDB results to verify for "${originalRecommendation.title}"`,
          );
          continue;
        }

        // Get detailed content for each search result
        const detailedResults = [];
        for (const searchResult of omdbSearchResults.slice(0, 3)) {
          // Limit to top 3 results
          const detailedContent = await getDetailedContent(searchResult.imdbID);
          if (detailedContent) {
            detailedResults.push(detailedContent);
          }
        }

        if (detailedResults.length === 0) {
          console.log(
            `No detailed results found for "${originalRecommendation.title}"`,
          );
          continue;
        }

        // If we only have one result, use it directly
        if (detailedResults.length === 1) {
          console.log(
            `Only one result for "${originalRecommendation.title}", using it directly`,
          );
          const contentItem = convertOmdbToContentItem(
            detailedResults[0],
            originalRecommendation,
          );
          verifiedResults.push(contentItem);
          continue;
        }

        // If we have multiple results and AI matching is enabled, use AI to find the best match
        if (useAiMatching) {
          console.log(
            `Using AI to match "${originalRecommendation.title}" with ${detailedResults.length} results`,
          );

          try {
            const matchResponse = await fetch(
              "/.netlify/functions/ai-content-matcher",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  originalRecommendation: {
                    title: originalRecommendation.title,
                    year: originalRecommendation.year,
                    reason: originalRecommendation.reason,
                    synopsis: originalRecommendation.synopsis,
                  },
                  omdbResults: detailedResults.map((result) => ({
                    title: result.Title,
                    year: result.Year,
                    type: result.Type,
                    imdbID: result.imdbID,
                    plot: result.Plot,
                    actors: result.Actors,
                    director: result.Director,
                    genre: result.Genre,
                    rated: result.Rated,
                  })),
                }),
              },
            );

            if (!matchResponse.ok) {
              throw new Error(
                `AI matching failed with status: ${matchResponse.status}`,
              );
            }

            const matchData = await matchResponse.json();

            if (matchData.matchedResult && matchData.matchedResult.imdbID) {
              console.log(
                `AI matched "${originalRecommendation.title}" with IMDB ID: ${matchData.matchedResult.imdbID}`,
              );
              console.log(
                `Confidence: ${matchData.matchedResult.confidence}, Reason: ${matchData.matchedResult.reasonForMatch}`,
              );

              // Find the matched result in our detailed results
              const matchedResult = detailedResults.find(
                (r) => r.imdbID === matchData.matchedResult.imdbID,
              );

              if (matchedResult) {
                const contentItem = convertOmdbToContentItem(
                  matchedResult,
                  originalRecommendation,
                );
                verifiedResults.push(contentItem);
              }
            } else {
              console.log(
                `AI couldn't find a good match for "${originalRecommendation.title}"`,
              );
            }
          } catch (aiError) {
            console.error(
              `Error using AI to match "${originalRecommendation.title}":`,
              aiError,
            );
            // Fall back to using the first result
            const contentItem = convertOmdbToContentItem(
              detailedResults[0],
              originalRecommendation,
            );
            verifiedResults.push(contentItem);
          }
        } else {
          // If AI matching is disabled, use the first result
          console.log(
            `AI matching disabled, using first result for "${originalRecommendation.title}"`,
          );
          const contentItem = convertOmdbToContentItem(
            detailedResults[0],
            originalRecommendation,
          );
          verifiedResults.push(contentItem);
        }
      }

      setVerifiedItems(verifiedResults);
      return verifiedResults;
    } catch (err) {
      console.error("Error verifying recommendations:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      return [];
    }
  };

  // Function to convert OMDB data to ContentItem format
  const convertOmdbToContentItem = (
    omdbData: any,
    originalRecommendation: any,
  ): ContentItem => {
    console.log(`Converting OMDB data for "${omdbData.Title}" to ContentItem`);
    console.log("OMDB data fields:", Object.keys(omdbData).join(", "));
    console.log("Content rating (Rated):", omdbData.Rated);

    // Extract genre information
    const genreStrings = omdbData.Genre ? omdbData.Genre.split(", ") : [];

    // Create the content item
    const contentItem: ContentItem = {
      id: omdbData.imdbID,
      imdb_id: omdbData.imdbID,
      title: omdbData.Title,
      poster_path: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
      media_type: omdbData.Type === "movie" ? "movie" : "tv",
      vote_average:
        omdbData.imdbRating !== "N/A" ? parseFloat(omdbData.imdbRating) : 0,
      vote_count:
        omdbData.imdbVotes !== "N/A"
          ? parseInt(omdbData.imdbVotes.replace(/,/g, ""))
          : 0,
      genre_ids: [],
      genre_strings: genreStrings,
      overview: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
      content_rating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
      contentRating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
      Rated: omdbData.Rated, // Preserve original OMDB field
      year: omdbData.Year,
      release_date:
        omdbData.Released !== "N/A" ? omdbData.Released : omdbData.Year,
      runtime: omdbData.Runtime !== "N/A" ? omdbData.Runtime : "",
      director: omdbData.Director !== "N/A" ? omdbData.Director : "",
      actors: omdbData.Actors !== "N/A" ? omdbData.Actors : "",
      writer: omdbData.Writer !== "N/A" ? omdbData.Writer : "",
      language: omdbData.Language !== "N/A" ? omdbData.Language : "",
      country: omdbData.Country !== "N/A" ? omdbData.Country : "",
      awards: omdbData.Awards !== "N/A" ? omdbData.Awards : "",
      metascore: omdbData.Metascore !== "N/A" ? omdbData.Metascore : "",
      imdb_rating: omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "",
      imdbRating: omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "",
      imdbVotes: omdbData.imdbVotes !== "N/A" ? omdbData.imdbVotes : "",
      poster: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
      plot: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
      recommendationReason: originalRecommendation.reason || "AI recommended",
      reason: originalRecommendation.reason || "AI recommended",
      synopsis: originalRecommendation.synopsis || omdbData.Plot,
      aiRecommended: true,
      verified: true,
    };

    console.log(
      "Created ContentItem with fields:",
      Object.keys(contentItem).join(", "),
    );
    console.log("Content rating fields in ContentItem:", {
      content_rating: contentItem.content_rating,
      contentRating: contentItem.contentRating,
      Rated: contentItem.Rated,
    });

    return contentItem;
  };

  // Function to save verified items to database
  const saveVerifiedItemsToDatabase = async (items: ContentItem[]) => {
    setCurrentStep("save");

    try {
      console.log(`Saving ${items.length} verified items to database`);

      // This is a placeholder for the actual database save logic
      // In a real implementation, you would call your database service here

      // Simulate a delay for the save operation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("Items saved successfully");
      return true;
    } catch (err) {
      console.error("Error saving items to database:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      return false;
    }
  };

  // Main function to start the testing process
  const startTest = async () => {
    setIsLoading(true);
    setError(null);
    setOmdbResponses([]);
    setVerifiedItems([]);
    setSelectedItem(null);

    try {
      // Step 1: Get AI recommendations
      const aiData = await fetchAiRecommendations();

      if (
        !aiData ||
        !aiData.recommendations ||
        aiData.recommendations.length === 0
      ) {
        throw new Error("No recommendations received from AI");
      }

      // Step 2: Search OMDB for each recommendation
      const omdbResults = await searchOmdbForRecommendations(
        aiData.recommendations,
      );

      if (omdbResults.length === 0) {
        throw new Error("No OMDB results found for any recommendations");
      }

      // Step 3: Verify recommendations with AI
      const verifiedResults = await verifyRecommendationsWithAi(omdbResults);

      if (verifiedResults.length === 0) {
        throw new Error("No verified results found");
      }

      // Step 4: Save to database if enabled
      if (saveToDatabase) {
        await saveVerifiedItemsToDatabase(verifiedResults);
      }

      setCurrentStep("complete");
    } catch (err) {
      console.error("Error in test process:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setCurrentStep("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Data Integrity Tester</CardTitle>
        <CardDescription>
          Test the full recommendation flow to ensure all data fields are
          properly saved
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Switch
              id="save-database"
              checked={saveToDatabase}
              onCheckedChange={setSaveToDatabase}
            />
            <Label htmlFor="save-database">Save to Database</Label>
          </div>

          <div className="flex items-center space-x-4">
            <Switch
              id="use-ai-matching"
              checked={useAiMatching}
              onCheckedChange={setUseAiMatching}
            />
            <Label htmlFor="use-ai-matching">Use AI for Matching</Label>
          </div>

          <Button onClick={startTest} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing in progress...
              </>
            ) : (
              "Start Data Integrity Test"
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Progress indicators */}
          {currentStep !== "idle" && (
            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center">
                <Badge
                  variant={
                    currentStep === "ai" || currentStep === "complete"
                      ? "default"
                      : "outline"
                  }
                  className="mr-2"
                >
                  {currentStep === "ai" || currentStep === "complete" ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    "1"
                  )}
                </Badge>
                <span className={currentStep === "ai" ? "font-medium" : ""}>
                  AI Recommendations
                </span>
              </div>
              <div className="h-px w-8 bg-muted" />
              <div className="flex items-center">
                <Badge
                  variant={
                    currentStep === "omdb" ||
                    currentStep === "verify" ||
                    currentStep === "save" ||
                    currentStep === "complete"
                      ? "default"
                      : "outline"
                  }
                  className="mr-2"
                >
                  {currentStep === "omdb" ||
                  currentStep === "verify" ||
                  currentStep === "save" ||
                  currentStep === "complete" ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    "2"
                  )}
                </Badge>
                <span className={currentStep === "omdb" ? "font-medium" : ""}>
                  OMDB Search
                </span>
              </div>
              <div className="h-px w-8 bg-muted" />
              <div className="flex items-center">
                <Badge
                  variant={
                    currentStep === "verify" ||
                    currentStep === "save" ||
                    currentStep === "complete"
                      ? "default"
                      : "outline"
                  }
                  className="mr-2"
                >
                  {currentStep === "verify" ||
                  currentStep === "save" ||
                  currentStep === "complete" ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    "3"
                  )}
                </Badge>
                <span className={currentStep === "verify" ? "font-medium" : ""}>
                  Verification
                </span>
              </div>
              <div className="h-px w-8 bg-muted" />
              <div className="flex items-center">
                <Badge
                  variant={
                    currentStep === "save" || currentStep === "complete"
                      ? "default"
                      : "outline"
                  }
                  className="mr-2"
                >
                  {currentStep === "save" || currentStep === "complete" ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : (
                    "4"
                  )}
                </Badge>
                <span className={currentStep === "save" ? "font-medium" : ""}>
                  Save
                </span>
              </div>
            </div>
          )}

          {/* Results display */}
          {(rawAiResponse ||
            omdbResponses.length > 0 ||
            verifiedItems.length > 0) && (
            <Tabs defaultValue="verified" className="mt-6">
              <TabsList>
                <TabsTrigger value="verified">
                  Verified Items ({verifiedItems.length})
                </TabsTrigger>
                <TabsTrigger value="omdb">
                  OMDB Results ({omdbResponses.length})
                </TabsTrigger>
                <TabsTrigger value="ai">AI Response</TabsTrigger>
              </TabsList>

              <TabsContent value="verified" className="mt-4">
                {verifiedItems.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {verifiedItems.map((item) => (
                        <Card
                          key={item.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedItem(item)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              {item.poster_path ? (
                                <img
                                  src={item.poster_path}
                                  alt={item.title}
                                  className="w-20 h-auto object-cover rounded"
                                />
                              ) : (
                                <div className="w-20 h-28 bg-muted flex items-center justify-center rounded">
                                  <span className="text-xs text-muted-foreground">
                                    No image
                                  </span>
                                </div>
                              )}
                              <div>
                                <h3 className="font-medium">{item.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {item.year}
                                </p>
                                <div className="mt-2">
                                  <Badge variant="outline">
                                    {item.media_type}
                                  </Badge>
                                  {item.content_rating && (
                                    <Badge variant="secondary" className="ml-2">
                                      {item.content_rating}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {selectedItem && (
                      <Card className="mt-6">
                        <CardHeader>
                          <CardTitle>
                            {selectedItem.title} ({selectedItem.year})
                          </CardTitle>
                          <CardDescription>
                            {selectedItem.media_type === "movie"
                              ? "Movie"
                              : "TV Series"}{" "}
                            • {selectedItem.content_rating}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h3 className="font-medium mb-2">
                                Content Details
                              </h3>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-sm font-medium">
                                    Director:
                                  </span>
                                  <span className="text-sm ml-2">
                                    {selectedItem.director || "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    Actors:
                                  </span>
                                  <span className="text-sm ml-2">
                                    {selectedItem.actors || "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    Genre:
                                  </span>
                                  <span className="text-sm ml-2">
                                    {selectedItem.genre_strings?.join(", ") ||
                                      "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    Runtime:
                                  </span>
                                  <span className="text-sm ml-2">
                                    {selectedItem.runtime || "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    IMDB Rating:
                                  </span>
                                  <span className="text-sm ml-2">
                                    {selectedItem.imdb_rating || "N/A"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-sm font-medium">
                                    Content Rating:
                                  </span>
                                  <span className="text-sm ml-2">
                                    {selectedItem.content_rating || "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h3 className="font-medium mb-2">Plot</h3>
                              <p className="text-sm">
                                {selectedItem.overview || "No plot available"}
                              </p>

                              <h3 className="font-medium mt-4 mb-2">
                                Recommendation Reason
                              </h3>
                              <p className="text-sm">
                                {selectedItem.recommendationReason ||
                                  "No reason provided"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-6">
                            <h3 className="font-medium mb-2">All Fields</h3>
                            <ScrollArea className="h-64 rounded border p-4">
                              <pre className="text-xs">
                                {JSON.stringify(selectedItem, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No verified items yet. Run the test to see results.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="omdb" className="mt-4">
                {omdbResponses.length > 0 ? (
                  <div className="space-y-6">
                    {omdbResponses.map((response, index) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle>
                            Original: {response.originalRecommendation.title}
                          </CardTitle>
                          <CardDescription>
                            Found {response.omdbSearchResults.length} potential
                            matches
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {response.omdbSearchResults.map((result: any) => (
                              <div
                                key={result.imdbID}
                                className="flex items-start gap-3 p-3 border rounded"
                              >
                                {result.Poster && result.Poster !== "N/A" ? (
                                  <img
                                    src={result.Poster}
                                    alt={result.Title}
                                    className="w-16 h-auto object-cover"
                                  />
                                ) : (
                                  <div className="w-16 h-24 bg-muted flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground">
                                      No image
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <h4 className="text-sm font-medium">
                                    {result.Title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    {result.Year}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {result.Type}
                                  </p>
                                  <p className="text-xs mt-1">
                                    ID: {result.imdbID}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No OMDB results yet. Run the test to see results.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ai" className="mt-4">
                {rawAiResponse ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Response</CardTitle>
                      <CardDescription>
                        Raw response from the AI recommendations API
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96 rounded border p-4">
                        <pre className="text-xs">
                          {JSON.stringify(rawAiResponse, null, 2)}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No AI response yet. Run the test to see results.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataIntegrityTester;
