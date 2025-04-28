// Types for OMDB API responses and our application's content model

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
  genre_strings?: string[]; // Actual genre names from OMDB
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
