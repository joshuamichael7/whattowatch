import { ContentItem } from "@/types/omdb";
import axios from "axios";

/**
 * Process user preferences to get personalized recommendations
 * @param preferences User preferences from quiz
 * @param limit Maximum number of recommendations to return
 * @returns Array of verified ContentItem recommendations
 */
export async function getPersonalizedRecommendations(
  preferences: any,
  limit: number = 10,
): Promise<ContentItem[]> {
  console.log(
    "[getPersonalizedRecommendations] Starting with preferences:",
    preferences,
  );

  // Step 1: Get AI recommendations based on preferences
  const aiRecommendations = await getAiRecommendations(preferences, limit * 2);
  console.log(
    `[getPersonalizedRecommendations] Received ${aiRecommendations.length} AI recommendations`,
  );

  // Step 2: Verify all recommendations with OMDB
  const verifiedRecommendations =
    await verifyAllRecommendations(aiRecommendations);
  console.log(
    `[getPersonalizedRecommendations] Successfully verified ${verifiedRecommendations.length} recommendations`,
  );

  // Return the verified recommendations (limited to requested amount)
  return verifiedRecommendations.slice(0, limit);
}

/**
 * Get recommendations from AI based on user preferences
 * @param preferences User preferences from quiz
 * @param limit Maximum number of recommendations to request
 * @returns Array of raw AI recommendations
 */
async function getAiRecommendations(
  preferences: any,
  limit: number,
): Promise<any[]> {
  try {
    console.log(
      "[getAiRecommendations] Sending preferences to AI service:",
      preferences,
    );

    // Call the Netlify function to get AI recommendations
    const response = await fetch("/.netlify/functions/ai-recommendations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences,
        limit,
        forceAi: true,
        skipImdbId: true, // We'll verify IDs ourselves
      }),
    });

    if (!response.ok) {
      throw new Error(
        `AI recommendations API returned status: ${response.status}`,
      );
    }

    // Get the raw response text for logging
    const responseText = await response.text();
    console.log("[getAiRecommendations] Raw AI response text:", responseText);

    // Parse the response manually
    const data = JSON.parse(responseText);

    // Log the raw recommendations for debugging
    console.log("========== RAW AI RECOMMENDATIONS ==========");
    console.log(JSON.stringify(data.recommendations?.slice(0, 3), null, 2));
    console.log("===========================================");

    if (!data.recommendations || !Array.isArray(data.recommendations)) {
      console.error(
        "[getAiRecommendations] Invalid response format from AI service",
      );
      return [];
    }

    return data.recommendations;
  } catch (error) {
    console.error(
      "[getAiRecommendations] Error getting AI recommendations:",
      error,
    );
    return [];
  }
}

/**
 * Search OMDB API by title
 * @param query Search query (title with optional year)
 * @returns Array of search results or null if none found
 */
async function searchOmdb(query: string): Promise<any[] | null> {
  try {
    const response = await fetch(
      `/.netlify/functions/omdb?s=${encodeURIComponent(query)}`,
    );

    if (!response.ok) {
      console.error(
        `[searchOmdb] OMDB search failed for "${query}": ${response.status}`,
      );
      return null;
    }

    // Get the raw response text for logging
    const responseText = await response.text();
    console.log(
      `[searchOmdb] Raw OMDB response for "${query}": ${responseText}`,
    );

    // Parse the response manually
    const data = JSON.parse(responseText);

    if (data.Response !== "True" || !data.Search || data.Search.length === 0) {
      console.log(`[searchOmdb] No results found for "${query}"`);
      return null;
    }

    return data.Search;
  } catch (error) {
    console.error(`[searchOmdb] Error searching OMDB for "${query}":`, error);
    return null;
  }
}

/**
 * Get detailed content information from OMDB by IMDB ID
 * @param imdbId IMDB ID
 * @returns Detailed content data or null if not found
 */
async function getOmdbDetails(imdbId: string): Promise<any | null> {
  try {
    const response = await fetch(
      `/.netlify/functions/omdb?i=${imdbId}&plot=full`,
    );

    if (!response.ok) {
      console.error(
        `[getOmdbDetails] OMDB details failed for ID ${imdbId}: ${response.status}`,
      );
      return null;
    }

    // Get the raw response text for logging
    const responseText = await response.text();
    console.log(
      `[getOmdbDetails] Raw OMDB details for ID ${imdbId}: ${responseText}`,
    );

    // Parse the response manually
    const data = JSON.parse(responseText);

    if (data.Response !== "True") {
      console.log(`[getOmdbDetails] No details found for ID ${imdbId}`);
      return null;
    }

    // Log the Rated field specifically
    console.log(`[getOmdbDetails] Content rating for ${data.Title}:`, {
      hasRated: "Rated" in data,
      ratedValue: data.Rated,
      ratedType: typeof data.Rated,
    });

    // If Rated field is missing, add a default one
    if (!("Rated" in data)) {
      console.log(
        `[getOmdbDetails] Adding default Rated field to ${data.Title}`,
      );
      data.Rated = "Not Rated";
    }

    return data;
  } catch (error) {
    console.error(
      `[getOmdbDetails] Error getting details for ID ${imdbId}:`,
      error,
    );
    return null;
  }
}

// Placeholder for the next implementation phase
export async function verifyAllRecommendations(
  recommendations: any[],
): Promise<ContentItem[]> {
  // This will be implemented in the next phase
  console.log(
    `[verifyAllRecommendations] Processing ${recommendations.length} recommendations`,
  );
  return [];
}
