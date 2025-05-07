// Replace this

// Make the request to OMDB API
const response = await fetch(
  `https://www.omdbapi.com/?${searchParams.toString()}`,
);
const data = await response.json();

// Debug log for content rating
console.log(`OMDB API response for ${searchParams.toString()}:`, {
  hasRated: "Rated" in data,
  ratedValue: data.Rated,
  allKeys: Object.keys(data),
});

// If Rated field is missing, add a default one
if (!("Rated" in data) && data.Response === "True") {
  console.log(`Adding default Rated field to OMDB response`);
  data.Rated = "Not Rated";
}
