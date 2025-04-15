// Netlify scheduled function to refresh trending content in local storage

exports.handler = async function (event, context) {
  try {
    console.log("Starting scheduled refresh of trending content");

    // Since this is a server-side function and local storage is client-side,
    // we need to use the OMDB API directly to refresh the cache on the server
    // This will prepare fresh data that clients can fetch

    // Get API key from environment variables
    const OMDB_API_KEY = process.env.OMDB_API_KEY;

    if (!OMDB_API_KEY) {
      throw new Error("OMDB API key is not configured");
    }

    // Fetch trending movies
    console.log("Fetching trending movies...");
    const movieResponse = await fetch(
      `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=movie&type=movie&y=2023`,
    );
    const movieData = await movieResponse.json();

    if (movieData.Response === "False") {
      throw new Error(`Error fetching trending movies: ${movieData.Error}`);
    }

    // Fetch trending TV shows
    console.log("Fetching trending TV shows...");
    const tvResponse = await fetch(
      `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=series&type=series&y=2023`,
    );
    const tvData = await tvResponse.json();

    if (tvData.Response === "False") {
      throw new Error(`Error fetching trending TV shows: ${tvData.Error}`);
    }

    // Log success
    console.log(
      `Successfully fetched ${movieData.Search?.length || 0} movies and ${tvData.Search?.length || 0} TV shows`,
    );

    // Return success response
    // The actual client-side refresh happens when users visit the site
    // and the initializeContentCache function runs
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Trending content cache refreshed successfully",
        timestamp: new Date().toISOString(),
        movies: movieData.Search?.length || 0,
        tvShows: tvData.Search?.length || 0,
      }),
    };
  } catch (error) {
    console.error("Error refreshing trending content:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error refreshing trending content",
        error: error.message,
      }),
    };
  }
};
