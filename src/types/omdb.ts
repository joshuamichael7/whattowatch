// Types for OMDB and TMDB API responses and our application's content model

// Basic content item structure used throughout the application
export interface ContentItem {
  // Core fields
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
  genre_strings?: string[]; // Actual genre names
  overview: string;
  runtime?: string | number; // Changed to accept both string and number values
  content_rating?: string;
  streaming_providers?: Record<string, any> | null;
  popularity?: number;

  // Similarity features
  plotSimilarity?: number;
  keywordSimilarity?: number;
  titleSimilarity?: number;
  combinedSimilarity?: number;
  keywords?: string[];
  recommendationSource?: string;
  recommendationReason?: string;
  isTrendingFallback?: boolean;
  isErrorFallback?: boolean;
  aiRecommended?: boolean;
  aiSimilarityScore?: number;

  // Additional fields for recommendation display
  year?: string;
  poster?: string;
  rating?: number;
  genres?: string[];
  synopsis?: string;
  streamingOn?: string[];
  contentRating?: string;

  // IMDB specific fields
  imdb_id?: string;
  imdb_url?: string; // Added for storing IMDB URL

  // TMDB specific fields
  tmdb_id?: string;
  tagline?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  original_language?: string;

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

  // Common fields for both APIs
  writer?: string;
  language?: string;
  country?: string;
  plot?: string;
  director?: string;
  actors?: string;

  // Verification fields
  verified?: boolean;
  similarityScore?: number;
  needsVerification?: boolean;
  needsUserSelection?: boolean;
  potentialMatches?: any[];
  verificationError?: string;
  lowConfidenceMatch?: boolean;
  lowSimilarity?: boolean;
  fuzzySearch?: boolean;
  originalAiData?: any;
  reason?: string;
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

import { genreIdToName } from "../lib/utils";

// Genre mapping for display purposes
export const genreMap: Record<number, string> = genreIdToName;

// TMDB API response types
export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchItem[];
  total_results: number;
  total_pages: number;
}

export interface TmdbSearchItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type?: "movie" | "tv" | "person";
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  overview: string;
  popularity: number;
  original_language: string;
  adult?: boolean;
}

export interface TmdbMovieDetails {
  id: number;
  imdb_id: string;
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  overview: string;
  tagline: string;
  status: string;
  original_language: string;
  budget: number;
  revenue: number;
  adult: boolean;
  genres: {
    id: number;
    name: string;
  }[];
  production_companies: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  production_countries: {
    iso_3166_1: string;
    name: string;
  }[];
  spoken_languages: {
    english_name: string;
    iso_639_1: string;
    name: string;
  }[];
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }[];
    crew: {
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }[];
  };
  "watch/providers"?: {
    results: {
      [country: string]: {
        link: string;
        flatrate?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
          display_priority: number;
        }[];
        rent?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
          display_priority: number;
        }[];
        buy?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
          display_priority: number;
        }[];
      };
    };
  };
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  episode_run_time: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  overview: string;
  tagline: string;
  status: string;
  original_language: string;
  number_of_seasons: number;
  number_of_episodes: number;
  adult: boolean;
  genres: {
    id: number;
    name: string;
  }[];
  created_by: {
    id: number;
    name: string;
    profile_path: string | null;
  }[];
  origin_country: string[];
  external_ids?: {
    imdb_id: string;
    tvdb_id: number;
  };
  credits?: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
      order: number;
    }[];
    crew: {
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }[];
  };
  "watch/providers"?: {
    results: {
      [country: string]: {
        link: string;
        flatrate?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
          display_priority: number;
        }[];
        rent?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
          display_priority: number;
        }[];
        buy?: {
          provider_id: number;
          provider_name: string;
          logo_path: string;
          display_priority: number;
        }[];
      };
    };
  };
}
