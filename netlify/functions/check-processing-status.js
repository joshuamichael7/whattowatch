// Netlify function to check the status of recommendation processing

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Define the status file path
    const STATUS_FILE_PATH = "/tmp/recommendation_processing_status.json";
    const fs = require("fs");

    // Default status
    const defaultStatus = {
      isRunning: false,
      processed: 0,
      successful: 0,
      failed: 0,
      total: 0,
      lastUpdated: new Date().toISOString(),
      logs: [],
    };

    // Read status from file if it exists
    let status = defaultStatus;
    try {
      if (fs.existsSync(STATUS_FILE_PATH)) {
        const fileContent = fs.readFileSync(STATUS_FILE_PATH, "utf8");
        status = JSON.parse(fileContent);
      }
    } catch (readError) {
      console.error("Error reading status file:", readError);
    }

    // Check if the process is still running by looking at the last update time
    const lastUpdated = new Date(status.lastUpdated);
    const now = new Date();
    const timeDiffMinutes =
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

    // If the status says it's running but hasn't been updated in 5 minutes, assume it's stopped
    if (status.isRunning && timeDiffMinutes > 5) {
      status.isRunning = false;
      status.logs.push(
        "Processing appears to have stopped (no updates in 5+ minutes)",
      );

      // Write updated status back to file
      try {
        fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(status), "utf8");
      } catch (writeError) {
        console.error("Error writing status file:", writeError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(status),
    };
  } catch (error) {
    console.error("Error checking processing status:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
