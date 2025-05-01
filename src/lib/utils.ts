import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to safely access environment variables
export function getEnvVar(key: string, defaultValue: string = ""): string {
  // For sensitive keys like API keys, we should only access them server-side
  // and not expose them to the client
  if (
    key === "GEMINI_API_KEY" ||
    key.includes("API_KEY") ||
    key.includes("SECRET")
  ) {
    // These keys should only be accessed via server-side functions
    console.log(
      `[getEnvVar] Sensitive key ${key} requested, using Netlify function instead`,
    );
    return defaultValue;
  }

  // For non-sensitive environment variables, we can use the client-side approach
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const viteKey = `VITE_${key}`;
    if (viteKey in import.meta.env) {
      return import.meta.env[viteKey] || defaultValue;
    }
    if (key in import.meta.env) {
      return import.meta.env[key] || defaultValue;
    }
  }

  // Fallback to process.env for server-side
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] || defaultValue;
  }

  console.log(`[getEnvVar] Env var ${key} not found, using default value`);
  return defaultValue;
}

// Explicit genre mapping with consistent IDs
export const genreMapping: Record<string, number> = {
  // Movie genres
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Science Fiction": 878,
  "Sci-Fi": 878, // Alias for Science Fiction
  "TV Movie": 10770,
  Thriller: 53,
  War: 10752,
  Western: 37,

  // TV genres
  "Action & Adventure": 10759,
  Kids: 10762,
  News: 10763,
  Reality: 10764,
  "Sci-Fi & Fantasy": 10765,
  Soap: 10766,
  Talk: 10767,
  "War & Politics": 10768,

  // Additional common genres from OMDB that might not be in the standard list
  Biography: 36001, // Custom ID
  Sport: 36002,
  Musical: 36003,
  Short: 36004,
  Adult: 36005,
  "Film-Noir": 36006,
  "Game-Show": 36007,
  "Talk-Show": 36008,
};

// Reverse mapping to get genre name from ID
export const genreIdToName: Record<number, string> = Object.entries(
  genreMapping,
).reduce(
  (acc, [name, id]) => {
    // Only add the first occurrence of each ID to avoid duplicates
    if (!acc[id]) {
      acc[id] = name;
    }
    return acc;
  },
  {} as Record<number, string>,
);

// Helper function to map genre strings to IDs
export function mapGenreStringsToIds(genreStrings: string[]): number[] {
  if (
    !genreStrings ||
    !Array.isArray(genreStrings) ||
    genreStrings.length === 0
  ) {
    return [];
  }

  return genreStrings
    .map((genre) => {
      const normalizedGenre = genre.trim();
      const genreId = genreMapping[normalizedGenre];

      if (genreId === undefined) {
        console.log(`[mapGenreStringsToIds] Unknown genre: ${normalizedGenre}`);
        return null;
      }

      return genreId;
    })
    .filter((id): id is number => id !== null);
}

/**
 * Sleep function to pause execution for a specified number of milliseconds
 * @param ms Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
