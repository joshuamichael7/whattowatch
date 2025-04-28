import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ContentItem } from "@/types/omdb";

interface RecommendationMatcherProps {
  recommendation: {
    title: string;
    year?: string;
    imdb_id?: string;
    imdb_url?: string;
    reason?: string;
    synopsis?: string;
  };
  onSelectMatch?: (match: ContentItem) => void;
  onCancel?: () => void;
}

const RecommendationMatcher: React.FC<RecommendationMatcherProps> = ({
  recommendation,
  onSelectMatch,
  onCancel,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ContentItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const findMatches = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Extract IMDB ID from URL if available
        let extractedImdbId = null;
        if (recommendation.imdb_url) {
          const urlMatch = recommendation.imdb_url.match(/\/title\/(tt\d+)/i);
          if (urlMatch && urlMatch[1]) {
            extractedImdbId = urlMatch[1];
            console.log(`Extracted IMDB ID from URL: ${extractedImdbId}`);
          }
        }

        const imdbIds = [recommendation.imdb_id, extractedImdbId].filter(
          Boolean,
        ) as string[];

        const uniqueImdbIds = [...new Set(imdbIds)];
        const matchResults: ContentItem[] = [];

        // First try direct IMDB ID lookup
        for (const imdbId of uniqueImdbIds) {
          if (!imdbId) continue;

          console.log(`Searching by IMDB ID: ${imdbId}`);
          const response = await fetch(
            `/.netlify/functions/omdb?i=${imdbId}&plot=full`,
          );

          if (response.ok) {
            const data = await response.json();
            if (data && data.Response === "True") {
              // Check title similarity
              const similarity = calculateTitleSimilarity(
                recommendation.title,
                data.Title,
              );

              console.log(`Title similarity for ${data.Title}: ${similarity}`);

              if (similarity >= 0.8) {
                // Good match, convert to ContentItem
                const contentItem = convertOmdbToContentItem(data);
                contentItem.recommendationReason =
                  recommendation.reason || "Recommended for you";
                contentItem.synopsis = recommendation.synopsis || data.Plot;

                // If this is a very good match (>90%), select it immediately
                if (similarity > 0.9) {
                  console.log(
                    `Found excellent match (${similarity}): ${data.Title}`,
                  );
                  if (onSelectMatch) {
                    onSelectMatch(contentItem);
                    return;
                  } else {
                    navigate(`/movie/${data.imdbID}`, {
                      state: { recommendation: contentItem },
                    });
                    return;
                  }
                }

                matchResults.push(contentItem);
              }
            }
          }
        }

        // If no good matches by IMDB ID, search by title
        if (matchResults.length === 0) {
          console.log(`Searching by title: ${recommendation.title}`);
          const titleSearchResponse = await fetch(
            `/.netlify/functions/omdb?s=${encodeURIComponent(recommendation.title)}${recommendation.year ? `&y=${recommendation.year}` : ""}`,
          );

          if (titleSearchResponse.ok) {
            const searchData = await titleSearchResponse.json();
            if (
              searchData &&
              searchData.Response === "True" &&
              searchData.Search
            ) {
              // Get full details for each search result
              for (const result of searchData.Search.slice(0, 5)) {
                // Limit to top 5
                const detailResponse = await fetch(
                  `/.netlify/functions/omdb?i=${result.imdbID}&plot=full`,
                );
                if (detailResponse.ok) {
                  const detailData = await detailResponse.json();
                  if (detailData && detailData.Response === "True") {
                    const contentItem = convertOmdbToContentItem(detailData);
                    contentItem.recommendationReason =
                      recommendation.reason || "Recommended for you";
                    contentItem.synopsis =
                      recommendation.synopsis || detailData.Plot;
                    matchResults.push(contentItem);
                  }
                }
              }
            }
          }
        }

        if (matchResults.length > 0) {
          console.log(`Found ${matchResults.length} potential matches`);
          setMatches(matchResults);
        } else {
          setError("We couldn't find any matches for this recommendation.");
        }
      } catch (err) {
        console.error("Error finding matches:", err);
        setError("An error occurred while searching for matches.");
      } finally {
        setIsLoading(false);
      }
    };

    findMatches();
  }, [recommendation]);

  const calculateTitleSimilarity = (title1: string, title2: string): number => {
    if (!title1 || !title2) return 0;

    // Normalize titles: lowercase, remove special characters
    const normalize = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const normalizedTitle1 = normalize(title1);
    const normalizedTitle2 = normalize(title2);

    // Check for exact match
    if (normalizedTitle1 === normalizedTitle2) return 1.0;

    // Check if one contains the other
    if (
      normalizedTitle1.includes(normalizedTitle2) ||
      normalizedTitle2.includes(normalizedTitle1)
    ) {
      return 0.9;
    }

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(normalizedTitle1, normalizedTitle2);
    const maxLength = Math.max(
      normalizedTitle1.length,
      normalizedTitle2.length,
    );

    return maxLength > 0 ? 1 - distance / maxLength : 0;
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length;
    const n = str2.length;

    // Create a matrix of size (m+1) x (n+1)
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // Initialize the first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost, // substitution
        );
      }
    }

    return dp[m][n];
  };

  const convertOmdbToContentItem = (omdbData: any): ContentItem => {
    return {
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
      genre_strings: omdbData.Genre ? omdbData.Genre.split(", ") : [],
      overview: omdbData.Plot !== "N/A" ? omdbData.Plot : "",
      content_rating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
      year: omdbData.Year,
      release_date:
        omdbData.Released !== "N/A" ? omdbData.Released : omdbData.Year,
      runtime: omdbData.Runtime !== "N/A" ? omdbData.Runtime : "",
      director: omdbData.Director !== "N/A" ? omdbData.Director : "",
      actors: omdbData.Actors !== "N/A" ? omdbData.Actors : "",
    };
  };

  const handleSelectMatch = (match: ContentItem) => {
    if (onSelectMatch) {
      onSelectMatch(match);
    } else {
      navigate(`/movie/${match.imdb_id}`, { state: { recommendation: match } });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Finding the best matches for your recommendation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={onCancel}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">We found a few matches</h2>
        <p className="text-muted-foreground mb-6">
          Please select the one you're most interested in!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.map((match) => (
          <Card
            key={match.id}
            className="overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-[2/3] overflow-hidden bg-muted">
              <img
                src={
                  match.poster_path ||
                  "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80"
                }
                alt={`${match.title} poster`}
                className="object-cover w-full h-full"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80";
                }}
              />
            </div>

            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-base line-clamp-1">
                {match.title} ({match.year})
              </CardTitle>
            </CardHeader>

            <CardContent className="p-3 pt-2 flex-grow">
              <p className="text-xs text-muted-foreground line-clamp-3">
                {match.overview || "No plot available"}
              </p>
            </CardContent>

            <CardFooter className="p-3 pt-0">
              <Button
                className="w-full"
                onClick={() => handleSelectMatch(match)}
              >
                Select This Match
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {onCancel && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

export default RecommendationMatcher;
