const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

// Initialize Supabase client
const initSupabaseClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseKey);
};

const supabase = initSupabaseClient();

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
    // Log environment variables for debugging
    console.log("Environment variables check:", {
      SUPABASE_URL: process.env.SUPABASE_URL ? "exists" : "missing",
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? "exists" : "missing",
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY
        ? "exists"
        : "missing",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "exists"
        : "missing",
    });
    const { action, userId, email } = JSON.parse(event.body);

    switch (action) {
      case "getUserById": {
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "userId is required" }),
          };
        }

        try {
          // Create a fresh Supabase client for this operation
          const supabase = initSupabaseClient();

          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

          if (error) {
            console.error("Error fetching user by ID:", error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: error.message }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ data }),
          };
        } catch (error) {
          console.error("Error in getUserById:", error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: error.message || "Internal server error",
            }),
          };
        }
      }

      case "getUserByEmail": {
        if (!email) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "email is required" }),
          };
        }

        try {
          // Create a fresh Supabase client for this operation
          const supabase = initSupabaseClient();

          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", email)
            .single();

          if (error) {
            console.error("Error fetching user by email:", error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: error.message }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ data }),
          };
        } catch (error) {
          console.error("Error in getUserByEmail:", error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: error.message || "Internal server error",
            }),
          };
        }
      }

      case "checkUserExists": {
        try {
          // Create a fresh Supabase client for this operation
          const supabase = initSupabaseClient();

          const query = supabase.from("users").select("id");

          if (userId) {
            query.eq("id", userId);
          } else if (email) {
            query.eq("email", email);
          } else {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: "userId or email is required" }),
            };
          }

          const { data, error } = await query;

          if (error) {
            console.error("Error checking if user exists:", error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: error.message }),
            };
          }

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ exists: data && data.length > 0 }),
          };
        } catch (error) {
          console.error("Error in checkUserExists:", error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: error.message || "Internal server error",
            }),
          };
        }
      }

      case "verifyAdminPassword": {
        if (!userId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "userId is required" }),
          };
        }

        const password = event.body ? JSON.parse(event.body).password : null;
        if (!password) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "password is required" }),
          };
        }

        try {
          // Create a fresh Supabase client for this operation
          const supabase = initSupabaseClient();

          // First check if user is an admin
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("id", userId)
            .single();

          if (userError) {
            console.error("Error fetching user role:", userError);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: userError.message }),
            };
          }

          if (userData.role !== "admin") {
            return {
              statusCode: 403,
              headers,
              body: JSON.stringify({ error: "User is not an admin" }),
            };
          }

          // Get the admin credentials
          const { data: credData, error: credError } = await supabase
            .from("admin_credentials")
            .select("password_hash")
            .eq("user_id", userId)
            .single();

          if (credError) {
            console.error("Error fetching admin credentials:", credError);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({ error: credError.message }),
            };
          }

          // Compare the password
          const isValid = await bcrypt.compare(
            password,
            credData.password_hash,
          );

          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: isValid }),
          };
        } catch (error) {
          console.error("Error in verifyAdminPassword:", error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: error.message || "Internal server error",
            }),
          };
        }
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unsupported action: ${action}` }),
        };
    }
  } catch (error) {
    console.error("Error in auth-helper function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
