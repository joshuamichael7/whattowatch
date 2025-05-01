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
function readTmdbIds() {
  try {
    // In a real implementation, you would read from a file in a persistent location
    // For now, we'll just return a hardcoded array
    return [
      {
        adult: false,
        id: 16523,
        original_title: "Where the Wild Things Are",
        popularity: 2.7677,
        video: false,
      },
      {
        adult: false,
        id: 16524,
        original_title: "A Time to Revenge",
        popularity: 1.3397,
        video: false,
      },
      {
        adult: false,
        id: 16526,
        original_title: "Clowning Around",
        popularity: 0.954,
        video: false,
      },
      {
        adult: false,
        id: 16527,
        original_title: "Mister Jerico",
        popularity: 0.6,
        video: false,
      },
      {
        adult: false,
        id: 16528,
        original_title: "Mister Moses",
        popularity: 1.4,
        video: false,
      },
      {
        adult: false,
        id: 16529,
        original_title: "Mister Roberts",
        popularity: 2.558,
        video: false,
      },
      {
        adult: false,
        id: 16530,
        original_title: "Mister Scoutmaster",
        popularity: 0.6,
        video: false,
      },
      {
        adult: false,
        id: 16531,
        original_title: "Mistress",
        popularity: 1.4,
        video: false,
      },
      {
        adult: false,
        id: 16532,
        original_title: "Misty",
        popularity: 1.4,
        video: false,
      },
      {
        adult: false,
        id: 16533,
        original_title: "Mitchell",
        popularity: 1.4,
        video: false,
      },
    ];
  } catch (error) {
    console.error("Error reading TMDB IDs:", error);
    return [];
  }
}

// Function to start the import process
async function startImport() {
  if (importStatus.isRunning) {
    return { success: false, message: "Import is already running" };
  }

  // Read the TMDB IDs
  const tmdbIds = readTmdbIds();
  if (tmdbIds.length === 0) {
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
  // For now, we'll just simulate it with a timeout
  setTimeout(() => {
    // Simulate processing
    importStatus.logs.push("Import process started");
    importStatus.lastUpdated = new Date().toISOString();

    // This would be replaced with actual processing logic
    // For now, we'll just simulate it with random success/failure
    for (let i = 0; i < tmdbIds.length; i++) {
      setTimeout(() => {
        const item = tmdbIds[i];
        importStatus.processed++;

        // Simulate random success/failure
        const success = Math.random() > 0.2; // 80% success rate
        if (success) {
          importStatus.successful++;
          importStatus.logs.push(
            `Successfully processed ID ${item.id}: ${item.original_title}`,
          );
        } else {
          importStatus.failed++;
          importStatus.logs.push(
            `Failed to process ID ${item.id}: ${item.original_title}`,
          );
        }

        importStatus.lastUpdated = new Date().toISOString();

        // Check if we're done
        if (importStatus.processed >= importStatus.totalItems) {
          importStatus.isRunning = false;
          importStatus.logs.push("Import process completed");
          importStatus.lastUpdated = new Date().toISOString();
        }
      }, i * 2000); // Process one item every 2 seconds
    }
  }, 1000);

  return {
    success: true,
    message: "Import started",
    ...importStatus,
  };
}

// Function to stop the import process
function stopImport() {
  if (!importStatus.isRunning) {
    return { success: false, message: "Import is not running" };
  }

  importStatus.isRunning = false;
  importStatus.logs.push("Import process stopped manually");
  importStatus.lastUpdated = new Date().toISOString();

  return {
    success: true,
    message: "Import stopped",
    ...importStatus,
  };
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
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { action } = requestBody;

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required parameter: action" }),
      };
    }

    let result;
    if (action === "start") {
      result = await startImport();
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
    console.error("Error processing request:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
