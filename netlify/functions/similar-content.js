const axios = require("axios");

// Configuration for the Gemini API
const defaultConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
  modelName: "gemini-1.5-flash", // Use 1.5 instead of 2.0 for better compatibility
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
    const {
      title,
      overview,
      mediaType = "movie",
      limit = 20,
      apiVersion = "v1beta",
      modelName = "gemini-1.5-flash",
    } = event.body ? JSON.parse(event.body) : {};

    if (!title || !overview) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing title or overview in request body",
        }),
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

    // Construct the prompt for Gemini
    const prompt = `I'm looking for content similar to "${title}" which is a ${mediaType === "movie" ? "movie" : "TV show"}. 
    Here's the plot: "${overview}"
    
    Please provide exactly ${limit} titles of movies AND TV shows that are similar in plot, themes, tone, and style. 
    Consider factors like genre, setting, character dynamics, and emotional impact.
    
    CRITICAL: For each recommendation, you MUST include:
    1. The EXACT title as it appears in IMDB
    2. The year in parentheses
    3. The IMDB ID in square brackets - this is REQUIRED and MUST be in the format tt followed by numbers (e.g., tt0111161)
    4. A brief reason why this content is similar to "${title}"
    
    Format each recommendation as follows:
    1. Title (Year) [IMDB_ID] - Reason: Your specific explanation
    
    For example:
    1. Parks and Recreation (2009) [tt1266020] - Reason: Mockumentary workplace comedy with quirky characters and similar humor style
    2. Brooklyn Nine-Nine (2013) [tt2467372] - Reason: Ensemble workplace comedy with similar character dynamics
    
    IMPORTANT: Use the EXACT title spelling and formatting as it appears in IMDB.
    CRITICAL: Include the year in parentheses after each title.
    CRITICAL: Include the IMDB ID in square brackets after the year - this is REQUIRED for accurate identification.
    CRITICAL: After the IMDB ID, include " - Reason: " followed by a specific explanation.`;

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

    // Extract JSON from the response
    let jsonMatch = responseText.match(/\[\s*\{.*\}\s*\]/s);
    if (!jsonMatch) {
      // Try to find JSON with different pattern
      jsonMatch = responseText.match(/\{\s*"titles"\s*:\s*\[.*\]\s*\}/s);
    }

    if (!jsonMatch) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to extract JSON from response",
        }),
      };
    }

    // Parse the JSON
    const json = JSON.parse(jsonMatch[0]);

    // Extract titles and reasons
    const titles = json.titles.map((title) => {
      const { title: titleText, year, imdb_id, reason } = title;
      return {
        title: titleText,
        year: year || null,
        imdb_id: imdb_id || null,
        aiRecommended: true,
        recommendationReason: reason || "Similar in style and themes",
      };
    });

    console.log(`Generated ${titles.length} similar titles for "${title}"`);

    // Log the extracted titles with reasons for debugging
    console.log(
      "Extracted titles with detailed reasons:",
      titles.map(
        (t) =>
          `${t.title} (${t.year || "unknown"}) [${t.imdb_id || "no ID"}] - Reason: ${t.recommendationReason.substring(0, 50)}...`,
      ),
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ titles, aiRecommended: true }),
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error generating similar content",
        message: error.message,
      }),
    };
  }
};
