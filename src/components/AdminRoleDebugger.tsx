import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

const AdminRoleDebugger: React.FC = () => {
  const { user, profile, isLoading, isAdmin, isAdminVerified } = useAuth();

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Auth Debug Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-bold">Loading State:</h3>
            <p>{isLoading ? "Loading..." : "Loaded"}</p>
          </div>

          <div>
            <h3 className="font-bold">User:</h3>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto">
              {user ? JSON.stringify(user, null, 2) : "No user"}
            </pre>
          </div>

          <div>
            <h3 className="font-bold">Direct Database Check:</h3>
            <Button
              onClick={async () => {
                if (user) {
                  const { data, error } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                  console.log("Direct DB check result:", { data, error });
                  alert(JSON.stringify({ data, error }, null, 2));
                }
              }}
              className="mb-2"
            >
              Check Database Directly
            </Button>
          </div>

          <div>
            <h3 className="font-bold">Profile:</h3>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto">
              {profile ? JSON.stringify(profile, null, 2) : "No profile"}
            </pre>
          </div>

          <div>
            <h3 className="font-bold">Admin Status:</h3>
            <p>isAdmin: {isAdmin ? "Yes" : "No"}</p>
            <p>isAdminVerified: {isAdminVerified ? "Yes" : "No"}</p>
            <p>Profile Role: {profile?.role || "None"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRoleDebugger;
