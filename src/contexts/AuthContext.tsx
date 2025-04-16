import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  getCurrentUser,
  getCurrentSession,
  getUserPreferences,
} from "@/services/authService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  preferences: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAdminVerified: boolean;
  refreshUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
  verifyAdminPassword: (password: string) => Promise<boolean>;
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
  isAdminVerified: false,
  refreshUser: async () => {},
  refreshProfile: async () => {},
  refreshPreferences: async () => {},
  verifyAdminPassword: async () => false,
});

// Create the provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // Function to refresh user data
  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const currentSession = await getCurrentSession();
      setUser(currentUser);
      setSession(currentSession);

      if (currentUser) {
        await refreshProfile();
        await refreshPreferences();
      } else {
        setProfile(null);
        setPreferences(null);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  // Function to refresh user profile with detailed logging
  const refreshProfile = async () => {
    if (!user) {
      console.log(`[REFRESH] No user available, cannot refresh profile`);
      return;
    }

    try {
      console.log(`[REFRESH] Refreshing profile for user ID: ${user.id}`);
      console.log(
        `[REFRESH] Current session valid: ${!!session?.access_token}`,
      );

      // Log the request we're about to make
      console.log(`[REFRESH] Making request to users table with id=${user.id}`);

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(
          `[REFRESH] Error fetching user profile: ${error.code} - ${error.message}`,
        );
        console.log(`[REFRESH] Full error details:`, JSON.stringify(error));

        // Try to get table info to verify the table exists
        const { data: tableInfo, error: tableError } = await supabase
          .from("users")
          .select("count(*)")
          .limit(1);

        if (tableError) {
          console.error(
            `[REFRESH] Error checking users table: ${tableError.code} - ${tableError.message}`,
          );
        } else {
          console.log(
            `[REFRESH] Users table exists and contains data:`,
            tableInfo,
          );
        }

        // If no profile found, try to fetch it again after a short delay
        // This helps in cases where the auth is loaded but the profile hasn't been created yet
        if (error.code === "PGRST116") {
          // No rows found
          console.log(`[REFRESH] No profile found, retrying after delay...`);
          setTimeout(async () => {
            console.log(`[REFRESH] Executing retry for user ${user.id}`);
            const retryResult = await supabase
              .from("users")
              .select("*")
              .eq("id", user.id)
              .single();

            if (!retryResult.error) {
              console.log(
                `[REFRESH] Retry profile fetch succeeded:`,
                retryResult.data,
              );
              setProfile(retryResult.data);
            } else {
              console.error(
                `[REFRESH] Retry failed: ${retryResult.error.code} - ${retryResult.error.message}`,
              );
            }
          }, 1000);
        }
      } else {
        console.log(`[REFRESH] Profile fetch result:`, data);
        setProfile(data);
      }
    } catch (error) {
      console.error(`[REFRESH] Unexpected error refreshing profile:`, error);
    }
  };

  // Function to refresh user preferences
  const refreshPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await getUserPreferences(user.id);
      if (error) {
        console.error("Error fetching user preferences:", error);
      } else {
        setPreferences(data);
      }
    } catch (error) {
      console.error("Error refreshing preferences:", error);
    }
  };

  // Initial load of user data
  useEffect(() => {
    // Simple function to get session and profile in one go
    const getSessionAndProfile = async () => {
      setIsLoading(true);

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("[AUTH] Initial session check:", !!session);

      // Set user and session state
      setSession(session);
      setUser(session?.user || null);

      // If we have a user, get their profile
      if (session?.user) {
        console.log(`[AUTH] Loading profile for user ID: ${session.user.id}`);

        // Direct query to get profile
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error(
            `[AUTH] Error loading profile: ${error.code} - ${error.message}`,
          );

          // Check if users table exists
          const { data: tableCheck, error: tableError } = await supabase
            .from("users")
            .select("count(*)")
            .limit(1);

          console.log("[AUTH] Users table check:", { tableCheck, tableError });
        } else {
          console.log("[AUTH] Profile loaded successfully:", data);
          setProfile(data);

          // Also load preferences
          const { data: prefs } = await supabase
            .from("user_preferences")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

          if (prefs) setPreferences(prefs);
        }
      }

      setIsLoading(false);
    };

    // Run the initial load
    getSessionAndProfile();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AUTH] Auth event: ${event}`);

        // Update user and session state
        setSession(session);
        setUser(session?.user || null);

        if (session?.user) {
          // Load profile on auth change
          const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (error) {
            console.error(
              `[AUTH] Error loading profile on auth change: ${error.message}`,
            );
          } else {
            console.log("[AUTH] Profile loaded on auth change:", data);
            setProfile(data);
          }
        } else {
          // Clear profile and preferences if user logs out
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

  // Function to verify admin password
  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    // In a real application, you would verify this against a secure source
    // For demo purposes, we're using a hardcoded password
    // IMPORTANT: In production, use environment variables and proper security measures
    const correctPassword = "admin123"; // This should be an environment variable in production

    const isCorrect = password === correctPassword;
    if (isCorrect) {
      console.log("Admin password verified, setting isAdminVerified to true");
      setIsAdminVerified(true);
    } else {
      console.log("Incorrect admin password provided");
    }
    return isCorrect;
  };

  // Determine if user is admin
  const isAdmin = React.useMemo(() => {
    console.log("[AUTH] Checking admin status:", {
      profileExists: !!profile,
      profileRole: profile?.role,
      userId: user?.id,
    });

    // Simple check - if profile exists and has admin role
    if (!profile) return false;
    if (!profile.role) return false;

    const result = profile.role === "admin";
    console.log(`[AUTH] Admin check result: ${result}, role=${profile.role}`);
    return result;
  }, [profile]);

  const value = {
    user,
    session,
    profile,
    preferences,
    isLoading,
    isAuthenticated: !!user,
    isAdmin,
    isAdminVerified,
    refreshUser,
    refreshProfile,
    refreshPreferences,
    verifyAdminPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export the hook as a function declaration for better HMR compatibility
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
