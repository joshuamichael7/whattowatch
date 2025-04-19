import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ListFilter, Search, Film, Tv } from "lucide-react";
import { Link } from "react-router-dom";

interface DiscoverProps {
  onStartQuiz: () => void;
  onStartSimilarSearch: () => void;
}

const Discover: React.FC<DiscoverProps> = ({
  onStartQuiz,
  onStartSimilarSearch,
}) => {
  return (
    <div className="w-full space-y-12">
      {/* Hero Banner */}
      <div className="w-full bg-gradient-to-r from-primary/20 to-secondary/20 py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-5xl mx-auto space-y-6"
        >
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              Discover your next favorite
            </h1>
            <div className="flex items-center justify-center gap-3">
              <Film className="h-8 w-8 text-primary" />
              <h2 className="text-4xl font-semibold">Movies</h2>
              <span className="text-2xl">•</span>
              <Tv className="h-8 w-8 text-primary" />
              <h2 className="text-4xl font-semibold">TV Shows</h2>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mt-4">
              Get personalized recommendations based on your preferences and
              favorites, or find similar content to what you already love.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Discovery Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-5xl mx-auto space-y-8 px-4"
      >
        <h2 className="text-3xl font-bold text-center">
          How would you like to discover?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="bg-card rounded-xl shadow-lg p-8 text-center space-y-6 border border-border hover:border-primary/50 transition-all hover:shadow-xl">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <ListFilter className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-semibold">What to Watch</h2>
            <p className="text-muted-foreground text-lg">
              Answer a few questions about your taste to get personalized
              recommendations tailored just for you.
            </p>
            <Button
              size="lg"
              onClick={onStartQuiz}
              className="mt-4 w-full md:w-auto md:px-8"
            >
              Take the Quiz
            </Button>
          </div>

          <div className="bg-card rounded-xl shadow-lg p-8 text-center space-y-6 border border-border hover:border-primary/50 transition-all hover:shadow-xl">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Search className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-semibold">Find Similar Content</h2>
            <p className="text-muted-foreground text-lg">
              Already have a favorite? Search for a movie or show you love to
              find similar content you might enjoy.
            </p>
            <Button
              size="lg"
              onClick={onStartSimilarSearch}
              className="mt-4 w-full md:w-auto md:px-8"
            >
              Find Similar
            </Button>
          </div>
        </div>

        <div className="text-center pt-8">
          <p className="text-muted-foreground mb-4">
            Want to see your personalized dashboard?
          </p>
          <Button asChild variant="outline">
            <Link to="/user-dashboard">Go to My Dashboard</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Discover;
