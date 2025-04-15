// Netlify function to proxy OMDB API requests
exports.handler = async function (event, context) {
  try {
    // Get the API key from environment variables
    const API_KEY = process.env.OMDB_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Missing OMDB API key in server environment variables.",
        }),
      };
    }

    // Get query parameters from the request
    const params = event.queryStringParameters || {};

    // Add the API key to the parameters
    const searchParams = new URLSearchParams(params);
    searchParams.set("apikey", API_KEY);

    // Make the request to OMDB API
    const response = await fetch(
      `https://www.omdbapi.com/?${searchParams.toString()}`,
    );
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // For CORS support
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Error in OMDB function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error fetching from OMDB API",
        message: error.message,
      }),
    };
  }
};
