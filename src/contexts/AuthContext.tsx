import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  getUserProfile,
  getUserPreferences,
  checkUserProfileExists,
} from "@/services/authService";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: any | null;
  preferences: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAdminVerified?: boolean;
  refreshProfile: () => Promise<void>;
  verifyAdminPassword?: (password: string) => Promise<boolean>;
};

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

// Helper function to load a user profile with retry logic
async function loadUserProfile(
  userId: string,
  isMounted: boolean,
  logPrefix: string,
) {
  // First check if the profile exists
  console.log(`[${logPrefix}] Checking if profile exists for user: ${userId}`);
  const { exists, error: checkError } = await checkUserProfileExists(userId);

  if (!isMounted) return { profileData: null, profileError: null };

  if (checkError) {
    console.error(
      `[${logPrefix}] Error checking if profile exists:`,
      checkError,
    );
  }

  // If profile doesn't exist, don't try to load it
  if (!exists) {
    console.log(
      `[${logPrefix}] No profile exists for user ${userId}, not creating one automatically`,
    );
    return { profileData: null, profileError: null };
  }

  // If profile exists, make multiple attempts to get it
  let profileData = null;
  let profileError = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (!profileData && attempts < maxAttempts) {
    attempts++;
    console.log(`[${logPrefix}] Profile fetch attempt ${attempts}`);

    try {
      // Wait for profile data with a small delay between attempts
      const { data, error } = await getUserProfile(userId);

      if (!isMounted) return { profileData: null, profileError: null };

      if (error) {
        console.error(
          `[${logPrefix}] Error fetching user profile (attempt ${attempts}):`,
          error,
        );
        profileError = error;

        // Add a small delay before retrying
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
        }
      } else {
        console.log(
          `[${logPrefix}] Profile loaded successfully (attempt ${attempts}):`,
          data,
        );
        profileData = data;
        break; // Exit the loop if we got the profile
      }
    } catch (error: any) {
      if (!isMounted) return { profileData: null, profileError: null };
      console.error(
        `[${logPrefix}] Exception in profile fetch (attempt ${attempts}):`,
        error.message,
        error.stack,
      );
      profileError = error;

      // Add a small delay before retrying
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
      }
    }
  }

  return { profileData, profileError };
}

// Define the provider component as a named function declaration
function AuthProviderComponent({ children }: { children: React.ReactNode }) {
  // Only maintain session as the source of truth for user
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // Get the current user directly from session
  const currentUser = session?.user || null;

  const refreshProfile = async () => {
    // Always use session.user directly instead of a separate user state
    if (!session?.user) {
      console.log("[refreshProfile] No session user, skipping profile refresh");
      return;
    }

    try {
      console.log(
        "[refreshProfile] Refreshing profile for user:",
        session.user.id,
      );

      // Check if profile exists before attempting to load it
      const { exists, error: checkError } = await checkUserProfileExists(
        session.user.id,
      );

      if (checkError) {
        console.error(
          "[refreshProfile] Error checking if profile exists:",
          checkError,
        );
      }

      if (exists) {
        // Fetch user profile with proper error handling
        const { data, error } = await getUserProfile(session.user.id);

        if (error) {
          console.error("[refreshProfile] Error fetching user profile:", error);

          // Diagnostic query to check if users table is accessible
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
          // Ensure we update the profile state immediately
          setProfile(data);
        }
      } else {
        console.log(
          "[refreshProfile] No profile exists for this user, not creating one automatically",
        );
      }

      // Fetch user preferences
      const { data: prefsData, error: prefsError } = await getUserPreferences(
        session.user.id,
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

  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!session?.user || !profile || profile.role !== "admin") {
      return false;
    }

    try {
      const isValid = password === "admin123";

      if (isValid) {
        setIsAdminVerified(true);
      }

      return isValid;
    } catch (error) {
      console.error("Error verifying admin password:", error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      if (!isMounted) return;
      setIsLoading(true);

      try {
        // Step 1: Get the session
        console.log("[initializeAuth] Step 1: Getting session");
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log(
          "[initializeAuth] Initial session:",
          session ? "exists" : "null",
        );

        if (!isMounted) return;
        setSession(session);

        // Step 2: If we have a user, get their profile
        if (session?.user) {
          console.log(
            "[initializeAuth] Step 2: User found, loading profile for:",
            session.user.id,
          );

          // Use the extracted helper function to load the profile
          const { profileData } = await loadUserProfile(
            session.user.id,
            isMounted,
            "initializeAuth",
          );

          if (profileData && isMounted) {
            setProfile(profileData);
          }

          // Step 3: Only proceed to preferences after profile is loaded or confirmed not to exist
          console.log("[initializeAuth] Step 3: Loading user preferences");
          try {
            const { data: prefsData, error: prefsError } =
              await getUserPreferences(session.user.id);

            if (!isMounted) return;

            if (prefsData) {
              console.log(
                "[initializeAuth] Preferences loaded successfully:",
                prefsData,
              );
              setPreferences(prefsData);
            } else if (prefsError) {
              console.error(
                "[initializeAuth] Error loading preferences:",
                prefsError,
              );
            }
          } catch (error: any) {
            if (!isMounted) return;
            console.error(
              "[initializeAuth] Exception in preferences fetch:",
              error.message,
              error.stack,
            );
          }
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("[initializeAuth] Error:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        console.log(`[AuthContext] Auth event: ${event}`);

        // Step 1: Update session state
        setSession(session);

        // For sign out events, clear everything immediately
        if (!session) {
          console.log(
            `[AuthContext] Auth event ${event} with no session, clearing profile`,
          );
          setProfile(null);
          setPreferences(null);
          setIsAdminVerified(false);
          return;
        }

        // Step 2: For events with a user, load their profile
        if (session?.user) {
          console.log(
            `[AuthContext] Auth event ${event} with user, loading profile for:`,
            session.user.id,
          );
          console.log(`[AuthContext] User details:`, {
            id: session.user.id,
            email: session.user.email,
            created_at: session.user.created_at,
          });

          // Use the extracted helper function to load the profile
          const { profileData } = await loadUserProfile(
            session.user.id,
            isMounted,
            "AuthContext",
          );

          if (profileData && isMounted) {
            setProfile(profileData);
          }

          // Step 3: Only proceed to preferences after profile is loaded or confirmed not to exist
          console.log("[AuthContext] Loading user preferences");
          try {
            const { data: prefsData, error: prefsError } =
              await getUserPreferences(session.user.id);

            if (!isMounted) return;

            if (prefsData) {
              console.log(
                "[AuthContext] Preferences loaded successfully:",
                prefsData,
              );
              setPreferences(prefsData);
            } else if (prefsError) {
              console.error(
                "[AuthContext] Error loading preferences:",
                prefsError,
              );
            }
          } catch (error: any) {
            if (!isMounted) return;
            console.error(
              "[AuthContext] Exception in preferences fetch:",
              error.message,
              error.stack,
            );
          }
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = React.useMemo(() => {
    // For debugging purposes, log the profile data
    console.log("[isAdmin check] Current profile:", profile);

    // Check if the user has the admin role
    const hasAdminRole = profile?.role === "admin";
    console.log("[isAdmin check] Has admin role:", hasAdminRole);

    // If we're having issues with the profile loading, add a fallback check
    // for specific admin users by email
    const adminEmails = ["joshmputnam@gmail.com"];
    const isAdminByEmail =
      currentUser?.email && adminEmails.includes(currentUser.email);
    console.log("[isAdmin check] Is admin by email:", isAdminByEmail);

    return hasAdminRole || isAdminByEmail;
  }, [profile, currentUser?.email]);

  const value = {
    user: currentUser, // Use currentUser derived from session
    session,
    profile,
    preferences,
    isLoading,
    isAuthenticated: !!currentUser, // Use currentUser for authentication check
    isAdmin,
    isAdminVerified,
    refreshProfile,
    verifyAdminPassword,
  };

  console.log("[AUTH_CONTEXT] Current state:", {
    user: currentUser ? { id: currentUser.id, email: currentUser.email } : null,
    profile,
    isAuthenticated: !!currentUser,
    isAdmin,
    isAdminVerified,
    isLoading,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Export the provider as a named export
export const AuthProvider = AuthProviderComponent;

// Export the hook as a named function
function useAuthHook() {
  return useContext(AuthContext);
}

export const useAuth = useAuthHook;
