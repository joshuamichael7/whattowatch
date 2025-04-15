import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getContentById, getSimilarContent } from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";
import { Link } from "react-router-dom";

const PlotSimilarityTest: React.FC = () => {
  const [contentId, setContentId] = useState("tt0816692"); // Default to Interstellar
  const [content, setContent] = useState<ContentItem | null>(null);
  const [similarContent, setSimilarContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = async () => {
    if (!contentId) return;

    setIsLoading(true);
    setError(null);

    try {
      const contentData = await getContentById(contentId);
      setContent(contentData as ContentItem);

      if (contentData) {
        const similar = await getSimilarContent(contentId, false, 10);
        setSimilarContent(similar);
      } else {
        setError("Content not found. Please check the IMDB ID and try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex items-center">
            <h1 className="text-xl font-bold">Plot Similarity Test</h1>
          </div>
          <nav className="flex flex-1 items-center justify-end space-x-4">
            <Button variant="ghost" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="container py-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <Label htmlFor="contentId">Enter IMDB ID:</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="contentId"
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              placeholder="e.g., tt0816692"
            />
            <Button onClick={fetchContent} disabled={isLoading}>
              {isLoading ? "Loading..." : "Search"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Try: tt0816692 (Interstellar), tt0468569 (The Dark Knight),
            tt0133093 (The Matrix)
          </p>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-destructive/10 text-destructive rounded-md">
            {error}
          </div>
        )}

        {content && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/4">
                  <img
                    src={content.poster_path}
                    alt={content.title}
                    className="w-full rounded-md"
                  />
                </div>
                <div className="md:w-3/4">
                  <h2 className="text-xl font-bold mb-2">{content.title}</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    {content.release_date} •{" "}
                    {content.media_type === "movie" ? "Movie" : "TV Show"}
                  </p>
                  <h3 className="font-semibold mb-1">Plot Synopsis:</h3>
                  <p className="mb-4">{content.overview}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {content.genre_strings?.map((genre, index) => (
                      <Badge key={index} variant="outline">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {similarContent.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">
              Similar Content (Plot-Based)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {similarContent.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="md:w-1/4">
                        <img
                          src={item.poster_path}
                          alt={item.title}
                          className="w-full rounded-md"
                        />
                      </div>
                      <div className="md:w-3/4">
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.release_date} •{" "}
                          {item.media_type === "movie" ? "Movie" : "TV Show"}
                        </p>
                        {item.plotSimilarity !== undefined && (
                          <div className="mb-2 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant={
                                  item.plotSimilarity > 0.2
                                    ? "default"
                                    : "outline"
                                }
                              >
                                Plot Similarity:{" "}
                                {Math.round(item.plotSimilarity * 100)}%
                              </Badge>

                              {item.keywordSimilarity !== undefined && (
                                <Badge
                                  variant={
                                    item.keywordSimilarity > 0.15
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  Keyword Match:{" "}
                                  {Math.round(item.keywordSimilarity * 100)}%
                                </Badge>
                              )}
                            </div>

                            {item.keywords && (
                              <div className="flex flex-wrap gap-1">
                                {item.keywords.map((keyword, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlotSimilarityTest;
