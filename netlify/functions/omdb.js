// Netlify function to proxy OMDB API requests
// This is a fallback for when edge functions aren't available
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
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(data),
      };
    }

    // Add the API key to the parameters
    const searchParams = new URLSearchParams(params);
    searchParams.set("apikey", API_KEY);

    // Log the request URL (with API key redacted)
    console.log(
      `OMDB API Request: ${searchParams.toString().replace(API_KEY, "[REDACTED]")}`,
    );

    // Make the request to OMDB API
    const response = await fetch(
      `https://www.omdbapi.com/?${searchParams.toString()}`,
    );
    const data = await response.json();

    // Log the response data
    console.log(`OMDB API Response Keys: ${Object.keys(data).join(", ")}`);
    if (data.Rated) console.log(`OMDB API Rated field: ${data.Rated}`);
    if (data.Title) console.log(`OMDB API Title: ${data.Title}`);

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
