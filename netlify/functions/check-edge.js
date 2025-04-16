// Simple function to check if edge functions are available
exports.handler = async function (event, context) {
  try {
    // Try to fetch from our edge function
    const response = await fetch("https://api.netlify.com/api/v1/sites");
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Edge function check",
        edgeFunctionPath: "/.netlify/edge-functions/omdb-edge",
        netlifyEnv: process.env.NETLIFY || "not set",
        context: context ? JSON.stringify(context) : "not available",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
