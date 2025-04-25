import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ListFilter,
  Search,
  Film,
  Tv,
  Sparkles,
  ArrowRight,
  Shuffle,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  getPersonalizedRecommendations,
  getSimilarContentTitles,
} from "@/services/aiService";
import { useAuth } from "@/contexts/AuthContext";

interface NewDiscoverProps {
  onStartQuiz?: () => void;
  onStartSimilarSearch?: () => void;
}

type QuestionStep =
  | "initial"
  | "similar"
  | "whatToWatch"
  | "random"
  | "savedPreferences"
  | "similarTitle"
  | "processing"
  | "results"
  | "whatToWatchGenres"
  | "whatToWatchMood"
  | "whatToWatchTime"
  | "whatToWatchFavorites"
  | "whatToWatchAvoid"
  | "whatToWatchRatings"
  | "whatToWatchLanguage";

const NewDiscover: React.FC<NewDiscoverProps> = () => {
  const [currentStep, setCurrentStep] = useState<QuestionStep>("initial");
  const [similarTitle, setSimilarTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [recommendations, setRecommendations] = useState<
    Array<{ title: string; reason: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  // State for the "What to Watch" flow
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedMood, setSelectedMood] = useState("");
  const [viewingTime, setViewingTime] = useState(90); // Default to 90 minutes
  const [favoriteContent, setFavoriteContent] = useState("");
  const [contentToAvoid, setContentToAvoid] = useState("");
  const [selectedRatings, setSelectedRatings] = useState<string[]>(["PG-13"]);
  const [preferredLanguage, setPreferredLanguage] = useState("English");

  // Get user auth context to check if user is authenticated and has preferences
  const { user, profile, isAuthenticated } = useAuth();
  const hasPreferences = profile?.preferences !== undefined;

  // Track screen size for responsive adjustments
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // Listen for window resize events
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper function to clear form data when starting over
  const resetFormData = () => {
    setSelectedGenres([]);
    setSelectedMood("");
    setViewingTime(90);
    setFavoriteContent("");
    setContentToAvoid("");
    setSelectedRatings(["PG-13"]);
    setPreferredLanguage("English");
    setSimilarTitle("");
    setError(null);
    setRecommendations([]);
  };

  const handleSimilarTitleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!similarTitle.trim()) return;

    setIsProcessing(true);
    setError(null); // Clear any previous errors
    setCurrentStep("processing");

    try {
      // Call the AI service to get similar content
      const similarContent = await getSimilarContentTitles(
        similarTitle,
        "", // No overview provided in this simple flow
        "movie", // Default to movie, could be enhanced to ask for media type
        10, // Request 10 recommendations for better results
      );

      if (similarContent.length === 0) {
        throw new Error("No similar content found. Try a different title.");
      }

      setRecommendations(similarContent);
      setCurrentStep("results");
    } catch (err) {
      console.error("Error getting similar content:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to get recommendations. Please try again.",
      );
      setCurrentStep("similar"); // Go back to input step
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRandomRecommendation = async () => {
    setIsProcessing(true);
    setError(null); // Clear any previous errors
    setCurrentStep("processing");

    try {
      // For random recommendations, we'll use a simplified preference set
      const randomPreferences = {
        genres: [
          "Action",
          "Comedy",
          "Drama",
          "Sci-Fi",
          "Adventure",
          "Animation",
          "Fantasy",
          "Romance",
        ]
          .sort(() => 0.5 - Math.random())
          .slice(0, 2),
        mood: [
          "exciting",
          "thoughtful",
          "funny",
          "suspenseful",
          "heartwarming",
          "uplifting",
        ].sort(() => 0.5 - Math.random())[0],
        viewingTime: Math.floor(Math.random() * (180 - 30 + 1)) + 30, // Random between 30-180 minutes
        favoriteContent: [],
        contentToAvoid: [],
        ageRating: "PG-13",
        language: "English", // Default language for random recommendations
      };

      const randomRecommendations = await getPersonalizedRecommendations(
        randomPreferences,
        5,
      );

      if (randomRecommendations.length === 0) {
        throw new Error("No recommendations found. Please try again.");
      }

      setRecommendations(randomRecommendations);
      setCurrentStep("results");
    } catch (err) {
      console.error("Error getting random recommendations:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to get random recommendations. Please try again.",
      );
      setCurrentStep("initial"); // Go back to initial step
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatToWatchSubmit = async () => {
    // Validate inputs
    if (selectedGenres.length === 0) {
      setError("Please select at least one genre");
      setCurrentStep("whatToWatchGenres");
      return;
    }

    if (!selectedMood) {
      setError("Please select a mood");
      setCurrentStep("whatToWatchMood");
      return;
    }

    setIsProcessing(true);
    setError(null); // Clear any previous errors
    setCurrentStep("processing");

    try {
      // Prepare the preferences object for the AI service
      const preferences = {
        genres: selectedGenres,
        mood: selectedMood,
        viewingTime: viewingTime,
        favoriteContent: favoriteContent
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        contentToAvoid: contentToAvoid
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        ageRating: selectedRatings[0] || "PG-13", // Use the first selected rating or default to PG-13
        language: preferredLanguage || "English", // Include language preference
      };

      // Log the preferences being sent to the API for debugging
      console.log("Sending preferences to AI service:", preferences);

      // Call the AI service to get personalized recommendations
      const personalizedRecommendations = await getPersonalizedRecommendations(
        preferences,
        5,
      );

      if (personalizedRecommendations.length === 0) {
        throw new Error(
          "No recommendations found based on your preferences. Try adjusting your criteria.",
        );
      }

      setRecommendations(personalizedRecommendations);
      setCurrentStep("results");
    } catch (err) {
      console.error("Error getting personalized recommendations:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to get recommendations. Please try again.",
      );
      setCurrentStep("whatToWatchAvoid"); // Go back to the last step
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavedPreferences = async () => {
    if (!profile?.preferences) {
      setError(
        "No saved preferences found. Please complete the preference quiz first.",
      );
      return;
    }

    setIsProcessing(true);
    setError(null); // Clear any previous errors
    setCurrentStep("processing");

    try {
      // Use the saved preferences from the user profile
      const savedPreferences = {
        genres: profile.preferences.genres || [],
        mood: profile.preferences.moods?.join(", ") || "",
        viewingTime: profile.preferences.viewingTime || 90,
        favoriteContent:
          profile.preferences.favoriteContent
            ?.split(",")
            .map((item) => item.trim())
            .filter(Boolean) || [],
        contentToAvoid:
          profile.preferences.contentToAvoid
            ?.split(",")
            .map((item) => item.trim())
            .filter(Boolean) || [],
        ageRating: profile.preferences.ageRatings?.[0] || "PG-13",
        language: profile.preferences.languagePreference || "English",
      };

      const personalizedRecommendations = await getPersonalizedRecommendations(
        savedPreferences,
        5,
      );

      if (personalizedRecommendations.length === 0) {
        throw new Error(
          "No recommendations found based on your preferences. Try adjusting your preferences.",
        );
      }

      setRecommendations(personalizedRecommendations);
      setCurrentStep("results");
    } catch (err) {
      console.error(
        "Error getting recommendations from saved preferences:",
        err,
      );
      setError(
        err instanceof Error
          ? err.message
          : "Failed to get recommendations. Please try again.",
      );
      setCurrentStep("initial"); // Go back to initial step
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "initial":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8"
          >
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold tracking-tight font-heading"
            >
              Get Personalized Recommendations
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Choose how you want to find your next favorite movie or show
            </motion.p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-6 px-2 sm:px-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  className="text-lg px-4 sm:px-8 py-4 sm:py-6 group transition-all duration-300 w-full"
                  onClick={() => setCurrentStep("similar")}
                >
                  <Search className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  <span>Find Similar Content</span>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  className="text-lg px-4 sm:px-8 py-4 sm:py-6 group transition-all duration-300 w-full"
                  onClick={() => setCurrentStep("whatToWatch")}
                >
                  <ListFilter className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  <span>Personalized Picks</span>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-4 sm:px-8 py-4 sm:py-6 group transition-all duration-300 w-full"
                  onClick={() => {
                    resetFormData();
                    handleRandomRecommendation();
                  }}
                >
                  <Shuffle className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                  <span>Surprise Me</span>
                </Button>
              </motion.div>

              {isAuthenticated && hasPreferences && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    variant="secondary"
                    className="text-lg px-4 sm:px-8 py-4 sm:py-6 group transition-all duration-300 w-full"
                    onClick={() => {
                      resetFormData();
                      handleSavedPreferences();
                    }}
                  >
                    <Sparkles className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                    <span>Use My Preferences</span>
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        );

      case "similar":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-heading">
              What's a movie or show you love?
            </h1>
            <p className="text-xl text-muted-foreground">
              We'll find similar content you might enjoy
            </p>

            <form
              onSubmit={handleSimilarTitleSubmit}
              className="pt-6 space-y-4"
            >
              <input
                type="text"
                placeholder="Enter a movie or TV show title..."
                value={similarTitle}
                onChange={(e) => setSimilarTitle(e.target.value)}
                className="w-full h-14 px-4 rounded-md border border-input bg-background text-lg"
                autoFocus
              />

              <div className="flex gap-4 justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    resetFormData();
                    setCurrentStep("initial");
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!similarTitle.trim()}
                  className="px-8"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Find Similar Content
                </Button>
              </div>
            </form>
          </motion.div>
        );

      case "whatToWatch":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-heading">
              Get Personalized Recommendations
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Answer a few questions to get personalized recommendations
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-6 w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => {
                  resetFormData();
                  setCurrentStep("initial");
                }}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-6 sm:px-8 group transition-all duration-300 w-full sm:w-auto"
                onClick={() => setCurrentStep("whatToWatchGenres")}
              >
                <span>Start Quiz</span>
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      case "whatToWatchGenres":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              What genres are you in the mood for right now?
            </h1>
            <p className="text-xl text-muted-foreground">
              Select all that apply
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 pt-4">
              {[
                "Action",
                "Adventure",
                "Animation",
                "Comedy",
                "Crime",
                "Documentary",
                "Drama",
                "Family",
                "Fantasy",
                "History",
                "Horror",
                "K-Drama",
                "Music",
                "Mystery",
                "Romance",
                "Science Fiction",
                "Thriller",
                "War",
                "Western",
              ].map((genre) => (
                <Button
                  key={genre}
                  variant={
                    selectedGenres.includes(genre) ? "default" : "outline"
                  }
                  className={`h-auto py-2 px-3 ${selectedGenres.includes(genre) ? "border-2 border-primary" : ""}`}
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
                </Button>
              ))}
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep("whatToWatch")}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-8"
                onClick={() => setCurrentStep("whatToWatchMood")}
                disabled={selectedGenres.length === 0}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        );

      case "whatToWatchMood":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              What kind of vibe are you looking for tonight?
            </h1>
            <p className="text-xl text-muted-foreground">
              Choose the vibe you're looking for
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 pt-4">
              {[
                "Exciting",
                "Funny",
                "Heartwarming",
                "Suspenseful",
                "Thoughtful",
                "Uplifting",
                "Relaxing",
                "Intense",
                "Emotional",
                "Inspiring",
                "Dark",
                "Nostalgic",
              ].map((mood) => (
                <Button
                  key={mood}
                  variant={
                    selectedMood === mood.toLowerCase() ? "default" : "outline"
                  }
                  className={`h-auto py-3 ${selectedMood === mood.toLowerCase() ? "border-2 border-primary" : ""}`}
                  onClick={() => setSelectedMood(mood.toLowerCase())}
                >
                  {mood}
                </Button>
              ))}
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep("whatToWatchGenres")}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-8"
                onClick={() => setCurrentStep("whatToWatchTime")}
                disabled={!selectedMood}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        );

      case "whatToWatchTime":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              How much time do you have available tonight?
            </h1>
            <p className="text-xl text-muted-foreground">
              Select your preferred viewing time
            </p>

            <div className="pt-6 px-4">
              <div className="flex justify-between mb-2 text-sm">
                <span>30 min</span>
                <span>1 hour</span>
                <span>2 hours</span>
                <span>3+ hours</span>
              </div>
              <input
                type="range"
                min="30"
                max="180"
                step="15"
                value={viewingTime}
                onChange={(e) => setViewingTime(parseInt(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
              <div className="mt-4 text-xl font-medium">
                {viewingTime < 60
                  ? `${viewingTime} minutes`
                  : viewingTime === 60
                    ? "1 hour"
                    : viewingTime < 120
                      ? `1 hour ${viewingTime - 60} minutes`
                      : viewingTime === 120
                        ? "2 hours"
                        : viewingTime < 180
                          ? `2 hours ${viewingTime - 120} minutes`
                          : "3+ hours"}
              </div>
            </div>

            <div className="pt-6 space-y-2">
              <p className="text-muted-foreground">
                Select a content length that fits your schedule
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant={viewingTime === 30 ? "default" : "outline"}
                  onClick={() => setViewingTime(30)}
                >
                  TV Episode (30 min)
                </Button>
                <Button
                  variant={viewingTime === 60 ? "default" : "outline"}
                  onClick={() => setViewingTime(60)}
                >
                  Short Film (1 hour)
                </Button>
                <Button
                  variant={viewingTime === 90 ? "default" : "outline"}
                  onClick={() => setViewingTime(90)}
                >
                  Average Movie (1.5 hours)
                </Button>
                <Button
                  variant={viewingTime === 120 ? "default" : "outline"}
                  onClick={() => setViewingTime(120)}
                >
                  Feature Film (2 hours)
                </Button>
                <Button
                  variant={viewingTime === 180 ? "default" : "outline"}
                  onClick={() => setViewingTime(180)}
                >
                  Epic/Series (3+ hours)
                </Button>
              </div>
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep("whatToWatchMood")}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-8"
                onClick={() => setCurrentStep("whatToWatchFavorites")}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        );

      case "whatToWatchFavorites":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              What kind of content have you enjoyed in the past?
            </h1>
            <p className="text-xl text-muted-foreground">
              List movies, TV shows, or genres you've liked (comma separated)
            </p>

            <div className="pt-6">
              <textarea
                placeholder="e.g. The Matrix, Breaking Bad, Inception"
                value={favoriteContent}
                onChange={(e) => setFavoriteContent(e.target.value)}
                className="w-full h-32 p-4 rounded-md border border-input bg-background text-lg resize-none"
                autoFocus
              />
              <p className="text-sm text-muted-foreground mt-2">
                This helps us understand your taste better
              </p>
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep("whatToWatchTime")}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-8"
                onClick={() => setCurrentStep("whatToWatchAvoid")}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        );

      case "whatToWatchAvoid":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              What are you definitely NOT in the mood for tonight?
            </h1>
            <p className="text-xl text-muted-foreground">
              List movies, TV shows, or genres you want to avoid right now
              (comma separated)
            </p>

            <div className="pt-6">
              <textarea
                placeholder="e.g. Horror movies, Game of Thrones, War documentaries"
                value={contentToAvoid}
                onChange={(e) => setContentToAvoid(e.target.value)}
                className="w-full h-32 p-4 rounded-md border border-input bg-background text-lg resize-none"
                autoFocus
              />
              <p className="text-sm text-muted-foreground mt-2">
                We'll make sure to exclude these from tonight's recommendations
              </p>
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep("whatToWatchFavorites")}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-8"
                onClick={() => setCurrentStep("whatToWatchRatings")}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        );

      case "whatToWatchRatings":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              What content ratings are you comfortable with tonight?
            </h1>
            <p className="text-xl text-muted-foreground">
              Select all that apply
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
              {["G", "PG", "PG-13", "R", "TV-Y", "TV-PG", "TV-14", "TV-MA"].map(
                (rating) => (
                  <Button
                    key={rating}
                    variant={
                      selectedRatings.includes(rating) ? "default" : "outline"
                    }
                    className={`h-auto py-3 ${selectedRatings.includes(rating) ? "border-2 border-primary" : ""}`}
                    onClick={() => {
                      if (selectedRatings.includes(rating)) {
                        setSelectedRatings(
                          selectedRatings.filter((r) => r !== rating),
                        );
                      } else {
                        setSelectedRatings([...selectedRatings, rating]);
                      }
                    }}
                  >
                    {rating}
                  </Button>
                ),
              )}
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep("whatToWatchAvoid")}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-8"
                onClick={() => setCurrentStep("whatToWatchLanguage")}
                disabled={selectedRatings.length === 0}
              >
                Next
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        );

      case "whatToWatchLanguage":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8 max-w-2xl mx-auto"
          >
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              What language do you prefer for tonight's content?
            </h1>
            <p className="text-xl text-muted-foreground">
              Select your preferred language
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6">
              {[
                "English",
                "Korean",
                "Spanish",
                "Japanese",
                "French",
                "Chinese",
                "Hindi",
                "German",
                "Italian",
                "Any Language (with subtitles)",
              ].map((language) => (
                <Button
                  key={language}
                  variant={
                    preferredLanguage === language ? "default" : "outline"
                  }
                  className={`h-auto py-3 ${preferredLanguage === language ? "border-2 border-primary" : ""}`}
                  onClick={() => setPreferredLanguage(language)}
                >
                  {language}
                </Button>
              ))}
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentStep("whatToWatchRatings")}
              >
                Back
              </Button>
              <Button
                size="lg"
                className="px-8 group transition-all duration-300"
                onClick={handleWhatToWatchSubmit}
                disabled={!preferredLanguage}
              >
                Get Recommendations
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </motion.div>
        );

      case "processing":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-heading">
              Finding the perfect match...
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our AI is searching for recommendations just for you
            </p>

            <div className="flex flex-col items-center justify-center pt-6 space-y-6">
              <div className="relative">
                <motion.div
                  className="h-16 w-16 rounded-full border-4 border-primary border-t-transparent animate-spin"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                ></motion.div>
                <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary animate-pulse" />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="text-muted-foreground italic text-sm max-w-md text-center"
              >
                This may take a few moments as we analyze your preferences and
                find the best matches...
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5, duration: 0.5 }}
                className="text-primary/80 text-sm max-w-md text-center font-medium mt-4"
              >
                Searching through thousands of titles to find your perfect
                match...
              </motion.div>
            </div>
          </motion.div>
        );

      case "results":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-heading">
              Your Recommendations
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Here's what we think you'll enjoy
            </p>

            <div className="max-w-3xl mx-auto space-y-4">
              {recommendations.length > 0 ? (
                recommendations.map((rec, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { delay: index * 0.1 },
                    }}
                    whileHover={{ scale: 1.02 }}
                    className="bg-card border border-border p-4 rounded-lg text-left hover:border-primary/50 transition-all"
                  >
                    <h3 className="text-xl font-semibold flex items-center justify-between">
                      <span>{rec.title}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="ml-2"
                      >
                        <Link
                          to={
                            rec.imdb_id
                              ? `/movie/${rec.imdb_id}`
                              : `/search?q=${encodeURIComponent(rec.title)}`
                          }
                        >
                          <Film className="h-3 w-3 mr-1" />
                          Details
                        </Link>
                      </Button>
                    </h3>
                    <p className="text-muted-foreground mt-2">{rec.reason}</p>
                  </motion.div>
                ))
              ) : (
                <div className="bg-card border border-border p-4 rounded-lg">
                  <p>No recommendations found. Try a different search.</p>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-center pt-6">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  resetFormData();
                  setCurrentStep("initial");
                }}
              >
                Start Over
              </Button>
              <Button
                size="lg"
                className="px-8 group transition-all duration-300"
                onClick={() => (window.location.href = "/dashboard")}
              >
                View All Recommendations
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full min-h-[80vh] bg-background font-body">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-destructive/10 text-destructive px-4 py-2 rounded-md shadow-md max-w-md w-full mx-auto text-center"
        >
          {error}
          <button
            onClick={() => setError(null)}
            className="absolute top-1 right-1 text-destructive hover:text-destructive/80"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </motion.div>
      )}

      <div className="relative overflow-hidden">
        {/* Background gradient similar to homepage */}
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-background to-background z-0" />

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-20 left-[10%] text-primary/20 opacity-30"
            animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Film size={60} />
          </motion.div>
          <motion.div
            className="absolute bottom-40 right-[15%] text-secondary/20 opacity-30"
            animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          >
            <Tv size={50} />
          </motion.div>
          <motion.div
            className="absolute top-1/2 right-[30%] text-accent/20 opacity-30"
            animate={{ y: [0, 10, 0], rotate: [0, 10, 0] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          >
            <Sparkles size={40} />
          </motion.div>
        </div>

        {/* Main content */}
        <div className="container relative z-10 py-12 sm:py-16 md:py-24 lg:py-32 flex items-center justify-center min-h-[60vh]">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default NewDiscover;
