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

    console.log(
      `[serverProcessingService] 📡 CALLING NETLIFY FUNCTION with ${recommendations.length} recommendations`,
    );
    console.log(
      `[serverProcessingService] 📊 FIRST RECOMMENDATION:`,
      JSON.stringify(recommendations[0]),
    );

    // Call the Netlify function to process recommendations
    try {
      console.log(
        `[serverProcessingService] 🔄 FETCH STARTING at ${new Date().toISOString()}`,
      );
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
      console.log(
        `[serverProcessingService] ✅ FETCH COMPLETED with status: ${response.status}`,
      );
    } catch (fetchError) {
      console.error(`[serverProcessingService] ❌ FETCH ERROR:`, fetchError);
      throw fetchError;
    }

    if (!response.ok) {
      console.error(
        `[serverProcessingService] ❌ Server returned error: ${response.status} ${response.statusText}`,
      );

      // Try to get more error details
      try {
        const errorText = await response.text();
        console.error(
          `[serverProcessingService] ❌ Error response body: ${errorText}`,
        );
      } catch (textError) {
        console.error(
          `[serverProcessingService] ❌ Could not read error response: ${textError}`,
        );
      }

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
