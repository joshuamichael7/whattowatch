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
      includeReasoning = true,
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
    
    CRITICAL: For each recommendation, you MUST include:
    1. The EXACT title as it appears in IMDB
    2. The year in parentheses
    3. The IMDB ID in square brackets
    4. A SPECIFIC and DETAILED reason (1-2 sentences) explaining WHY this content is similar to "${title}"
    
    Format each recommendation as follows:
    1. Title (Year) [IMDB_ID] | Reason: Your specific explanation of why this is similar
    
    For example:
    1. The Office (UK) (2001) [tt0290978] | Reason: Like The Office (US), this is the original mockumentary workplace comedy that established the format, featuring cringe humor, awkward boss-employee dynamics, and documentary-style filming.
    2. Parks and Recreation (2009) [tt1266020] | Reason: Created by the same producers as The Office, it shares the mockumentary style, workplace setting, and ensemble cast with quirky characters, though with a more optimistic tone.
    3. Brooklyn Nine-Nine (2013) [tt2467372] | Reason: While set in a police precinct instead of an office, it features the same workplace comedy dynamics, ensemble cast chemistry, and character-driven humor that made The Office popular.
    
    IMPORTANT: Use the EXACT title spelling and formatting as it appears in IMDB to ensure proper matching.
    CRITICAL: Include the year in parentheses after each title to distinguish between movies/shows with the same title.
    CRITICAL: Include the IMDB ID in square brackets after the year. If you don't know the exact IMDB ID, make a best guess based on the title and year, always starting with 'tt' followed by 7-8 digits.
    CRITICAL: Provide a SPECIFIC reason for each recommendation that explains the similarities in detail, not just generic statements.
    CRITICAL: Ensure you recommend a diverse range of content that captures different aspects of similarity to the original title.`;

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

    // Extract numbered list items with reasons
    const titles = responseText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s+.+/.test(line)) // Match lines starting with numbers followed by period
      .map((line) => {
        // Extract the full line
        const fullLine = line.replace(/^\d+\.\s+/, "").trim();

        // Split by the reason separator if it exists
        const parts = fullLine.split(/\s*\|\s*Reason:\s*/);
        const fullTitle = parts[0].trim();
        const reason =
          parts.length > 1 ? parts[1].trim() : "Similar in style and themes";

        // Check if the title has a year in parentheses and IMDB ID in square brackets
        const match = fullTitle.match(/(.+)\s+\((\d{4})\)\s*(?:\[(tt\d+)\])?/);
        if (match) {
          // Return title, year, IMDB ID, and reason if available
          return {
            title: match[1].trim(),
            year: match[2],
            imdb_id: match[3] || null,
            aiRecommended: true,
            recommendationReason: reason,
          };
        }
        // If no year or IMDB ID found, just return the title and reason
        return {
          title: fullTitle,
          year: null,
          imdb_id: null,
          aiRecommended: true,
          recommendationReason: reason,
        };
      });

    // Log the extracted titles with reasons for debugging
    console.log(
      "Extracted titles with detailed reasons:",
      titles.map(
        (t) =>
          `${t.title} (${t.year || "unknown"}) [${t.imdb_id || "no ID"}] - Reason: ${t.recommendationReason.substring(0, 50)}...`,
      ),
    );

    console.log(`Generated ${titles.length} similar titles for "${title}"`);

    // Log the extracted titles with IMDB IDs for debugging
    console.log(
      "Extracted titles with IMDB IDs and reasons:",
      titles.map(
        (t) =>
          `${t.title} (${t.year || "unknown"}) [${t.imdb_id || "no ID"}] - ${t.recommendationReason.substring(0, 50)}...`,
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
