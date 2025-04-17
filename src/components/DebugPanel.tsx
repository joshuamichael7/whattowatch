import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabaseClient";

const DebugPanel: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("query");

  const runDirectQuery = async () => {
    setIsLoading(true);
    // Clear any previous errors
    setResults(null);

    try {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();

      // Log session info
      console.log("[DebugPanel] Current session:", {
        exists: !!sessionData.session,
        user: sessionData.session?.user
          ? {
              id: sessionData.session.user.id,
              email: sessionData.session.user.email,
            }
          : null,
      });

      // Run direct query to get all users
      const { data: allUsers, error: allUsersError } = await supabase
        .from("users")
        .select("*")
        .limit(10);

      // Run specific query if ID or email provided
      let specificResult = null;
      if (userId) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        specificResult = { type: "id", data, error };
      } else if (email) {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .single();

        specificResult = { type: "email", data, error };
      }

      // Set results
      setResults({
        session: sessionData,
        allUsers: { data: allUsers, error: allUsersError },
        specificResult,
      });
    } catch (error) {
      console.error("[DebugPanel] Error running query:", error);
      setResults({ error });
    } finally {
      setIsLoading(false);
    }
  };

  const checkRLS = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();

      // Try to run a query with service role key
      const serviceRoleResult = {
        message: "Service role key not available in client",
        note: "This would require a server-side function",
      };

      // Check RLS policies
      const { data: policies, error: policiesError } = await supabase.rpc(
        "get_policies_for_table",
        { table_name: "users" },
      );

      setResults({
        session: sessionData,
        serviceRoleResult,
        policies: { data: policies, error: policiesError },
      });
    } catch (error) {
      console.error("[DebugPanel] Error checking RLS:", error);
      setResults({ error });
    } finally {
      setIsLoading(false);
    }
  };

  const createTestUser = async () => {
    setIsLoading(true);
    setResults(null);

    try {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();

      // Try to create a test user
      const { data, error } = await supabase
        .from("users")
        .insert({
          id: "test-user-" + Date.now(),
          email: `test-${Date.now()}@example.com`,
          role: "user",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();

      setResults({
        session: sessionData,
        createResult: { data, error },
      });
    } catch (error) {
      console.error("[DebugPanel] Error creating test user:", error);
      setResults({ error });
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
                {isLoading ? "Running..." : "Run Direct Query"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rls" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Check Row Level Security policies for the users table.
            </p>
            <Button onClick={checkRLS} disabled={isLoading}>
              {isLoading ? "Checking..." : "Check RLS Policies"}
            </Button>
          </TabsContent>

          <TabsContent value="create" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Attempt to create a test user to check write permissions.
            </p>
            <Button onClick={createTestUser} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Test User"}
            </Button>
          </TabsContent>
        </Tabs>

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
