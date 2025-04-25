import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";

interface WatchlistButtonProps {
  contentId: string;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
  showText?: boolean;
}

const WatchlistButton: React.FC<WatchlistButtonProps> = ({
  contentId,
  variant = "outline",
  size = "default",
  className = "",
  showIcon = true,
  showText = true,
}) => {
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Check if user is logged in and if content is in watchlist
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setIsLoggedIn(true);
        setUserId(data.session.user.id);

        // Check if content is in watchlist
        checkWatchlistStatus(data.session.user.id);
      }
    };

    checkSession();
  }, [contentId]);

  const checkWatchlistStatus = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("watchlist")
        .select("*")
        .eq("user_id", uid)
        .eq("content_id", contentId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is the error code for no rows returned
        console.error("Error checking watchlist status:", error);
        return;
      }

      setIsInWatchlist(!!data);
    } catch (err) {
      console.error("Error checking watchlist status:", err);
    }
  };

  const toggleWatchlist = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add content to your watchlist",
        variant: "default",
      });
      return;
    }

    if (!contentId || !userId) return;

    setIsLoading(true);

    try {
      if (isInWatchlist) {
        // Remove from watchlist
        const { error } = await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", userId)
          .eq("content_id", contentId);

        if (error) throw error;

        setIsInWatchlist(false);
        toast({
          title: "Removed from watchlist",
          description: "Content has been removed from your watchlist",
          variant: "default",
        });
      } else {
        // Get content details to get media_type
        const { data: contentData, error: contentError } = await supabase
          .from("content")
          .select("title, poster_path, media_type")
          .eq("id", contentId)
          .single();

        if (contentError) {
          console.error("Error fetching content details:", contentError);
          throw contentError;
        }

        // Add to watchlist
        const { error } = await supabase.from("watchlist").insert({
          user_id: userId,
          content_id: contentId,
          title: contentData?.title || "",
          poster_path: contentData?.poster_path || "",
          media_type: contentData?.media_type || "movie",
          added_at: new Date().toISOString(),
        });

        if (error) throw error;

        setIsInWatchlist(true);
        toast({
          title: "Added to watchlist",
          description: "Content has been added to your watchlist",
          variant: "default",
        });
      }
    } catch (err) {
      console.error("Error updating watchlist:", err);
      toast({
        title: "Error",
        description: "Failed to update your watchlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={toggleWatchlist}
      disabled={isLoading}
    >
      {showIcon && (
        <Heart
          className={`h-4 w-4 ${showText ? "mr-2" : ""} ${isInWatchlist ? "fill-current" : ""}`}
        />
      )}
      {showText && (isInWatchlist ? "Saved" : "Save")}
      {isLoading && <span className="ml-2 animate-pulse">...</span>}
    </Button>
  );
};

export default WatchlistButton;
