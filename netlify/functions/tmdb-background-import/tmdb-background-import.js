// Background function for TMDB import that can run for up to 15 minutes
const fs = require("fs");
const axios = require("axios");

// Define the path for the status file
const STATUS_FILE_PATH = "/tmp/tmdb_import_status.json";

// Default status object
const defaultStatus = {
  isRunning: false,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  totalItems: 0,
  logs: [],
  lastUpdated: new Date().toISOString(),
};

// Function to read the status from file
function readStatusFromFile() {
  try {
    if (fs.existsSync(STATUS_FILE_PATH)) {
      const fileContent = fs.readFileSync(STATUS_FILE_PATH, "utf8");
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Error reading status file:", error);
  }
  return defaultStatus;
}

// Function to write the status to file
function writeStatusToFile(status) {
  try {
    fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(status), "utf8");
    return true;
  } catch (error) {
    console.error("Error writing status file:", error);
    return false;
  }
}

// Function to read the TMDB IDs from the static file
async function readTmdbIds() {
  console.log("[TMDB Import] Reading TMDB IDs from data file");
  try {
    // Fetch from the public URL only
    const siteUrl = process.env.URL || "https://whattowatchapp.netlify.app";
    const fileUrl = `${siteUrl}/tmdbIds.json`;

    console.log(`[TMDB Import] Fetching TMDB IDs from URL: ${fileUrl}`);

    try {
      const response = await axios.get(fileUrl);
      const ids = response.data;

      console.log(`[TMDB Import] Successfully fetched data from URL`);

      // Validate the parsed data
      if (!Array.isArray(ids)) {
        throw new Error("TMDB IDs file does not contain an array");
      }

      if (ids.length === 0) {
        throw new Error("TMDB IDs array is empty");
      }

      console.log(
        `[TMDB Import] Successfully parsed ${ids.length} TMDB IDs from file`,
      );
      return ids;
    } catch (fetchError) {
      console.error(`[TMDB Import] Error fetching file from URL: ${fileUrl}`);
      console.error(`[TMDB Import] Error message: ${fetchError.message}`);
      throw new Error(
        `Failed to fetch TMDB IDs from ${fileUrl}: ${fetchError.message}`,
      );
    }
  } catch (error) {
    console.error("[TMDB Import] Error reading TMDB IDs:", error);
    throw error; // Preserve the original error
  }
}

/**
 * Process a single TMDB item
 */
async function processTmdbItem(tmdbItem, addLog) {
  try {
    if (!tmdbItem || typeof tmdbItem !== "object" || !tmdbItem.id) {
      addLog(`Invalid TMDB item: ${JSON.stringify(tmdbItem)}`);
      return { success: false, message: "Invalid TMDB item", notFound: true };
    }

    // Determine media type from the item
    let mediaType = "movie";
    if (
      tmdbItem.media_type &&
      (tmdbItem.media_type === "movie" || tmdbItem.media_type === "tv")
    ) {
      mediaType = tmdbItem.media_type;
    } else if (tmdbItem.video === false) {
      mediaType = "movie";
    } else if (
      tmdbItem.first_air_date ||
      tmdbItem.number_of_seasons ||
      tmdbItem.number_of_episodes
    ) {
      mediaType = "tv";
    }

    const itemTitle =
      tmdbItem.original_title ||
      tmdbItem.title ||
      tmdbItem.name ||
      "Unknown title";
    addLog(`Processing TMDB ID: ${tmdbItem.id} - ${itemTitle} (${mediaType})`);

    // Fetch content from TMDB API
    let content = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (!content && attempts < maxAttempts) {
      attempts++;
      try {
        if (mediaType === "tv") {
          const { getTvShowById } = require("../../src/lib/tmdbClientProxy");
          content = await getTvShowById(tmdbItem.id);
        } else {
          const { getMovieById } = require("../../src/lib/tmdbClientProxy");
          content = await getMovieById(tmdbItem.id);
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
    addLog(`Error processing TMDB ID ${tmdbItem.id}: ${errorMessage}`);
    console.error(
      `[TMDB Import] Error processing TMDB ID ${tmdbItem.id}:`,
      errorMessage,
    );
    return { success: false, message: errorMessage };
  }
}

/**
 * Helper function to sleep for a specified time
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clear the Pinecone database
 */
async function clearVectorDatabase() {
  try {
    console.log("[TMDB Import] Clearing Pinecone database...");
    const { clearPineconeIndex } = require("../../src/lib/pineconeClient");
    const result = await clearPineconeIndex();
    console.log(`[TMDB Import] Pinecone database cleared: ${result}`);
    return result;
  } catch (error) {
    console.error("[TMDB Import] Error clearing Pinecone database:", error);
    return false;
  }
}

/**
 * Main background function handler
 */
exports.handler = async function (event, context) {
  // This is a background function that can run for up to 15 minutes
  console.log("[TMDB Background Import] Starting background import process");

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { clearExisting } = requestBody;

    // Initialize status
    let importStatus = {
      isRunning: true,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalItems: 0,
      logs: ["Starting background import process"],
      lastUpdated: new Date().toISOString(),
    };

    writeStatusToFile(importStatus);

    // Read TMDB IDs
    const tmdbIds = await readTmdbIds();
    console.log(
      `[TMDB Background Import] Found ${tmdbIds.length} TMDB IDs to process`,
    );

    // Update status with total items
    importStatus.totalItems = tmdbIds.length;
    importStatus.logs.push(`Found ${tmdbIds.length} TMDB IDs to process`);
    writeStatusToFile(importStatus);

    // Clear existing data if requested
    if (clearExisting) {
      importStatus.logs.push("Clearing existing vector database...");
      writeStatusToFile(importStatus);

      const cleared = await clearVectorDatabase();

      importStatus.logs.push(`Vector database cleared: ${cleared}`);
      writeStatusToFile(importStatus);
    }

    // Function to add logs and update status file
    const addLog = (log) => {
      console.log(`[TMDB Background Import] ${log}`);
      importStatus.logs = [...importStatus.logs.slice(-99), log]; // Keep last 100 logs
      importStatus.lastUpdated = new Date().toISOString();
      writeStatusToFile(importStatus);
    };

    // Process in batches
    const batchSize = 5; // Process 5 at a time to avoid rate limits

    for (let i = 0; i < tmdbIds.length; i += batchSize) {
      const batch = tmdbIds.slice(i, i + batchSize);
      addLog(
        `Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(tmdbIds.length / batchSize)}`,
      );

      // Process each item in the batch
      const batchPromises = batch.map((item) => processTmdbItem(item, addLog));
      const results = await Promise.allSettled(batchPromises);

      // Process results
      results.forEach((result, index) => {
        importStatus.processed++;

        if (result.status === "fulfilled") {
          if (result.value.success) {
            importStatus.successful++;
          } else if (result.value.notFound) {
            importStatus.skipped++;
          } else {
            importStatus.failed++;
          }
        } else {
          importStatus.failed++;
          addLog(`Error: ${result.reason}`);
        }

        writeStatusToFile(importStatus);
      });

      // Add delay between batches to respect rate limits
      if (i + batchSize < tmdbIds.length) {
        addLog("Rate limit pause: waiting 3 seconds between batches");
        await sleep(3000); // 3 second delay between batches
      }
    }

    // Mark process as complete
    importStatus.isRunning = false;
    importStatus.logs.push(
      `Import process completed. Processed: ${importStatus.processed}, ` +
        `Successful: ${importStatus.successful}, Failed: ${importStatus.failed}, ` +
        `Skipped: ${importStatus.skipped}`,
    );
    importStatus.lastUpdated = new Date().toISOString();
    writeStatusToFile(importStatus);

    console.log(
      "[TMDB Background Import] Import process completed successfully",
    );
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error("[TMDB Background Import] Error:", error);

    // Update status file with error
    const importStatus = readStatusFromFile();
    importStatus.isRunning = false;
    importStatus.logs.push(`Error: ${error.message || String(error)}`);
    importStatus.lastUpdated = new Date().toISOString();
    writeStatusToFile(importStatus);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
    };
  }
};
