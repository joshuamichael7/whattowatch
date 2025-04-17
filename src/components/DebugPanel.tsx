import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const DebugPanel: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("query");

  // Log connection details on mount
  useEffect(() => {
    console.log("[DebugPanel] Environment variables check:");
    console.log(
      "VITE_SUPABASE_URL exists:",
      !!import.meta.env.VITE_SUPABASE_URL,
    );
    console.log(
      "VITE_SUPABASE_ANON_KEY exists:",
      !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    );
  }, []);

  const runDirectQuery = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log("[DebugPanel] Starting direct query");

      // Direct fetch to check connection
      const response = await fetch("/.netlify/functions/check-edge");
      const data = await response.json();

      setResults({
        message: "Direct fetch to Netlify function successful",
        data,
      });
      console.log("[DebugPanel] Direct fetch result:", data);
    } catch (err: any) {
      console.error("[DebugPanel] Error running query:", err);
      setError(err.message || "An unknown error occurred");
      setResults({ error: err.message || "An unknown error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  const checkRLS = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log("[DebugPanel] Starting RLS check");

      // Direct fetch to test edge function
      const response = await fetch("/.netlify/functions/test-edge");
      const data = await response.json();

      setResults({
        message: "Edge function test successful",
        data,
      });
      console.log("[DebugPanel] Edge function test result:", data);
    } catch (err: any) {
      console.error("[DebugPanel] Error checking RLS:", err);
      setError(err.message || "An unknown error occurred");
      setResults({ error: err.message || "An unknown error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  const createTestUser = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log("[DebugPanel] Starting OMDB test");

      // Test OMDB API through edge function
      const response = await fetch("/.netlify/functions/omdb?s=inception");
      const data = await response.json();

      setResults({
        message: "OMDB API test successful",
        data,
      });
      console.log("[DebugPanel] OMDB API test result:", data);
    } catch (err: any) {
      console.error("[DebugPanel] Error testing OMDB API:", err);
      setError(err.message || "An unknown error occurred");
      setResults({ error: err.message || "An unknown error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>API Debug Panel</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="query">Check Connection</TabsTrigger>
            <TabsTrigger value="rls">Test Edge Function</TabsTrigger>
            <TabsTrigger value="create">Test OMDB API</TabsTrigger>
          </TabsList>

          <TabsContent value="query" className="space-y-4 mt-4">
            <div className="flex flex-col space-y-4">
              <p className="text-sm text-muted-foreground">
                Test connection to Netlify functions.
              </p>
              <Button onClick={runDirectQuery} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rls" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Test edge function functionality.
            </p>
            <Button onClick={checkRLS} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Edge Function"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Test OMDB API through Netlify function.
            </p>
            <Button onClick={createTestUser} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test OMDB API"
              )}
            </Button>
          </TabsContent>
        </Tabs>

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

export default DebugPanel;
