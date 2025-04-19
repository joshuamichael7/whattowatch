import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ListFilter, Search } from "lucide-react";

interface DiscoverProps {
  onStartQuiz?: () => void;
  onStartSimilarSearch?: () => void;
}

const Discover: React.FC<DiscoverProps> = ({
  onStartQuiz = () => {},
  onStartSimilarSearch = () => {},
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Discover your next favorite movie or show
        </h1>
        <p className="text-xl text-muted-foreground">
          Get personalized recommendations based on your preferences and
          favorites.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
        <div className="bg-muted/40 rounded-lg p-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <ListFilter className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold">What to Watch</h2>
          <p className="text-muted-foreground">
            Answer a few questions about your taste to get personalized
            recommendations.
          </p>
          <Button size="lg" onClick={onStartQuiz} className="mt-4">
            Get Started
          </Button>
        </div>

        <div className="bg-muted/40 rounded-lg p-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Search className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold">Find Similar Content</h2>
          <p className="text-muted-foreground">
            Search for a movie or show you love to find similar content you
            might enjoy.
          </p>
          <Button size="lg" onClick={onStartSimilarSearch} className="mt-4">
            Search Now
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default Discover;
