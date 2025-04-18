import axios from "axios";
import { getEnvVar } from "../lib/utils";
import { ContentItem } from "../types/omdb";

// Configuration for the Gemini API
interface GeminiConfig {
  apiKey: string;
  apiEndpoint: string;
  maxTokens?: number;
  temperature?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// Default configuration
const defaultConfig: GeminiConfig = {
  apiKey: getEnvVar("GEMINI_API_KEY"),
  apiEndpoint: getEnvVar(
    "GEMINI_API_ENDPOINT",
    "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
  ),
  maxTokens: parseInt(getEnvVar("GEMINI_MAX_TOKENS", "1024")),
  temperature: parseFloat(getEnvVar("GEMINI_TEMPERATURE", "0.7")),
  maxRetries: parseInt(getEnvVar("GEMINI_MAX_RETRIES", "3")),
  retryDelay: parseInt(getEnvVar("GEMINI_RETRY_DELAY", "1000")),
};

// Rate limiting variables
let requestsInLastMinute = 0;
let lastRequestTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 15000; // Gemini limit

/**
 * Reset the rate limiting counter if a minute has passed
 */
function checkAndResetRateLimit() {
  const now = Date.now();
  if (now - lastRequestTime > 60000) {
    requestsInLastMinute = 0;
    lastRequestTime = now;
  }
}

/**
 * Get similar content titles using Gemini AI
 * @param title The title of the content to find similar items for
 * @param overview The plot/overview of the content
 * @param mediaType The type of media (movie or tv)
 * @param limit The number of similar titles to request
 * @param customConfig Optional custom configuration
 * @returns An array of similar content titles
 */
export async function getSimilarContentTitles(
  title: string,
  overview: string,
  mediaType: "movie" | "tv",
  limit: number = 10,
  customConfig?: Partial<GeminiConfig>,
): Promise<string[]> {
  try {
    // Check rate limiting
    checkAndResetRateLimit();
    if (requestsInLastMinute >= MAX_REQUESTS_PER_MINUTE) {
      console.warn("Rate limit exceeded for Gemini API");
      return [];
    }
    requestsInLastMinute++;

    // Merge default config with custom config
    const config = { ...defaultConfig, ...customConfig };

    if (!config.apiKey) {
      console.error(
        "Missing Gemini API key. Please check your environment variables.",
      );
      return [];
    }

    // Construct the prompt for Gemini
    const prompt = `I'm looking for content similar to "${title}" which is a ${mediaType === "movie" ? "movie" : "TV show"}. 
    Here's the plot: "${overview}"
    
    Please provide exactly ${limit} titles of movies AND TV shows that are similar in plot, themes, tone, and style. 
    Consider factors like genre, setting, character dynamics, and emotional impact.
    
    Return ONLY the titles as a numbered list without any additional text, explanation, or commentary.
    For example:
    1. Title One
    2. Title Two
    etc.`;

    // Make the API request
    const response = await axios.post(
      `${config.apiEndpoint}?key=${config.apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    // Parse the response to extract just the titles
    const responseText = response.data.candidates[0].content.parts[0].text;

    // Extract numbered list items (1. Title, 2. Title, etc.)
    const titles = responseText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s+.+/.test(line)) // Match lines starting with numbers followed by period
      .map((line) => line.replace(/^\d+\.\s+/, "").trim()); // Remove the numbering

    console.log(
      `[aiService] Generated ${titles.length} similar titles for "${title}"`,
    );
    return titles;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return [];
  }
}

/**
 * Generate personalized recommendations based on user preferences
 * @param preferences User preferences from the quiz
 * @param limit Number of recommendations to generate
 * @param customConfig Optional custom configuration
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
  customConfig?: Partial<GeminiConfig>,
): Promise<Array<{ title: string; reason: string }>> {
  try {
    // Check rate limiting
    checkAndResetRateLimit();
    if (requestsInLastMinute >= MAX_REQUESTS_PER_MINUTE) {
      console.warn("Rate limit exceeded for Gemini API");
      return [];
    }
    requestsInLastMinute++;

    // Merge default config with custom config
    const config = { ...defaultConfig, ...customConfig };

    if (!config.apiKey) {
      console.error(
        "Missing Gemini API key. Please check your environment variables.",
      );
      return [];
    }

    // Format preferences for the prompt
    const genresText = preferences.genres.join(", ");
    const favoritesText = preferences.favoriteContent.join(", ");
    const avoidText = preferences.contentToAvoid.join(", ");
    const viewingTimeText =
      preferences.viewingTime < 60
        ? `${preferences.viewingTime} minutes`
        : `${Math.floor(preferences.viewingTime / 60)} hour${preferences.viewingTime >= 120 ? "s" : ""}${preferences.viewingTime % 60 > 0 ? ` ${preferences.viewingTime % 60} minutes` : ""}`;

    // Construct the prompt for Gemini
    const prompt = `I need personalized movie and TV show recommendations based on the following preferences:\n\n    - Preferred genres: ${genresText || "No specific genres"}\n    - Current mood: ${preferences.mood}\n    - Available viewing time: ${viewingTimeText}\n    - Content they've enjoyed: ${favoritesText || "No examples provided"}\n    - Content they want to avoid: ${avoidText || "No examples provided"}\n    - Age/content rating preference: ${preferences.ageRating}\n\n    Please recommend exactly ${limit} movies or TV shows that match these preferences. For each recommendation, provide:\n    1. The exact title\n    2. A brief reason why it matches their preferences (1-2 sentences)\n\n    Format your response as a JSON array with title and reason properties for each recommendation. Example:\n    [\n      {"title": "Movie Title", "reason": "Reason this matches their preferences"},\n      {"title": "Another Title", "reason": "Another reason"}\n    ]\n    \n    Only return the JSON array, no other text.`;

    // Make the API request
    const response = await axios.post(
      `${config.apiEndpoint}?key=${config.apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    // Parse the response to extract the JSON
    const responseText = response.data.candidates[0].content.parts[0].text;

    // Extract JSON from the response (handling potential text before/after the JSON)
    let jsonStr = responseText.trim();

    // Find the start and end of the JSON array
    const startIdx = jsonStr.indexOf("[");
    const endIdx = jsonStr.lastIndexOf("]") + 1;

    if (startIdx >= 0 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx);
    }

    try {
      const recommendations = JSON.parse(jsonStr);
      console.log(
        `[aiService] Generated ${recommendations.length} personalized recommendations`,
      );
      return recommendations;
    } catch (parseError) {
      console.error("Error parsing JSON from Gemini response:", parseError);
      console.log("Raw response:", responseText);
      return [];
    }
  } catch (error) {
    console.error(
      "Error calling Gemini API for personalized recommendations:",
      error,
    );
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
  customConfig?: Partial<GeminiConfig>,
): Promise<{
  similarityScore: number;
  explanation: string;
  commonThemes: string[];
}> {
  try {
    // Check rate limiting
    checkAndResetRateLimit();
    if (requestsInLastMinute >= MAX_REQUESTS_PER_MINUTE) {
      console.warn("Rate limit exceeded for Gemini API");
      return {
        similarityScore: 0,
        explanation: "Rate limit exceeded",
        commonThemes: [],
      };
    }
    requestsInLastMinute++;

    // Merge default config with custom config
    const config = { ...defaultConfig, ...customConfig };

    if (!config.apiKey) {
      console.error(
        "Missing Gemini API key. Please check your environment variables.",
      );
      return {
        similarityScore: 0,
        explanation: "API key missing",
        commonThemes: [],
      };
    }

    // Construct the prompt for Gemini
    const prompt = `Compare these two ${baseContent.media_type === "movie" ? "movies" : "TV shows"} and analyze their similarity:\n\n    FIRST CONTENT:\n    Title: ${baseContent.title}\n    Plot: ${baseContent.overview || "No plot available"}\n    ${baseContent.genre_strings ? `Genres: ${baseContent.genre_strings.join(", ")}` : ""}\n    ${baseContent.release_date ? `Release date: ${baseContent.release_date}` : ""}\n\n    SECOND CONTENT:\n    Title: ${comparisonContent.title}\n    Plot: ${comparisonContent.overview || "No plot available"}\n    ${comparisonContent.genre_strings ? `Genres: ${comparisonContent.genre_strings.join(", ")}` : ""}\n    ${comparisonContent.release_date ? `Release date: ${comparisonContent.release_date}` : ""}\n\n    Analyze their similarity in terms of plot, themes, tone, character dynamics, and overall storytelling approach.\n    \n    Return your analysis as a JSON object with the following properties:\n    1. similarityScore: A number between 0 and 1 representing how similar they are (0 = not similar at all, 1 = extremely similar)\n    2. explanation: A brief explanation of why they are similar or different (2-3 sentences)\n    3. commonThemes: An array of common themes or elements shared between them (3-5 items)\n    \n    Example format:\n    {"similarityScore": 0.75, "explanation": "Both films explore...", "commonThemes": ["theme1", "theme2", "theme3"]}\n    \n    Only return the JSON object, no other text.`;

    // Make the API request
    const response = await axios.post(
      `${config.apiEndpoint}?key=${config.apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    // Parse the response to extract the JSON
    const responseText = response.data.candidates[0].content.parts[0].text;

    // Extract JSON from the response (handling potential text before/after the JSON)
    let jsonStr = responseText.trim();

    // Find the start and end of the JSON object
    const startIdx = jsonStr.indexOf("{");
    const endIdx = jsonStr.lastIndexOf("}") + 1;

    if (startIdx >= 0 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx);
    }

    try {
      const analysis = JSON.parse(jsonStr);
      console.log(
        `[aiService] Generated similarity analysis between "${baseContent.title}" and "${comparisonContent.title}": ${analysis.similarityScore}`,
      );
      return analysis;
    } catch (parseError) {
      console.error("Error parsing JSON from Gemini response:", parseError);
      console.log("Raw response:", responseText);
      return {
        similarityScore: 0.5,
        explanation: "Unable to parse similarity analysis",
        commonThemes: ["unknown"],
      };
    }
  } catch (error) {
    console.error(
      "Error calling Gemini API for content similarity analysis:",
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
