exports.handler = async function (event, context) {
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
    // Check for environment variables (without revealing their values)
    const envVars = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "Set" : "Not set",
      GEMINI_API_ENDPOINT: process.env.GEMINI_API_ENDPOINT ? "Set" : "Not set",
      GEMINI_MAX_TOKENS: process.env.GEMINI_MAX_TOKENS ? "Set" : "Not set",
      GEMINI_TEMPERATURE: process.env.GEMINI_TEMPERATURE ? "Set" : "Not set",
      NODE_ENV: process.env.NODE_ENV || "Not set",
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "Environment check completed",
        environment: envVars,
        nodeVersion: process.version,
        functionRegion: process.env.AWS_REGION || "Unknown",
      }),
    };
  } catch (error) {
    console.error("Error checking environment:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error checking environment",
        message: error.message,
      }),
    };
  }
};
