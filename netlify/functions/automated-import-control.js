// Netlify function to control the TMDB import process
const fs = require("fs");
const path = require("path");

// This would normally connect to a database or other persistent storage
// For now, we'll use a simple in-memory object that's shared with the status endpoint

// Define the path for the status file
// In Netlify Functions, we can use the /tmp directory for temporary storage
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

// Initialize the status from file or default
let importStatus = readStatusFromFile();

// Function to read the TMDB IDs from the static file
async function readTmdbIds() {
  console.log("[TMDB Import] Reading TMDB IDs from data file");
  try {
    // Fetch from the public URL only
    const siteUrl = process.env.URL || "https://whattowatchapp.netlify.app";
    const fileUrl = `${siteUrl}/tmdbIds.json`;

    console.log(`[TMDB Import] Fetching TMDB IDs from URL: ${fileUrl}`);

    // Use axios to get the file from the URL
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

  // Call the background function instead of the regular function
  try {
    console.log("[TMDB Import] Starting background import process");
    importStatus.logs.push("Starting background import process");
    importStatus.lastUpdated = new Date().toISOString();
    writeStatusToFile(importStatus);

    // Call the background function
    const backgroundUrl = `${siteUrl}/.netlify/functions/tmdb-background-import`;
    console.log(
      `[TMDB Import] Calling background function at: ${backgroundUrl}`,
    );

    const response = await axios.post(backgroundUrl, {
      clearExisting: true, // Clear existing data before import
    });

    console.log(
      `[TMDB Import] Background function initiated with status: ${response.status}`,
    );

    importStatus.logs.push("Background import process initiated successfully");
    importStatus.logs.push(
      "This process will continue running even if you close your browser",
    );
    importStatus.lastUpdated = new Date().toISOString();
    writeStatusToFile(importStatus);
  } catch (error) {
    console.error("[TMDB Import] Error starting background process:", error);
    importStatus.logs.push(
      `Error starting background process: ${error.message || "Unknown error"}`,
    );
    importStatus.isRunning = false;
    importStatus.lastUpdated = new Date().toISOString();
    writeStatusToFile(importStatus);
  }

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
  writeStatusToFile(importStatus);
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
