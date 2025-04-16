// Netlify Edge Function to proxy OMDB API requests with lower latency
export default async (request, context) => {
  try {
    // Get the API key from environment variables
    const API_KEY = context.env.get("OMDB_API_KEY");

    if (!API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Missing OMDB API key in server environment variables.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Get query parameters from the request URL
    const url = new URL(request.url);
    const params = url.searchParams;

    // Check if this is a trending request
    if (params.has("trending") && params.get("trending") === "true") {
      // Handle trending content request
      const type = params.get("type") || "movie";
      const limit = parseInt(params.get("limit") || "10");

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
      const omdbParams = new URLSearchParams();
      omdbParams.set("apikey", API_KEY);
      omdbParams.set("s", randomTerm); // Use a better search term
      omdbParams.set("type", type === "movie" ? "movie" : "series");
      omdbParams.set("y", year.toString());

      // Make the request to OMDB API
      const response = await fetch(
        `https://www.omdbapi.com/?${omdbParams.toString()}`,
      );
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // For regular requests, just pass through the parameters
    const searchParams = new URLSearchParams(params);
    searchParams.set("apikey", API_KEY);

    // Make the request to OMDB API
    const response = await fetch(
      `https://www.omdbapi.com/?${searchParams.toString()}`,
    );
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // For CORS support
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Error in OMDB edge function:", error);
    return new Response(
      JSON.stringify({
        error: "Error fetching from OMDB API",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
};
