import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const SupabaseConnectionTest: React.FC = () => {
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Log environment variables on mount
  useEffect(() => {
    const envVars = {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "not set",
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY
        ? "exists"
        : "not set",
      SUPABASE_URL: "cannot access server-side env vars from browser",
      SUPABASE_ANON_KEY: "cannot access server-side env vars from browser",
    };

    setResults({
      environmentVariables: envVars,
    });
  }, []);

  const testDirectConnection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create a new Supabase client directly with the env vars
      const { createClient } = await import("@supabase/supabase-js");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase URL or key in environment variables");
      }

      console.log("Creating direct Supabase client with:", {
        url: supabaseUrl,
        keyExists: !!supabaseKey,
      });

      const directClient = createClient(supabaseUrl, supabaseKey);

      // Test 1: Basic ping - with timeout
      console.log("Testing direct connection to Supabase...");
      const pingPromise = directClient
        .rpc("ping")
        .then((result) => {
          console.log("Ping result:", result);
          return result;
        })
        .catch((err) => {
          console.error("Ping error:", err);
          throw err;
        });

      // Add timeout to ping
      const pingWithTimeout = Promise.race([
        pingPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Ping timeout after 5 seconds")),
            5000,
          ),
        ),
      ]);

      const pingResult = await pingWithTimeout;

      // Test 2: Try to access users table - with timeout
      console.log("Testing access to users table...");
      const usersPromise = directClient
        .from("users")
        .select("count", { count: "exact", head: true })
        .then((result) => {
          console.log("Users table result:", result);
          return result;
        })
        .catch((err) => {
          console.error("Users table error:", err);
          throw err;
        });

      // Add timeout to users query
      const usersWithTimeout = Promise.race([
        usersPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Users query timeout after 5 seconds")),
            5000,
          ),
        ),
      ]);

      const usersResult = await usersWithTimeout;

      setResults((prev) => ({
        ...prev,
        directConnection: {
          ping: pingResult,
          usersTable: usersResult,
        },
      }));
    } catch (err: any) {
      console.error("Error testing direct connection:", err);
      setError(err.message || "An unknown error occurred");
      setResults((prev) => ({
        ...prev,
        directConnection: {
          error: err.message || "An unknown error occurred",
        },
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const testFetchToSupabase = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase URL or key in environment variables");
      }

      console.log("Testing direct fetch to Supabase with:", {
        url: `${supabaseUrl}/rest/v1/users?select=count`,
        keyExists: !!supabaseKey,
      });

      // Create an AbortController for the timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Test direct fetch to Supabase REST API
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?select=count`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);
      console.log("Fetch response:", {
        status: response.status,
        statusText: response.statusText,
      });

      const data = await response.json();
      console.log("Fetch data:", data);

      setResults((prev) => ({
        ...prev,
        directFetch: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
      }));
    } catch (err: any) {
      console.error("Error testing fetch to Supabase:", err);
      setError(err.message || "An unknown error occurred");
      setResults((prev) => ({
        ...prev,
        directFetch: {
          error: err.message || "An unknown error occurred",
        },
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const testCorsWithNetlify = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("Testing CORS with Netlify function...");

      // Create an AbortController for the timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Test using Netlify function as a proxy
      const response = await fetch("/.netlify/functions/check-edge", {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("Netlify function response:", {
        status: response.status,
        statusText: response.statusText,
      });

      const data = await response.json();
      console.log("Netlify function data:", data);

      setResults((prev) => ({
        ...prev,
        netlifyProxy: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
      }));
    } catch (err: any) {
      console.error("Error testing Netlify proxy:", err);
      setError(err.message || "An unknown error occurred");
      setResults((prev) => ({
        ...prev,
        netlifyProxy: {
          error: err.message || "An unknown error occurred",
        },
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Supabase Connection Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4">
          <Button onClick={testDirectConnection} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Direct Connection...
              </>
            ) : (
              "Test Direct Supabase Connection"
            )}
          </Button>

          <Button onClick={testFetchToSupabase} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Fetch...
              </>
            ) : (
              "Test Direct Fetch to Supabase"
            )}
          </Button>

          <Button onClick={testCorsWithNetlify} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Netlify Proxy...
              </>
            ) : (
              "Test Netlify Function Proxy"
            )}
          </Button>
        </div>

        {error && (
          <div className="mt-6 border-t pt-4">
            <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-md">
              <h3 className="font-medium">Error:</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-medium mb-2">Results</h3>
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupabaseConnectionTest;
