import React, { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import * as omdbClient from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import MovieDetailPageHeader from "./MovieDetailPageHeader";
import MovieDetailPageFooter from "./MovieDetailPageFooter";
import SimilarContentCarousel from "./SimilarContentCarousel";
import { useAuth } from "@/contexts/AuthContext";
import WatchlistButton from "./WatchlistButton";

interface MovieDetailPageProps {
  id?: string;
  initialData?: ContentItem;
}

const MovieDetailPage: React.FC<MovieDetailPageProps> = ({
  id: propId,
  initialData,
}) => {
  const { id: paramId } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();

  const id = propId || paramId;
  const [content, setContent] = useState<ContentItem | null>(
    initialData || (location.state?.recommendation as ContentItem) || null,
  );
  const [loading, setLoading] = useState(
    !initialData && !location.state?.recommendation,
  );
  const [error, setError] = useState<string | null>(null);
  const [similarContent, setSimilarContent] = useState<ContentItem[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      if (!id) {
        setError("No content ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const contentData = await omdbClient.getContentById(id);

        if (!contentData) {
          setError("Content not found");
          setLoading(false);
          return;
        }

        setContent(contentData);
        setLoading(false);

        // After loading the main content, fetch similar content
        fetchSimilarContent(contentData.imdb_id || id);
      } catch (err) {
        console.error("Error fetching content:", err);
        setError("Failed to load content details");
        setLoading(false);
      }
    };

    const fetchSimilarContent = async (contentId: string) => {
      try {
        setLoadingSimilar(true);
        const similar = await omdbClient.getSimilarContent(
          contentId,
          true,
          8,
          true,
        );
        setSimilarContent(similar);
      } catch (err) {
        console.error("Error fetching similar content:", err);
      } finally {
        setLoadingSimilar(false);
      }
    };

    // Only fetch if we don't already have content data
    if (!content && id) {
      fetchContent();
    } else if (content && !similarContent.length) {
      // If we already have content but no similar content yet
      fetchSimilarContent(content.imdb_id || id || "");
    }
  }, [id, content, similarContent.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-xl font-medium">Loading content details...</p>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-destructive text-xl mb-4">
          {error || "Content not available"}
        </div>
        <Button asChild>
          <Link to="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Back button */}
      <div className="container mx-auto px-4 py-4">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/dashboard" className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Movie detail header */}
      <MovieDetailPageHeader content={content} />

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left column - Poster */}
          <div className="md:w-1/3 lg:w-1/4">
            <div className="rounded-lg overflow-hidden shadow-lg">
              {content.poster_path ? (
                <img
                  src={content.poster_path}
                  alt={`${content.title} poster`}
                  className="w-full h-auto"
                  loading="lazy"
                />
              ) : (
                <div className="bg-muted aspect-[2/3] flex items-center justify-center">
                  <p className="text-muted-foreground">No poster available</p>
                </div>
              )}
            </div>

            {/* Watchlist button */}
            {user && (
              <div className="mt-4">
                <WatchlistButton content={content} />
              </div>
            )}
          </div>

          {/* Right column - Details */}
          <div className="md:w-2/3 lg:w-3/4">
            <h1 className="text-3xl font-bold mb-2">{content.title}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-muted-foreground">
                {content.year ||
                  (content.release_date &&
                    new Date(content.release_date).getFullYear())}
              </span>
              {content.runtime && (
                <span className="text-muted-foreground">
                  • {content.runtime}
                </span>
              )}
              {content.content_rating && (
                <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded text-sm">
                  {content.content_rating}
                </span>
              )}
            </div>

            {/* Genre tags */}
            {content.genre_strings && content.genre_strings.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {content.genre_strings.map((genre) => (
                  <span
                    key={genre}
                    className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {/* Plot */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Plot</h2>
              <p className="text-foreground/80 leading-relaxed">
                {content.overview || content.plot || "No plot available"}
              </p>
            </div>

            {/* Additional details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {content.director && (
                <div>
                  <h3 className="text-lg font-medium mb-1">Director</h3>
                  <p className="text-foreground/80">{content.director}</p>
                </div>
              )}
              {content.actors && (
                <div>
                  <h3 className="text-lg font-medium mb-1">Cast</h3>
                  <p className="text-foreground/80">{content.actors}</p>
                </div>
              )}
              {content.writer && (
                <div>
                  <h3 className="text-lg font-medium mb-1">Writer</h3>
                  <p className="text-foreground/80">{content.writer}</p>
                </div>
              )}
              {content.awards && (
                <div>
                  <h3 className="text-lg font-medium mb-1">Awards</h3>
                  <p className="text-foreground/80">{content.awards}</p>
                </div>
              )}
            </div>

            {/* Ratings */}
            {content.imdb_rating && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-2">Ratings</h2>
                <div className="flex items-center gap-4">
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg">
                    <div className="text-yellow-800 dark:text-yellow-300 font-bold text-xl">
                      {content.imdb_rating}/10
                    </div>
                    <div className="text-yellow-700 dark:text-yellow-400 text-sm">
                      IMDb Rating
                    </div>
                  </div>
                  {content.metascore && content.metascore !== "N/A" && (
                    <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
                      <div className="text-green-800 dark:text-green-300 font-bold text-xl">
                        {content.metascore}/100
                      </div>
                      <div className="text-green-700 dark:text-green-400 text-sm">
                        Metascore
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Recommendation reason if available */}
            {content.recommendationReason && (
              <div className="mb-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">
                  Why We Recommended This
                </h2>
                <p className="text-foreground/80 italic">
                  "{content.recommendationReason}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Similar content section */}
        {similarContent.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">
              Similar Content You Might Enjoy
            </h2>
            <SimilarContentCarousel items={similarContent} />
          </div>
        )}

        {loadingSimilar && (
          <div className="mt-12 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-muted-foreground">Finding similar content...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <MovieDetailPageFooter content={content} />
    </div>
  );
};

export default MovieDetailPage;
