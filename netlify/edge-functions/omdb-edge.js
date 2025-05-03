// Netlify Edge Function to proxy OMDB API requests with lower latency
export default async (request, context) => {
  // Handle OPTIONS requests for CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    // Get the API key from environment variables
    const API_KEY =
      process.env.OMDB_API_KEY ||
      (context && context.env ? context.env.get("OMDB_API_KEY") : null);

    // Get query parameters from the request URL
    const url = new URL(request.url);
    const params = url.searchParams;

    // Create a search params object for the OMDB API
    const omdbParams = new URLSearchParams();
    omdbParams.set("apikey", API_KEY);

    // Pass through search term if provided, otherwise use default
    if (params.has("s")) {
      omdbParams.set("s", params.get("s"));
    } else if (params.has("i")) {
      omdbParams.set("i", params.get("i"));
    } else {
      omdbParams.set("s", "movie"); // Simple search term that will return results
    }

    // Pass through other common parameters
    for (const param of ["type", "y", "plot", "page"]) {
      if (params.has(param)) {
        omdbParams.set(param, params.get(param));
      }
    }

    // Make the request to OMDB API
    const response = await fetch(
      `https://www.omdbapi.com/?${omdbParams.toString()}`,
      { cf: { cacheTtl: 3600 } }, // Use Cloudflare's cache when possible
    );
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
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
