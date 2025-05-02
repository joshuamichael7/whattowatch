import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Film, Tv, Info } from "lucide-react";
import { ContentItem } from "@/types/omdb";

interface RecommendationMatcherProps {
  recommendation: {
    title: string;
    year?: string;
    imdb_id?: string;
    imdb_url?: string;
    reason?: string;
    synopsis?: string;
    type?: "movie" | "tv";
  };
  potentialMatches: ContentItem[];
  onSelectMatch: (match: ContentItem) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

const RecommendationMatcher: React.FC<RecommendationMatcherProps> = ({
  recommendation,
  potentialMatches,
  onSelectMatch,
  onCancel,
  isLoading = false,
}) => {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelectMatch = (match: ContentItem) => {
    setSelectedId(match.id);
    if (onSelectMatch) {
      onSelectMatch(match);
    } else {
      const path = match.media_type === "movie" ? "/movie/" : "/tv/";
      navigate(`${path}${match.id}`, { state: { recommendation: match } });
    }
  };

  const getPosterImage = (item: ContentItem) => {
    if (item.poster_path && !item.poster_path.includes("null")) {
      return item.poster_path;
    }
    if (item.poster && !item.poster.includes("null")) {
      return item.poster;
    }
    return "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80";
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary animate-pulse-glow"></div>
        <p className="text-muted-foreground">
          Finding matches for "{recommendation.title}"...
        </p>
      </div>
    );
  }

  if (potentialMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-destructive">
          No matches found for "{recommendation.title}"
          {recommendation.year ? ` (${recommendation.year})` : ""}.
        </p>
        <p className="text-muted-foreground text-center max-w-md">
          We couldn't find any content that matches this recommendation. This
          might be due to differences in title spelling or availability in our
          database.
        </p>
        <Button onClick={onCancel}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2 font-heading">
          We found {potentialMatches.length} potential{" "}
          {potentialMatches.length === 1 ? "match" : "matches"}
        </h2>
        <p className="text-muted-foreground mb-2">
          For: <span className="font-medium">{recommendation.title}</span>
          {recommendation.year ? ` (${recommendation.year})` : ""}
          {recommendation.type
            ? ` - ${recommendation.type === "movie" ? "Movie" : "TV Show"}`
            : ""}
        </p>
        <p className="text-muted-foreground mb-6">
          Please select the one you're most interested in!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {potentialMatches.map((match) => (
          <Card
            key={match.id}
            className={`overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow ${selectedId === match.id ? "ring-2 ring-primary" : ""}`}
          >
            <div className="relative aspect-[2/3] overflow-hidden bg-muted">
              <img
                src={getPosterImage(match)}
                alt={`${match.title} poster`}
                className="object-cover w-full h-full"
                onError={(e) => {
                  e.currentTarget.src =
                    "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=800&q=80";
                }}
              />
              <div className="absolute top-2 right-2">
                <Badge
                  variant={
                    match.media_type === "movie" ? "default" : "secondary"
                  }
                  className="flex items-center gap-1"
                >
                  {match.media_type === "movie" ? (
                    <Film size={12} />
                  ) : (
                    <Tv size={12} />
                  )}
                  {match.media_type === "movie" ? "Movie" : "TV"}
                </Badge>
              </div>
              {match.imdb_id && (
                <div className="absolute bottom-2 left-2">
                  <Badge variant="outline" className="bg-background/70 text-xs">
                    IMDB: {match.imdb_id}
                  </Badge>
                </div>
              )}
            </div>

            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-base line-clamp-1 font-heading">
                {match.title}
              </CardTitle>
              <div className="flex items-center text-sm text-muted-foreground">
                <span>
                  {match.release_date
                    ? new Date(match.release_date).getFullYear()
                    : match.first_air_date
                      ? new Date(match.first_air_date).getFullYear()
                      : match.year || "Unknown year"}
                </span>
                {match.vote_average > 0 && (
                  <span className="flex items-center ml-2">
                    <Star
                      size={14}
                      className="fill-yellow-400 text-yellow-400 mr-1"
                    />
                    {match.vote_average.toFixed(1)}
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-3 pt-2 flex-grow">
              <div className="flex flex-wrap gap-1 mb-2">
                {match.genre_strings && match.genre_strings.length > 0 ? (
                  match.genre_strings.slice(0, 2).map((genre) => (
                    <Badge key={genre} variant="outline" className="text-xs">
                      {genre}
                    </Badge>
                  ))
                ) : match.genre_ids && match.genre_ids.length > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    {match.genre_ids.length} genres
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {match.overview || match.synopsis || "No description available"}
              </p>
            </CardContent>

            <CardFooter className="p-3 pt-0 flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => handleSelectMatch(match)}
                disabled={selectedId === match.id}
              >
                {selectedId === match.id ? "Selected" : "Select This Match"}
              </Button>

              {match.imdb_id &&
                match.imdb_id !== recommendation.imdb_id &&
                recommendation.imdb_id && (
                  <div className="w-full text-xs text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                    <Info size={12} className="inline mr-1" />
                    IMDB ID differs from recommendation
                  </div>
                )}
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
