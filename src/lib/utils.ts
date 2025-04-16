import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to safely access environment variables
export function getEnvVar(key: string, defaultValue: string = ""): string {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    // First check for VITE_ prefixed variables which are exposed to the client
    const viteKey = `VITE_${key}`;
    if (viteKey in import.meta.env) {
      return import.meta.env[viteKey] || defaultValue;
    }
    // Then check for the regular key
    if (key in import.meta.env) {
      return import.meta.env[key] || defaultValue;
    }
  }
  // Fallback to process.env for server-side
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key] || defaultValue;
  }
  return defaultValue;
}
