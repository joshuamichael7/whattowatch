import React from "react";
import { Button } from "@/components/ui/button";

const ForceProcessingButton = () => {
  const handleClick = async () => {
    try {
      // Get recommendations from localStorage
      const recsString = localStorage.getItem(
        "pendingRecommendationsToProcess",
      );
      if (!recsString) {
        console.log("No recommendations found in localStorage!");
        return;
      }

      const recs = JSON.parse(recsString);
      console.log(
        `Found ${recs.length} recommendations. Starting processing...`,
      );

      // Import the service and start processing
      const service = await import(
        "@/services/recommendationProcessingService"
      );
      service.startBackgroundProcessing();

      console.log("Processing started!");
    } catch (error) {
      console.error("Error processing recommendations:", error);
    }
  };

  return (
    <Button
      onClick={handleClick}
      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
    >
      FORCE PROCESS RECOMMENDATIONS
    </Button>
  );
};

export default ForceProcessingButton;
