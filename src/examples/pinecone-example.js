// Example of how data is structured for Pinecone upsert

// Original OMDB record
const omdbRecord = {
  Title: "My Mister",
  Year: "2018",
  Rated: "TV-14",
  Released: "03 Nov 2020",
  Runtime: "1 min",
  Genre: "Drama, Family",
  Director: "N/A",
  Writer: "N/A",
  Actors: "Lee Sun-kyun, IU, Lee Ji-ah",
  Plot: "A man in his 40s withstands the weight of life. A woman in her 20s goes through different experiences, but also withstands the weight of her life. The man and woman get together to help each other.",
  Language: "Korean",
  Country: "South Korea",
  Awards: "4 wins & 6 nominations total",
  Poster:
    "https://m.media-amazon.com/images/M/MV5BMjFkYzIwMTctYzljYS00M2RiLTlhNmItZDM3MjFiOTFiOTY5XkEyXkFqcGc@._V1_SX300.jpg",
  Ratings: [{ Source: "Internet Movie Database", Value: "9.0/10" }],
  Metascore: "N/A",
  imdbRating: "9.0",
  imdbVotes: "11,606",
  imdbID: "tt7923710",
  Type: "series",
  totalSeasons: "1",
  Response: "True",
};

// Structured for Pinecone upsert
const pineconeVector = {
  // Use IMDB ID as the primary identifier
  id: omdbRecord.imdbID,

  // Metadata: All fields converted to strings for Pinecone
  metadata: {
    title: omdbRecord.Title,
    year: omdbRecord.Year,
    type: omdbRecord.Type,
    rated: omdbRecord.Rated,
    released: omdbRecord.Released,
    runtime: omdbRecord.Runtime,
    genre: omdbRecord.Genre,
    director: omdbRecord.Director,
    writer: omdbRecord.Writer,
    actors: omdbRecord.Actors,
    plot: omdbRecord.Plot,
    language: omdbRecord.Language,
    country: omdbRecord.Country,
    awards: omdbRecord.Awards,
    poster: omdbRecord.Poster,
    metascore: omdbRecord.Metascore,
    imdbRating: omdbRecord.imdbRating,
    imdbVotes: omdbRecord.imdbVotes,
    totalSeasons: omdbRecord.totalSeasons,
  },

  // Text field for generating embeddings
  text: [
    `Title: ${omdbRecord.Title}`,
    `Type: ${omdbRecord.Type}`,
    `Year: ${omdbRecord.Year}`,
    `Plot: ${omdbRecord.Plot}`,
    `Genre: ${omdbRecord.Genre}`,
    `Director: ${omdbRecord.Director !== "N/A" ? omdbRecord.Director : ""}`,
    `Writer: ${omdbRecord.Writer !== "N/A" ? omdbRecord.Writer : ""}`,
    `Actors: ${omdbRecord.Actors}`,
    `Language: ${omdbRecord.Language}`,
    `Country: ${omdbRecord.Country}`,
    `Awards: ${omdbRecord.Awards}`,
    `Released: ${omdbRecord.Released}`,
    `Runtime: ${omdbRecord.Runtime}`,
    `Rated: ${omdbRecord.Rated}`,
    `IMDb Rating: ${omdbRecord.imdbRating}`,
    `Total Seasons: ${omdbRecord.totalSeasons}`,
  ]
    .filter((line) => !line.endsWith(": ") && !line.endsWith(": N/A"))
    .join("\n"),
};

// This is what would be sent to Pinecone
console.log("Vector ID:", pineconeVector.id);
console.log("Metadata sample:", Object.keys(pineconeVector.metadata));
console.log("Text for embedding:", pineconeVector.text);

// Example of how this would be used in the code:
/*
const formattedVectors = [pineconeVector];
await index.upsert(formattedVectors);
*/
