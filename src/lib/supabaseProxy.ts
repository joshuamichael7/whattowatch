import { createClient } from "@supabase/supabase-js";

// Get Supabase URL and key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Create Supabase client with environment variables
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Function to fetch data from Supabase REST API directly
export async function fetchFromSupabase(
  path: string,
  options: RequestInit = {},
) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL or key in environment variables");
  }

  const url = `${supabaseUrl}/rest/v1/${path}`;

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Supabase REST API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching from Supabase:", error);
    throw error;
  }
}

// Function to get users
export async function getUsers(limit = 10) {
  return fetchFromSupabase(`users?select=*&limit=${limit}`);
}

// Function to get user by ID
export async function getUserById(id: string) {
  return fetchFromSupabase(`users?id=eq.${id}&select=*`);
}

// Function to get user by email
export async function getUserByEmail(email: string) {
  return fetchFromSupabase(
    `users?email=eq.${encodeURIComponent(email)}&select=*`,
  );
}

// Function to create user
export async function createUser(userData: any) {
  return fetchFromSupabase("users", {
    method: "POST",
    body: JSON.stringify(userData),
    headers: {
      Prefer: "return=representation",
    },
  });
}

// Function to update user
export async function updateUser(id: string, userData: any) {
  return fetchFromSupabase(`users?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(userData),
    headers: {
      Prefer: "return=representation",
    },
  });
}
