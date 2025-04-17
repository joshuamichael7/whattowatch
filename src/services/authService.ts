import { supabase } from "@/lib/supabaseClient";

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
      const { error: profileError } = await supabase.from("users").insert({
        id: data.user.id,
        email: email,
        role: "user", // Always set regular users by default
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error("Error creating user profile:", profileError);
        return { data, error: profileError };
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
    console.log("[getUserProfile] Supabase URL:", supabase.supabaseUrl);
    console.log("[getUserProfile] Table being queried:", "users");

    // First, check if the table exists and is accessible
    console.log("[getUserProfile] STEP 1: Checking if table exists");
    const tableCheckQuery = supabase
      .from("users")
      .select("count(*)", { count: "exact", head: true });

    console.log("[getUserProfile] Table check query:", tableCheckQuery.toURL());
    const {
      data: tableCheck,
      error: tableError,
      count: tableCount,
    } = await tableCheckQuery;

    console.log("[getUserProfile] Table check result:", {
      tableCheck,
      tableError,
      tableCount,
      status: tableError ? "ERROR" : "SUCCESS",
    });

    if (tableError) {
      console.error("[getUserProfile] Table check failed:", {
        code: tableError.code,
        message: tableError.message,
        details: tableError.details,
        hint: tableError.hint,
      });
      return { data: null, error: tableError };
    }

    // STEP 2: Try to get all users to see if any exist
    console.log("[getUserProfile] STEP 2: Checking for any users in table");
    const allUsersQuery = supabase
      .from("users")
      .select("id, email, role")
      .limit(5);

    console.log("[getUserProfile] All users query:", allUsersQuery.toURL());
    const { data: allUsers, error: allUsersError } = await allUsersQuery;

    console.log("[getUserProfile] All users result:", {
      userCount: allUsers?.length || 0,
      users: allUsers,
      error: allUsersError,
      status: allUsersError ? "ERROR" : "SUCCESS",
    });

    // STEP 3: Now try to get the specific user - either by ID or email
    console.log(
      `[getUserProfile] STEP 3: Looking up specific user by ${isEmail ? "email" : "ID"}: ${userIdOrEmail}`,
    );
    const query = supabase.from("users").select("*");

    // Apply the appropriate filter based on whether we're using email or ID
    const specificQuery = isEmail
      ? query.eq("email", userIdOrEmail).single()
      : query.eq("id", userIdOrEmail).single();

    console.log("[getUserProfile] Specific user query:", specificQuery.toURL());
    const { data, error } = await specificQuery;

    console.log("[getUserProfile] Specific user query result:", {
      data,
      error,
      status: error ? "ERROR" : "SUCCESS",
    });

    if (error) {
      console.error("[getUserProfile] Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      // If we can't find the user and we're looking up by ID, try to get user details from auth
      if (error.code === "PGRST116" && !isEmail) {
        // No rows returned
        console.log(
          "[getUserProfile] User not found by ID, not creating default profile automatically",
        );
      }

      // STEP 4: If lookup by email fails, try a case-insensitive search
      if (isEmail && error.code === "PGRST116") {
        console.log(
          "[getUserProfile] STEP 4: Email lookup failed, trying case-insensitive search",
        );
        const caseInsensitiveQuery = supabase
          .from("users")
          .select("*")
          .ilike("email", userIdOrEmail)
          .single();

        console.log(
          "[getUserProfile] Case-insensitive query:",
          caseInsensitiveQuery.toURL(),
        );
        const { data: caseData, error: caseError } = await caseInsensitiveQuery;

        console.log("[getUserProfile] Case-insensitive result:", {
          data: caseData,
          error: caseError,
          status: caseError ? "ERROR" : "SUCCESS",
        });

        if (!caseError && caseData) {
          console.log(
            "[getUserProfile] Found user with case-insensitive search:",
            {
              id: caseData.id,
              email: caseData.email,
              role: caseData.role,
            },
          );
          return { data: caseData, error: null };
        }
      }
    }

    // Ensure we wait for the data to be fully available before returning
    if (data) {
      console.log("[getUserProfile] Successfully retrieved profile:", {
        id: data.id,
        email: data.email,
        role: data.role,
      });
    }

    return { data, error };
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

    // STEP 1: First check if the table exists and is accessible
    console.log("[checkUserProfileExists] STEP 1: Checking if table exists");
    const tableCheckQuery = supabase
      .from("users")
      .select("count(*)", { count: "exact", head: true });

    console.log(
      "[checkUserProfileExists] Table check query:",
      tableCheckQuery.toURL(),
    );
    const {
      data: tableCheck,
      error: tableError,
      count: tableCount,
    } = await tableCheckQuery;

    console.log("[checkUserProfileExists] Table check result:", {
      tableCheck,
      tableError,
      tableCount,
      status: tableError ? "ERROR" : "SUCCESS",
    });

    if (tableError) {
      console.error("[checkUserProfileExists] Table check failed:", {
        code: tableError.code,
        message: tableError.message,
        details: tableError.details,
        hint: tableError.hint,
      });
      return { exists: false, error: tableError };
    }

    // STEP 2: Check for the specific user
    console.log(
      `[checkUserProfileExists] STEP 2: Checking for specific ${isEmail ? "email" : "ID"}: ${userIdOrEmail}`,
    );
    const query = supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    // Apply the appropriate filter based on whether we're using email or ID
    const specificQuery = isEmail
      ? query.eq("email", userIdOrEmail)
      : query.eq("id", userIdOrEmail);

    console.log(
      "[checkUserProfileExists] Specific check query:",
      specificQuery.toURL(),
    );
    const { count, error } = await specificQuery;

    console.log("[checkUserProfileExists] Specific check result:", {
      count,
      error,
      status: error ? "ERROR" : "SUCCESS",
    });

    if (error) {
      console.error("[checkUserProfileExists] Error checking profile:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return { exists: false, error };
    }

    // STEP 3: If email check fails, try case-insensitive search
    if (isEmail && (count === null || count === 0)) {
      console.log(
        "[checkUserProfileExists] STEP 3: Email check returned no results, trying case-insensitive search",
      );
      const caseInsensitiveQuery = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .ilike("email", userIdOrEmail);

      console.log(
        "[checkUserProfileExists] Case-insensitive query:",
        caseInsensitiveQuery.toURL(),
      );
      const { count: caseCount, error: caseError } = await caseInsensitiveQuery;

      console.log("[checkUserProfileExists] Case-insensitive result:", {
        count: caseCount,
        error: caseError,
        status: caseError ? "ERROR" : "SUCCESS",
      });

      if (!caseError && caseCount !== null && caseCount > 0) {
        console.log(
          `[checkUserProfileExists] Found profile with case-insensitive search: ${caseCount} results`,
        );
        return { exists: true, error: null };
      }
    }

    const exists = count !== null && count > 0;
    console.log(`[checkUserProfileExists] Profile exists: ${exists}`);

    return { exists, error };
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
    const { count, error: tableError } = await supabase
      .from("user_preferences")
      .select("*", { count: "exact", head: true });

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
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

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
    const { data: existingPrefs } = await supabase
      .from("user_preferences")
      .select("user_id")
      .eq("user_id", userId)
      .single();

    let result;
    if (existingPrefs) {
      // Update existing preferences
      result = await supabase
        .from("user_preferences")
        .update({
          ...preferences,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      // Insert new preferences
      result = await supabase.from("user_preferences").insert({
        user_id: userId,
        ...preferences,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return { data: result.data, error: result.error };
  } catch (error: any) {
    console.error("Error updating user preferences:", error.message);
    return { data: null, error };
  }
}
