// Netlify function for automated import of OMDB data to Pinecone
const { getContentById } = require("../../src/lib/omdbClient");
const { addContentToVectorDb } = require("../../src/services/vectorService");

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

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { startId, count, batchSize } = requestBody;

    // Validate parameters
    if (!startId || !count || !batchSize) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required parameters: startId, count, batchSize",
        }),
      };
    }

    // Process batch
    const result = await processBatch(startId, count, batchSize);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
