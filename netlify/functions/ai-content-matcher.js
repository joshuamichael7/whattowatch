const axios = require("axios");

// Configuration for the Gemini API
const defaultConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
  modelName: "gemini-1.5-flash",
  maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || "1024"),
  temperature: parseFloat(process.env.GEMINI_TEMPERATURE || "0.2"),
};

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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

  // Allow both GET and POST requests
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Parse parameters from query string or request body
    let requestData = {};

    if (event.httpMethod === "GET") {
      requestData = event.queryStringParameters || {};
    } else if (event.httpMethod === "POST") {
      try {
        requestData = JSON.parse(event.body || "{}");
      } catch (error) {
        console.error("Error parsing request body:", error);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid JSON in request body" }),
        };
      }
    }

    const { originalRecommendation, omdbResults } = requestData;

    if (
      !originalRecommendation ||
      !omdbResults ||
      !Array.isArray(omdbResults)
    ) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing required parameters",
          details:
            "Request must include originalRecommendation and omdbResults array",
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
    const prompt = `I need you to match an AI-recommended movie/TV show with the correct entry from OMDB search results.

Original AI Recommendation:
Title: ${originalRecommendation.title}
Year: ${originalRecommendation.year || "Unknown"}
Reason: ${originalRecommendation.reason || "No reason provided"}
Synopsis: ${originalRecommendation.synopsis || "No synopsis provided"}

OMDB Search Results:
${omdbResults
  .map(
    (result, index) => `
Result ${index + 1}:
Title: ${result.title || result.Title}
Year: ${result.year || result.Year}
Type: ${result.type || result.Type}
IMDB ID: ${result.imdbID || result.imdb_id}
Plot: ${result.plot || result.Plot || "No plot available"}
Actors: ${result.actors || result.Actors || "No actors listed"}
Director: ${result.director || result.Director || "No director listed"}
Genre: ${result.genre || result.Genre || "No genre listed"}
`,
  )
  .join("")}

Please analyze these results and determine which OMDB result best matches the original AI recommendation. Consider title similarity, year match, plot/synopsis similarity, and any other relevant factors. Return ONLY a JSON object with the following structure:

{
  "matchedResult": {
    "imdbID": "tt1234567",
    "confidence": 0.95,
    "reasonForMatch": "Brief explanation of why this is the best match"
  }
}

If none of the results seem to match well (below 70% confidence), return:

{
  "matchedResult": null,
  "reason": "Explanation of why no good match was found"
}

Only return the JSON object, no other text.`;

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

    // Log the raw response for debugging (truncated)
    console.log(
      "Raw response from Gemini API (first 100 chars):",
      responseText.substring(0, 100) + "...",
    );

    // Parse the JSON response
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/s);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(parsedResponse),
        };
      } else {
        throw new Error("No valid JSON found in response");
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to parse AI response",
          rawResponse: responseText.substring(0, 500),
        }),
      };
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error matching content",
        message: error.message,
      }),
    };
  }
};
