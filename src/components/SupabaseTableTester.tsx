import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";

const SupabaseTableTester: React.FC = () => {
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testUsersTable = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // Test 1: Check if we can list tables
      console.log("[TableTester] Attempting to list tables");
      const { data: tableList, error: tableListError } = await supabase
        .from("users")
        .select("count(*)", { count: "exact", head: true });

      // Test 2: Try a simple query on the users table
      console.log("[TableTester] Attempting to query users table");
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .limit(5);

      setResults({
        tableCheck: {
          data: tableList,
          error: tableListError
            ? {
                message: tableListError.message,
                code: tableListError.code,
                details: tableListError.details,
              }
            : null,
        },
        usersQuery: {
          data: usersData,
          error: usersError
            ? {
                message: usersError.message,
                code: usersError.code,
                details: usersError.details,
              }
            : null,
        },
      });
    } catch (err: any) {
      console.error("[TableTester] Error:", err);
      setError(err.message || "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Supabase Table Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <Button onClick={testUsersTable} disabled={isLoading}>
            {isLoading ? "Testing..." : "Test Users Table"}
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

export default SupabaseTableTester;
