// Types for OMDB API responses and our application's content model

// Basic content item structure used throughout the application
export interface ContentItem {
  id: string;
  title: string;
  poster_path: string;
  backdrop_path?: string;
  media_type: "movie" | "tv";
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genre_strings?: string[]; // Actual genre names from OMDB
  overview: string;
  runtime?: number;
  content_rating?: string;
  streaming_providers?: Record<string, any> | null;
  popularity?: number;
  // Additional fields for recommendation display
  year?: string;
  poster?: string;
  rating?: number;
  genres?: string[];
  synopsis?: string;
  streamingOn?: string[];
  recommendationReason?: string;
  contentRating?: string;
  // Fields from OMDB API
  imdbID?: string;
  Type?: string;
  Year?: string;
  Poster?: string;
  Plot?: string;
  Rated?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Actors?: string;
  imdbRating?: string;
}

// OMDB API search response
export interface OmdbSearchResponse {
  Search: OmdbSearchItem[];
  totalResults: string;
  Response: string;
  Error?: string;
}

// OMDB API search item
export interface OmdbSearchItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

// OMDB API detailed item response
export interface OmdbDetailedItem {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: {
    Source: string;
    Value: string;
  }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD?: string;
  BoxOffice?: string;
  Production?: string;
  Website?: string;
  Response: string;
  Error?: string;
}

// Genre mapping for display purposes
export const genreMap: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};
