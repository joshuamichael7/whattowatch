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
    const body = JSON.parse(event.body || "{}");
    const {
      preferences,
      mediaType = "movie",
      limit = 20,
      apiVersion,
      modelName,
      skipImdbId = false, // New parameter to control whether to request IMDB IDs
    } = body;

    console.log("Received request with body:", JSON.stringify(body, null, 2));

    if (!preferences) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing preferences in request body" }),
      };
    }

    // Validate preferences structure to avoid errors
    if (!preferences.genres || !Array.isArray(preferences.genres)) {
      preferences.genres = [];
    }
    if (!preferences.favoriteContent) {
      preferences.favoriteContent = [];
    }
    if (!preferences.contentToAvoid) {
      preferences.contentToAvoid = [];
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
    const viewingTimeText = preferences.viewingTime
      ? preferences.viewingTime < 60
        ? `${preferences.viewingTime} minutes`
        : `${Math.floor(preferences.viewingTime / 60)} hour${preferences.viewingTime >= 120 ? "s" : ""}${preferences.viewingTime % 60 > 0 ? ` ${preferences.viewingTime % 60} minutes` : ""}`
      : "No specific time limit";
    const moodText = preferences.mood || "No specific mood";
    const ageRatingText = preferences.ageRating || "No specific rating";

    // Construct the prompt for Gemini
    let prompt = `I need personalized movie and TV show recommendations based on the following preferences:\n\n
    - Preferred genres: ${genresText || "No specific genres"}\n
    - Current mood: ${moodText}\n
    - Available viewing time: ${viewingTimeText}\n
    - Content they've enjoyed: ${favoritesText || "No examples provided"}\n
    - Content they want to avoid: ${avoidText || "No examples provided"}\n
    - Age/content rating preference: ${ageRatingText}\n\n
    Please recommend exactly ${limit} movies or TV shows that match these preferences. For each recommendation, provide:\n
    1. The exact title as it appears in IMDB\n
    2. The year of release (just the 4-digit year)\n
    3. A brief reason why it matches their preferences (1-2 sentences)\n
    4. A brief synopsis of the plot (1-2 sentences)\n
    5. The content type (movie or tv)\n\n
    Format your response as a JSON array with title, year, reason, synopsis, and type properties for each recommendation. Example:\n
    [\n
      {\"title\": \"The Shawshank Redemption\", \"year\": \"1994\", \"type\": \"movie\", \"reason\": \"A powerful drama about hope and redemption that matches your preference for thoughtful storytelling.\", \"synopsis\": \"Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.\"},\n
      {\"title\": \"Inception\", \"year\": \"2010\", \"type\": \"movie\", \"reason\": \"A mind-bending sci-fi thriller that aligns with your interest in complex narratives.\", \"synopsis\": \"A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.\"}\n
    ]\n
    \n
    IMPORTANT: Make sure the titles are accurate and match real movies or TV shows.\n
    Only return the JSON array, no other text.`;

    // We're skipping IMDB ID requests to simplify the response and avoid errors

    // Construct the API endpoint URL
    const apiEndpoint = `https://generativelanguage.googleapis.com/${defaultConfig.apiVersion}/models/${defaultConfig.modelName}:generateContent`;

    console.log(`Using Gemini API endpoint: ${apiEndpoint}`);
    console.log(`Skip IMDB ID: ${skipImdbId}`);

    // Check if API key is available
    if (!defaultConfig.apiKey) {
      console.error("Missing Gemini API key");

      // Return fallback recommendations instead of failing
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          recommendations: getFallbackRecommendations(preferences),
        }),
      };
    }

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

    // Log the full response for debugging
    console.log("========== FULL GEMINI API RESPONSE ==========");
    console.log(responseText);
    console.log("==============================================");
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

  // Extract JSON from the response
  let extractedJson = null;

  // Try to find JSON array directly - this should be the most common case
  const jsonArrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/s);
  if (jsonArrayMatch) {
    extractedJson = jsonArrayMatch[0];
  }

  // Initialize array for manual extraction results
  const manualItems = [];

  if (extractedJson) {
    console.log(
      `Extracted JSON (first 100 chars): ${extractedJson.substring(0, 100)}...`,
    );

    try {
      // Try to parse the extracted JSON
      let parsedData;
      try {
        parsedData = JSON.parse(extractedJson);
      } catch (initialParseError) {
        // If parsing fails, try to clean the JSON string
        console.log(
          "Initial JSON parsing failed, attempting to clean JSON string",
        );
        const cleanedJson = extractedJson
          .replace(/\\n/g, " ")
          .replace(/\\r/g, "")
          .replace(/\\t/g, " ")
          .replace(/\\'/g, "'")
          .replace(/\\\\(?!")/g, "\\"); // Keep escape for double quotes

        parsedData = JSON.parse(cleanedJson);
      }

      // Determine if we have an array or an object with recommendations
      const recommendations = Array.isArray(parsedData)
        ? parsedData
        : parsedData.recommendations;

      if (recommendations && recommendations.length > 0) {
        console.log(
          `Successfully parsed ${recommendations.length} recommendations from AI response`,
        );

        // Return the recommendations directly without validation
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            recommendations: recommendations,
          }),
        };
      } else {
        console.error("No recommendations found in parsed data");
      }
    } catch (parseError) {
      console.error("Error parsing extracted JSON:", parseError);
    }
  }

  // If we get here, we couldn't extract valid JSON
  console.error("No valid JSON found in response text");

  // Try to manually extract recommendations as a last resort
  try {
    const lines = responseText.split("\n");

    // First try to extract complete JSON objects
    let currentObject = "";
    let inObject = false;
    let bracketCount = 0;

    // Try to extract the full JSON array first
    const jsonArrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/s);
    if (jsonArrayMatch) {
      try {
        const jsonArray = JSON.parse(jsonArrayMatch[0]);
        if (Array.isArray(jsonArray) && jsonArray.length > 0) {
          console.log(`Extracted ${jsonArray.length} items from JSON array`);
          // Process the array instead of returning it directly
          for (const item of jsonArray) {
            if (item.title) {
              manualItems.push({
                title: item.title,
                year: item.year || null,
                imdb_id: item.imdb_id || null,
                director: item.director || null,
                actors: item.actors || null,
                reason: item.reason || "Matches your preferences",
                synopsis: item.synopsis || null,
              });
            }
          }
          console.log(`Processed ${manualItems.length} items from JSON array`);
        }
      } catch (e) {
        console.error("Error parsing JSON array:", e);
      }
    }

    // If we couldn't extract the full array, try line by line
    for (const line of lines) {
      const trimmedLine = line.trim();

      // Count opening and closing braces to track complete objects
      if (trimmedLine.includes("{")) {
        if (!inObject) {
          inObject = true;
          currentObject = trimmedLine;
        } else {
          currentObject += trimmedLine;
        }
        bracketCount += (trimmedLine.match(/{/g) || []).length;
      } else if (trimmedLine.includes("}")) {
        currentObject += trimmedLine;
        bracketCount -= (trimmedLine.match(/}/g) || []).length;

        // If brackets are balanced, we have a complete object
        if (bracketCount === 0 && inObject) {
          // Clean up the object string - remove any trailing commas
          let cleanObject = currentObject;
          if (cleanObject.endsWith(",")) {
            cleanObject = cleanObject.slice(0, -1);
          }

          try {
            // Try to parse as a single object
            const obj = JSON.parse(cleanObject);
            if (obj.title) {
              manualItems.push({
                title: obj.title,
                year: obj.year || null,
                imdb_id: obj.imdb_id || null,
                director: obj.director || null,
                actors: obj.actors || null,
                reason: obj.reason || "Matches your preferences",
                synopsis: obj.synopsis || null,
              });
            }
          } catch (e) {
            // Try to parse as an array
            try {
              if (cleanObject.startsWith("[") && cleanObject.endsWith("]")) {
                const objArray = JSON.parse(cleanObject);
                if (Array.isArray(objArray)) {
                  for (const item of objArray) {
                    if (item.title) {
                      manualItems.push({
                        title: item.title,
                        year: item.year || null,
                        imdb_id: item.imdb_id || null,
                        director: item.director || null,
                        actors: item.actors || null,
                        reason: item.reason || "Matches your preferences",
                        synopsis: item.synopsis || null,
                      });
                    }
                  }
                }
              }
            } catch (arrayError) {
              // Not a valid JSON array either
            }
          }

          inObject = false;
          currentObject = "";
          bracketCount = 0;
        }
      } else if (inObject) {
        currentObject += trimmedLine;
      }
    }

    // If we still couldn't extract objects, fall back to regex matching
    if (manualItems.length === 0) {
      console.log("Falling back to regex extraction");
      for (const line of lines) {
        // Look for patterns like: {"title": "Movie Name", "year": "2021", "reason": "...", "synopsis": "..."},
        if (line.includes('"title"')) {
          const titleMatch = line.match(/"title"\s*:\s*"([^"]+)"/);
          const yearMatch = line.match(/"year"\s*:\s*"([^"]+)"/);
          const imdbMatch = line.match(/"imdb_id"\s*:\s*"([^"]+)"/);
          const directorMatch = line.match(/"director"\s*:\s*"([^"]+)"/);
          const actorsMatch = line.match(/"actors"\s*:\s*"([^"]+)"/);
          const reasonMatch = line.match(/"reason"\s*:\s*"([^"]+)"/);
          const synopsisMatch = line.match(/"synopsis"\s*:\s*"([^"]+)"/);

          if (titleMatch) {
            manualItems.push({
              title: titleMatch[1],
              year: yearMatch ? yearMatch[1] : null,
              imdb_id: imdbMatch ? imdbMatch[1] : null,
              director: directorMatch ? directorMatch[1] : null,
              actors: actorsMatch ? actorsMatch[1] : null,
              reason: reasonMatch ? reasonMatch[1] : "Matches your preferences",
              synopsis: synopsisMatch ? synopsisMatch[1] : null,
            });
          }
        }
      }
    }

    // If we found any items through manual extraction, return them
    if (manualItems.length > 0) {
      console.log(`Manually extracted ${manualItems.length} recommendations`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          recommendations: manualItems,
        }),
      };
    }
  } catch (manualError) {
    console.error("Error during manual extraction:", manualError);
  }

  // If we get here, we couldn't extract any recommendations
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({
      error: "No JSON found in response",
      rawResponse: responseText.substring(0, 500),
    }),
  };
};

// Fallback recommendations function to use when the API fails
function getFallbackRecommendations(preferences = {}) {
  // Extract genre preferences if available
  const preferredGenres = preferences.genres || [];
  const isFunnyMood = preferences.mood?.toLowerCase() === "funny" || false;
  const isShortViewing =
    preferences.viewingTime && preferences.viewingTime <= 90;
  const wantsFamilyFriendly =
    preferences.ageRating?.includes("PG") ||
    preferences.ageRating?.includes("TV-14");

  // Default recommendations - family friendly comedies and light content
  const defaultRecs = [
    {
      title: "Parks and Recreation",
      year: "2009",
      type: "tv",
      reason:
        "A lighthearted mockumentary comedy series with lovable characters and positive themes.",
      synopsis:
        "A mockumentary that follows the optimistic Leslie Knope and her colleagues in the Parks Department of Pawnee, Indiana.",
      contentRating: "TV-14",
    },
    {
      title: "The Good Place",
      year: "2016",
      type: "tv",
      reason:
        "A clever comedy with philosophical themes that's both funny and thought-provoking.",
      synopsis:
        "A woman struggles to define what it means to be good when she mistakenly ends up in the afterlife.",
      contentRating: "TV-14",
    },
    {
      title: "Brooklyn Nine-Nine",
      year: "2013",
      type: "tv",
      reason:
        "A workplace comedy set in a police precinct with diverse characters and witty humor.",
      synopsis:
        "The 99th precinct of the NYPD is led by the serious Captain Holt and includes the talented but immature Detective Jake Peralta.",
      contentRating: "TV-14",
    },
    {
      title: "Ted Lasso",
      year: "2020",
      type: "tv",
      reason:
        "A heartwarming comedy about kindness and personal growth with an optimistic outlook.",
      synopsis:
        "An American football coach is hired to manage an English soccer team, bringing his optimistic approach to the job.",
      contentRating: "TV-14",
    },
    {
      title: "Paddington",
      year: "2014",
      type: "movie",
      reason:
        "A charming family film with humor and heart that appeals to all ages.",
      synopsis:
        "A young bear travels to London from Peru and is adopted by the Brown family while being pursued by a taxidermist.",
      contentRating: "PG",
    },
    {
      title: "School of Rock",
      year: "2003",
      type: "movie",
      reason:
        "A fun comedy with great music and positive messages about finding your passion.",
      synopsis:
        "After being kicked out of his rock band, Dewey Finn becomes a substitute teacher and forms a band with his students.",
      contentRating: "PG-13",
    },
    {
      title: "Ferris Bueller's Day Off",
      year: "1986",
      type: "movie",
      reason:
        "A classic teen comedy about seizing the day and enjoying life's moments.",
      synopsis:
        "A high school student skips school for a day in Chicago with his girlfriend and best friend.",
      contentRating: "PG-13",
    },
  ];

  return defaultRecs;
}
