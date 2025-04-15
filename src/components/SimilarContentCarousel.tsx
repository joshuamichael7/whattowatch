import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSimilarContent } from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";

interface SimilarContentCarouselProps {
  contentId: string;
  mediaType: "movie" | "tv";
  limit?: number;
}

const SimilarContentCarousel: React.FC<SimilarContentCarouselProps> = ({
  contentId,
  mediaType,
  limit = 6,
}) => {
  const [similarContent, setSimilarContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSimilarContent = async () => {
      if (!contentId) return;

      console.log(
        `[SimilarContentCarousel] Fetching similar content for ${mediaType} ID: ${contentId}, limit: ${limit}`,
      );
      setIsLoading(true);
      setError(null);

      try {
        // Using the enhanced getSimilarContent function with the new similarity algorithm
        console.log(
          `[SimilarContentCarousel] Calling getSimilarContent with useKeywords=true`,
        );
        const content = await getSimilarContent(contentId, true, limit);
        console.log(
          `[SimilarContentCarousel] Received ${content.length} similar items:`,
          content,
        );

        // Log detailed information about each similar item
        console.log("[SimilarContentCarousel] Similar items details:");
        content.forEach((item, index) => {
          console.log(`Item ${index + 1}: ${item.title}`);
          console.log(`  - ID: ${item.id}`);
          console.log(`  - Media Type: ${item.media_type}`);
          console.log(
            `  - Release Date: ${item.release_date || item.first_air_date || "Unknown"}`,
          );
          console.log(`  - Vote Average: ${item.vote_average}`);
          if (item.plotSimilarity !== undefined) {
            console.log(
              `  - Plot Similarity Score: ${item.plotSimilarity.toFixed(4)}`,
            );
          }
          if (item.keywordSimilarity !== undefined) {
            console.log(
              `  - Keyword Similarity Score: ${item.keywordSimilarity.toFixed(4)}`,
            );
          }
          if (item.titleSimilarity !== undefined) {
            console.log(
              `  - Title Similarity Score: ${item.titleSimilarity.toFixed(4)}`,
            );
          }
          if (item.combinedSimilarity !== undefined) {
            console.log(
              `  - Combined Similarity Score: ${item.combinedSimilarity.toFixed(4)}`,
            );
          }
          console.log("  ---");
        });
        setSimilarContent(content);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load similar content";
        console.error(
          `[SimilarContentCarousel] Error fetching similar content:`,
          err,
        );
        setError(errorMessage);
      } finally {
        setIsLoading(false);
        console.log(
          `[SimilarContentCarousel] Finished loading similar content`,
        );
      }
    };

    fetchSimilarContent();
  }, [contentId, limit, mediaType]);

  if (isLoading) {
    console.log(`[SimilarContentCarousel] Rendering loading state`);
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading similar content...</span>
      </div>
    );
  }

  if (error) {
    console.log(`[SimilarContentCarousel] Rendering error state:`, error);
    return (
      <div className="text-center py-8 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  if (similarContent.length === 0) {
    console.log(`[SimilarContentCarousel] No similar content found`);
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No similar content found</p>
      </div>
    );
  }

  console.log(
    `[SimilarContentCarousel] Rendering ${similarContent.length} similar items for ${mediaType} ID: ${contentId}`,
  );

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold tracking-tight">
          {mediaType === "movie" ? "Similar Movies" : "Similar TV Shows"}
        </h2>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        {/* Display similarity scores on cards */}
        {similarContent.map((item) => (
          <Link
            key={item.id}
            to={`/${item.media_type}/${item.id}`}
            className="block"
          >
            <Card className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
              <div className="aspect-[2/3] relative overflow-hidden bg-muted">
                <img
                  src={item.poster_path}
                  alt={item.title}
                  className="object-cover w-full h-full transition-transform group-hover:scale-105"
                  onError={(e) => {
                    // Hide the image if it fails to load
                    e.currentTarget.style.display = "none";
                  }}
                />
                {item.vote_average > 0 && (
                  <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-medium py-1 px-2 rounded-md">
                    {item.vote_average.toFixed(1)}
                  </div>
                )}
                {item.combinedSimilarity !== undefined && (
                  <div className="absolute top-2 left-2 bg-primary/80 backdrop-blur-sm text-xs font-medium py-1 px-2 rounded-md text-primary-foreground">
                    Similarity: {(item.combinedSimilarity * 100).toFixed(0)}%
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold truncate">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.release_date
                    ? new Date(item.release_date).getFullYear()
                    : item.first_air_date
                      ? new Date(item.first_air_date).getFullYear()
                      : ""}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SimilarContentCarousel;
