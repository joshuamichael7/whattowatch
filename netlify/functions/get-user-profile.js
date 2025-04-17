// Netlify function to get user profile with role information
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const initSupabaseClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * Handler for getting user profile
 * @param {Object} event - Netlify function event
 * @returns {Object} - Response object with user profile
 */
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
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse the request body
    const { userId, email } = JSON.parse(event.body);

    // Validate required fields - either userId or email must be provided
    if (!userId && !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Either userId or email is required" }),
      };
    }

    // Initialize Supabase client
    const supabase = initSupabaseClient();

    // Query the users table based on the provided identifier
    let query = supabase.from("users").select("*");

    if (userId) {
      query = query.eq("id", userId);
    } else if (email) {
      query = query.eq("email", email);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error("Error fetching user profile:", error);

      // Special handling for "no rows returned" error
      if (error.code === "PGRST116") {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: "User profile not found" }),
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }

    // Return the user profile
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ profile: data }),
    };
  } catch (error) {
    console.error("Error in get-user-profile function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
