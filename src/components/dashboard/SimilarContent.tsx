import React, { useState } from "react";
import { motion } from "framer-motion";
import SimilarContentSearch from "../SimilarContentSearch";
import ErrorBoundary from "../ErrorBoundary";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";

interface SimilarContentProps {
  onSelectItem: (item: any) => void;
  useDirectApi: boolean;
}

const SimilarContent: React.FC<SimilarContentProps> = ({
  onSelectItem,
  useDirectApi,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleReset = () => {
    setHasError(false);
    window.location.reload();
  };

  if (hasError) {
    return (
      <div className="p-6 max-w-md mx-auto bg-card rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 text-destructive">
          Something went wrong
        </h2>
        <p className="mb-4 text-muted-foreground">
          There was an error loading the similar content feature.
        </p>
        <Button onClick={handleReset}>Try again</Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ErrorBoundary>
        <SimilarContentSearch
          onSelectItem={onSelectItem}
          useDirectApi={useDirectApi}
        />
      </ErrorBoundary>
    </motion.div>
  );
};

export default SimilarContent;
