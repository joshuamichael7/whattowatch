import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile, getUserPreferences } from "@/services/authService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  preferences: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  preferences: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  refreshProfile: async () => {},
});

// Create the provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to refresh user profile
  const refreshProfile = async () => {
    if (!user) {
      console.log("[refreshProfile] No user, skipping profile refresh");
      return;
    }

    try {
      console.log("[refreshProfile] Refreshing profile for user:", user.id);

      // Check if the user exists in auth
      const { data: authUser, error: authError } =
        await supabase.auth.getUser();
      console.log("[refreshProfile] Auth user check:", {
        exists: !!authUser?.user,
        id: authUser?.user?.id,
        error: authError,
      });

      // Get profile from public.users table
      const { data, error } = await getUserProfile(user.id);

      if (error) {
        console.error("[refreshProfile] Error fetching user profile:", error);

        // Try a direct query to see what's in the users table
        const { data: allUsers, error: listError } = await supabase
          .from("users")
          .select("id, email")
          .limit(5);

        console.log("[refreshProfile] Sample users in table:", {
          users: allUsers,
          error: listError,
        });
      } else {
        console.log("[refreshProfile] Profile loaded successfully:", data);
        setProfile(data);
      }

      // Get preferences
      const { data: prefsData, error: prefsError } = await getUserPreferences(
        user.id,
      );
      console.log("[refreshProfile] Preferences result:", {
        data: prefsData,
        error: prefsError,
      });

      if (prefsData) {
        setPreferences(prefsData);
      }
    } catch (error: any) {
      console.error(
        "[refreshProfile] Exception in profile refresh:",
        error.message,
        error.stack,
      );
    }
  };

  // Initial load of user data
  useEffect(() => {
    // Get current session and set up auth state change listener
    const initializeAuth = async () => {
      setIsLoading(true);

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log(
        "[initializeAuth] Initial session:",
        session ? "exists" : "null",
      );

      // Set user and session state
      setSession(session);
      setUser(session?.user || null);

      // If we have a user, get their profile
      if (session?.user) {
        console.log(
          "[initializeAuth] User found, loading profile for:",
          session.user.id,
        );
        await refreshProfile();
      }

      setIsLoading(false);
    };

    // Run the initial load
    initializeAuth();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext] Auth event: ${event}`);

        // Update user and session state
        setSession(session);
        setUser(session?.user || null);

        if (session?.user) {
          // Load profile on auth change
          console.log(
            `[AuthContext] Auth event ${event} with user, loading profile for:`,
            session.user.id,
          );
          console.log(`[AuthContext] User details:`, {
            id: session.user.id,
            email: session.user.email,
            created_at: session.user.created_at,
          });

          // Try to load the profile immediately
          await refreshProfile();
        } else {
          // Clear profile and preferences if user logs out
          console.log(
            `[AuthContext] Auth event ${event} with no user, clearing profile`,
          );
          setProfile(null);
          setPreferences(null);
        }
      },
    );

    // Clean up subscription on unmount
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Determine if user is admin
  const isAdmin = React.useMemo(() => {
    // Simple check - if profile exists and has admin role
    return profile?.role === "admin";
  }, [profile]);

  const value = {
    user,
    session,
    profile,
    preferences,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    refreshProfile,
  };

  // Log the auth context state to the browser console
  console.log("[AUTH_CONTEXT] Current state:", {
    user: user ? { id: user.id, email: user.email } : null,
    profile,
    isAuthenticated: !!user,
    isAdmin,
    isLoading,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export the hook as a named export, not a function declaration
// This fixes the HMR issue with "useAuth export is incompatible"
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
