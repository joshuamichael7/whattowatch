import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile, getUserPreferences } from "@/services/authService";

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

      // No need to verify auth user separately since we're using session.user directly
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
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log(
          "[initializeAuth] Initial session:",
          session ? "exists" : "null",
        );

        if (!isMounted) return;

        setSession(session);

        if (session?.user) {
          console.log(
            "[initializeAuth] User found, loading profile for:",
            session.user.id,
          );

          try {
            console.log(
              "[initializeAuth] Fetching profile directly with session user ID",
            );
            const { data, error } = await getUserProfile(session.user.id);

            if (!isMounted) return;

            if (error) {
              console.error(
                "[initializeAuth] Error fetching user profile:",
                error,
              );
            } else {
              console.log(
                "[initializeAuth] Profile loaded successfully:",
                data,
              );
              setProfile(data);
            }

            const { data: prefsData, error: prefsError } =
              await getUserPreferences(session.user.id);

            if (!isMounted) return;

            if (prefsData) {
              setPreferences(prefsData);
            }
          } catch (error: any) {
            if (!isMounted) return;
            console.error(
              "[initializeAuth] Error in profile fetch:",
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

        setSession(session);

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

          try {
            console.log(
              "[AuthContext] Fetching profile directly with session user ID",
            );
            const { data, error } = await getUserProfile(session.user.id);

            if (!isMounted) return;

            if (error) {
              console.error(
                "[AuthContext] Error fetching user profile:",
                error,
              );
            } else {
              console.log("[AuthContext] Profile loaded successfully:", data);
              setProfile(data);
            }

            const { data: prefsData, error: prefsError } =
              await getUserPreferences(session.user.id);

            if (!isMounted) return;

            if (prefsData) {
              setPreferences(prefsData);
            }
          } catch (error: any) {
            if (!isMounted) return;
            console.error(
              "[AuthContext] Error in profile fetch:",
              error.message,
              error.stack,
            );
          }
        } else {
          console.log(
            `[AuthContext] Auth event ${event} with no user, clearing profile`,
          );
          setProfile(null);
          setPreferences(null);
          setIsAdminVerified(false);
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = React.useMemo(() => {
    return profile?.role === "admin";
  }, [profile]);

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
