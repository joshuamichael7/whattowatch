import { supabase } from "@/lib/supabaseClient";
import { getUserByEmail, createUser } from "@/lib/supabaseProxy";

// Sign in with email and password
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { data, error };
  } catch (error: any) {
    console.error("Error signing in:", error.message);
    return { data: null, error };
  }
}

// Sign up with email and password
export async function signUp(email: string, password: string) {
  try {
    // First, create the auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    // If auth user creation is successful, create a public user profile
    if (data.user && !error) {
      try {
        // Try to create user profile using REST API directly
        await createUser({
          id: data.user.id,
          email: email,
          username: data.user.user_metadata?.name || email.split("@")[0], // Use name from metadata or generate from email
          role: "user", // Always set regular users by default
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (profileError: any) {
        console.error("Error creating user profile:", profileError);
        return { data, error: { message: profileError.message } };
      }
    }

    return { data, error };
  } catch (error: any) {
    console.error("Error signing up:", error.message);
    return { data: null, error };
  }
}

// Sign out
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (error: any) {
    console.error("Error signing out:", error.message);
    return { error };
  }
}

// Reset password
export async function resetPassword(email: string) {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    return { data, error };
  } catch (error: any) {
    console.error("Error resetting password:", error.message);
    return { data: null, error };
  }
}

// Update password
export async function updatePassword(password: string) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password,
    });

    return { data, error };
  } catch (error: any) {
    console.error("Error updating password:", error.message);
    return { data: null, error };
  }
}

// Get user profile from the public.users table - can look up by userId or email
export async function getUserProfile(
  userIdOrEmail: string,
  isEmail: boolean = false,
) {
  try {
    console.log(
      `[getUserProfile] Fetching profile for user ${isEmail ? "email" : "ID"}:`,
      userIdOrEmail,
    );

    // Use direct REST API calls instead of Supabase client
    try {
      let userData;

      if (isEmail) {
        console.log(
          `[getUserProfile] Looking up user by email: ${userIdOrEmail}`,
        );
        userData = await getUserByEmail(userIdOrEmail);
      } else {
        console.log(`[getUserProfile] Looking up user by ID: ${userIdOrEmail}`);
        userData = await getUserById(userIdOrEmail);
      }

      if (userData && userData.length > 0) {
        const data = userData[0];
        console.log("[getUserProfile] Successfully retrieved profile:", {
          id: data.id,
          email: data.email,
          role: data.role,
        });
        return { data, error: null };
      } else {
        console.log(
          `[getUserProfile] No user found with ${isEmail ? "email" : "ID"}: ${userIdOrEmail}`,
        );
        return { data: null, error: { message: "User not found" } };
      }
    } catch (error: any) {
      console.error("[getUserProfile] Error fetching user profile:", error);
      return { data: null, error };
    }
  } catch (error: any) {
    console.error(
      "[getUserProfile] Exception caught:",
      error.message,
      error.stack,
    );
    return { data: null, error };
  }
}

// Check if a user profile exists in the public.users table - can check by userId or email
export async function checkUserProfileExists(
  userIdOrEmail: string,
  isEmail: boolean = false,
) {
  try {
    console.log(
      `[checkUserProfileExists] Checking if profile exists for user ${isEmail ? "email" : "ID"}:`,
      userIdOrEmail,
    );

    // Use direct REST API calls instead of Supabase client
    try {
      // Import the fetchFromSupabase function
      const { fetchFromSupabase } = await import("@/lib/supabaseProxy");

      // Build the query path
      const queryPath = isEmail
        ? `users?email=eq.${encodeURIComponent(userIdOrEmail)}&select=id,count=exact`
        : `users?id=eq.${userIdOrEmail}&select=id,count=exact`;

      console.log(`[checkUserProfileExists] Fetching from path: ${queryPath}`);

      // Make the direct API call
      const result = await fetchFromSupabase(queryPath);

      console.log("[checkUserProfileExists] Direct API result:", result);

      const exists = Array.isArray(result) && result.length > 0;
      console.log(`[checkUserProfileExists] Profile exists: ${exists}`);

      return { exists, error: null };
    } catch (error: any) {
      console.error(
        "[checkUserProfileExists] Error with direct API call:",
        error,
      );

      // Try a fallback approach with case-insensitive search if it's an email
      if (isEmail) {
        try {
          const { fetchFromSupabase } = await import("@/lib/supabaseProxy");

          // Use ILIKE for case-insensitive search
          const queryPath = `users?email=ilike.${encodeURIComponent(userIdOrEmail)}&select=id,count=exact`;

          console.log(
            `[checkUserProfileExists] Trying case-insensitive search: ${queryPath}`,
          );

          const result = await fetchFromSupabase(queryPath);

          console.log(
            "[checkUserProfileExists] Case-insensitive result:",
            result,
          );

          const exists = Array.isArray(result) && result.length > 0;
          console.log(
            `[checkUserProfileExists] Profile exists (case-insensitive): ${exists}`,
          );

          return { exists, error: null };
        } catch (fallbackError: any) {
          console.error(
            "[checkUserProfileExists] Fallback search failed:",
            fallbackError,
          );
        }
      }

      return { exists: false, error };
    }
  } catch (error: any) {
    console.error(
      "Error checking if user profile exists:",
      error.message,
      error.stack,
    );
    return { exists: false, error };
  }
}

// Update user profile in the public.users table
export async function updateUserProfile(userId: string, updates: any) {
  try {
    console.log(
      "[updateUserProfile] Updating profile for user:",
      userId,
      updates,
    );

    const { data, error } = await supabase
      .from("users")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
      .select(); // Add select() to return the updated data

    if (error) {
      console.error("[updateUserProfile] Error details:", error);
    } else {
      console.log(
        "[updateUserProfile] Update successful, returned data:",
        data,
      );
    }

    return { data, error };
  } catch (error: any) {
    console.error("Error updating user profile:", error.message, error.stack);
    return { data: null, error };
  }
}

// Get user preferences from the user_preferences table
export async function getUserPreferences(userId: string) {
  try {
    console.log(
      "[getUserPreferences] Checking for preferences for user ID:",
      userId,
    );

    // First check if the table exists
    console.log(
      "[getUserPreferences] Checking if user_preferences table exists",
    );
    const { count, error: tableError } = await supabase
      .from("user_preferences")
      .select("*", { count: "exact", head: true });

    console.log("[getUserPreferences] Table check result:", {
      count,
      error: tableError,
      status: tableError ? "ERROR" : "SUCCESS",
    });

    if (tableError) {
      console.log(
        "[getUserPreferences] Error checking preferences table:",
        tableError,
      );
      // Return empty preferences rather than error
      return { data: {}, error: null };
    }

    if (count === 0) {
      console.log(
        "[getUserPreferences] No preferences in table, returning empty object",
      );
      // Return empty preferences if table is empty
      return { data: {}, error: null };
    }

    // Now try to get the specific user's preferences
    console.log(
      `[getUserPreferences] Fetching preferences for user ID: ${userId}`,
    );
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    console.log("[getUserPreferences] User preferences query result:", {
      data,
      error,
      status: error ? "ERROR" : "SUCCESS",
    });

    if (error && error.code === "PGRST116") {
      // No rows found
      console.log(
        "[getUserPreferences] No preferences found for user, returning empty object",
      );
      return { data: {}, error: null };
    }

    return { data, error };
  } catch (error: any) {
    console.error("Error getting user preferences:", error.message);
    // Return empty preferences rather than error
    return { data: {}, error: null };
  }
}

// Update user preferences in the user_preferences table
export async function updateUserPreferences(userId: string, preferences: any) {
  try {
    // Check if preferences exist for this user
    console.log(
      `[updateUserPreferences] Checking if preferences exist for user ID: ${userId}`,
    );
    const { data: existingPrefs, error: checkError } = await supabase
      .from("user_preferences")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    console.log("[updateUserPreferences] Preferences check result:", {
      exists: !!existingPrefs,
      error: checkError,
      status: checkError ? "ERROR" : "SUCCESS",
    });

    let result;
    if (existingPrefs) {
      // Update existing preferences
      console.log(
        `[updateUserPreferences] Updating existing preferences for user ID: ${userId}`,
      );
      result = await supabase
        .from("user_preferences")
        .update({
          ...preferences,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      console.log("[updateUserPreferences] Update result:", {
        data: result.data,
        error: result.error,
        status: result.error ? "ERROR" : "SUCCESS",
      });
    } else {
      // Insert new preferences
      console.log(
        `[updateUserPreferences] Creating new preferences for user ID: ${userId}`,
      );
      result = await supabase.from("user_preferences").insert({
        user_id: userId,
        ...preferences,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      console.log("[updateUserPreferences] Insert result:", {
        data: result.data,
        error: result.error,
        status: result.error ? "ERROR" : "SUCCESS",
      });
    }

    return { data: result.data, error: result.error };
  } catch (error: any) {
    console.error("Error updating user preferences:", error.message);
    return { data: null, error };
  }
}
