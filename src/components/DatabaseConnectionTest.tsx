import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

const DatabaseConnectionTest: React.FC = () => {
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // Test 1: Check Supabase connection
      console.log("[ConnectionTest] Testing Supabase connection");
      const { data: pingData, error: pingError } = await supabase.rpc("ping");

      // Test 2: List all tables in the public schema
      console.log("[ConnectionTest] Listing all tables");
      const { data: tablesData, error: tablesError } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public");

      // Test 3: Try a direct query on the users table
      console.log("[ConnectionTest] Querying users table directly");
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .limit(5);

      // Test 4: Check if the specific user exists
      console.log("[ConnectionTest] Checking specific user");
      const { data: specificUser, error: specificUserError } = await supabase
        .from("users")
        .select("*")
        .eq("email", "joshmputnam@gmail.com")
        .single();

      setResults({
        connection: {
          success: !pingError,
          data: pingData,
          error: pingError ? pingError.message : null,
        },
        tables: {
          success: !tablesError,
          data: tablesData,
          error: tablesError ? tablesError.message : null,
        },
        users: {
          success: !usersError,
          data: usersData,
          error: usersError ? usersError.message : null,
        },
        specificUser: {
          success: !specificUserError,
          data: specificUser,
          error: specificUserError ? specificUserError.message : null,
        },
      });
    } catch (err: any) {
      console.error("[ConnectionTest] Error:", err);
      setError(err.message || "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Database Connection Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <Button onClick={testConnection} disabled={isLoading}>
            {isLoading ? "Testing..." : "Test Connection"}
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-md">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {results && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Results:</h3>
            <div className="bg-muted p-4 rounded-md overflow-auto max-h-96">
              <pre className="text-xs">{JSON.stringify(results, null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DatabaseConnectionTest;
