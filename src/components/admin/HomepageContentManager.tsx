import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, ArrowUp, ArrowDown, Trash, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ContentItem {
  id: string;
  title: string;
  media_type: string;
  poster_path?: string | null;
  year?: string | null;
}

interface HomepageContentItem {
  id: string;
  content_id: string;
  order: number;
  content?: ContentItem;
}

const HomepageContentManager: React.FC = () => {
  const [homepageContent, setHomepageContent] = useState<HomepageContentItem[]>(
    [],
  );
  const [availableContent, setAvailableContent] = useState<ContentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<
    "all" | "movie" | "series"
  >("all");

  // Fetch homepage content on component mount
  useEffect(() => {
    fetchHomepageContent();
    fetchAvailableContent();
  }, []);

  // Fetch current homepage content with content details
  const fetchHomepageContent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get homepage content ordered by the 'order' column
      const { data: homepageData, error: homepageError } = await supabase
        .from("homepage_content")
        .select("*")
        .order("order", { ascending: true });

      if (homepageError) throw homepageError;

      // For each homepage content item, fetch the content details
      const contentWithDetails = await Promise.all(
        homepageData.map(async (item) => {
          const { data: contentData, error: contentError } = await supabase
            .from("content")
            .select("*")
            .eq("id", item.content_id)
            .single();

          if (contentError) {
            console.error("Error fetching content details:", contentError);
            return { ...item, content: null };
          }

          return { ...item, content: contentData };
        }),
      );

      setHomepageContent(contentWithDetails);
    } catch (err) {
      console.error("Error fetching homepage content:", err);
      setError("Failed to load homepage content. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available content for adding to homepage
  const fetchAvailableContent = async () => {
    try {
      const { data, error } = await supabase
        .from("content")
        .select("*")
        .order("popularity", { ascending: false })
        .limit(100);

      if (error) throw error;
      setAvailableContent(data);
    } catch (err) {
      console.error("Error fetching available content:", err);
    }
  };

  // Search content
  const searchContent = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      let query = supabase
        .from("content")
        .select("*")
        .or(`title.ilike.%${searchQuery}%,plot.ilike.%${searchQuery}%`)
        .order("popularity", { ascending: false })
        .limit(10);

      // Apply media type filter if not set to "all"
      if (mediaTypeFilter !== "all") {
        query = query.eq("media_type", mediaTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSearchResults(data);
    } catch (err) {
      console.error("Error searching content:", err);
    }
  };

  // Add content to homepage
  const addToHomepage = async (contentId: string, mediaType: string) => {
    try {
      // Get the highest order value
      const maxOrder =
        homepageContent.length > 0
          ? Math.max(...homepageContent.map((item) => item.order))
          : 0;

      // Insert new homepage content
      const { data, error } = await supabase
        .from("homepage_content")
        .insert({
          content_id: contentId,
          order: maxOrder + 1,
          media_type: mediaType,
        })
        .select();

      if (error) throw error;

      // Refresh homepage content
      fetchHomepageContent();
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      console.error("Error adding content to homepage:", err);
      setError("Failed to add content to homepage. Please try again.");
    }
  };

  // Remove content from homepage
  const removeFromHomepage = async (id: string) => {
    try {
      const { error } = await supabase
        .from("homepage_content")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Refresh homepage content
      fetchHomepageContent();
    } catch (err) {
      console.error("Error removing content from homepage:", err);
      setError("Failed to remove content from homepage. Please try again.");
    }
  };

  // Move content up in order
  const moveUp = async (index: number) => {
    if (index <= 0) return; // Already at the top

    try {
      const currentItem = homepageContent[index];
      const previousItem = homepageContent[index - 1];

      // Swap orders
      const updates = [
        { id: currentItem.id, order: previousItem.order },
        { id: previousItem.id, order: currentItem.order },
      ];

      // Update both items
      for (const update of updates) {
        const { error } = await supabase
          .from("homepage_content")
          .update({ order: update.order })
          .eq("id", update.id);

        if (error) throw error;
      }

      // Refresh homepage content
      fetchHomepageContent();
    } catch (err) {
      console.error("Error reordering content:", err);
      setError("Failed to reorder content. Please try again.");
    }
  };

  // Move content down in order
  const moveDown = async (index: number) => {
    if (index >= homepageContent.length - 1) return; // Already at the bottom

    try {
      const currentItem = homepageContent[index];
      const nextItem = homepageContent[index + 1];

      // Swap orders
      const updates = [
        { id: currentItem.id, order: nextItem.order },
        { id: nextItem.id, order: currentItem.order },
      ];

      // Update both items
      for (const update of updates) {
        const { error } = await supabase
          .from("homepage_content")
          .update({ order: update.order })
          .eq("id", update.id);

        if (error) throw error;
      }

      // Refresh homepage content
      fetchHomepageContent();
    } catch (err) {
      console.error("Error reordering content:", err);
      setError("Failed to reorder content. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Homepage Content</CardTitle>
          <CardDescription>
            Manage the content displayed on the homepage. Drag to reorder.
          </CardDescription>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-medium">Filter:</span>
            <div className="flex gap-1">
              <Button
                variant={mediaTypeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaTypeFilter("all")}
              >
                All
              </Button>
              <Button
                variant={mediaTypeFilter === "movie" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaTypeFilter("movie")}
              >
                Movies
              </Button>
              <Button
                variant={mediaTypeFilter === "series" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaTypeFilter("series")}
              >
                TV Shows
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading homepage content...</p>
          ) : homepageContent.length === 0 ? (
            <p className="text-muted-foreground">
              No content added to homepage yet.
            </p>
          ) : (
            <div className="space-y-2">
              {homepageContent
                .filter(
                  (item) =>
                    mediaTypeFilter === "all" ||
                    item.content?.media_type === mediaTypeFilter,
                )
                .map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-md bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {item.content?.poster_path && (
                        <img
                          src={item.content.poster_path}
                          alt={item.content?.title}
                          className="h-12 w-8 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{item.content?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.content?.media_type === "movie"
                            ? "Movie"
                            : "TV Series"}{" "}
                          •{item.content?.year || "Unknown year"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => moveDown(index)}
                        disabled={index === homepageContent.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeFromHomepage(item.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Content to Homepage</CardTitle>
          <CardDescription>
            Search for movies and TV shows to add to the homepage.
          </CardDescription>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm font-medium">Filter:</span>
            <div className="flex gap-1">
              <Button
                variant={mediaTypeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaTypeFilter("all")}
              >
                All
              </Button>
              <Button
                variant={mediaTypeFilter === "movie" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaTypeFilter("movie")}
              >
                Movies
              </Button>
              <Button
                variant={mediaTypeFilter === "series" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaTypeFilter("series")}
              >
                TV Shows
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by title..."
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchContent()}
              />
              <Button onClick={searchContent}>Search</Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Search Results</h3>
                {searchResults.map((content) => (
                  <div
                    key={content.id}
                    className="flex items-center justify-between p-3 border rounded-md bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {content.poster_path && (
                        <img
                          src={content.poster_path}
                          alt={content.title}
                          className="h-12 w-8 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium">{content.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {content.media_type === "movie"
                            ? "Movie"
                            : "TV Series"}{" "}
                          •{content.year || "Unknown year"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        addToHomepage(content.id, content.media_type)
                      }
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HomepageContentManager;
