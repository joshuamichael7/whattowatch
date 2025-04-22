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

    // Extract numbered list items with reasons
    const titles = responseText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s+.+/.test(line)) // Match lines starting with numbers followed by period
      .map((line) => {
        // Extract the full line
        const fullLine = line.replace(/^\d+\.\s+/, "").trim();

        // Check if the title has a year in parentheses and IMDB ID in square brackets
        // This improved regex captures the title, year, and IMDB ID more reliably
        const match = fullLine.match(
          /(.+?)\s+\((\d{4})\)\s*(?:\[(tt\d+)\])?(.*)/,
        );

        if (match) {
          // The title is in match[1], year in match[2], IMDB ID in match[3] (if present)
          // Any additional text after the IMDB ID would be in match[4]
          const title = match[1].trim();
          const year = match[2];
          const imdb_id = match[3] || null;

          // Extract reason if it exists after the IMDB ID
          // First check if there's any text after the IMDB ID bracket
          let reason = "Similar in style and themes";

          if (match[4]) {
            // Look for explicit reason format
            const reasonMatch = match[4].match(/\s*[-|]\s*(.+)/);
            if (reasonMatch) {
              reason = reasonMatch[1].trim();
            }
          }

          return {
            title: title,
            year: year,
            imdb_id: imdb_id,
            aiRecommended: true,
            recommendationReason: reason,
          };
        }

        // If the standard format wasn't found, try an alternative approach
        // Split by common separators that might indicate a reason
        const parts = fullLine.split(/\s*[\-|:]\s*/);
        const fullTitle = parts[0].trim();
        const reason =
          parts.length > 1
            ? parts.slice(1).join(" - ").trim()
            : "Similar in style and themes";

        // Try to extract year and IMDB ID from the title part
        const altMatch = fullTitle.match(
          /(.+?)(?:\s+\((\d{4})\))?(?:\s*\[(tt\d+)\])?/,
        );

        if (altMatch) {
          return {
            title: altMatch[1].trim(),
            year: altMatch[2] || null,
            imdb_id: altMatch[3] || null,
            aiRecommended: true,
            recommendationReason: reason,
          };
        }

        // Fallback if no patterns match
        return {
          title: fullTitle,
          year: null,
          imdb_id: null,
          aiRecommended: true,
          recommendationReason: reason,
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
