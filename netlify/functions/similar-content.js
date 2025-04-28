const axios = require("axios");

// Configuration for the Gemini API
const defaultConfig = {
  apiKey: process.env.GEMINI_API_KEY,
  apiVersion: "v1beta",
  modelName: "gemini-2.0-flash", // Updated to use 2.0 for consistency
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
      apiVersion,
      modelName,
      includeReasoning = true,
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
    
    CRITICAL: Format your response as a JSON array with the following properties for each recommendation:
    - title: The EXACT title as it appears in IMDB - this is extremely important for matching with the database
    - year: The year of release
    - imdb_id: The IMDB ID in the format tt1234567
    - imdb_url: The IMDB URL in the format https://www.imdb.com/title/tt1234567/
    - reason: A brief explanation of why this content is similar
    - synopsis: A detailed summary of the plot (2-3 sentences) - this helps with matching
    
    Example JSON format:
    [
      {"title": "Parks and Recreation", "year": "2009", "imdb_id": "tt1266020", "imdb_url": "https://www.imdb.com/title/tt1266020/", "reason": "Mockumentary workplace comedy with quirky characters and similar humor style", "synopsis": "The absurd antics of an Indiana town's public officials as they pursue projects to make their city a better place. The series focuses on Leslie Knope, an ambitious mid-level bureaucrat in the Parks Department of Pawnee, Indiana."},
      {"title": "Brooklyn Nine-Nine", "year": "2013", "imdb_id": "tt2467372", "imdb_url": "https://www.imdb.com/title/tt2467372/", "reason": "Ensemble workplace comedy with similar character dynamics", "synopsis": "Comedy series following the exploits of Det. Jake Peralta and his diverse, lovable colleagues as they police the NYPD's 99th Precinct. The show explores their professional challenges and personal lives while solving crimes in Brooklyn."}
    ]
    
    ULTRA IMPORTANT: Use the EXACT title spelling and formatting as it appears in IMDB - this is critical for matching.
    ULTRA IMPORTANT: Make sure the IMDB ID and URL are correct and match the actual IMDB entry for the title.
    CRITICAL: Only return the JSON array, no other text.`;

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
    console.log(
      "Raw response from Gemini API (first 100 chars):",
      responseText.substring(0, 100) + "...",
    );

    // Extract JSON from the response
    let extractedJson = null;

    // Try to find JSON array directly
    const jsonArrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/s);
    if (jsonArrayMatch) {
      extractedJson = jsonArrayMatch[0].trim();
    } else {
      // Try to find JSON in code blocks
      const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        extractedJson = codeBlockMatch[1].trim();
      } else {
        // Try to find JSON with different pattern
        const jsonObjMatch = responseText.match(
          /\{\s*"titles"\s*:\s*\[[\s\S]*\]\s*\}/s,
        );
        if (jsonObjMatch) {
          extractedJson = jsonObjMatch[0].trim();
        }
      }
    }

    if (!extractedJson) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to extract JSON from response",
          rawResponse: responseText.substring(0, 500),
        }),
      };
    }

    console.log(
      "Extracted JSON (first 100 chars):",
      extractedJson.substring(0, 100) + "...",
    );

    try {
      // Parse the JSON
      const parsedData = JSON.parse(extractedJson);

      // Handle both array format and object with titles property
      const items = Array.isArray(parsedData)
        ? parsedData
        : parsedData.titles || [];

      // Map to consistent format
      const titles = items.map((item) => {
        return {
          title: item.title,
          year: item.year || null,
          imdb_id: item.imdb_id || null,
          aiRecommended: true,
          recommendationReason: item.reason || "Similar in style and themes",
          synopsis: item.synopsis || null,
        };
      });

      console.log(`Generated ${titles.length} similar titles for "${title}"`);

      // Log the extracted titles with reasons for debugging
      if (titles.length > 0) {
        console.log(
          "Extracted titles with detailed reasons:",
          titles
            .slice(0, 3)
            .map(
              (t) =>
                `${t.title} (${t.year || "unknown"}) [${t.imdb_id || "no ID"}] - Reason: ${t.recommendationReason?.substring(0, 50)}...`,
            ),
        );

        // For each title, try to find its IMDB ID
        console.log("Looking up IMDB IDs for recommendations...");

        for (let i = 0; i < titles.length; i++) {
          const title = titles[i];
          try {
            // Search OMDB for this title
            const searchResponse = await axios.get(
              `http://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${encodeURIComponent(title.title)}`,
            );

            if (
              searchResponse.data.Response === "True" &&
              searchResponse.data.Search &&
              searchResponse.data.Search.length > 0
            ) {
              // Find best match by title
              const bestMatch = searchResponse.data.Search.find(
                (result) =>
                  result.Title.toLowerCase() === title.title.toLowerCase(),
              );

              if (bestMatch) {
                console.log(
                  `Found IMDB ID for "${title.title}": ${bestMatch.imdbID}`,
                );
                titles[i].imdb_id = bestMatch.imdbID;

                // Also get the poster if available
                if (bestMatch.Poster && bestMatch.Poster !== "N/A") {
                  titles[i].poster = bestMatch.Poster;
                }
              }
            }
          } catch (error) {
            console.error(
              `Error looking up IMDB ID for "${title.title}":`,
              error.message,
            );
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ titles, aiRecommended: true }),
      };
    } catch (parseError) {
      console.error("Error parsing extracted JSON:", parseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Error parsing extracted JSON",
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
        error: "Error generating similar content",
        message: error.message,
      }),
    };
  }
};
