// Forward the request to OMDB API
try {
  // Build the OMDB API URL with the API key
  const omdbUrl = `https://www.omdbapi.com/?apikey=${apiKey}`;

  // Always ensure we're requesting full plot for complete data including Rated field
  if (!event.queryStringParameters.plot) {
    event.queryStringParameters.plot = "full";
  }

  // Log the full request parameters for debugging
  console.log("OMDB API request parameters:", event.queryStringParameters);

  // Forward the request to OMDB API
  const omdbResponse = await axios.get(omdbUrl, {
    params: event.queryStringParameters,
  });

  // Log the ENTIRE response data to see everything we're getting
  console.log("COMPLETE OMDB API RESPONSE:", JSON.stringify(omdbResponse.data));

  // Log specific fields we're interested in
  console.log("OMDB API response keys:", Object.keys(omdbResponse.data));
  console.log("OMDB API Title:", omdbResponse.data.Title);
  console.log("OMDB API Year:", omdbResponse.data.Year);
  console.log("OMDB API Rated field:", omdbResponse.data.Rated);
  console.log(
    "OMDB API Plot:",
    omdbResponse.data.Plot?.substring(0, 50) + "...",
  );

  // Return the response data
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(omdbResponse.data),
  };
} catch (error) {
  console.error("Error forwarding request to OMDB API:", error);
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ error: "Error forwarding request to OMDB API" }),
  };
}
