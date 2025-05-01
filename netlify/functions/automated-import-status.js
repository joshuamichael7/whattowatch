// Netlify function to check the status of the TMDB import process

// This would normally connect to a database or other persistent storage
// For now, we'll use a simple in-memory object that's shared with the import process

// Import the shared state from wherever it's maintained
// This is just a placeholder - in a real implementation, you'd use a database or other persistent storage

// Create a file-based storage for the import status
const fs = require("fs");
const path = require("path");

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

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Read the latest status from the file
    const currentStatus = readStatusFromFile();

    // Check if the import is still running by looking at the last update time
    const lastUpdated = new Date(currentStatus.lastUpdated);
    const now = new Date();
    const timeDiffMinutes =
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

    // If the status says it's running but hasn't been updated in 10 minutes, assume it's stopped
    if (currentStatus.isRunning && timeDiffMinutes > 10) {
      currentStatus.isRunning = false;
      currentStatus.logs.push(
        "Import process appears to have stopped (no updates in 10+ minutes)",
      );
      writeStatusToFile(currentStatus);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(currentStatus),
    };
  } catch (error) {
    console.error("Error getting import status:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
