import { supabase } from "@/lib/supabaseClient";
import { User, Session } from "@supabase/supabase-js";

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
    console.log("Signing up with Supabase URL:", supabase.supabaseUrl);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    // If sign up is successful, create a user profile in the public.users table
    if (data.user && !error) {
      try {
        await createUserProfile(data.user.id, email, "user");
        console.log("User profile created successfully");
      } catch (profileError) {
        console.error("Error creating user profile:", profileError);
        // Continue even if profile creation fails
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

// Get current user
export async function getCurrentUser(): Promise<User | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error: any) {
    console.error("Error getting current user:", error.message);
    return null;
  }
}

// Get current session
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  } catch (error: any) {
    console.error("Error getting current session:", error.message);
    return null;
  }
}

// Create user profile in the public.users table
async function createUserProfile(
  userId: string,
  email: string,
  role: string = "user",
) {
  try {
    const { error } = await supabase.from("users").insert({
      id: userId,
      email,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error creating user profile:", error.message);
    }

    return { error };
  } catch (error: any) {
    console.error("Error creating user profile:", error.message);
    return { error };
  }
}

// Get user profile from the public.users table
export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    return { data, error };
  } catch (error: any) {
    console.error("Error getting user profile:", error.message);
    return { data: null, error };
  }
}

// Update user profile in the public.users table
export async function updateUserProfile(userId: string, updates: any) {
  try {
    const { data, error } = await supabase
      .from("users")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return { data, error };
  } catch (error: any) {
    console.error("Error updating user profile:", error.message);
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
