import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  getUserProfileById,
  getUserProfileByEmail,
} from "@/services/userProfileService";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  refreshProfile: async () => {},
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get the current user directly from session
  const currentUser = session?.user || null;

  // Function to refresh user profile
  const refreshProfile = async () => {
    if (!currentUser) {
      console.log(
        "[refreshProfile] No user logged in, skipping profile refresh",
      );
      return;
    }

    try {
      console.log(
        "[refreshProfile] Refreshing profile for user:",
        currentUser.email || currentUser.id,
      );

      let userProfile = null;

      // First try to get profile by email if available
      if (currentUser.email) {
        userProfile = await getUserProfileByEmail(currentUser.email);
      }

      // If no profile found by email, try by ID
      if (!userProfile) {
        userProfile = await getUserProfileById(currentUser.id);
      }

      if (userProfile) {
        console.log(
          "[refreshProfile] Profile loaded successfully:",
          userProfile,
        );
        setProfile(userProfile);
      } else {
        console.log("[refreshProfile] No profile found for user");
        setProfile(null);
      }
    } catch (error) {
      console.error("[refreshProfile] Error refreshing profile:", error);
    }
  };

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      if (!isMounted) return;
      setIsLoading(true);

      try {
        // Get the session
        console.log("[initializeAuth] Getting session");
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setSession(session);

        // If we have a user, get their profile
        if (session?.user) {
          console.log("[initializeAuth] User found, loading profile");
          await refreshProfile();
        }
      } catch (error) {
        console.error("[initializeAuth] Error:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        console.log(`[AuthContext] Auth event: ${event}`);

        // Update session state
        setSession(session);

        // For sign out events, clear profile
        if (!session) {
          console.log(
            `[AuthContext] Auth event ${event} with no session, clearing profile`,
          );
          setProfile(null);
          return;
        }

        // For events with a user, load their profile
        if (session?.user) {
          console.log(
            `[AuthContext] Auth event ${event} with user, loading profile`,
          );
          await refreshProfile();
        }
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Determine if user is admin based on profile role
  const isAdmin = profile?.role === "admin";

  const value = {
    user: currentUser,
    session,
    profile,
    isLoading,
    isAuthenticated: !!currentUser,
    isAdmin,
    refreshProfile,
  };

  console.log("[AUTH_CONTEXT] Current state:", {
    user: currentUser ? { id: currentUser.id, email: currentUser.email } : null,
    profile,
    isAuthenticated: !!currentUser,
    isAdmin,
    isLoading,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

export { AuthProvider, useAuth };
