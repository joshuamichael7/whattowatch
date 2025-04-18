import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to safely access environment variables
export function getEnvVar(key: string, defaultValue: string = ""): string {
  // For sensitive keys like API keys, we should only access them server-side
  // and not expose them to the client
  if (
    key === "GEMINI_API_KEY" ||
    key.includes("API_KEY") ||
    key.includes("SECRET")
  ) {
    // These keys should only be accessed via server-side functions
    console.log(
      `[getEnvVar] Sensitive key ${key} requested, using Netlify function instead`,
    );
    return defaultValue;
  }

  // For non-sensitive environment variables, we can use the client-side approach
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const viteKey = `VITE_${key}`;
    if (viteKey in import.meta.env) {
      return import.meta.env[viteKey] || defaultValue;
    }
    if (key in import.meta.env) {
      return import.meta.env[key] || defaultValue;
    }
  }

  // Fallback to process.env for server-side
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] || defaultValue;
  }

  console.log(`[getEnvVar] Env var ${key} not found, using default value`);
  return defaultValue;
}
