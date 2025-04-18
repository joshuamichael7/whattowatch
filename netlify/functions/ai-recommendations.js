const axios = require("axios");

// Configuration for the Gemini API
const defaultConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  apiEndpoint:
    process.env.GEMINI_API_ENDPOINT ||
    "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
  maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || "1024"),
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || "0.7"),
};

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
    const { preferences, limit = 10 } = JSON.parse(event.body || "{}");

    if (!preferences) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing preferences in request body" }),
      };
    }

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

    // Make the API request
    const response = await axios.post(
      `${defaultConfig.apiEndpoint}?key=${defaultConfig.apiKey}`,
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
