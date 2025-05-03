// Netlify function to proxy OMDB API requests
// This is a fallback for when edge functions aren't available
exports.handler = async function (event, context) {
  // Set CORS headers
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  try {
    // Get the API key from environment variables
    const API_KEY = process.env.OMDB_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Missing OMDB API key in server environment variables.",
        }),
      };
    }

    // Get parameters from query string or request body
    let params = {};

    if (event.httpMethod === "GET") {
      params = event.queryStringParameters || {};
    } else if (event.httpMethod === "POST") {
      try {
        params = JSON.parse(event.body || "{}");
      } catch (error) {
        console.error("Error parsing request body:", error);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid JSON in request body" }),
        };
      }
    }

    // Check if this is a trending request
    if (params.trending === "true") {
      const type = params.type || "movie";
      const limit = parseInt(params.limit || "10");

      // Create a search for recent popular content
      const year = new Date().getFullYear();

      // Use better search terms for trending content
      const popularTerms =
        type === "movie"
          ? ["action", "adventure", "sci-fi", "thriller", "drama"]
          : ["show", "series", "drama", "comedy", "thriller"];

      // Pick a random popular term
      const randomTerm =
        popularTerms[Math.floor(Math.random() * popularTerms.length)];

      // Create a new search params object for the OMDB API
      const searchParams = new URLSearchParams();
      searchParams.set("apikey", API_KEY);
      searchParams.set("s", randomTerm);
      searchParams.set("type", type === "movie" ? "movie" : "series");
      searchParams.set("y", year.toString());

      // Make the request to OMDB API
      const response = await fetch(
        `https://www.omdbapi.com/?${searchParams.toString()}`,
      );
      const data = await response.json();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data),
      };
    }

    // Add the API key to the parameters
    const searchParams = new URLSearchParams();

    // Add all parameters to the search params
    Object.keys(params).forEach((key) => {
      searchParams.set(key, params[key]);
    });

    // Ensure API key is set
    searchParams.set("apikey", API_KEY);

    // Make the request to OMDB API
    const response = await fetch(
      `https://www.omdbapi.com/?${searchParams.toString()}`,
    );
    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Error in OMDB function:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Error fetching from OMDB API",
        message: error.message,
      }),
    };
  }
};
