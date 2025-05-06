// Debugging proxy for the OMDB function
exports.handler = async function (event, context) {
  try {
    // Import the original function
    const omdbFunction = require("./omdb");

    // Log the incoming request
    console.log("OMDB Debug - Request received:", {
      method: event.httpMethod,
      path: event.path,
      params: event.queryStringParameters,
    });

    // Call the original function
    const result = await omdbFunction.handler(event, context);

    // Log the response
    console.log("OMDB Debug - Response status:", result.statusCode);
    console.log("OMDB Debug - Response headers:", result.headers);

    // Parse and log the body if it's JSON
    try {
      const bodyData = JSON.parse(result.body);
      console.log("OMDB Debug - Response body keys:", Object.keys(bodyData));

      // Log specific fields we're interested in
      if (bodyData.Search) {
        console.log(
          "OMDB Debug - Search results count:",
          bodyData.Search.length,
        );
      } else if (bodyData.Title) {
        console.log("OMDB Debug - Title:", bodyData.Title);
        console.log("OMDB Debug - Year:", bodyData.Year);
        console.log("OMDB Debug - Rated:", bodyData.Rated);
        console.log(
          "OMDB Debug - Plot:",
          bodyData.Plot
            ? bodyData.Plot.substring(0, 50) + "..."
            : "Not available",
        );
      }
    } catch (parseError) {
      console.log("OMDB Debug - Could not parse response body as JSON");
    }

    // Return the original result unchanged
    return result;
  } catch (error) {
    console.error("OMDB Debug - Error:", error);

    // Return a proper error response
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Error in OMDB debug function",
        message: error.message,
      }),
    };
  }
};
