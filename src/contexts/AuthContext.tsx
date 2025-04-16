import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import {
  getCurrentUser,
  getCurrentSession,
  getUserProfile,
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
  refreshUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPreferences: () => Promise<void>;
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
  refreshUser: async () => {},
  refreshProfile: async () => {},
  refreshPreferences: async () => {},
});

// Create the provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      const { data, error } = await getUserProfile(user.id);
      if (error) {
        console.error("Error fetching user profile:", error);
      } else {
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

  const value = {
    user,
    session,
    profile,
    preferences,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: !!profile?.role && profile.role === "admin",
    refreshUser,
    refreshProfile,
    refreshPreferences,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Export the hook directly as a named function
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
