// Simple test edge function to verify edge functions are working
export default async (request, context) => {
  try {
    // Get environment variables
    const netlifyEnv = context.env.get("NETLIFY") || "not set";
    const contextEnv = context.env.get("CONTEXT") || "not set";
    const omdbApiKey = context.env.get("OMDB_API_KEY") || "not set";

    // Test OMDB API if we have a key
    let omdbTest = "not tested";
    if (omdbApiKey !== "not set") {
      try {
        const response = await fetch(
          `https://www.omdbapi.com/?apikey=${omdbApiKey}&s=inception&type=movie`,
        );
        const data = await response.json();
        omdbTest =
          data.Response === "True"
            ? "working"
            : "error: " + (data.Error || "unknown error");
      } catch (omdbError) {
        omdbTest = "error: " + omdbError.message;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Edge function is working!",
        timestamp: new Date().toISOString(),
        url: request.url,
        method: request.method,
        headers: Object.fromEntries([...request.headers]),
        env: {
          NETLIFY: netlifyEnv,
          CONTEXT: contextEnv,
          OMDB_API_KEY: omdbApiKey ? "present" : "missing",
        },
        omdbTest: omdbTest,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Error in test edge function",
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
