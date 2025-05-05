// Replace this

// Forward the request to OMDB API
const omdbResponse = await axios.get(omdbUrl, {
  params: event.queryStringParameters,
});

// Log the response data to verify we're getting the Rated field
console.log("OMDB API response keys:", Object.keys(omdbResponse.data));
if (omdbResponse.data.Rated) {
  console.log("OMDB API Rated field:", omdbResponse.data.Rated);
} else {
  console.log("OMDB API Rated field is missing!");
}
