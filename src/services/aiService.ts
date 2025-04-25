import axios from "axios";
import { getEnvVar } from "../lib/utils";
import { ContentItem } from "../types/omdb";

/**
 * Get similar content titles using Gemini AI via Netlify function
 * @param title The title of the content to find similar items for
 * @param overview The plot/overview of the content
 * @param mediaType The type of media (movie or tv)
 * @param limit The number of similar titles to request
 * @returns An array of similar content titles with reasoning
 */
export async function getSimilarContentTitles(
  title: string,
  overview: string,
  mediaType: "movie" | "tv",
  limit: number = 10,
): Promise<
  Array<{ title: string; reason: string; imdb_id?: string; year?: string }>
> {
  try {
    console.log("[aiService] Using Netlify function for similar content");
    const response = await axios.post(
      "/.netlify/functions/similar-content",
      {
        title,
        overview,
        mediaType,
        limit,
        apiVersion: "v1beta",
        modelName: "gemini-2.0-flash",
        includeReasoning: true, // Request reasoning for each recommendation
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (
      response.data &&
      response.data.recommendations &&
      Array.isArray(response.data.recommendations)
    ) {
      console.log(
        `[aiService] Received ${response.data.recommendations.length} similar titles with reasoning from Netlify function`,
      );
      return response.data.recommendations;
    } else if (
      response.data &&
      response.data.titles &&
      Array.isArray(response.data.titles)
    ) {
      // Backward compatibility with old API format
      console.log(
        `[aiService] Received ${response.data.titles.length} similar titles from Netlify function (old format)`,
      );
      return response.data.titles.map((title: string) => ({
        title,
        reason: "Similar content based on genre and themes",
      }));
    }

    console.log(
      "[aiService] Netlify function didn't return valid recommendations",
    );
    return [];
  } catch (error) {
    console.error("[aiService] Error using Netlify function:", error);
    return [];
  }
}

/**
 * Generate personalized recommendations based on user preferences
 * @param preferences User preferences from the quiz
 * @param limit Number of recommendations to generate
 * @returns Array of recommended movie/show titles with reasoning
 */
export async function getPersonalizedRecommendations(
  preferences: {
    genres: string[];
    mood: string;
    viewingTime: number;
    favoriteContent: string[];
    contentToAvoid: string[];
    ageRating: string;
  },
  limit: number = 10,
): Promise<
  Array<{ title: string; reason: string; imdb_id?: string; year?: string }>
> {
  try {
    console.log("[aiService] Using Netlify function for recommendations");
    const response = await axios.post(
      "/.netlify/functions/ai-recommendations",
      {
        preferences,
        limit,
        apiVersion: "v1beta",
        modelName: "gemini-2.0-flash",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data && response.data.recommendations) {
      console.log(
        `[aiService] Received ${response.data.recommendations.length} recommendations from Netlify function`,
      );
      return response.data.recommendations;
    }

    console.log(
      "[aiService] Netlify function didn't return valid recommendations",
    );
    return [];
  } catch (error) {
    console.error("[aiService] Error using Netlify function:", error);
    return [];
  }
}

/**
 * Analyze content similarity between two items
 * @param baseContent The base content item
 * @param comparisonContent The content to compare with
 * @returns Similarity analysis with score and explanation
 */
export async function analyzeContentSimilarity(
  baseContent: ContentItem,
  comparisonContent: ContentItem,
): Promise<{
  similarityScore: number;
  explanation: string;
  commonThemes: string[];
}> {
  try {
    console.log(
      "[aiService] Using Netlify function for content similarity analysis",
    );
    const response = await axios.post(
      "/.netlify/functions/calculate-similarity",
      {
        baseContent,
        comparisonContent,
        apiVersion: "v1beta",
        modelName: "gemini-2.0-flash",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data && response.data.analysis) {
      console.log(
        `[aiService] Received similarity analysis between "${baseContent.title}" and "${comparisonContent.title}": ${response.data.analysis.similarityScore}`,
      );
      return response.data.analysis;
    }

    console.log("[aiService] Netlify function didn't return valid analysis");
    return {
      similarityScore: 0,
      explanation: "Error analyzing content similarity",
      commonThemes: [],
    };
  } catch (error) {
    console.error(
      "Error calling Netlify function for content similarity analysis:",
      error,
    );
    return {
      similarityScore: 0,
      explanation: "Error analyzing content similarity",
      commonThemes: [],
    };
  }
}

/**
 * Store content data in the vector database
 */
export async function storeContentInVectorDB(
  contentData: ContentItem,
): Promise<boolean> {
  try {
    // Import dynamically to avoid circular dependencies
    const { storeContentVector } = await import("./vectorService");
    return await storeContentVector(contentData);
  } catch (error) {
    console.error("[aiService] Error storing content in vector DB:", error);
    return false;
  }
}
