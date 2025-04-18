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
    const {
      title,
      overview,
      mediaType,
      limit = 10,
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
    
    Return ONLY the titles as a numbered list without any additional text, explanation, or commentary.
    For example:
    1. Title One
    2. Title Two
    etc.`;

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

    // Parse the response to extract just the titles
    const responseText = response.data.candidates[0].content.parts[0].text;

    // Extract numbered list items (1. Title, 2. Title, etc.)
    const titles = responseText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s+.+/.test(line)) // Match lines starting with numbers followed by period
      .map((line) => line.replace(/^\d+\.\s+/, "").trim()); // Remove the numbering

    console.log(`Generated ${titles.length} similar titles for "${title}"`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ titles }),
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
