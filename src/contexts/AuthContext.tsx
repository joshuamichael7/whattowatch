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

  // Function to refresh user profile
  const refreshProfile = async () => {
    if (!user) return;

    try {
      console.log(`Refreshing profile for user ID: ${user.id}`);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
      } else {
        console.log(`Profile fetch result:`, data);
        setProfile(data);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
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
          await refreshProfile();
          await refreshPreferences();
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
      setIsAdminVerified(true);
    }
    return isCorrect;
  };

  // Determine if user is admin
  const isAdmin = React.useMemo(() => {
    console.log("Checking admin status:", { profile, userId: user?.id });
    if (!profile) {
      console.log("No profile found, user is not admin");
      return false;
    }
    if (!profile.role) {
      console.log("Profile has no role field, user is not admin");
      return false;
    }
    const result = profile.role === "admin";
    console.log(`Admin check result: ${result}, role=${profile.role}`);
    return result;
  }, [profile, user?.id]);

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
