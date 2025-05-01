// Netlify function to check the status of the TMDB import process

// This would normally connect to a database or other persistent storage
// For now, we'll use a simple in-memory object that's shared with the import process

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
    // In a real implementation, you would fetch the status from a database or other persistent storage
    // For now, we'll just return the in-memory status

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(importStatus),
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
