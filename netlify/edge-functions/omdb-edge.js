// Netlify Edge Function to proxy OMDB API requests with lower latency
export default async (request, context) => {
  try {
    // Get the API key from environment variables
    const API_KEY = Netlify.env.get("OMDB_API_KEY");

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

    // Add the API key to the parameters
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
