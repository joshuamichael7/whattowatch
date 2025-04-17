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

// Get user profile from the public.users table
export async function getUserProfile(userId: string) {
  try {
    console.log("[getUserProfile] Fetching profile for user ID:", userId);
    console.log("[getUserProfile] Supabase URL:", supabase.supabaseUrl);
    console.log("[getUserProfile] Table being queried:", "users");

    // First, check if the table exists and is accessible
    const { data: tableCheck, error: tableError } = await supabase
      .from("users")
      .select("count(*)", { count: "exact", head: true });

    console.log("[getUserProfile] Table check result:", {
      tableCheck,
      tableError,
    });

    // Now try to get the specific user
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("[getUserProfile] Query result:", { data, error });

    if (error) {
      console.error("[getUserProfile] Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
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
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    return { data, error };
  } catch (error: any) {
    console.error("Error getting user preferences:", error.message);
    return { data: null, error };
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
