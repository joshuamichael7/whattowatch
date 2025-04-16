// Simple test edge function to verify edge functions are working
export default async (request, context) => {
  try {
    // Get environment variables - handle missing context.env
    const netlifyEnv =
      context && context.env
        ? context.env.get("NETLIFY")
        : process.env.NETLIFY || "not set";
    const contextEnv =
      context && context.env
        ? context.env.get("CONTEXT")
        : process.env.CONTEXT || "not set";
    const omdbApiKey =
      process.env.OMDB_API_KEY ||
      (context && context.env ? context.env.get("OMDB_API_KEY") : null);

    // Test OMDB API with hardcoded key
    let omdbTest = "not tested";
    try {
      const response = await fetch(
        `https://www.omdbapi.com/?apikey=${omdbApiKey || ""}&s=inception&type=movie`,
      );
      const data = await response.json();
      omdbTest =
        data.Response === "True"
          ? "working"
          : "error: " + (data.Error || "unknown error");
    } catch (omdbError) {
      omdbTest = "error: " + omdbError.message;
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
