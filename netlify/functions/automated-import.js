// Netlify function for automated import of OMDB/TMDB data to Pinecone
const { getContentById } = require("../../src/lib/omdbClient");
const { addContentToVectorDb } = require("../../src/services/vectorService");

/**
 * Clear the Pinecone database
 * @returns {Promise<boolean>} Boolean indicating success
 */
async function clearVectorDatabase() {
  try {
    console.log("[Automated Import] Clearing Pinecone database...");
    const { clearPineconeIndex } = require("../../src/lib/pineconeClient");
    const result = await clearPineconeIndex();
    console.log(`[Automated Import] Pinecone database cleared: ${result}`);
    return result;
  } catch (error) {
    console.error(
      "[Automated Import] Error clearing Pinecone database:",
      error,
    );
    return false;
  }
}

/**
 * Process a single IMDB ID
 * @param {string} imdbId IMDB ID to process
 * @returns {Object} Result object with success status and message
 */
async function processImdbId(imdbId) {
  try {
    console.log(`Processing IMDB ID: ${imdbId}`);

    // Fetch content from OMDB
    const content = await getContentById(imdbId);

    if (!content) {
      console.log(`No content found for IMDB ID: ${imdbId}`);
      return { success: false, message: "Content not found" };
    }

    console.log(`Found content: ${content.title}`);

    // Add content to vector database
    const result = await addContentToVectorDb(content);

    if (result) {
      console.log(`Successfully added "${content.title}" to vector database`);
      return { success: true, message: `Added ${content.title}` };
    } else {
      console.log(`Failed to add "${content.title}" to vector database`);
      return { success: false, message: "Failed to add to vector database" };
    }
  } catch (error) {
    console.error(`Error processing ${imdbId}:`, error);
    return { success: false, message: error.message || String(error) };
  }
}

/**
 * Generate the next IMDB ID in sequence
 * @param {string} currentId Current IMDB ID
 * @returns {string} Next IMDB ID in sequence
 */
function getNextImdbId(currentId) {
  // Extract the numeric part
  const numericPart = currentId.replace(/^tt/, "");
  const nextNumber = parseInt(numericPart, 10) + 1;

  // Format with leading zeros to match the original length
  const paddedNumber = nextNumber.toString().padStart(numericPart.length, "0");

  return `tt${paddedNumber}`;
}

/**
 * Process a batch of TMDB IDs
 * @param {Array} tmdbIds Array of TMDB ID objects
 * @param {number} batchSize Size of each batch
 * @returns {Object} Result object with processed counts
 */
async function processTmdbBatch(tmdbIds, batchSize) {
  let currentId = "tmdb-batch";
  let processed = 0;
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const logs = [];

  const addLog = (log) => {
    logs.push(log);
    console.log(`[Automated Import] ${log}`);

    // Update the status file with the new log
    updateStatusFile({
      logs: [...logs],
      lastUpdated: new Date().toISOString(),
    });
  };

  addLog(`Starting TMDB batch processing for ${tmdbIds.length} items`);

  try {
    // Separate movie and TV IDs for bulk processing
    const movieIds = [];
    const tvIds = [];
    const movieItems = {};
    const tvItems = {};

    // Categorize items by media type
    tmdbIds.forEach((item) => {
      // Use the media_type from the item if available, otherwise determine based on video property
      const mediaType =
        item.media_type || (item.video === false ? "movie" : "tv");
      if (mediaType === "movie") {
        movieIds.push(item.id);
        movieItems[item.id] = item;
      } else {
        tvIds.push(item.id);
        tvItems[item.id] = item;
      }
    });

    addLog(
      `Categorized items: ${movieIds.length} movies and ${tvIds.length} TV shows`,
    );

    // Process movies in bulk if possible
    if (movieIds.length > 0) {
      addLog(`Processing ${movieIds.length} movies in bulk`);
      try {
        // Respect TMDB rate limit (40 requests per 10 seconds)
        // Since we make multiple requests per movie, we need to be cautious
        const maxBatchSize = Math.min(movieIds.length, 10); // Smaller batch size for safety

        for (let j = 0; j < movieIds.length; j += maxBatchSize) {
          const idBatch = movieIds.slice(j, j + maxBatchSize);
          addLog(
            `Processing movie batch ${Math.floor(j / maxBatchSize) + 1} of ${Math.ceil(movieIds.length / maxBatchSize)}`,
          );

          // Process each movie individually
          const batchPromises = [];
          for (const movieId of idBatch) {
            batchPromises.push(processTmdbItem(movieItems[movieId], addLog));
          }

          // Wait for all promises in the batch to resolve
          const results = await Promise.allSettled(batchPromises);

          // Process results
          results.forEach((result, index) => {
            processed++;
            const currentId = idBatch[index];

            if (result.status === "fulfilled") {
              if (result.value.success) {
                successful++;
                addLog(
                  `Successfully processed movie ID ${currentId}: ${result.value.message}`,
                );
              } else if (result.value.notFound) {
                skipped++;
                addLog(`Skipped movie ID ${currentId}: Content not found`);
              } else {
                failed++;
                addLog(
                  `Failed to process movie ID ${currentId}: ${result.value.message}`,
                );
              }
            } else {
              failed++;
              addLog(
                `Error processing movie ID ${currentId}: ${result.reason}`,
              );
            }

            // Update the status file with progress
            updateStatusFile({
              processed,
              successful,
              failed,
              skipped,
              lastUpdated: new Date().toISOString(),
            });
          });

          // Add delay between batches to respect rate limits
          if (j + maxBatchSize < movieIds.length) {
            addLog("Rate limit pause: waiting 3 seconds between batches");
            await sleep(3000); // 3 second delay between batches
          }
        }
      } catch (error) {
        addLog(
          `Error processing movies in bulk: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Fall back to individual processing for movies that failed
        for (const movieId of movieIds) {
          try {
            const result = await processTmdbItem(movieItems[movieId], addLog);
            // We don't increment processed here as these items were already counted
            if (result.success) {
              // Only increment successful if it wasn't already counted
              if (!result.alreadyCounted) {
                successful++;
              }
            } else if (result.message === "Content not found") {
              if (!result.alreadyCounted) {
                skipped++;
              }
            } else {
              if (!result.alreadyCounted) {
                failed++;
              }
            }
          } catch (itemError) {
            addLog(
              `Error processing movie ID ${movieId}: ${itemError.message || String(itemError)}`,
            );
          }
        }
      }
    }

    // Process TV shows in bulk if possible
    if (tvIds.length > 0) {
      addLog(`Processing ${tvIds.length} TV shows in bulk`);
      try {
        // Respect TMDB rate limit (40 requests per 10 seconds)
        // Since we make multiple requests per TV show, we need to be cautious
        const maxBatchSize = Math.min(tvIds.length, 10); // Smaller batch size for safety

        for (let j = 0; j < tvIds.length; j += maxBatchSize) {
          const idBatch = tvIds.slice(j, j + maxBatchSize);
          addLog(
            `Processing TV show batch ${Math.floor(j / maxBatchSize) + 1} of ${Math.ceil(tvIds.length / maxBatchSize)}`,
          );

          // Process each TV show individually
          const batchPromises = [];
          for (const tvId of idBatch) {
            batchPromises.push(processTmdbItem(tvItems[tvId], addLog));
          }

          // Wait for all promises in the batch to resolve
          const results = await Promise.allSettled(batchPromises);

          // Process results
          results.forEach((result, index) => {
            processed++;
            const currentId = idBatch[index];

            if (result.status === "fulfilled") {
              if (result.value.success) {
                successful++;
                addLog(
                  `Successfully processed TV show ID ${currentId}: ${result.value.message}`,
                );
              } else if (result.value.notFound) {
                skipped++;
                addLog(`Skipped TV show ID ${currentId}: Content not found`);
              } else {
                failed++;
                addLog(
                  `Failed to process TV show ID ${currentId}: ${result.value.message}`,
                );
              }
            } else {
              failed++;
              addLog(
                `Error processing TV show ID ${currentId}: ${result.reason}`,
              );
            }

            // Update the status file with progress
            updateStatusFile({
              processed,
              successful,
              failed,
              skipped,
              lastUpdated: new Date().toISOString(),
            });
          });

          // Add delay between batches to respect rate limits
          if (j + maxBatchSize < tvIds.length) {
            addLog("Rate limit pause: waiting 3 seconds between batches");
            await sleep(3000); // 3 second delay between batches
          }
        }
      } catch (error) {
        addLog(
          `Error processing TV shows in bulk: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Fall back to individual processing for TV shows that failed
        for (const tvId of tvIds) {
          try {
            const result = await processTmdbItem(tvItems[tvId], addLog);
            // We don't increment processed here as these items were already counted
            if (result.success) {
              // Only increment successful if it wasn't already counted
              if (!result.alreadyCounted) {
                successful++;
              }
            } else if (result.message === "Content not found") {
              if (!result.alreadyCounted) {
                skipped++;
              }
            } else {
              if (!result.alreadyCounted) {
                failed++;
              }
            }
          } catch (itemError) {
            addLog(
              `Error processing TV show ID ${tvId}: ${itemError.message || String(itemError)}`,
            );
          }
        }
      }
    }

    addLog(
      `TMDB batch processing completed. Processed: ${processed}, Successful: ${successful}, Failed: ${failed}, Skipped: ${skipped}`,
    );

    return {
      success: true,
      currentId,
      processed,
      successful,
      failed,
      skipped,
      logs: logs.slice(-50), // Return last 50 logs
    };
  } catch (error) {
    console.error("[Automated Import] Error in TMDB batch processing:", error);
    return {
      success: false,
      error: error.message || String(error),
      currentId,
      processed,
      successful,
      failed,
      skipped,
      logs: logs.slice(-50), // Return last 50 logs
    };
  }
}

/**
 * Process a single TMDB item
 * @param {Object} tmdbItem TMDB item object
 * @param {Function} addLog Function to add log entries
 * @param {boolean} includeDetails Whether to include additional details like cast, crew, and streaming providers
 * @returns {Object} Result object with success status and message
 */
async function processTmdbItem(tmdbItem, addLog, includeDetails = true) {
  // Log the entire tmdbItem for debugging
  console.log(
    `[Automated Import] Processing TMDB item: ${JSON.stringify(tmdbItem)}`,
  );
  try {
    if (!tmdbItem || typeof tmdbItem !== "object" || !tmdbItem.id) {
      addLog(`Invalid TMDB item: ${JSON.stringify(tmdbItem)}`);
      return { success: false, message: "Invalid TMDB item", notFound: true };
    }

    // Determine media type from the item using a more robust method
    // First check media_type property, then check video property, then default to movie
    let mediaType = "movie";
    if (
      tmdbItem.media_type &&
      (tmdbItem.media_type === "movie" || tmdbItem.media_type === "tv")
    ) {
      mediaType = tmdbItem.media_type;
    } else if (tmdbItem.video === false) {
      // In TMDB data, movies typically have video=false
      mediaType = "movie";
    } else if (
      tmdbItem.first_air_date ||
      tmdbItem.number_of_seasons ||
      tmdbItem.number_of_episodes
    ) {
      // These properties are specific to TV shows
      mediaType = "tv";
    }

    const itemTitle =
      tmdbItem.original_title ||
      tmdbItem.title ||
      tmdbItem.name ||
      "Unknown title";
    addLog(`Processing TMDB ID: ${tmdbItem.id} - ${itemTitle} (${mediaType})`);

    // Fetch content from TMDB API based on media type with retry logic
    let content = null;
    let attempts = 0;
    const maxAttempts = 3;

    console.log(
      `[Automated Import] Fetching ${mediaType} content for TMDB ID: ${tmdbItem.id}`,
    );

    while (!content && attempts < maxAttempts) {
      attempts++;
      try {
        if (mediaType === "tv") {
          console.log(
            `[Automated Import] Calling getTvShowById for ID: ${tmdbItem.id}`,
          );
          const { getTvShowById } = require("../../src/lib/tmdbClientProxy");
          content = await getTvShowById(tmdbItem.id);
          console.log(
            `[Automated Import] getTvShowById result: ${content ? "Success" : "Failed"}`,
          );
        } else {
          console.log(
            `[Automated Import] Calling getMovieById for ID: ${tmdbItem.id}`,
          );
          const { getMovieById } = require("../../src/lib/tmdbClientProxy");
          content = await getMovieById(tmdbItem.id);
          console.log(
            `[Automated Import] getMovieById result: ${content ? "Success" : "Failed"}`,
          );
        }

        if (!content && attempts < maxAttempts) {
          addLog(
            `Attempt ${attempts} failed for TMDB ID: ${tmdbItem.id}. Retrying...`,
          );
          await sleep(1000 * attempts); // Exponential backoff
        }
      } catch (apiError) {
        if (attempts < maxAttempts) {
          const errorMsg =
            apiError instanceof Error ? apiError.message : String(apiError);
          addLog(
            `API error on attempt ${attempts} for TMDB ID ${tmdbItem.id}: ${errorMsg}. Retrying...`,
          );
          await sleep(1000 * attempts); // Exponential backoff
        } else {
          throw apiError; // Re-throw on final attempt
        }
      }
    }

    if (!content) {
      addLog(
        `No content found for TMDB ID: ${tmdbItem.id} after ${maxAttempts} attempts`,
      );
      return { success: false, message: "Content not found", notFound: true };
    }

    addLog(`Found content: ${content.title || content.name}`);

    // Validate content before upserting
    if (!validateTmdbContent(content, addLog)) {
      addLog(`Invalid content data for TMDB ID: ${tmdbItem.id}`);
      return {
        success: false,
        message: "Invalid content data",
        notFound: false,
      };
    }

    // Add content to vector database
    const {
      addContentToVectorDb,
    } = require("../../src/services/vectorService");
    const result = await addContentToVectorDb(content);

    if (result) {
      addLog(
        `Successfully added "${content.title || content.name}" to vector database`,
      );
      return {
        success: true,
        message: `Added ${content.title || content.name}`,
      };
    } else {
      addLog(
        `Failed to add "${content.title || content.name}" to vector database`,
      );
      return { success: false, message: "Failed to add to vector database" };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack trace";
    addLog(`Error processing TMDB ID ${tmdbItem.id}: ${errorMessage}`);
    console.error(
      `[Automated Import] Error processing TMDB ID ${tmdbItem.id}:`,
      errorMessage,
    );
    console.error(`[Automated Import] Error stack:`, errorStack);
    return { success: false, message: errorMessage };
  }
}

/**
 * Process a batch of IMDB IDs
 * @param {string} startId Starting IMDB ID
 * @param {number} count Number of IDs to process
 * @param {number} batchSize Size of each batch
 * @returns {Object} Result object with processed counts and current ID
 */
async function processBatch(startId, count, batchSize) {
  let currentId = startId;
  let processed = 0;
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  const logs = [];

  const addLog = (log) => {
    logs.push(log);
    console.log(log);
  };

  addLog(`Starting batch processing from ${startId}`);

  try {
    // Process IDs in smaller batches
    for (let i = 0; i < count && i < 1000; i += batchSize) {
      // Limit to 1000 max
      const batchPromises = [];
      const batchIds = [];

      // Create a batch of promises
      for (let j = 0; j < batchSize && i + j < count; j++) {
        batchIds.push(currentId);
        batchPromises.push(processImdbId(currentId));
        currentId = getNextImdbId(currentId);
      }

      // Wait for all promises in the batch to resolve
      const results = await Promise.allSettled(batchPromises);

      // Process results
      results.forEach((result, index) => {
        processed++;

        if (result.status === "fulfilled") {
          if (result.value.success) {
            if (result.value.skipped) {
              skipped++;
              addLog(`Skipped ${batchIds[index]}: ${result.value.message}`);
            } else {
              successful++;
              addLog(
                `Successfully processed ${batchIds[index]}: ${result.value.message}`,
              );
            }
          } else if (result.value.notFound) {
            skipped++;
            addLog(`Skipped ${batchIds[index]}: Content not found`);
          } else {
            failed++;
            const errorType = result.value.error || "unknown_error";
            addLog(
              `Failed to process ${batchIds[index]}: ${result.value.message} (${errorType})`,
            );
          }
        } else {
          failed++;
          addLog(`Error processing ${batchIds[index]}: ${result.reason}`);
        }
      });

      // Small delay between batches to prevent overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    addLog(
      `Batch processing completed. Processed: ${processed}, Successful: ${successful}, Failed: ${failed}, Skipped: ${skipped}`,
    );

    return {
      success: true,
      currentId,
      processed,
      successful,
      failed,
      skipped,
      logs: logs.slice(-50), // Return last 50 logs
    };
  } catch (error) {
    console.error("Error in batch processing:", error);
    return {
      success: false,
      error: error.message || String(error),
      currentId,
      processed,
      successful,
      failed,
      skipped,
      logs: logs.slice(-50), // Return last 50 logs
    };
  }
}

/**
 * Helper function to sleep for a specified time
 * @param {number} ms - Time to sleep in milliseconds
 * @returns {Promise<void>} Promise that resolves after the specified time
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate TMDB content before upserting to Pinecone
 * @param {Object} content - The content object to validate
 * @param {Function} addLog - Function to add log entries
 * @returns {boolean} - Whether the content is valid
 */
function validateTmdbContent(content, addLog) {
  if (!content) {
    addLog("Content is null or undefined");
    return false;
  }

  // Check for required fields
  const requiredFields = ["id", "media_type"];
  const missingFields = requiredFields.filter((field) => !content[field]);

  if (missingFields.length > 0) {
    addLog(`Content is missing required fields: ${missingFields.join(", ")}`);
    return false;
  }

  // Check that we have either a title or name
  if (!content.title && !content.name) {
    addLog("Content is missing both title and name");
    return false;
  }

  // Ensure we have some descriptive content for the vector database
  if (!content.overview && !content.synopsis) {
    addLog("Content is missing both overview and synopsis");
    // This is not a deal-breaker, so we'll just log it but still return true
    // return false;
  }

  return true;
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    console.log("[Automated Import] Received request to automated-import");

    // Parse request body
    const requestBody = JSON.parse(event.body);
    console.log(
      `[Automated Import] Request body: ${JSON.stringify(requestBody)}`,
    );

    const { startId, count, batchSize, tmdbIds, clearExisting } = requestBody;

    // Validate parameters for TMDB import
    if (tmdbIds && Array.isArray(tmdbIds)) {
      if (!batchSize) {
        console.log("[Automated Import] Missing batchSize parameter");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Missing required parameter: batchSize",
          }),
        };
      }
    }
    // Validate parameters for IMDB import
    else if (!startId || !count || !batchSize) {
      console.log("[Automated Import] Missing required parameters");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required parameters: startId, count, batchSize",
        }),
      };
    }

    // Update the status file with initial information
    updateStatusFile({
      isRunning: true,
      totalItems: tmdbIds && Array.isArray(tmdbIds) ? tmdbIds.length : count,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      logs: ["Starting import process"],
      lastUpdated: new Date().toISOString(),
    });

    // Clear existing data if requested
    if (clearExisting) {
      console.log("[Automated Import] Clearing existing vector database...");
      try {
        const { clearPineconeIndex } = require("../../src/lib/pineconeClient");
        const cleared = await clearVectorDatabase();
        console.log(`[Automated Import] Vector database cleared: ${cleared}`);

        // Update status file
        updateStatusFile({
          logs: [
            "Starting import process",
            `Vector database cleared: ${cleared}`,
          ],
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error(
          "[Automated Import] Error clearing vector database:",
          error,
        );
        // Update status file with error
        updateStatusFile({
          logs: [
            "Starting import process",
            `Error clearing vector database: ${error.message || String(error)}`,
          ],
          lastUpdated: new Date().toISOString(),
        });
        // Continue with import even if clearing fails
      }
    }

    // Update the status file with progress
    const fs = require("fs");
    const STATUS_FILE_PATH = "/tmp/tmdb_import_status.json";

    function updateStatusFile(update) {
      try {
        let currentStatus = {
          isRunning: true,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          totalItems: 0,
          logs: [],
          lastUpdated: new Date().toISOString(),
        };

        if (fs.existsSync(STATUS_FILE_PATH)) {
          const fileContent = fs.readFileSync(STATUS_FILE_PATH, "utf8");
          currentStatus = JSON.parse(fileContent);
        }

        const updatedStatus = { ...currentStatus, ...update };
        fs.writeFileSync(
          STATUS_FILE_PATH,
          JSON.stringify(updatedStatus),
          "utf8",
        );
      } catch (error) {
        console.error("[Automated Import] Error updating status file:", error);
      }
    }

    // Process batch - check if we have TMDB IDs
    let result;
    if (tmdbIds && Array.isArray(tmdbIds)) {
      console.log(`[Automated Import] Processing ${tmdbIds.length} TMDB IDs`);
      console.log(
        `[Automated Import] First TMDB ID: ${JSON.stringify(tmdbIds[0])}`,
      );
      // Process TMDB IDs
      try {
        // Make sure each item has an id property
        const validTmdbIds = tmdbIds.filter(
          (item) => item && typeof item === "object" && item.id,
        );
        console.log(
          `[Automated Import] Found ${validTmdbIds.length} valid TMDB items with IDs`,
        );

        if (validTmdbIds.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              error: "No valid TMDB items found in the provided data",
              details: "Each TMDB item must be an object with an 'id' property",
            }),
          };
        }

        result = await processTmdbBatch(validTmdbIds, batchSize);
      } catch (error) {
        console.error(
          `[Automated Import] Error processing TMDB batch: ${error.message || String(error)}`,
        );
        console.error(`[Automated Import] Error stack: ${error.stack}`);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: error.message || "Error processing TMDB batch",
            stack: error.stack,
            details: "Failed to process TMDB batch",
          }),
        };
      }
    } else {
      console.log(`[Automated Import] Processing IMDB batch from ${startId}`);
      // Process IMDB IDs
      try {
        result = await processBatch(startId, count, batchSize);
      } catch (error) {
        console.error(
          `[Automated Import] Error processing IMDB batch: ${error.message || String(error)}`,
        );
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: error.message || "Error processing IMDB batch",
          }),
        };
      }
    }

    console.log(
      `[Automated Import] Processing complete: ${JSON.stringify(result)}`,
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("[Automated Import] Error processing request:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
