import {
  getMovieById,
  getTvShowById,
  searchMoviesByIds,
  searchTvShowsByIds,
} from "@/lib/tmdbClientProxy";
import { sleep } from "@/lib/utils";
import { addContentToVectorDb } from "@/services/vectorService";
import { ContentItem } from "@/types/omdb";
import { clearPineconeIndex } from "@/lib/pineconeClient";

/**
 * Interface for TMDB import progress tracking
 */
export interface TmdbImportProgress {
  currentIndex: number;
  totalItems: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  isRunning: boolean;
  logs: string[];
  lastUpdated: Date;
}

/**
 * Default TMDB import progress state
 */
export const defaultTmdbImportProgress: TmdbImportProgress = {
  currentIndex: 0,
  totalItems: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  isRunning: false,
  logs: [],
  lastUpdated: new Date(),
};

/**
 * Interface for TMDB ID item from JSON list
 */
export interface TmdbIdItem {
  id: number;
  original_title?: string;
  adult?: boolean;
  popularity?: number;
  video?: boolean;
  media_type?: "movie" | "tv";
}

/**
 * Clear the Pinecone database
 * @returns Boolean indicating success
 */
export async function clearVectorDatabase(): Promise<boolean> {
  try {
    console.log("Clearing Pinecone database...");
    const result = await clearPineconeIndex();
    console.log(`Pinecone database cleared: ${result}`);
    return result;
  } catch (error) {
    console.error("Error clearing Pinecone database:", error);
    return false;
  }
}

/**
 * Process a single TMDB ID
 * @param tmdbId TMDB ID to process
 * @param mediaType Media type (movie or tv)
 * @param addLog Function to add log entries
 * @param includeDetails Whether to include additional details like cast, crew, and streaming providers
 * @returns Result object with success status and message
 */
export async function processTmdbId(
  tmdbId: number,
  mediaType: "movie" | "tv" = "movie",
  addLog: (log: string) => void,
  includeDetails: boolean = true,
): Promise<{ success: boolean; message: string }> {
  try {
    addLog(`Processing TMDB ID: ${tmdbId} (${mediaType})`);

    // Fetch content from TMDB
    let content: ContentItem | null;
    if (mediaType === "movie") {
      content = await getMovieById(tmdbId);
    } else {
      content = await getTvShowById(tmdbId);
    }

    if (!content) {
      addLog(`No content found for TMDB ID: ${tmdbId}`);
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
    addLog(`Error processing ${tmdbId}: ${errorMessage}`);
    return { success: false, message: errorMessage };
  }
}

/**
 * Process a batch of TMDB IDs
 * @param tmdbItems Array of TMDB ID items
 * @param batchSize Size of each batch
 * @param updateProgress Function to update progress
 * @param shouldContinue Function that returns whether processing should continue
 * @returns Final progress state
 */
/**
 * Parse a JSON string containing TMDB IDs
 * @param jsonString JSON string with one object per line
 * @returns Array of TMDB ID items
 */
export function parseTmdbJsonList(jsonString: string): TmdbIdItem[] {
  try {
    // Split the string by newlines and parse each line as JSON
    const lines = jsonString.trim().split("\n");
    const items: TmdbIdItem[] = [];

    for (const line of lines) {
      if (line.trim()) {
        try {
          const item = JSON.parse(line.trim());
          if (item && typeof item.id === "number") {
            // Ensure media_type is set if available in the JSON
            if (!item.media_type) {
              // Default to movie if video is false, otherwise tv
              // This is a common pattern in TMDB data
              item.media_type = item.video === false ? "movie" : "tv";
            }
            items.push(item);
          }
        } catch (e) {
          console.error("Error parsing JSON line:", line, e);
        }
      }
    }

    return items;
  } catch (error) {
    console.error("Error parsing TMDB JSON list:", error);
    return [];
  }
}

/**
 * Load TMDB IDs from the static file
 * @returns Promise<TmdbIdItem[]> Array of TMDB ID items
 */
export async function loadTmdbIdsFromFile(): Promise<TmdbIdItem[]> {
  try {
    console.log("Loading TMDB IDs from static file");
    const response = await fetch("/tmdbIds.json");

    if (!response.ok) {
      throw new Error(
        `Failed to fetch TMDB IDs file: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("TMDB IDs file does not contain an array");
    }

    console.log(`Successfully loaded ${data.length} TMDB IDs from file`);

    // Ensure each item has the required properties
    return data.map((item) => {
      // Ensure media_type is set if available in the JSON
      if (!item.media_type) {
        // Default to movie if video is false, otherwise tv
        // This is a common pattern in TMDB data
        item.media_type = item.video === false ? "movie" : "tv";
      }
      return item;
    });
  } catch (error) {
    console.error("Error loading TMDB IDs from file:", error);
    return [];
  }
}

/**
 * Import TMDB data from a JSON list
 * @param jsonString JSON string with one object per line
 * @param batchSize Size of each batch
 * @param updateProgress Function to update progress
 * @param shouldContinue Function that returns whether processing should continue
 * @param clearExisting Whether to clear existing data before import
 * @returns Final progress state
 */
export async function importTmdbData(
  jsonString: string,
  batchSize: number = 10,
  updateProgress: (
    updater: (prev: TmdbImportProgress) => TmdbImportProgress,
  ) => void,
  shouldContinue: () => boolean = () => true,
  clearExisting: boolean = false,
  defaultMediaType: "movie" | "tv" = "movie",
): Promise<TmdbImportProgress> {
  // Parse the JSON list
  const tmdbItems = parseTmdbJsonList(jsonString);

  if (tmdbItems.length === 0) {
    updateProgress((prev) => ({
      ...prev,
      logs: [...prev.logs, "No valid TMDB items found in the provided JSON"],
    }));
    return defaultTmdbImportProgress;
  }

  // Clear existing data if requested
  if (clearExisting) {
    updateProgress((prev) => ({
      ...prev,
      logs: [...prev.logs, "Clearing existing vector database..."],
    }));

    const cleared = await clearVectorDatabase();

    updateProgress((prev) => ({
      ...prev,
      logs: [...prev.logs, `Vector database cleared: ${cleared}`],
    }));

    if (!cleared) {
      updateProgress((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          "Failed to clear vector database, continuing with import anyway",
        ],
      }));
    }
  }

  // Process the batch
  return processTmdbBatch(
    tmdbItems,
    batchSize,
    updateProgress,
    shouldContinue,
    true,
    defaultMediaType,
  );
}

/**
 * Process a batch of TMDB IDs using bulk API calls when possible
 * @param tmdbItems Array of TMDB ID items
 * @param batchSize Size of each batch
 * @param updateProgress Function to update progress
 * @param shouldContinue Function that returns whether processing should continue
 * @param includeDetails Whether to include additional details like cast, crew, and streaming providers
 * @returns Final progress state
 */
export async function processTmdbBatch(
  tmdbItems: TmdbIdItem[],
  batchSize: number = 10,
  updateProgress: (
    updater: (prev: TmdbImportProgress) => TmdbImportProgress,
  ) => void,
  shouldContinue: () => boolean = () => true,
  includeDetails: boolean = true,
  defaultMediaType: "movie" | "tv" = "movie",
): Promise<TmdbImportProgress> {
  let processed = 0;
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let currentIndex = 0;
  const totalItems = tmdbItems.length;

  const addLog = (log: string) => {
    updateProgress((prev) => ({
      ...prev,
      logs: [...prev.logs.slice(-99), log], // Keep last 100 logs
    }));
  };

  addLog(`Starting batch processing of ${totalItems} TMDB IDs`);

  // Process IDs in smaller batches
  for (let i = 0; i < totalItems && shouldContinue(); i += batchSize) {
    const currentBatch = tmdbItems.slice(i, i + batchSize);
    const movieIds: number[] = [];
    const tvIds: number[] = [];

    // Separate movie and TV IDs
    currentBatch.forEach((item) => {
      // Use the media_type from the item if available, otherwise use the default
      const mediaType = item.media_type || defaultMediaType;
      if (mediaType === "movie") {
        movieIds.push(item.id);
      } else {
        tvIds.push(item.id);
      }
    });

    // Process movies in bulk if possible
    if (movieIds.length > 0) {
      addLog(`Processing ${movieIds.length} movies in bulk`);
      try {
        // Respect TMDB rate limit (40 requests per 10 seconds)
        // Since searchMoviesByIds makes multiple requests, we need to be cautious
        const maxBatchSize = Math.min(movieIds.length, 10); // Smaller batch size for safety
        const movies = [];

        // Process in smaller batches to respect rate limits
        for (let j = 0; j < movieIds.length; j += maxBatchSize) {
          const idBatch = movieIds.slice(j, j + maxBatchSize);
          addLog(
            `Processing movie batch ${j / maxBatchSize + 1} of ${Math.ceil(movieIds.length / maxBatchSize)}`,
          );

          const batchMovies = await searchMoviesByIds(idBatch, includeDetails);
          movies.push(...batchMovies);

          // Add delay between batches to respect rate limits
          if (j + maxBatchSize < movieIds.length) {
            addLog("Rate limit pause: waiting 3 seconds between batches");
            await sleep(3000); // 3 second delay between batches
          }
        }

        for (const movie of movies) {
          if (movie) {
            addLog(`Found movie: ${movie.title}`);
            const result = await addContentToVectorDb(movie);
            processed++;
            if (result) {
              successful++;
              addLog(`Successfully added "${movie.title}" to vector database`);
            } else {
              failed++;
              addLog(`Failed to add "${movie.title}" to vector database`);
            }
          } else {
            processed++;
            skipped++;
          }

          currentIndex++;
          updateProgress((prev) => ({
            ...prev,
            currentIndex,
            totalItems,
            processed,
            successful,
            failed,
            skipped,
            lastUpdated: new Date(),
          }));
        }
      } catch (error) {
        addLog(
          `Error processing movies in bulk: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Fall back to individual processing for movies
        for (const movieId of movieIds) {
          const result = await processTmdbId(
            movieId,
            "movie",
            addLog,
            includeDetails,
          );
          processed++;
          if (result.success) {
            successful++;
          } else if (result.message === "Content not found") {
            skipped++;
          } else {
            failed++;
          }

          currentIndex++;
          updateProgress((prev) => ({
            ...prev,
            currentIndex,
            totalItems,
            processed,
            successful,
            failed,
            skipped,
            lastUpdated: new Date(),
          }));
        }
      }
    }

    // Process TV shows in bulk if possible
    if (tvIds.length > 0) {
      addLog(`Processing ${tvIds.length} TV shows in bulk`);
      try {
        // Respect TMDB rate limit (40 requests per 10 seconds)
        // Since searchTvShowsByIds makes multiple requests, we need to be cautious
        const maxBatchSize = Math.min(tvIds.length, 10); // Smaller batch size for safety
        const tvShows = [];

        // Process in smaller batches to respect rate limits
        for (let j = 0; j < tvIds.length; j += maxBatchSize) {
          const idBatch = tvIds.slice(j, j + maxBatchSize);
          addLog(
            `Processing TV show batch ${j / maxBatchSize + 1} of ${Math.ceil(tvIds.length / maxBatchSize)}`,
          );

          const batchTvShows = await searchTvShowsByIds(
            idBatch,
            includeDetails,
          );
          tvShows.push(...batchTvShows);

          // Add delay between batches to respect rate limits
          if (j + maxBatchSize < tvIds.length) {
            addLog("Rate limit pause: waiting 3 seconds between batches");
            await sleep(3000); // 3 second delay between batches
          }
        }

        for (const tvShow of tvShows) {
          if (tvShow) {
            addLog(`Found TV show: ${tvShow.title}`);
            const result = await addContentToVectorDb(tvShow);
            processed++;
            if (result) {
              successful++;
              addLog(`Successfully added "${tvShow.title}" to vector database`);
            } else {
              failed++;
              addLog(`Failed to add "${tvShow.title}" to vector database`);
            }
          } else {
            processed++;
            skipped++;
          }

          currentIndex++;
          updateProgress((prev) => ({
            ...prev,
            currentIndex,
            totalItems,
            processed,
            successful,
            failed,
            skipped,
            lastUpdated: new Date(),
          }));
        }
      } catch (error) {
        addLog(
          `Error processing TV shows in bulk: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Fall back to individual processing for TV shows
        for (const tvId of tvIds) {
          const result = await processTmdbId(
            tvId,
            "tv",
            addLog,
            includeDetails,
          );
          processed++;
          if (result.success) {
            successful++;
          } else if (result.message === "Content not found") {
            skipped++;
          } else {
            failed++;
          }

          currentIndex++;
          updateProgress((prev) => ({
            ...prev,
            currentIndex,
            totalItems,
            processed,
            successful,
            failed,
            skipped,
            lastUpdated: new Date(),
          }));
        }
      }
    }

    // Small delay between batches to prevent overwhelming the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  addLog(
    `Batch processing completed. Processed: ${processed}, Successful: ${successful}, Failed: ${failed}, Skipped: ${skipped}`,
  );

  return {
    currentIndex,
    totalItems,
    processed,
    successful,
    failed,
    skipped,
    isRunning: false,
    logs: [],
    lastUpdated: new Date(),
  };
}
