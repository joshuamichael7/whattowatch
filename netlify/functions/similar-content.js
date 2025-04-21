const axios = require("axios");

// Configuration for the Gemini API
const defaultConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
  modelName: "gemini-2.0-flash",
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
      mediaType,
      limit = 10,
      apiVersion,
      modelName,
    } = JSON.parse(event.body || "{}");

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
    
    CRITICAL: For each recommendation, you MUST include the IMDB ID.
    
    Return ONLY the EXACT titles as they appear in IMDB, FOLLOWED BY THE YEAR in parentheses, FOLLOWED BY THE IMDB ID in square brackets, as a numbered list without any additional text, explanation, or commentary.
    // IMPORTANT: Use the EXACT title spelling and formatting as it appears in IMDB to ensure proper matching.
    // CRITICAL: Include the year in parentheses after each title to distinguish between movies/shows with the same title.
    // CRITICAL: Include the IMDB ID in square brackets after the year. If you don't know the exact IMDB ID, make a best guess based on the title and year, always starting with 'tt' followed by 7-8 digits.
    For example:
    1. The Shawshank Redemption (1994) [tt0111161]
    2. The Godfather (1972) [tt0068646]
    3. The Dark Knight (2008) [tt0468569]
    etc.`;

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

    // Parse the response to extract just the titles
    const responseText = response.data.candidates[0].content.parts[0].text;

    // Extract numbered list items (1. Title (Year), 2. Title (Year), etc.)
    const titles = responseText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s+.+/.test(line)) // Match lines starting with numbers followed by period
      .map((line) => {
        // Extract the full title with year and IMDB ID
        const fullTitle = line.replace(/^\d+\.\s+/, "").trim();
        // Check if the title has a year in parentheses and IMDB ID in square brackets
        const match = fullTitle.match(/(.+)\s+\((\d{4})\)\s*(?:\[(tt\d+)\])?/);
        if (match) {
          // Return title, year, and IMDB ID if available
          return {
            title: match[1].trim(),
            year: match[2],
            imdb_id: match[3] || null,
            aiRecommended: true,
          };
        }
        // If no year or IMDB ID found, just return the title
        return {
          title: fullTitle,
          year: null,
          imdb_id: null,
          aiRecommended: true,
        };
      });

    console.log(`Generated ${titles.length} similar titles for "${title}"`);

    // Log the extracted titles with IMDB IDs for debugging
    console.log(
      "Extracted titles with IMDB IDs:",
      titles.map(
        (t) => `${t.title} (${t.year || "unknown"}) [${t.imdb_id || "no ID"}]`,
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
