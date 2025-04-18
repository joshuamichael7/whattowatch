import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, X, Loader2 } from "lucide-react";
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
  moods: string[];
  viewingTime: number;
  favoriteContent: string;
  contentToAvoid: string;
  ageRatings: string[];
  aiRecommendations?: Array<{ title: string; reason: string }>;
  languagePreference?: string;
  releaseYearRange?: { min: number; max: number };
  isAiRecommendationSuccess?: boolean;
  aiRecommendationError?: string | null;
}

const PreferenceFinder: React.FC<PreferenceFinderProps> = ({
  onComplete = () => {},
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<PreferenceResults>({
    genres: [],
    moods: [],
    viewingTime: 90,
    favoriteContent: "",
    contentToAvoid: "",
    ageRatings: ["PG-13"],
    languagePreference: "English",
    releaseYearRange: { min: 1980, max: new Date().getFullYear() },
  });

  // Add loading and error states for AI recommendations
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 8;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleGenreChange = (genre: string, checked: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      genres: checked
        ? [...prev.genres, genre]
        : prev.genres.filter((g) => g !== genre),
    }));
  };

  const handleMoodChange = (mood: string, checked: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      moods: checked
        ? [...prev.moods, mood]
        : prev.moods.filter((m) => m !== mood),
    }));
  };

  const handleViewingTimeChange = (value: number[]) => {
    setPreferences((prev) => ({ ...prev, viewingTime: value[0] }));
  };

  const handleFavoriteContentChange = (content: string) => {
    setPreferences((prev) => ({
      ...prev,
      favoriteContent: content,
    }));
  };

  const handleContentToAvoidChange = (content: string) => {
    setPreferences((prev) => ({
      ...prev,
      contentToAvoid: content,
    }));
  };

  const handleAgeRatingChange = (ageRating: string, checked: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      ageRatings: checked
        ? [...prev.ageRatings, ageRating]
        : prev.ageRatings.filter((r) => r !== ageRating),
    }));
  };

  const handleLanguageChange = (language: string) => {
    setPreferences((prev) => ({ ...prev, languagePreference: language }));
  };

  const handleReleaseYearChange = (values: number[]) => {
    if (values.length >= 2) {
      setPreferences((prev) => ({
        ...prev,
        releaseYearRange: { min: values[0], max: values[1] },
      }));
    }
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
    // Reset error state and set loading to true
    setError(null);
    setIsLoading(true);

    // Try to use enhanced recommendation engine if available
    try {
      // Convert preferences to the format expected by the AI service
      const aiServicePreferences = {
        genres: preferences.genres,
        mood: preferences.moods.join(", "),
        viewingTime: preferences.viewingTime,
        favoriteContent: preferences.favoriteContent
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        contentToAvoid: preferences.contentToAvoid
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        ageRating: preferences.ageRatings[0] || "PG-13", // Use the first selected rating as primary
      };

      console.log(
        "Fetching AI recommendations with preferences:",
        aiServicePreferences,
      );

      // Use Netlify function instead of client-side API call
      const response = await fetch("/.netlify/functions/ai-recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferences: aiServicePreferences,
          limit: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const aiRecommendations = data.recommendations;

      // If we got AI recommendations, add them to the preferences object
      if (aiRecommendations && aiRecommendations.length > 0) {
        console.log("Received AI recommendations:", aiRecommendations);
        const enhancedPreferences = {
          ...preferences,
          aiRecommendations: aiRecommendations,
          isAiRecommendationSuccess: true,
        };
        setIsLoading(false);
        onComplete(enhancedPreferences);
        return;
      } else {
        console.log("No AI recommendations received, falling back to default");
        setError(
          "No recommendations found. Using default recommendations instead.",
        );
      }
    } catch (error) {
      console.error("Error getting AI recommendations:", error);
      setError(
        "Failed to get AI recommendations. Using default recommendations instead.",
      );
      // Fall back to regular preferences if AI fails
    }

    // Default behavior if AI recommendations fail or aren't available
    setIsLoading(false);
    onComplete({
      ...preferences,
      isAiRecommendationSuccess: false,
      aiRecommendationError: error,
    });
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
    "Action-packed",
    "Romantic",
    "Funny",
    "Scary",
    "Mind-bending",
    "Educational",
    "Relaxing",
    "Nostalgic",
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
                What are you in the mood to watch?
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Select all that apply
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {moods.map((mood) => (
                <div key={mood} className="flex items-center space-x-2">
                  <Checkbox
                    id={`mood-${mood}`}
                    checked={preferences.moods.includes(mood.toLowerCase())}
                    onCheckedChange={(checked) =>
                      handleMoodChange(mood.toLowerCase(), checked === true)
                    }
                  />
                  <Label htmlFor={`mood-${mood}`}>{mood}</Label>
                </div>
              ))}
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
                  <span>3+ hours</span>
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
                  : preferences.viewingTime >= 180
                    ? "3+ hours"
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
              <p className="text-sm text-muted-foreground mt-2">
                List movies, TV shows, or genres you've enjoyed (comma
                separated)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="favorite-content">Your favorites</Label>
                  <textarea
                    id="favorite-content"
                    value={preferences.favoriteContent}
                    onChange={(e) =>
                      handleFavoriteContentChange(e.target.value)
                    }
                    placeholder="e.g., Inception, Breaking Bad, sci-fi thrillers, crime documentaries"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
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
              <p className="text-sm text-muted-foreground mt-2">
                List movies, TV shows, or genres you dislike (comma separated)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="avoid-content">Content to avoid</Label>
                  <textarea
                    id="avoid-content"
                    value={preferences.contentToAvoid}
                    onChange={(e) => handleContentToAvoidChange(e.target.value)}
                    placeholder="e.g., horror movies, reality TV, musicals"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
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
              <p className="text-sm text-muted-foreground mt-2">
                Select all that apply
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ageRatings.map((rating) => (
                <div key={rating} className="flex items-center space-x-2">
                  <Checkbox
                    id={`rating-${rating}`}
                    checked={preferences.ageRatings.includes(rating)}
                    onCheckedChange={(checked) =>
                      handleAgeRatingChange(rating, checked === true)
                    }
                  />
                  <Label htmlFor={`rating-${rating}`}>{rating}</Label>
                </div>
              ))}
            </CardContent>
          </>
        );

      case 6: // Language Preference
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                Preferred language for content?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={preferences.languagePreference}
                onValueChange={handleLanguageChange}
                className="grid grid-cols-2 gap-4"
              >
                {[
                  "English",
                  "Spanish",
                  "French",
                  "Japanese",
                  "Korean",
                  "Any",
                ].map((language) => (
                  <div key={language} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={language}
                      id={`language-${language}`}
                    />
                    <Label htmlFor={`language-${language}`}>{language}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </>
        );

      case 7: // Release Year Range
        return (
          <>
            <CardHeader>
              <CardTitle className="text-2xl">
                Release year range preference?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>1950</span>
                  <span>{new Date().getFullYear()}</span>
                </div>
                <Slider
                  value={[
                    preferences.releaseYearRange?.min || 1980,
                    preferences.releaseYearRange?.max ||
                      new Date().getFullYear(),
                  ]}
                  min={1950}
                  max={new Date().getFullYear()}
                  step={5}
                  onValueChange={handleReleaseYearChange}
                  minStepsBetweenThumbs={1}
                />
              </div>
              <div className="text-center font-medium">
                {`${preferences.releaseYearRange?.min || 1980} - ${preferences.releaseYearRange?.max || new Date().getFullYear()}`}
              </div>
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
          {error && currentStep === totalSteps - 1 && (
            <div className="px-6 py-2 text-sm text-red-500">{error}</div>
          )}
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
          <Button
            onClick={nextStep}
            disabled={currentStep === totalSteps - 1 && isLoading}
          >
            {currentStep === totalSteps - 1 ? (
              isLoading ? (
                <>
                  Getting recommendations...
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                </>
              ) : (
                <>
                  Complete
                  <Check className="ml-2 h-4 w-4" />
                </>
              )
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
