// Netlify function to control the TMDB import process
const fs = require("fs");
const path = require("path");

// This would normally connect to a database or other persistent storage
// For now, we'll use a simple in-memory object that's shared with the status endpoint

// Import the shared state from wherever it's maintained
// This is just a placeholder - in a real implementation, you'd use a database or other persistent storage
let importStatus = {
  isRunning: false,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  totalItems: 0,
  logs: [],
  lastUpdated: new Date().toISOString(),
};

// Function to read the TMDB IDs from the static file
async function readTmdbIds() {
  console.log("[TMDB Import] Reading TMDB IDs from data file");
  try {
    // In Netlify, we should fetch the file from the public URL
    const siteUrl = process.env.URL || "https://whattowatchapp.netlify.app";
    const fileUrl = `${siteUrl}/tmdbIds.json`;

    console.log(`[TMDB Import] Fetching TMDB IDs from URL: ${fileUrl}`);

    // Use axios or node-fetch to get the file from the URL
    const axios = require("axios");

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
      console.error(`[TMDB Import] Error stack: ${fetchError.stack}`);

      // Try to provide more detailed error information
      if (fetchError.response) {
        console.error(`[TMDB Import] Status: ${fetchError.response.status}`);
        console.error(
          `[TMDB Import] Response data: ${JSON.stringify(fetchError.response.data)}`,
        );
      }

      throw new Error(
        `Failed to fetch TMDB IDs from ${fileUrl}: ${fetchError.message}`,
      );
    }
  } catch (error) {
    console.error("[TMDB Import] Error reading TMDB IDs:", error);
    console.error(`[TMDB Import] Error stack: ${error.stack}`);
    throw error; // Preserve the original error
  }
}

// Function to start the import process
async function startImport() {
  console.log("[TMDB Import] Starting import process");

  if (importStatus.isRunning) {
    console.log("[TMDB Import] Import is already running, aborting");
    return { success: false, message: "Import is already running" };
  }

  // Read the TMDB IDs
  console.log("[TMDB Import] Reading TMDB IDs");
  let tmdbIds;
  try {
    tmdbIds = await readTmdbIds();
    console.log(`[TMDB Import] Found ${tmdbIds.length} TMDB IDs to process`);
  } catch (error) {
    console.error(`[TMDB Import] Failed to read TMDB IDs: ${error.message}`);
    console.error(`[TMDB Import] Error stack: ${error.stack}`);
    // Preserve the original error instead of wrapping it
    throw error;
  }

  if (!tmdbIds || tmdbIds.length === 0) {
    console.log("[TMDB Import] No TMDB IDs found, aborting");
    return { success: false, message: "No TMDB IDs found" };
  }

  // Reset the import status
  importStatus = {
    isRunning: true,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    totalItems: tmdbIds.length,
    logs: [`Starting import of ${tmdbIds.length} TMDB items`],
    lastUpdated: new Date().toISOString(),
  };

  // In a real implementation, you would start a background process to handle the import
  // For now, we'll call the automated-import function directly
  console.log("[TMDB Import] Setting up call to automated-import function");
  // Add immediate logging to verify execution path
  console.log("[TMDB Import] About to call automated-import function");
  // Log the tmdbIds to verify they're being passed correctly
  console.log(`[TMDB Import] First item: ${JSON.stringify(tmdbIds[0])}`);

  // Call the automated-import function
  const axios = require("axios");
  const siteUrl = process.env.URL || "https://whattowatchapp.netlify.app";
  const importUrl = `${siteUrl}/.netlify/functions/automated-import`;

  console.log(`[TMDB Import] Calling import function at: ${importUrl}`);

  // Make the call asynchronously so we can return immediately
  setTimeout(async () => {
    try {
      console.log("[TMDB Import] Starting processing in timeout");
      // Simulate processing
      importStatus.logs.push("Import process started");
      importStatus.lastUpdated = new Date().toISOString();
      console.log("[TMDB Import] Updated import status with start message");
      console.log("[TMDB Import] Processing items count: " + tmdbIds.length);

      // Call the automated-import function with the TMDB IDs
      try {
        console.log(
          `[TMDB Import] Sending TMDB IDs to import function: ${JSON.stringify(tmdbIds)}`;
        );
        const response = await axios.post(importUrl, {
          startId: "tmdb-batch", // Not used for TMDB import
          count: tmdbIds.length,
          batchSize: 5, // Process 5 at a time to avoid rate limits
          tmdbIds: tmdbIds, // Pass the actual TMDB IDs
          clearExisting: true // Clear existing data before import
        });

        console.log(
          `[TMDB Import] Import function response status: ${response.status}`,
        );
        console.log(
          `[TMDB Import] Import function response: ${JSON.stringify(response.data)}`,
        );

        // Update the status based on the response
        if (response.data && response.data.success) {
          importStatus.logs.push("Import process started successfully");
          importStatus.logs.push(
            `Sent ${tmdbIds.length} items to import function`,
          );
        } else {
          importStatus.logs.push("Import process failed to start");
          importStatus.logs.push(
            `Error: ${response.data?.error || "Unknown error"}`,
          );
          importStatus.isRunning = false;
        }

        importStatus.lastUpdated = new Date().toISOString();
      } catch (error) {
        console.error(`[TMDB Import] Error calling import function:`, error);
        importStatus.logs.push(
          `Error calling import function: ${error.message || "Unknown error"}`,
        );
        importStatus.isRunning = false;
        importStatus.lastUpdated = new Date().toISOString();
      }
    } catch (error) {
      console.error("[TMDB Import] Error in timeout function:", error);
      importStatus.logs.push(
        `Error starting import process: ${error.message || "Unknown error"}`,
      );
      importStatus.lastUpdated = new Date().toISOString();
      importStatus.isRunning = false;
    }
  }, 1000);

  console.log("[TMDB Import] Import process initiated successfully");
  return {
    success: true,
    message: "Import started",
    ...importStatus,
  };
}

// Function to stop the import process
function stopImport() {
  console.log("[TMDB Import] Attempting to stop import process");
  if (!importStatus.isRunning) {
    console.log("[TMDB Import] Import is not running, cannot stop");
    return { success: false, message: "Import is not running" };
  }

  importStatus.isRunning = false;
  importStatus.logs.push("Import process stopped manually");
  importStatus.lastUpdated = new Date().toISOString();
  console.log("[TMDB Import] Import process stopped manually");

  return {
    success: true,
    message: "Import stopped",
    ...importStatus,
  };
}

exports.handler = async (event, context) => {
  console.log("[TMDB Import] Received request to automated-import-control");
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
    // Parse request body
    console.log("[TMDB Import] Parsing request body");
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      console.error("[TMDB Import] Error parsing request body:", parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid JSON in request body",
          details: parseError.message,
        }),
      };
    }

    const { action } = requestBody;
    console.log(`[TMDB Import] Received action: ${action}`);

    if (!action) {
      console.log("[TMDB Import] Missing required parameter: action");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required parameter: action" }),
      };
    }

    let result;
    if (action === "start") {
      try {
        result = await startImport();
      } catch (importError) {
        console.error("[TMDB Import] Error starting import:", importError);
        console.error(`[TMDB Import] Error stack: ${importError.stack}`);

        // Provide more detailed error information
        let errorDetails = "Failed to start TMDB import process";

        // Check for specific error types
        if (
          importError.message &&
          importError.message.includes("Data file not found")
        ) {
          errorDetails =
            "TMDB IDs file not found. Please ensure src/data/tmdbIds.json exists and is accessible.";
        } else if (
          importError.message &&
          importError.message.includes("parse")
        ) {
          errorDetails =
            "TMDB IDs file contains invalid JSON. Please check the file format.";
        } else if (importError.code === "ENOENT") {
          errorDetails = `File not found: ${importError.path || "unknown path"}. Please check file paths.`;
        }

        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: importError.message || "Error starting import",
            stack: importError.stack,
            details: errorDetails,
            code: importError.code || "UNKNOWN_ERROR",
          }),
        };
      }
    } else if (action === "stop") {
      result = stopImport();
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid action: ${action}` }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("[TMDB Import] Error processing request:", error);
    console.error(`[TMDB Import] Error stack: ${error.stack}`);

    // Enhanced error response
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Internal server error",
        stack: error.stack,
        details: "Failed to process TMDB import request",
        code: error.code || "UNKNOWN_ERROR",
        path: error.path || undefined,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};