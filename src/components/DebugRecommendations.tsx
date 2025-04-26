import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPersonalizedRecommendations } from "@/services/aiService";

const DebugRecommendations = () => {
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDebugRequest = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Sample preferences
      const preferences = {
        genres: ["Drama"],
        mood: "heartwarming",
        viewingTime: 90,
        favoriteContent: ["The Office"],
        contentToAvoid: ["Horror"],
        ageRating: "PG-13",
      };

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
      setRawResponse(data);
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
    </div>
  );
};

export default DebugRecommendations;
