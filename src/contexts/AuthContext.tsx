import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  getUserPreferences,
  checkUserProfileExists,
} from "@/services/authService";
import {
  getUserById,
  getUserByEmail,
  fetchFromSupabase,
} from "@/lib/supabaseProxy";

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

// Helper function to load a user profile with retry logic - prioritizes email lookup
async function loadUserProfile(
  user: User,
  isMounted: boolean,
  logPrefix: string,
) {
  // First try to get the profile by email (faster and more reliable)
  if (user.email) {
    console.log(
      `[${logPrefix}] Checking if profile exists by email: ${user.email}`,
    );
    const { exists, error: checkError } = await checkUserProfileExists(
      user.email,
      true,
    );

    if (!isMounted) return { profileData: null, profileError: null };

    if (checkError) {
      console.error(
        `[${logPrefix}] Error checking if profile exists by email:`,
        checkError,
      );
    }

    // If profile exists by email, try to load it
    if (exists) {
      console.log(`[${logPrefix}] Profile exists by email, loading it`);
      let profileData = null;
      let profileError = null;
      let attempts = 0;
      const maxAttempts = 2; // Fewer attempts needed for email lookup

      while (!profileData && attempts < maxAttempts) {
        attempts++;
        console.log(
          `[${logPrefix}] Profile fetch by email attempt ${attempts}`,
        );

        try {
          // Wait for profile data with a small delay between attempts using supabaseProxy
          const userData = await getUserByEmail(user.email!);

          if (!isMounted) return { profileData: null, profileError: null };

          if (!userData || userData.length === 0) {
            console.error(
              `[${logPrefix}] Error fetching user profile by email (attempt ${attempts}): User not found`,
            );
            profileError = { message: "User not found" };

            // Add a small delay before retrying
            if (attempts < maxAttempts) {
              await new Promise((resolve) =>
                setTimeout(resolve, 300 * attempts),
              );
            }
          } else {
            const data = userData[0];
            console.log(
              `[${logPrefix}] Profile loaded successfully by email (attempt ${attempts}):`,
              data,
            );
            profileData = data;
            break; // Exit the loop if we got the profile
          }
        } catch (error: any) {
          if (!isMounted) return { profileData: null, profileError: null };
          console.error(
            `[${logPrefix}] Exception in profile fetch by email (attempt ${attempts}):`,
            error.message,
            error.stack,
          );
          profileError = error;

          // Add a small delay before retrying
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 300 * attempts));
          }
        }
      }

      // If we found the profile by email, return it
      if (profileData) {
        return { profileData, profileError };
      }
    }
  }

  // Fallback to ID-based lookup if email lookup failed or wasn't possible
  console.log(
    `[${logPrefix}] Checking if profile exists for user ID: ${user.id}`,
  );
  const { exists, error: checkError } = await checkUserProfileExists(user.id);

  if (!isMounted) return { profileData: null, profileError: null };

  if (checkError) {
    console.error(
      `[${logPrefix}] Error checking if profile exists by ID:`,
      checkError,
    );
  }

  // If profile doesn't exist, don't try to load it
  if (!exists) {
    console.log(
      `[${logPrefix}] No profile exists for user ${user.id}, not creating one automatically`,
    );
    return { profileData: null, profileError: null };
  }

  // If profile exists by ID, make multiple attempts to get it
  let profileData = null;
  let profileError = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (!profileData && attempts < maxAttempts) {
    attempts++;
    console.log(`[${logPrefix}] Profile fetch by ID attempt ${attempts}`);

    try {
      // Wait for profile data with a small delay between attempts using supabaseProxy
      const userData = await getUserById(user.id);

      if (!isMounted) return { profileData: null, profileError: null };

      if (!userData || userData.length === 0) {
        console.error(
          `[${logPrefix}] Error fetching user profile by ID (attempt ${attempts}): User not found`,
        );
        profileError = { message: "User not found" };

        // Add a small delay before retrying
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
        }
      } else {
        const data = userData[0];
        console.log(
          `[${logPrefix}] Profile loaded successfully by ID (attempt ${attempts}):`,
          data,
        );
        profileData = data;
        break; // Exit the loop if we got the profile
      }
    } catch (error: any) {
      if (!isMounted) return { profileData: null, profileError: null };
      console.error(
        `[${logPrefix}] Exception in profile fetch by ID (attempt ${attempts}):`,
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
        session.user.email || session.user.id,
      );

      // First try to get the profile by email if available (faster and more reliable)
      if (session.user.email) {
        console.log("[refreshProfile] Trying to get profile by email first");

        // Check if profile exists by email before attempting to load it
        const { exists: existsByEmail, error: checkEmailError } =
          await checkUserProfileExists(
            session.user.email,
            true, // isEmail = true
          );

        if (checkEmailError) {
          console.error(
            "[refreshProfile] Error checking if profile exists by email:",
            checkEmailError,
          );
        }

        if (existsByEmail) {
          // Fetch user profile by email with proper error handling using supabaseProxy
          try {
            const userData = await getUserByEmail(session.user.email);
            const data = userData && userData.length > 0 ? userData[0] : null;
            const error = !data ? { message: "User not found" } : null;

            if (error) {
              console.error(
                "[refreshProfile] Error fetching user profile by email:",
                error,
              );
            } else {
              console.log(
                "[refreshProfile] Profile loaded successfully by email:",
                data,
              );
              // Ensure we update the profile state immediately
              setProfile(data);

              // Fetch user preferences after profile is loaded
              const { data: prefsData, error: prefsError } =
                await getUserPreferences(session.user.id);
              console.log("[refreshProfile] Preferences result:", {
                data: prefsData,
                error: prefsError,
              });

              if (prefsData) {
                setPreferences(prefsData);
              }

              // If we found the profile by email, we're done
              return;
            }
          } catch (error) {
            console.error(
              "[refreshProfile] Exception fetching user profile by email:",
              error,
            );
          }
        } else {
          console.log(
            "[refreshProfile] No profile exists by email, falling back to ID lookup",
          );
        }
      }

      // Fallback to ID-based lookup
      console.log("[refreshProfile] Checking profile by user ID");
      const { exists, error: checkError } = await checkUserProfileExists(
        session.user.id,
      );

      if (checkError) {
        console.error(
          "[refreshProfile] Error checking if profile exists by ID:",
          checkError,
        );
      }

      if (exists) {
        // Fetch user profile with proper error handling using supabaseProxy
        try {
          const userData = await getUserById(session.user.id);
          const data = userData && userData.length > 0 ? userData[0] : null;
          const error = !data ? { message: "User not found" } : null;

          if (error) {
            console.error(
              "[refreshProfile] Error fetching user profile by ID:",
              error,
            );

            // Diagnostic query to check if users table is accessible
            try {
              const allUsers = await fetchFromSupabase(
                "users?select=id,email&limit=5",
              );
              console.log("[refreshProfile] Sample users in table:", {
                users: allUsers,
                error: null,
              });
            } catch (listError) {
              console.log(
                "[refreshProfile] Error fetching sample users:",
                listError,
              );
            }
          } else {
            console.log(
              "[refreshProfile] Profile loaded successfully by ID:",
              data,
            );
            // Ensure we update the profile state immediately
            setProfile(data);
          }
        } catch (error) {
          console.error(
            "[refreshProfile] Exception fetching user profile by ID:",
            error,
          );
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

      // Set a timeout to stop loading after a reasonable time
      // This prevents the UI from being stuck in loading state
      const loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.log(
            "[initializeAuth] Loading timeout reached, stopping loading state",
          );
          setIsLoading(false);
        }
      }, 5000); // 5 seconds max loading time

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
            session.user,
            isMounted,
            "initializeAuth",
          );

          if (profileData && isMounted) {
            setProfile(profileData);
          }

          // Step 3: Preferences are optional, don't block on them
          console.log(
            "[initializeAuth] Step 3: Loading user preferences (optional)",
          );
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
            } else {
              // No preferences found, that's fine
              console.log("[initializeAuth] No preferences found, continuing");
              // Set empty preferences to avoid further loading attempts
              setPreferences({});
            }
          } catch (error: any) {
            if (!isMounted) return;
            console.error(
              "[initializeAuth] Exception in preferences fetch:",
              error.message,
              error.stack,
            );
            // Set empty preferences to avoid further loading attempts
            setPreferences({});
          }
        }
      } catch (error) {
        if (!isMounted) return;
        console.error("[initializeAuth] Error:", error);
      } finally {
        if (isMounted) {
          clearTimeout(loadingTimeout);
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
            session.user,
            isMounted,
            "AuthContext",
          );

          if (profileData && isMounted) {
            setProfile(profileData);
          }

          // Step 3: Preferences are optional, don't block on them
          console.log("[AuthContext] Loading user preferences (optional)");
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
            } else {
              // No preferences found, that's fine
              console.log("[AuthContext] No preferences found, continuing");
              // Set empty preferences to avoid further loading attempts
              setPreferences({});
            }
          } catch (error: any) {
            if (!isMounted) return;
            console.error(
              "[AuthContext] Exception in preferences fetch:",
              error.message,
              error.stack,
            );
            // Set empty preferences to avoid further loading attempts
            setPreferences({});
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

    // If we have a profile with admin role, that's our source of truth
    if (profile && hasAdminRole) {
      return true;
    }

    // If we have a profile but not admin role, they're definitely not admin
    if (profile && profile.role !== "admin") {
      return false;
    }

    // If we don't have a profile yet, check if they're an admin in the database
    // using a direct database query
    if (currentUser?.email) {
      // We'll use the RPC function to check if they're an admin
      // This is an async operation but we can't use async in useMemo
      // So we'll trigger it and update the state later
      (async () => {
        try {
          console.log(
            "[isAdmin check] Checking admin status via RPC for email:",
            currentUser.email,
          );
          const { data, error } = await supabase.rpc("find_user_by_email", {
            email_to_find: currentUser.email,
          });

          console.log("[isAdmin check] RPC result:", { data, error });

          if (data && data.length > 0 && data[0].role === "admin") {
            console.log("[isAdmin check] User is admin according to database");
            // We found the user and they're an admin
            // We can't update state here directly, but we can refresh the profile
            refreshProfile();
          }
        } catch (error) {
          console.error(
            "[isAdmin check] Error checking admin status via RPC:",
            error,
          );
        }
      })();
    }

    // Default to false if we can't determine admin status yet
    return false;
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
