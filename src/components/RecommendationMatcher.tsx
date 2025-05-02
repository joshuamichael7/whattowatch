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
        console.log(
          `[RecommendationMatcher] Finding matches for: ${recommendation.title}`,
        );
        console.log(
          `[RecommendationMatcher] IMDB ID: ${recommendation.imdb_id || "none"}`,
        );
        console.log(
          `[RecommendationMatcher] IMDB URL: ${recommendation.imdb_url || "none"}`,
        );

        let extractedImdbId = null;
        if (recommendation.imdb_url) {
          const urlMatch = recommendation.imdb_url.match(/\/title\/(tt\d+)/i);
          if (urlMatch && urlMatch[1]) {
            extractedImdbId = urlMatch[1];
            console.log(
              `[RecommendationMatcher] Extracted IMDB ID from URL: ${extractedImdbId}`,
            );
          }
        }

        const imdbIds = [recommendation.imdb_id, extractedImdbId].filter(
          Boolean,
        ) as string[];

        const uniqueImdbIds = [...new Set(imdbIds)];
        const matchResults: ContentItem[] = [];

        if (
          uniqueImdbIds.length > 1 &&
          recommendation.imdb_id &&
          extractedImdbId &&
          recommendation.imdb_id !== extractedImdbId
        ) {
          console.warn(
            `[RecommendationMatcher] WARNING: IMDB ID mismatch between provided ID (${recommendation.imdb_id}) and URL-extracted ID (${extractedImdbId})`,
          );
        }

        let foundExcellentMatch = false;
        for (const imdbId of uniqueImdbIds) {
          if (!imdbId) continue;

          console.log(
            `[RecommendationMatcher] Searching by IMDB ID: ${imdbId}`,
          );
          try {
            const response = await fetch(
              `/.netlify/functions/omdb?i=${imdbId}&plot=full`,
            );

            if (!response.ok) {
              console.error(
                `[RecommendationMatcher] OMDB API error for IMDB ID ${imdbId}: ${response.status}`,
              );
              continue;
            }

            const data = await response.json();
            if (data && data.Response === "True") {
              const similarity = calculateTitleSimilarity(
                recommendation.title,
                data.Title,
              );

              console.log(
                `[RecommendationMatcher] Title similarity for ${data.Title}: ${similarity.toFixed(2)}`,
              );

              if (similarity >= 0.95) {
                const contentItem = convertOmdbToContentItem(data);
                contentItem.recommendationReason =
                  recommendation.reason || "Recommended for you";
                contentItem.synopsis = data.Plot;
                contentItem.imdb_url = recommendation.imdb_url;
                contentItem.poster = data.Poster;
                contentItem.contentRating = data.Rated;
                contentItem.created_at = new Date().toISOString();
                contentItem.updated_at = new Date().toISOString();

                console.log(
                  `[RecommendationMatcher] Found excellent match (${similarity.toFixed(2)}): ${data.Title}`,
                );
                foundExcellentMatch = true;
                if (onSelectMatch) {
                  onSelectMatch(contentItem);
                  return;
                } else {
                  navigate(`/movie/${data.imdbID}`, {
                    state: { recommendation: contentItem },
                  });
                  return;
                }
              } else if (similarity >= 0.8) {
                console.log(
                  `[RecommendationMatcher] Found good match (${similarity.toFixed(2)}): ${data.Title}`,
                );
                const contentItem = convertOmdbToContentItem(data);
                contentItem.recommendationReason =
                  recommendation.reason || "Recommended for you";
                contentItem.synopsis = data.Plot;
                contentItem.imdb_url = recommendation.imdb_url;
                contentItem.poster = data.Poster;
                contentItem.contentRating = data.Rated;
                contentItem.created_at = new Date().toISOString();
                contentItem.updated_at = new Date().toISOString();
                matchResults.push(contentItem);
              } else {
                console.log(
                  `[RecommendationMatcher] Low similarity match (${similarity.toFixed(2)}): ${data.Title}`,
                );
                const contentItem = convertOmdbToContentItem(data);
                contentItem.recommendationReason =
                  recommendation.reason || "Recommended for you";
                contentItem.synopsis = data.Plot;
                contentItem.imdb_url = recommendation.imdb_url;
                contentItem.poster = data.Poster;
                contentItem.contentRating = data.Rated;
                contentItem.created_at = new Date().toISOString();
                contentItem.updated_at = new Date().toISOString();
                contentItem.lowSimilarity = true;
                matchResults.push(contentItem);
              }
            } else {
              console.log(
                `[RecommendationMatcher] No valid data returned for IMDB ID: ${imdbId}`,
              );
            }
          } catch (error) {
            console.error(
              `[RecommendationMatcher] Error fetching data for IMDB ID ${imdbId}:`,
              error,
            );
            continue;
          }
        }

        if (matchResults.length === 0) {
          console.log(
            `[RecommendationMatcher] No matches by IMDB ID, searching by title: ${recommendation.title}`,
          );
          const titleSearchResponse = await fetch(
            `/.netlify/functions/omdb?s=${encodeURIComponent(recommendation.title)}${recommendation.year ? `&y=${recommendation.year}` : ""}`,
          );

          if (!titleSearchResponse.ok) {
            console.error(
              `[RecommendationMatcher] OMDB search failed: ${titleSearchResponse.status}`,
            );
            setError("Error searching for content. Please try again.");
            return;
          }

          const searchData = await titleSearchResponse.json();
          if (
            searchData &&
            searchData.Response === "True" &&
            searchData.Search
          ) {
            console.log(
              `[RecommendationMatcher] Found ${searchData.Search.length} results by title search`,
            );

            for (const result of searchData.Search.slice(0, 5)) {
              const detailResponse = await fetch(
                `/.netlify/functions/omdb?i=${result.imdbID}&plot=full`,
              );
              if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                if (detailData && detailData.Response === "True") {
                  const similarity = calculateTitleSimilarity(
                    recommendation.title,
                    detailData.Title,
                  );

                  console.log(
                    `[RecommendationMatcher] Title similarity for ${detailData.Title}: ${similarity.toFixed(2)}`,
                  );

                  const contentItem = convertOmdbToContentItem(detailData);
                  contentItem.recommendationReason =
                    recommendation.reason || "Recommended for you";
                  contentItem.synopsis = detailData.Plot;
                  contentItem.imdb_url = recommendation.imdb_url;
                  contentItem.poster = detailData.Poster;
                  contentItem.contentRating = detailData.Rated;
                  contentItem.created_at = new Date().toISOString();
                  contentItem.updated_at = new Date().toISOString();
                  contentItem.similarityScore = similarity;
                  matchResults.push(contentItem);
                }
              }
            }
          } else {
            console.log(
              `[RecommendationMatcher] No results found for title: ${recommendation.title}`,
            );
          }
        }

        if (matchResults.length > 0) {
          console.log(
            `[RecommendationMatcher] Found ${matchResults.length} potential matches`,
          );

          const sortedMatches = matchResults.sort((a, b) => {
            const scoreA = a.similarityScore || (a.lowSimilarity ? 0 : 0.5);
            const scoreB = b.similarityScore || (b.lowSimilarity ? 0 : 0.5);
            return scoreB - scoreA;
          });

          setMatches(sortedMatches);
        } else {
          setError("We couldn't find any matches for this recommendation.");
        }
      } catch (err) {
        console.error("[RecommendationMatcher] Error finding matches:", err);
        setError("An error occurred while searching for matches.");
      } finally {
        setIsLoading(false);
      }
    };

    findMatches();
  }, [recommendation]);

  const calculateTitleSimilarity = (title1: string, title2: string): number => {
    if (!title1 || !title2) return 0;

    const normalize = (title: string): string => {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const normalizedTitle1 = normalize(title1);
    const normalizedTitle2 = normalize(title2);

    if (normalizedTitle1 === normalizedTitle2) return 1.0;

    if (
      title1.includes(",") ||
      title1.includes(";") ||
      title1.includes("|") ||
      title2.includes(",") ||
      title2.includes(";") ||
      title2.includes("|") ||
      title1.length > 50 ||
      title2.length > 50
    ) {
      console.log(
        `[calculateTitleSimilarity] Suspicious title detected, reducing similarity score`,
      );
      return 0.5;
    }

    if (normalizedTitle1.length > 3 && normalizedTitle2.length > 3) {
      const lengthRatio =
        Math.min(normalizedTitle1.length, normalizedTitle2.length) /
        Math.max(normalizedTitle1.length, normalizedTitle2.length);

      if (lengthRatio < 0.7) {
        if (
          normalizedTitle1.includes(normalizedTitle2) ||
          normalizedTitle2.includes(normalizedTitle1)
        ) {
          return 0.7;
        }
      }
    }

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

    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
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
      writer: omdbData.Writer !== "N/A" ? omdbData.Writer : "",
      language: omdbData.Language !== "N/A" ? omdbData.Language : "",
      country: omdbData.Country !== "N/A" ? omdbData.Country : "",
      awards: omdbData.Awards !== "N/A" ? omdbData.Awards : "",
      metascore: omdbData.Metascore !== "N/A" ? omdbData.Metascore : "",
      production: omdbData.Production !== "N/A" ? omdbData.Production : "",
      website: omdbData.Website !== "N/A" ? omdbData.Website : "",
      boxOffice: omdbData.BoxOffice !== "N/A" ? omdbData.BoxOffice : "",
      imdb_rating: omdbData.imdbRating !== "N/A" ? omdbData.imdbRating : "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      poster: omdbData.Poster !== "N/A" ? omdbData.Poster : "",
      contentRating: omdbData.Rated !== "N/A" ? omdbData.Rated : "",
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
                  match.poster ||
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
