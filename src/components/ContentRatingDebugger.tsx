import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { verifyRecommendationWithOmdb } from "@/services/aiService";

const ContentRatingDebugger = () => {
  const [imdbId, setImdbId] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDebug = async () => {
    if (!imdbId.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log(
        `[ContentRatingDebugger] Starting debug for IMDB ID: ${imdbId}`,
      );

      // Step 1: Get raw OMDB data
      const omdbResponse = await fetch(
        `/.netlify/functions/omdb?i=${encodeURIComponent(imdbId)}&plot=full`,
      );
      const omdbData = await omdbResponse.json();

      console.log(`[ContentRatingDebugger] Raw OMDB data:`, {
        title: omdbData.Title,
        rated: omdbData.Rated,
        hasRatedField: "Rated" in omdbData,
        ratedValue: omdbData.Rated,
      });

      // Step 2: Create a mock recommendation item
      const mockRecommendation = {
        id: omdbData.imdbID,
        imdb_id: omdbData.imdbID,
        title: omdbData.Title,
        year: omdbData.Year,
        synopsis: omdbData.Plot,
        overview: omdbData.Plot,
        reason: "Test recommendation",
        recommendationReason: "Test recommendation",
        aiRecommended: true,
      };

      // Step 3: Run it through the verification process
      console.log(
        `[ContentRatingDebugger] Running verification with mock recommendation:`,
        mockRecommendation,
      );
      const verifiedContent =
        await verifyRecommendationWithOmdb(mockRecommendation);

      console.log(`[ContentRatingDebugger] Verification result:`, {
        title: verifiedContent?.title,
        content_rating: verifiedContent?.content_rating,
        contentRating: verifiedContent?.contentRating,
        Rated: verifiedContent?.Rated,
        hasContentRating: !!verifiedContent?.content_rating,
        hasContentRatingField: "content_rating" in (verifiedContent || {}),
        hasRatedField: "Rated" in (verifiedContent || {}),
      });

      // Step 4: Collect all results
      setResults({
        omdbData,
        verifiedContent,
        contentRatingFields: {
          content_rating: verifiedContent?.content_rating,
          contentRating: verifiedContent?.contentRating,
          Rated: verifiedContent?.Rated,
        },
      });
    } catch (err) {
      console.error("[ContentRatingDebugger] Error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Content Rating Debugger</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter IMDB ID (e.g., tt0111161)"
              value={imdbId}
              onChange={(e) => setImdbId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDebug()}
            />
            <Button onClick={handleDebug} disabled={loading}>
              {loading ? "Processing..." : "Debug Content Rating"}
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="p-3 bg-primary/10 rounded-md">
                <h3 className="font-medium mb-2">Content Rating Fields:</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-sm font-medium">OMDB Rated:</p>
                    <p className="text-lg">
                      {results.omdbData.Rated || "Not found"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">content_rating:</p>
                    <p className="text-lg">
                      {results.contentRatingFields.content_rating ||
                        "Not found"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">contentRating:</p>
                    <p className="text-lg">
                      {results.contentRatingFields.contentRating || "Not found"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Raw OMDB Data:</h3>
                <div className="bg-muted p-3 rounded-md">
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(results.omdbData, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Verified Content:</h3>
                <div className="bg-muted p-3 rounded-md">
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(results.verifiedContent, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContentRatingDebugger;
