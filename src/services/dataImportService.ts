import { getContentById } from "@/lib/omdbClient";
import { addContentToVectorDb } from "@/services/vectorService";
import { ContentItem } from "@/types/omdb";

/**
 * Interface for import progress tracking
 */
export interface ImportProgress {
  currentId: string;
  startId: string;
  endId: string;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  isRunning: boolean;
  logs: string[];
  lastUpdated: Date;
}

/**
 * Default import progress state
 */
export const defaultImportProgress: ImportProgress = {
  currentId: "",
  startId: "tt0000001",
  endId: "tt0010000",
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  isRunning: false,
  logs: [],
  lastUpdated: new Date(),
};

/**
 * Generate the next IMDB ID in sequence
 * @param currentId Current IMDB ID
 * @returns Next IMDB ID in sequence
 */
export function getNextImdbId(currentId: string): string {
  // Extract the numeric part
  const numericPart = currentId.replace(/^tt/, "");
  const nextNumber = parseInt(numericPart, 10) + 1;

  // Format with leading zeros to match the original length
  const paddedNumber = nextNumber.toString().padStart(numericPart.length, "0");

  return `tt${paddedNumber}`;
}

/**
 * Check if content already exists in the vector database
 * @param imdbId IMDB ID to check
 * @returns Boolean indicating if content exists
 */
export async function checkContentExists(imdbId: string): Promise<boolean> {
  try {
    // Call the Netlify function to check if content exists in Pinecone
    const response = await fetch("/.netlify/functions/pinecone-operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "checkVectorExists",
        params: { id: imdbId },
      }),
    });

    if (!response.ok) {
      console.error(`Error checking if content exists: ${response.status}`);
      return false; // Assume it doesn't exist if we can't check
    }

    const data = await response.json();
    return data.exists || false;
  } catch (error) {
    console.error("Error checking if content exists:", error);
    return false; // Assume it doesn't exist if we can't check
  }
}

/**
 * Process a single IMDB ID
 * @param imdbId IMDB ID to process
 * @param addLog Function to add log entries
 * @returns Result object with success status and message
 */
export async function processImdbId(
  imdbId: string,
  addLog: (log: string) => void,
): Promise<{ success: boolean; message: string }> {
  try {
    addLog(`Processing IMDB ID: ${imdbId}`);

    // Check if content already exists in the vector database
    const exists = await checkContentExists(imdbId);
    if (exists) {
      addLog(
        `Content with IMDB ID ${imdbId} already exists in vector database, skipping`,
      );
      return { success: true, message: "Content already exists" };
    }

    // Fetch content from OMDB
    const content = await getContentById(imdbId);

    if (!content) {
      addLog(`No content found for IMDB ID: ${imdbId}`);
      return { success: false, message: "Content not found" };
    }

    addLog(`Found content: ${content.title}`);

    // Add content to vector database
    const result = await addContentToVectorDb(content);

    if (result) {
      addLog(`Successfully added "${content.title}" to vector database`);
      return { success: true, message: `Added ${content.title}` };
    } else {
      addLog(`Failed to add "${content.title}" to vector database`);
      return { success: false, message: "Failed to add to vector database" };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog(`Error processing ${imdbId}: ${errorMessage}`);
    return { success: false, message: errorMessage };
  }
}

/**
 * Process a batch of IMDB IDs
 * @param startId Starting IMDB ID (used only in range mode)
 * @param count Number of IDs to process
 * @param batchSize Size of each batch
 * @param updateProgress Function to update progress
 * @param shouldContinue Function that returns whether processing should continue
 * @param imdbIds Optional array of specific IMDB IDs to process
 * @returns Final progress state
 */
export async function processBatch(
  startId: string,
  count: number,
  batchSize: number,
  updateProgress: (updater: (prev: ImportProgress) => ImportProgress) => void,
  shouldContinue: () => boolean,
  imdbIds?: string[],
): Promise<ImportProgress> {
  let currentId = startId;
  let processed = 0;
  let successful = 0;
  let failed = 0;
  let skipped = 0;

  const addLog = (log: string) => {
    updateProgress((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-99), log], // Keep last 100 logs
    }));
  };

  // Determine if we're using a list of IDs or generating them sequentially
  const useIdList = Array.isArray(imdbIds) && imdbIds.length > 0;

  // Sort IDs by popularity if requested
  if (useIdList && prioritizePopular && imdbIds) {
    addLog("Sorting IMDB IDs by estimated popularity...");
    imdbIds = [...imdbIds].sort((a, b) => {
      return getPopularityScore(b) - getPopularityScore(a);
    });
    addLog(
      "Sorted IDs by popularity. Processing higher priority content first.",
    );
  }

  if (useIdList) {
    addLog(
      `Starting batch processing of ${imdbIds.length} IMDB IDs${prioritizePopular ? " (prioritizing popular content)" : ""}`,
    );
  } else {
    addLog(
      `Starting batch processing from ${startId}${prioritizePopular ? " (prioritizing popular content)" : ""}`,
    );
  }

  // Process IDs in smaller batches
  for (let i = 0; i < count && shouldContinue(); i += batchSize) {
    const batchPromises = [];
    const batchIds = [];

    // Create a batch of promises
    for (let j = 0; j < batchSize && i + j < count && shouldContinue(); j++) {
      let idToProcess: string;

      if (useIdList) {
        // Use the provided list of IDs
        idToProcess = imdbIds![i + j];
        // Update currentId for progress tracking
        currentId = idToProcess;
      } else {
        // Generate IDs sequentially
        idToProcess = currentId;
        currentId = getNextImdbId(currentId);
      }

      batchIds.push(idToProcess);
      batchPromises.push(processImdbId(idToProcess, addLog));
    }

    // Wait for all promises in the batch to resolve
    const results = await Promise.allSettled(batchPromises);

    // Process results
    results.forEach((result, index) => {
      processed++;

      if (result.status === "fulfilled") {
        if (result.value.success) {
          if (result.value.message === "Content already exists") {
            skipped++;
          } else {
            successful++;
          }
        } else if (result.value.message === "Content not found") {
          skipped++;
        } else {
          failed++;
        }
      } else {
        addLog(`Error processing ${batchIds[index]}: ${result.reason}`);
        failed++;
      }

      // Update progress after each item
      updateProgress((prev) => ({
        ...prev,
        currentId: useIdList ? batchIds[index] : currentId,
        processed,
        successful,
        failed,
        skipped,
        lastUpdated: new Date(),
      }));
    });

    // Small delay between batches to prevent overwhelming the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  addLog(
    `Batch processing completed. Processed: ${processed}, Successful: ${successful}, Failed: ${failed}, Skipped: ${skipped}`,
  );

  return {
    currentId,
    startId,
    endId: "", // Will be set by the component
    processed,
    successful,
    failed,
    skipped,
    isRunning: false,
    logs: [],
    lastUpdated: new Date(),
  };
}
