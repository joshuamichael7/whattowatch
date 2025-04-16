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
export function AuthProvider({ children }: { children: React.ReactNode }) {
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
    const initializeAuth = async () => {
      setIsLoading(true);
      await refreshUser();
      setIsLoading(false);
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Auth event: ${event}`);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Ensure profile is loaded correctly with detailed logging
          try {
            console.log(
              `[AUTH] Loading profile for user ID: ${session.user.id}`,
            );
            console.log(`[AUTH] Supabase URL: ${supabase.supabaseUrl}`);
            console.log(`[AUTH] Auth token exists: ${!!session.access_token}`);

            // First attempt to load profile
            const { data, error } = await supabase
              .from("users")
              .select("*")
              .eq("id", session.user.id)
              .single();

            if (error) {
              console.error(
                `[AUTH] Error fetching user profile during auth change: ${error.code} - ${error.message}`,
                error,
              );
              console.log(`[AUTH] Full error details:`, JSON.stringify(error));

              // Log the raw query for debugging
              console.log(
                `[AUTH] Query attempted: users table, id=${session.user.id}`,
              );

              // Try a different approach - get all users to see if the table exists and has data
              const { data: allUsers, error: listError } = await supabase
                .from("users")
                .select("id")
                .limit(5);

              if (listError) {
                console.error(
                  `[AUTH] Error listing users: ${listError.code} - ${listError.message}`,
                );
              } else {
                console.log(
                  `[AUTH] Users table exists with ${allUsers?.length || 0} records`,
                );
              }
            } else {
              console.log(
                `[AUTH] Profile loaded successfully during auth change:`,
                data,
              );
              setProfile(data);
            }

            await refreshPreferences();
          } catch (err) {
            console.error("Unexpected error during profile loading:", err);
          }
        } else {
          setProfile(null);
          setPreferences(null);
        }

        setIsLoading(false);
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
    console.log("Checking admin status:", { profile, userId: user?.id });
    if (!profile) {
      console.log("No profile found, user is not admin");
      // If no profile but we have a user, trigger a refresh
      if (user && !isLoading) {
        console.log("User exists but no profile, triggering refresh");
        refreshProfile();
      }
      return false;
    }
    if (!profile.role) {
      console.log("Profile has no role field, user is not admin");
      return false;
    }
    const result = profile.role === "admin";
    console.log(`Admin check result: ${result}, role=${profile.role}`);
    return result;
  }, [profile, user?.id, isLoading]);

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
}

// Export the hook directly
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
