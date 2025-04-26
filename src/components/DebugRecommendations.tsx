import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPersonalizedRecommendations } from "@/services/aiService";

const DebugRecommendations = () => {
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [omdbResponse, setOmdbResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleDebugRequest();
  }, []);

  const handleDebugRequest = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Starting debug request to AI recommendations API");

      // Sample preferences
      const preferences = {
        genres: ["Drama"],
        mood: "heartwarming",
        viewingTime: 90,
        favoriteContent: ["The Office"],
        contentToAvoid: ["Horror"],
        ageRating: "PG-13",
      };

      console.log("Sending preferences to AI API:", preferences);

      // Make direct request to the Netlify function
      const response = await fetch("/.netlify/functions/ai-recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferences,
          limit: 5, // Small limit for debugging
        }),
      });

      const data = await response.json();
      console.log("Raw AI API response:", data);
      setRawResponse(data);

      // If we have recommendations, test OMDB lookup for the first one
      if (data.recommendations && data.recommendations.length > 0) {
        const firstRec = data.recommendations[0];
        console.log("Testing OMDB lookup for:", firstRec.title);

        // Try to look up the first recommendation in OMDB
        const omdbResponse = await fetch(
          `/.netlify/functions/omdb?s=${encodeURIComponent(firstRec.title)}`,
        );
        const omdbData = await omdbResponse.json();
        console.log("OMDB response for title search:", omdbData);
        setOmdbResponse(omdbData);

        // If we found a match, get the full details
        if (omdbData.Search && omdbData.Search.length > 0) {
          const firstMatch = omdbData.Search[0];
          console.log("First OMDB match:", firstMatch);

          // Get full details
          const detailResponse = await fetch(
            `/.netlify/functions/omdb?i=${firstMatch.imdbID}&plot=full`,
          );
          const detailData = await detailResponse.json();
          console.log("OMDB detail response:", detailData);

          // Compare synopsis with plot
          if (firstRec.synopsis && detailData.Plot) {
            console.log("AI Synopsis:", firstRec.synopsis);
            console.log("OMDB Plot:", detailData.Plot);

            // Simple word overlap comparison
            const aiWords = firstRec.synopsis
              .toLowerCase()
              .split(/\W+/)
              .filter((w) => w.length > 3);
            const omdbWords = detailData.Plot.toLowerCase()
              .split(/\W+/)
              .filter((w) => w.length > 3);

            const aiWordSet = new Set(aiWords);
            const omdbWordSet = new Set(omdbWords);

            let overlap = 0;
            for (const word of aiWordSet) {
              if (omdbWordSet.has(word)) overlap++;
            }

            const similarity =
              overlap / Math.max(1, Math.min(aiWordSet.size, omdbWordSet.size));
            console.log(
              `Synopsis similarity score: ${similarity.toFixed(2)} (${overlap} words overlap)`,
            );
          }
        }
      }
    } catch (err) {
      console.error("Error in debug request:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Recommendations</h1>

      <Button
        onClick={handleDebugRequest}
        disabled={isLoading}
        className="mb-6"
      >
        {isLoading ? "Loading..." : "Test AI Recommendations"}
      </Button>

      {error && (
        <div className="p-4 mb-6 bg-red-100 text-red-800 rounded-md">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {rawResponse && (
        <Card>
          <CardHeader>
            <CardTitle>Raw AI Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[600px]">
              <h3 className="font-medium mb-2">
                Recommendations ({rawResponse.recommendations?.length || 0}):
              </h3>

              {rawResponse.recommendations?.map((rec: any, index: number) => (
                <div key={index} className="mb-4 p-4 border rounded-md">
                  <p>
                    <strong>Title:</strong> {rec.title}
                  </p>
                  <p>
                    <strong>Year:</strong> {rec.year}
                  </p>
                  <p>
                    <strong>Reason:</strong> {rec.reason}
                  </p>
                  <p>
                    <strong>Synopsis:</strong> {rec.synopsis || "<missing>"}
                  </p>
                  {rec.director && (
                    <p>
                      <strong>Director:</strong> {rec.director}
                    </p>
                  )}
                  {rec.actors && (
                    <p>
                      <strong>Actors:</strong> {rec.actors}
                    </p>
                  )}
                </div>
              ))}

              <div className="mt-6">
                <h3 className="font-medium mb-2">Full Response:</h3>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto text-xs">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {omdbResponse && (
        <Card>
          <CardHeader>
            <CardTitle>OMDB Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[600px]">
              <h3 className="font-medium mb-2">
                OMDB Search Results ({omdbResponse.Search?.length || 0}):
              </h3>

              {omdbResponse.Search?.map((rec: any, index: number) => (
                <div key={index} className="mb-4 p-4 border rounded-md">
                  <p>
                    <strong>Title:</strong> {rec.Title}
                  </p>
                  <p>
                    <strong>Year:</strong> {rec.Year}
                  </p>
                  <p>
                    <strong>IMDB ID:</strong> {rec.imdbID}
                  </p>
                  <p>
                    <strong>Plot:</strong> {rec.Plot || "<missing>"}
                  </p>
                </div>
              ))}

              <div className="mt-6">
                <h3 className="font-medium mb-2">Full OMDB Response:</h3>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto text-xs">
                  {JSON.stringify(omdbResponse, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DebugRecommendations;
