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
      mediaType = "movie",
      limit = 20,
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
    const prompt = `I need personalized movie and TV show recommendations based on the following preferences:\\n\\n\n    - Preferred genres: ${genresText || "No specific genres"}\\n\n    - Current mood: ${preferences.mood}\\n\n    - Available viewing time: ${viewingTimeText}\\n\n    - Content they've enjoyed: ${favoritesText || "No examples provided"}\\n\n    - Content they want to avoid: ${avoidText || "No examples provided"}\\n\n    - Age/content rating preference: ${preferences.ageRating}\\n\\n\n    Please recommend exactly ${limit} movies or TV shows that match these preferences. For each recommendation, provide:\\n\n    1. The exact title as it appears in IMDB\\n\n    2. The year of release (just the 4-digit year)\\n\n    3. A brief reason why it matches their preferences (1-2 sentences)\\n\n    4. A brief synopsis of the plot (1-2 sentences)\\n\\n\n    Format your response as a JSON array with title, year, reason, and synopsis properties for each recommendation. Example:\\n\n    [\\n\n      {\"title\": \"The Shawshank Redemption\", \"year\": \"1994\", \"reason\": \"A powerful drama about hope and redemption that matches your preference for thoughtful storytelling.\", \"synopsis\": \"Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.\"},\\n\n      {\"title\": \"Inception\", \"year\": \"2010\", \"reason\": \"A mind-bending sci-fi thriller that aligns with your interest in complex narratives.\", \"synopsis\": \"A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.\"}\\n\n    ]\\n\n    \\n\n    IMPORTANT: Make sure the titles are accurate and match real movies or TV shows.\\n\n    Only return the JSON array, no other text.`;

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

    // Extract the generated text from the response
    const responseText = response.data.candidates[0].content.parts[0].text;

    // Log the raw response for debugging
    console.log(
      "Raw response from Gemini API (first 100 chars):",
      responseText.substring(0, 100) + "...",
    );

    // Extract JSON from the response
    let extractedJson = null;

    // Try to find JSON array directly - this should be the most common case
    const jsonArrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/s);
    if (jsonArrayMatch) {
      extractedJson = jsonArrayMatch[0].trim();
    } else {
      // Try to find JSON in code blocks
      const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        extractedJson = codeBlockMatch[1].trim();
      } else {
        // Try to find JSON with another pattern
        const jsonObjMatch = responseText.match(
          /\{\s*"recommendations"\s*:\s*\[[\s\S]*\]\s*\}/s,
        );
        if (jsonObjMatch) {
          extractedJson = jsonObjMatch[0].trim();
        }
      }
    }

    if (extractedJson) {
      console.log(
        `Extracted JSON (first 100 chars): ${extractedJson.substring(0, 100)}...`,
      );

      try {
        const parsedData = JSON.parse(extractedJson);
        const recommendations = Array.isArray(parsedData)
          ? parsedData
          : parsedData.recommendations;

        if (recommendations && recommendations.length > 0) {
          console.log(
            `Generated ${recommendations.length} personalized recommendations`,
          );

          // Validate recommendations against user preferences
          const validatedRecommendations = validateRecommendations(
            recommendations,
            preferences,
          );

          if (validatedRecommendations.length > 0) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                recommendations: validatedRecommendations,
              }),
            };
          } else {
            console.log("No recommendations passed validation");
            // Fall through to error handling
          }
        } else {
          console.error("No recommendations found in parsed data");
        }
      } catch (parseError) {
        console.error("Error parsing JSON from Gemini response:", parseError);
        console.log(
          "Raw response (first 500 chars):",
          responseText.substring(0, 500),
        );

        // Continue to fallback methods
      }
    }

    // If we get here, we couldn't extract valid JSON
    console.error("No valid JSON found in response text");

    // Try to manually extract recommendations as a last resort
    try {
      const manualItems = [];
      const lines = responseText.split("\n");

      for (const line of lines) {
        // Look for patterns like: {"title": "Movie Name", "year": "2021", "reason": "...", "synopsis": "..."},
        if (line.includes('"title"') && line.includes('"reason"')) {
          const titleMatch = line.match(/"title"\s*:\s*"([^"]+)"/);
          const yearMatch = line.match(/"year"\s*:\s*"([^"]+)"/);
          const imdbMatch = line.match(/"imdb_id"\s*:\s*"([^"]+)"/);
          const directorMatch = line.match(/"director"\s*:\s*"([^"]+)"/);
          const actorsMatch = line.match(/"actors"\s*:\s*"([^"]+)"/);
          const reasonMatch = line.match(/"reason"\s*:\s*"([^"]+)"/);
          const synopsisMatch = line.match(/"synopsis"\s*:\s*"([^"]+)"/);

          if (titleMatch && reasonMatch) {
            manualItems.push({
              title: titleMatch[1],
              year: yearMatch ? yearMatch[1] : null,
              imdb_id: imdbMatch ? imdbMatch[1] : null,
              director: directorMatch ? directorMatch[1] : null,
              actors: actorsMatch ? actorsMatch[1] : null,
              reason: reasonMatch[1],
              synopsis: synopsisMatch ? synopsisMatch[1] : null,
            });
          }
        }
      }

      if (manualItems.length > 0) {
        console.log(`Manually extracted ${manualItems.length} recommendations`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ recommendations: manualItems }),
        };
      }
    } catch (manualError) {
      console.error("Error during manual extraction:", manualError);
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "No JSON found in response",
        rawResponse: responseText.substring(0, 500),
      }),
    };
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
