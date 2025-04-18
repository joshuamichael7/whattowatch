import React, { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ContentItem } from "@/types/omdb";

interface WhatToWatchProps {
  onSubmit: (preferences: {
    genres: string[];
    mood: string;
    viewingTime: number;
    favoriteContent: string[];
    contentToAvoid: string[];
    ageRating: string;
  }) => Promise<void>;
  isLoading: boolean;
  maturityLevel: string;
  initialGenres?: string[];
}

const WhatToWatch: React.FC<WhatToWatchProps> = ({
  onSubmit,
  isLoading,
  maturityLevel,
  initialGenres = [],
}) => {
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenres);
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [viewingTime, setViewingTime] = useState<number>(120); // Default 2 hours

  const handleWhatToWatchSubmit = async () => {
    if (selectedGenres.length === 0 || !selectedMood) {
      return;
    }

    // Create preferences object from selected options
    const preferences = {
      genres: selectedGenres,
      mood: selectedMood,
      viewingTime: viewingTime,
      favoriteContent: [],
      contentToAvoid: [],
      ageRating: maturityLevel || "PG-13",
    };

    await onSubmit(preferences);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          What to Watch Tonight?
        </h1>
        <p className="text-xl text-muted-foreground">
          Tell us what you're in the mood for and we'll find the perfect match
        </p>
      </div>

      <div className="bg-muted/40 rounded-lg p-6 space-y-6">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Select Genres</h2>
          <div className="flex flex-wrap gap-2">
            {[
              "Action",
              "Adventure",
              "Animation",
              "Comedy",
              "Crime",
              "Documentary",
              "Drama",
              "Fantasy",
              "Horror",
              "Mystery",
              "Romance",
              "Sci-Fi",
              "Thriller",
              "Western",
            ].map((genre) => (
              <Badge
                key={genre}
                variant={selectedGenres.includes(genre) ? "default" : "outline"}
                className="px-3 py-1 text-sm cursor-pointer hover:bg-primary/90 transition-colors"
                onClick={() => {
                  if (selectedGenres.includes(genre)) {
                    setSelectedGenres(
                      selectedGenres.filter((g) => g !== genre),
                    );
                  } else {
                    setSelectedGenres([...selectedGenres, genre]);
                  }
                }}
              >
                {genre}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">What's Your Mood?</h2>
          <div className="flex flex-wrap gap-2">
            {[
              "Happy",
              "Thoughtful",
              "Excited",
              "Relaxed",
              "Nostalgic",
              "Curious",
              "Inspired",
              "Emotional",
            ].map((mood) => (
              <Badge
                key={mood}
                variant={selectedMood === mood ? "default" : "outline"}
                className="px-3 py-1 text-sm cursor-pointer hover:bg-primary/90 transition-colors"
                onClick={() => setSelectedMood(mood)}
              >
                {mood}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">How Much Time Do You Have?</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>30 min</span>
              <span>1 hour</span>
              <span>2 hours</span>
              <span>3+ hours</span>
            </div>
            <Slider
              defaultValue={[viewingTime]}
              min={30}
              max={180}
              step={15}
              onValueChange={(value) => setViewingTime(value[0])}
            />
            <div className="text-center text-muted-foreground">
              {viewingTime < 60
                ? `${viewingTime} minutes`
                : `${Math.floor(viewingTime / 60)} hour${viewingTime >= 120 ? "s" : ""}${viewingTime % 60 > 0 ? ` ${viewingTime % 60} minutes` : ""}`}
            </div>
          </div>
        </div>

        <Button
          className="w-full mt-4"
          size="lg"
          onClick={() => handleWhatToWatchSubmit()}
          disabled={selectedGenres.length === 0 || !selectedMood || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finding the perfect match...
            </>
          ) : (
            "Find My Perfect Match"
          )}
        </Button>
      </div>
    </motion.div>
  );
};

export default WhatToWatch;
