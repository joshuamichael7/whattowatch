// Netlify function to populate the Supabase database from a CSV file
const { createClient } = require("@supabase/supabase-js");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to verify admin privileges
async function verifyAdminUser(token) {
  if (!token) {
    return { authorized: false, error: "No authorization token provided" };
  }

  try {
    // Verify the JWT token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return { authorized: false, error: "Invalid or expired token" };
    }

    // Check if user has admin role in the profiles table
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { authorized: false, error: "User profile not found" };
    }

    if (profile.role !== "admin") {
      return { authorized: false, error: "Insufficient permissions" };
    }

    return { authorized: true, user };
  } catch (error) {
    console.error("Error verifying admin user:", error);
    return { authorized: false, error: "Authentication error" };
  }
}

// Helper function to process CSV data and format it for Supabase
function processContentItem(item) {
  // Convert string values to appropriate types
  return {
    id:
      item.id ||
      `${item.imdbID || item.Title.replace(/\s+/g, "-").toLowerCase()}-${item.Year}`,
    title: item.Title,
    media_type: item.Type === "movie" ? "movie" : "tv",
    year: item.Year,
    poster_path: item.Poster,
    imdb_id: item.imdbID,
    overview: item.Plot,
    plot: item.Plot,
    content_rating: item.Rated,
    runtime: item.Runtime ? parseInt(item.Runtime) : null,
    genre_strings: item.Genre ? item.Genre.split(", ") : [],
    director: item.Director,
    actors: item.Actors,
    imdb_rating: item.imdbRating,
    vote_average: item.imdbRating ? parseFloat(item.imdbRating) : 0,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Main function to handle the request
exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // Get the authorization token from the request headers
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;

  // Verify admin privileges
  const { authorized, error, user } = await verifyAdminUser(token);

  if (!authorized) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Unauthorized: " + error }),
    };
  }

  try {
    const { csvUrl, filePath } = JSON.parse(event.body);
    let results = [];

    // Option 1: Read from a URL (not implemented here, would require fetch)
    // Option 2: Read from a local file path
    if (filePath) {
      const absolutePath = path.resolve(filePath);

      // Read the CSV file
      const readStream = fs.createReadStream(absolutePath);

      // Parse the CSV data
      await new Promise((resolve, reject) => {
        readStream
          .pipe(csv())
          .on("data", (data) => results.push(data))
          .on("end", resolve)
          .on("error", reject);
      });
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No file path provided" }),
      };
    }

    // Process and insert data into Supabase
    const processedItems = results.map(processContentItem);

    // Insert in batches to avoid hitting limits
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < processedItems.length; i += batchSize) {
      batches.push(processedItems.slice(i, i + batchSize));
    }

    const insertResults = [];

    for (const batch of batches) {
      const { data, error } = await supabase
        .from("content")
        .upsert(batch, { onConflict: "id" });

      if (error) {
        console.error("Error inserting batch:", error);
        insertResults.push({ success: false, error });
      } else {
        insertResults.push({ success: true, count: batch.length });
      }
    }

    // Trigger similarity calculation (will be implemented in another function)
    // This would typically be done by calling another function or endpoint

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Database population completed",
        totalItems: processedItems.length,
        results: insertResults,
      }),
    };
  } catch (error) {
    console.error("Error in populate-database function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        details: error.message,
      }),
    };
  }
};
