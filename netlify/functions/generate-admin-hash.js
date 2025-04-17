const bcrypt = require("bcryptjs");
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

exports.handler = async (event) => {
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

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { password, userId, rounds = 10 } = JSON.parse(event.body);

    if (!password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Password is required" }),
      };
    }

    // Generate a hash with the specified number of rounds
    const salt = await bcrypt.genSalt(rounds);
    const hash = await bcrypt.hash(password, salt);

    console.log("Generated hash details:", {
      rounds,
      hashLength: hash.length,
      hashPrefix: hash.substring(0, 7),
    });

    // If userId is provided, update the admin credentials
    if (userId) {
      try {
        const supabase = initSupabaseClient();

        // Update the admin credentials
        const { data, error } = await supabase
          .from("admin_credentials")
          .update({
            password_hash: hash,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (error) {
          console.error("Error updating admin credentials:", error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: "Admin password updated successfully",
            hash,
          }),
        };
      } catch (error) {
        console.error("Error updating admin credentials:", error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: error.message || "Error updating admin credentials",
          }),
        };
      }
    }

    // If no userId, just return the hash
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        hash,
      }),
    };
  } catch (error) {
    console.error("Error generating hash:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
