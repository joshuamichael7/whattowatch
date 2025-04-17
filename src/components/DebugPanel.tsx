import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

const DebugPanel: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("query");

  // Log Supabase connection details on mount
  useEffect(() => {
    console.log("[DebugPanel] Supabase URL:", supabase.supabaseUrl);
    console.log("[DebugPanel] Anon key exists:", !!supabase.supabaseKey);
  }, []);

  const runDirectQuery = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log("[DebugPanel] Starting direct query");

      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[DebugPanel] Session data:", sessionData);

      // Run direct query to get all users
      console.log("[DebugPanel] Querying all users");
      const { data: allUsers, error: allUsersError } = await supabase
        .from("users")
        .select("*")
        .limit(10);

      console.log("[DebugPanel] All users result:", {
        data: allUsers,
        error: allUsersError,
      });

      // Run specific query if ID or email provided
      let specificResult = null;
      if (userId) {
        console.log(`[DebugPanel] Querying user by ID: ${userId}`);
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        console.log("[DebugPanel] User by ID result:", { data, error });
        specificResult = { type: "id", data, error };
      } else if (email) {
        console.log(`[DebugPanel] Querying user by email: ${email}`);
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .single();

        console.log("[DebugPanel] User by email result:", { data, error });
        specificResult = { type: "email", data, error };
      }

      // Set results
      setResults({
        session: sessionData,
        allUsers: { data: allUsers, error: allUsersError },
        specificResult,
      });
      console.log("[DebugPanel] Query completed successfully");
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

      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();

      // Try a simple query to check if users table is accessible
      console.log("[DebugPanel] Testing users table access");
      const { data: usersCount, error: usersError } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      console.log("[DebugPanel] Users table access result:", {
        count: usersCount,
        error: usersError,
      });

      // Try to get RLS policies (this might fail if the function doesn't exist)
      let policiesResult = null;
      try {
        console.log("[DebugPanel] Checking RLS policies");
        const { data: policies, error: policiesError } = await supabase.rpc(
          "get_policies_for_table",
          { table_name: "users" },
        );
        policiesResult = { data: policies, error: policiesError };
        console.log("[DebugPanel] RLS policies result:", policiesResult);
      } catch (policyErr: any) {
        console.error("[DebugPanel] Error checking policies:", policyErr);
        policiesResult = { error: policyErr.message };
      }

      setResults({
        session: sessionData,
        usersTableAccess: { success: !usersError, error: usersError },
        policies: policiesResult,
      });
      console.log("[DebugPanel] RLS check completed");
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
      console.log("[DebugPanel] Starting test user creation");

      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();

      // Generate a unique ID and email
      const timestamp = Date.now();
      const testId = `test-user-${timestamp}`;
      const testEmail = `test-${timestamp}@example.com`;

      console.log(
        `[DebugPanel] Attempting to create test user: ${testId}, ${testEmail}`,
      );

      // Try to create a test user
      const { data, error } = await supabase
        .from("users")
        .insert({
          id: testId,
          email: testEmail,
          role: "user",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();

      console.log("[DebugPanel] Test user creation result:", { data, error });

      setResults({
        session: sessionData,
        createResult: { data, error },
      });
      console.log("[DebugPanel] Test user creation completed");
    } catch (err: any) {
      console.error("[DebugPanel] Error creating test user:", err);
      setError(err.message || "An unknown error occurred");
      setResults({ error: err.message || "An unknown error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Database Debug Panel</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="query">Direct Query</TabsTrigger>
            <TabsTrigger value="rls">Check RLS</TabsTrigger>
            <TabsTrigger value="create">Create Test User</TabsTrigger>
          </TabsList>

          <TabsContent value="query" className="space-y-4 mt-4">
            <div className="flex flex-col space-y-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">
                    User ID
                  </label>
                  <Input
                    placeholder="Enter user ID"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">
                    Email
                  </label>
                  <Input
                    placeholder="Enter email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={runDirectQuery} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  "Run Direct Query"
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rls" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Check Row Level Security policies for the users table.
            </p>
            <Button onClick={checkRLS} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Check RLS Policies"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Attempt to create a test user to check write permissions.
            </p>
            <Button onClick={createTestUser} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Test User"
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
