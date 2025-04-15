import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";

interface PreferenceFinderProps {
  onComplete?: (preferences: PreferenceResults) => void;
}

interface PreferenceResults {
  genres: string[];
  mood: string;
  viewingTime: number;
  favoriteContent: string[];
  contentToAvoid: string[];
  ageRating: string;
  aiRecommendations?: Array<{ title: string; reason: string }>;
}

const PreferenceFinder: React.FC<PreferenceFinderProps> = ({
  onComplete = () => {},
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<PreferenceResults>({
    genres: [],
    mood: "thoughtful",
    viewingTime: 90,
    favoriteContent: [],
    contentToAvoid: [],
    ageRating: "PG-13",
  });

  const totalSteps = 6;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleGenreChange = (genre: string, checked: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      genres: checked
        ? [...prev.genres, genre]
        : prev.genres.filter((g) => g !== genre),
    }));
  };

  const handleMoodChange = (mood: string) => {
    setPreferences((prev) => ({ ...prev, mood }));
  };

  const handleViewingTimeChange = (value: number[]) => {
    setPreferences((prev) => ({ ...prev, viewingTime: value[0] }));
  };

  const handleFavoriteContentChange = (content: string, checked: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      favoriteContent: checked
        ? [...prev.favoriteContent, content]
        : prev.favoriteContent.filter((c) => c !== content),
    }));
  };

  const handleContentToAvoidChange = (content: string, checked: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      contentToAvoid: checked
        ? [...prev.contentToAvoid, content]
        : prev.contentToAvoid.filter((c) => c !== content),
    }));
  };

  const handleAgeRatingChange = (ageRating: string) => {
    setPreferences((prev) => ({ ...prev, ageRating }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handlePreferenceComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePreferenceComplete = async () => {
    // Try to use enhanced recommendation engine if available
    try {
      const { getPersonalizedRecommendations } = await import(
        "@/services/aiService"
      );
      const aiRecommendations = await getPersonalizedRecommendations(
        preferences,
        10,
      );

      // If we got AI recommendations, add them to the preferences object
      if (aiRecommendations && aiRecommendations.length > 0) {
        const enhancedPreferences = {
          ...preferences,
          aiRecommendations: aiRecommendations,
        };
        onComplete(enhancedPreferences);
        return;
      }
    } catch (error) {
      console.error("Error getting AI recommendations:", error);
      // Fall back to regular preferences if AI fails
    }

    // Default behavior if AI recommendations fail or aren't available
    onComplete(preferences);
  };

  const genres = [
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
  ];

  const moods = [
    "Thoughtful",
    "Lighthearted",
    "Suspenseful",
    "Emotional",
    "Inspiring",
    "Dark",
  ];

  const popularContent = [
    "Stranger Things",
    "Breaking Bad",
    "The Office",
    "Game of Thrones",
    "The Mandalorian",
    "Friends",
    "The Crown",
    "Black Mirror",
    "Squid Game",
    "The Avengers",
    "Inception",
    "The Shawshank Redemption",
    "Parasite",
  ];

  const ageRatings = [
    "G",
    "PG",
    "PG-13",
    "R",
    "TV-Y",
    "TV-PG",
    "TV-14",
    "TV-MA",
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Genre Preferences
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                What genres do you enjoy?
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {genres.map((genre) => (
                <div key={genre} className="flex items-center space-x-2">
                  <Checkbox
                    id={`genre-${genre}`}
                    checked={preferences.genres.includes(genre)}
                    onCheckedChange={(checked) =>
                      handleGenreChange(genre, checked === true)
                    }
                  />
                  <Label htmlFor={`genre-${genre}`}>{genre}</Label>
                </div>
              ))}
            </CardContent>
          </>
        );

      case 1: // Mood Selection
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                What mood are you in today?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={preferences.mood}
                onValueChange={handleMoodChange}
                className="grid grid-cols-2 gap-4"
              >
                {moods.map((mood) => (
                  <div key={mood} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={mood.toLowerCase()}
                      id={`mood-${mood}`}
                    />
                    <Label htmlFor={`mood-${mood}`}>{mood}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </>
        );

      case 2: // Viewing Time
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                How much time do you have?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>30 min</span>
                  <span>2+ hours</span>
                </div>
                <Slider
                  value={[preferences.viewingTime]}
                  min={30}
                  max={180}
                  step={15}
                  onValueChange={handleViewingTimeChange}
                />
              </div>
              <div className="text-center font-medium">
                {preferences.viewingTime < 60
                  ? `${preferences.viewingTime} minutes`
                  : `${Math.floor(preferences.viewingTime / 60)} hour${preferences.viewingTime >= 120 ? "s" : ""} ${preferences.viewingTime % 60 > 0 ? `${preferences.viewingTime % 60} minutes` : ""}`}
              </div>
            </CardContent>
          </>
        );

      case 3: // Favorite Content
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                What content have you enjoyed?
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularContent.map((content) => (
                <div key={content} className="flex items-center space-x-2">
                  <Checkbox
                    id={`favorite-${content}`}
                    checked={preferences.favoriteContent.includes(content)}
                    onCheckedChange={(checked) =>
                      handleFavoriteContentChange(content, checked === true)
                    }
                  />
                  <Label htmlFor={`favorite-${content}`}>{content}</Label>
                </div>
              ))}
            </CardContent>
          </>
        );

      case 4: // Content to Avoid
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                What content do you want to avoid?
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularContent.map((content) => (
                <div key={content} className="flex items-center space-x-2">
                  <Checkbox
                    id={`avoid-${content}`}
                    checked={preferences.contentToAvoid.includes(content)}
                    onCheckedChange={(checked) =>
                      handleContentToAvoidChange(content, checked === true)
                    }
                  />
                  <Label htmlFor={`avoid-${content}`}>{content}</Label>
                </div>
              ))}
            </CardContent>
          </>
        );

      case 5: // Age Rating
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                What age ratings are acceptable?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={preferences.ageRating}
                onValueChange={handleAgeRatingChange}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                {ageRatings.map((rating) => (
                  <div key={rating} className="flex items-center space-x-2">
                    <RadioGroupItem value={rating} id={`rating-${rating}`} />
                    <Label htmlFor={`rating-${rating}`}>{rating}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-background">
      <Card className="w-full">
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-2" />
          <div className="mt-2 text-sm text-muted-foreground text-right">
            Step {currentStep + 1} of {totalSteps}
          </div>
        </div>

        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderStep()}
        </motion.div>

        <CardFooter className="flex justify-between p-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button onClick={nextStep}>
            {currentStep === totalSteps - 1 ? (
              <>
                Complete
                <Check className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PreferenceFinder;
