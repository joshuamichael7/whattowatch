const axios = require("axios");

// Configuration for the Gemini API
const defaultConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
  modelName: "gemini-2.0-flash",
  maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || "1024"),
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || "0.7"),
};

// Helper function to validate recommendations against user preferences
function validateRecommendations(recommendations, preferences) {
  if (!recommendations || !Array.isArray(recommendations)) {
    return [];
  }

  // Extract genres from user preferences
  const preferredGenres = preferences.genres || [];
  const favoriteContent = preferences.favoriteContent || [];

  // Convert to lowercase for case-insensitive matching
  const preferredGenresLower = preferredGenres.map((g) => g.toLowerCase());
  const favoriteContentLower = Array.isArray(favoriteContent)
    ? favoriteContent.map((c) => c.toLowerCase())
    : typeof favoriteContent === "string"
      ? [favoriteContent.toLowerCase()]
      : [];

  // Keywords that indicate documentary content
  const documentaryKeywords = [
    "documentary",
    "historical",
    "educational",
    "factual",
    "informative",
  ];

  // Keywords that indicate comedy/mockumentary content
  const comedyKeywords = [
    "comedy",
    "mockumentary",
    "sitcom",
    "humorous",
    "funny",
    "satire",
  ];

  // Check if user likes mockumentary/comedy content
  const userLikesComedy = favoriteContentLower.some(
    (item) =>
      comedyKeywords.some((keyword) => item.includes(keyword)) ||
      item.includes("the office") ||
      item.includes("parks and rec") ||
      item.includes("modern family") ||
      item.includes("what we do in the shadows"),
  );

  return recommendations.filter((rec) => {
    // Skip recommendations without required fields
    if (!rec.title || !rec.reason) return false;

    const title = rec.title.toLowerCase();
    const reason = rec.reason.toLowerCase();
    const genres =
      rec.genres && Array.isArray(rec.genres)
        ? rec.genres.map((g) => g.toLowerCase())
        : [];

    // Check for genre mismatch - documentary recommended for comedy lovers
    if (
      userLikesComedy &&
      documentaryKeywords.some(
        (keyword) => title.includes(keyword) || reason.includes(keyword),
      ) &&
      !comedyKeywords.some(
        (keyword) => title.includes(keyword) || reason.includes(keyword),
      ) &&
      genres.includes("documentary") &&
      !genres.includes("comedy")
    ) {
      console.log(`Filtering out documentary "${rec.title}" for comedy lover`);
      return false;
    }

    // Ensure the recommendation reason matches the actual content
    if (genres.length > 0 && preferredGenresLower.length > 0) {
      const hasMatchingGenre = genres.some((g) =>
        preferredGenresLower.includes(g),
      );
      if (!hasMatchingGenre) {
        console.log(`Filtering out "${rec.title}" due to genre mismatch`);
        return false;
      }
    }

    return true;
  });
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Parse the request body
    const {
      preferences,
      limit = 10,
      apiVersion,
      modelName,
    } = JSON.parse(event.body || "{}");

    if (!preferences) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing preferences in request body" }),
      };
    }

    // Override config with request parameters if provided
    if (apiVersion) defaultConfig.apiVersion = apiVersion;
    if (modelName) defaultConfig.modelName = modelName;

    // Check if we have a Gemini API key
    if (!defaultConfig.apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Missing Gemini API key in server configuration",
        }),
      };
    }

    // Format preferences for the prompt
    const genresText = preferences.genres.join(", ");
    const favoritesText = Array.isArray(preferences.favoriteContent)
      ? preferences.favoriteContent.join(", ")
      : preferences.favoriteContent || "";
    const avoidText = Array.isArray(preferences.contentToAvoid)
      ? preferences.contentToAvoid.join(", ")
      : preferences.contentToAvoid || "";
    const viewingTimeText =
      preferences.viewingTime < 60
        ? `${preferences.viewingTime} minutes`
        : `${Math.floor(preferences.viewingTime / 60)} hour${preferences.viewingTime >= 120 ? "s" : ""}${preferences.viewingTime % 60 > 0 ? ` ${preferences.viewingTime % 60} minutes` : ""}`;

    // Construct the prompt for Gemini
    const prompt = `I need personalized movie and TV show recommendations based on the following preferences:\n\n
    - Preferred genres: ${genresText || "No specific genres"}\n
    - Current mood: ${preferences.mood}\n
    - Available viewing time: ${viewingTimeText}\n
    - Content they've enjoyed: ${favoritesText || "No examples provided"}\n
    - Content they want to avoid: ${avoidText || "No examples provided"}\n
    - Age/content rating preference: ${preferences.ageRating}\n\n
    Please recommend exactly ${limit} movies or TV shows that match these preferences. For each recommendation, provide:\n
    1. The exact title\n
    2. A brief reason why it matches their preferences (1-2 sentences)\n\n
    Format your response as a JSON array with title and reason properties for each recommendation. Example:\n
    [\n
      {"title": "Movie Title", "reason": "Reason this matches their preferences"},\n
      {"title": "Another Title", "reason": "Another reason"}\n
    ]\n
    \n
    Only return the JSON array, no other text.`;

    // Construct the API endpoint URL
    const apiEndpoint = `https://generativelanguage.googleapis.com/${defaultConfig.apiVersion}/models/${defaultConfig.modelName}:generateContent`;

    console.log(`Using Gemini API endpoint: ${apiEndpoint}`);

    // Make the API request
    const response = await axios.post(
      `${apiEndpoint}?key=${defaultConfig.apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: defaultConfig.maxTokens,
          temperature: defaultConfig.temperature,
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
        `Generated ${recommendations.length} personalized recommendations`,
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ recommendations }),
      };
    } catch (parseError) {
      console.error("Error parsing JSON from Gemini response:", parseError);
      console.log("Raw response:", responseText);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Error parsing AI response",
          rawResponse: responseText,
        }),
      };
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error generating recommendations",
        message: error.message,
      }),
    };
  }
};
