// Simple Netlify function to log debug information

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

  console.log(
    "🔍 DEBUG-LOG: Function triggered at " + new Date().toISOString(),
  );
  console.log("🔍 DEBUG-LOG: HTTP Method: " + event.httpMethod);
  console.log("🔍 DEBUG-LOG: Headers: " + JSON.stringify(event.headers));

  try {
    let message = "No message provided";
    let data = {};

    if (event.httpMethod === "POST") {
      try {
        const body = JSON.parse(event.body || "{}");
        message = body.message || message;
        data = body.data || data;
      } catch (parseError) {
        console.error("🔍 DEBUG-LOG: Error parsing request body:", parseError);
      }
    } else if (event.httpMethod === "GET") {
      message = event.queryStringParameters?.message || message;
    }

    console.log(`🔍 DEBUG-LOG: ${message}`);
    if (Object.keys(data).length > 0) {
      console.log("🔍 DEBUG-LOG: Data:", JSON.stringify(data));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Debug log recorded",
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("🔍 DEBUG-LOG: Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
    };
  }
};
