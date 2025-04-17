import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { getUserProfile } from "@/services/userProfileService";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isAdminVerified?: boolean;
  verifyAdminPassword: (password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,
  isAdminVerified: false,
  verifyAdminPassword: async () => false,
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // Initialize auth state
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      if (!isMounted) return;
      setIsLoading(true);

      try {
        // Get the session
        console.log("[AuthContext] Getting session");
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setSession(session);

        // If we have a user, get their profile
        if (session?.user) {
          console.log("[AuthContext] User found, loading profile");
          const userProfile = await getUserProfile(session.user.id);
          if (isMounted) {
            console.log("[AuthContext] Profile loaded:", userProfile);
            setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error("[AuthContext] Error:", error);
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
          console.log(`[AuthContext] No session, clearing profile`);
          setProfile(null);
          return;
        }

        // For events with a user, load their profile
        if (session?.user) {
          console.log(`[AuthContext] User present, loading profile`);
          const userProfile = await getUserProfile(session.user.id);
          if (isMounted) {
            console.log("[AuthContext] Profile loaded:", userProfile);
            setProfile(userProfile);
          }
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
  const currentUser = session?.user || null;

  // Function to verify admin password using Netlify function
  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    if (!currentUser) return false;

    try {
      const response = await fetch("/.netlify/functions/auth-helper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "verifyAdminPassword",
          userId: currentUser.id,
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAdminVerified(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("[AuthContext] Error verifying admin password:", error);
      return false;
    }
  };

  const value = {
    user: currentUser,
    session,
    profile,
    isLoading,
    isAuthenticated: !!currentUser,
    isAdmin,
    isAdminVerified,
    verifyAdminPassword,
  };

  console.log("[AuthContext] Current state:", {
    user: currentUser ? { id: currentUser.id, email: currentUser.email } : null,
    profile,
    isAuthenticated: !!currentUser,
    isAdmin,
    isAdminVerified,
    isLoading,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

export { AuthProvider, useAuth };
