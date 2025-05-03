import { ContentItem } from "@/types/omdb";

/**
 * Service for processing recommendations on the server side
 */

/**
 * Process recommendations on the server side
 * @param recommendations Array of recommendations to process
 * @returns Promise with processing results
 */
export async function processRecommendationsOnServer(
  recommendations: ContentItem[],
): Promise<{
  success: boolean;
  processed: number;
  errors: number;
  processedRecommendations: ContentItem[];
  errorDetails: any[];
}> {
  try {
    console.log(
      `[serverProcessingService] 🚀 Sending ${recommendations.length} recommendations to server for processing`,
    );

    // Call the Netlify function to process recommendations
    const response = await fetch(
      "/.netlify/functions/process-recommendations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recommendations }),
      },
    );

    if (!response.ok) {
      console.error(
        `[serverProcessingService] ❌ Server returned error: ${response.status} ${response.statusText}`,
      );
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `[serverProcessingService] ✅ Server processed ${data.processed} recommendations`,
    );

    // Store processed recommendations in localStorage
    if (
      data.processedRecommendations &&
      data.processedRecommendations.length > 0
    ) {
      try {
        // Get existing processed recommendations
        const existingRecs = JSON.parse(
          localStorage.getItem("processedRecommendations") || "{}",
        );

        // Add new processed recommendations
        const updatedRecs = { ...existingRecs };
        data.processedRecommendations.forEach((rec: ContentItem) => {
          if (rec.id) {
            updatedRecs[rec.id] = rec;
          }
        });

        // Save back to localStorage
        localStorage.setItem(
          "processedRecommendations",
          JSON.stringify(updatedRecs),
        );
        console.log(
          `[serverProcessingService] ✅ Saved ${data.processedRecommendations.length} processed recommendations to localStorage`,
        );
      } catch (storageError) {
        console.error(
          "[serverProcessingService] ❌ Error saving to localStorage:",
          storageError,
        );
      }
    }

    return data;
  } catch (error) {
    console.error(
      "[serverProcessingService] ❌ Error processing recommendations on server:",
      error,
    );
    throw error;
  }
}

/**
 * Get processed recommendations from localStorage
 * @returns Record of processed recommendations
 */
export function getProcessedRecommendations(): Record<string, ContentItem> {
  try {
    const stored = localStorage.getItem("processedRecommendations");
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error(
      "[serverProcessingService] ❌ Error loading processed recommendations:",
      error,
    );
    return {};
  }
}
