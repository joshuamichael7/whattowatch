import React from "react";
import NewDiscover from "./NewDiscover";

interface DiscoverProps {
  onStartQuiz: () => void;
  onStartSimilarSearch: () => void;
}

const Discover: React.FC<DiscoverProps> = ({
  onStartQuiz,
  onStartSimilarSearch,
}) => {
  // We're now using the new questionnaire-style UX component
  return (
    <NewDiscover
      onStartQuiz={onStartQuiz}
      onStartSimilarSearch={onStartSimilarSearch}
    />
  );
};

export default Discover;
