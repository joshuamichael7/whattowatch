import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Database, Upload, Users } from "lucide-react";
import CsvManagement from "./admin/CsvManagement";
import AdminPasswordForm from "./AdminPasswordForm";

const AdminDashboard: React.FC = () => {
  const { user, profile, isLoading, isAdmin, isAdminVerified, refreshProfile } =
    useAuth();
  const navigate = useNavigate();

  // Redirect non-admin users
  React.useEffect(() => {
    if (isLoading) {
      // Wait for loading to complete
      console.log("[ADMIN] Still loading, waiting...");
      return;
    }

    console.log("[ADMIN] Auth check:", {
      userId: user?.id,
      email: user?.email,
      profileExists: !!profile,
      profileId: profile?.id,
      profileRole: profile?.role,
      isAdmin,
      isAdminVerified,
      isLoading,
    });

    // If we have a user but no profile, trigger a manual profile refresh
    if (user && !profile && !isLoading) {
      console.log(
        `[ADMIN] User exists but no profile, triggering manual refresh`,
      );
      refreshProfile();
      return;
    }

    // Only redirect if user is definitely not logged in or definitely not an admin
    // Don't redirect during loading or if profile isn't loaded yet
    if (!user && !isLoading) {
      // Redirect if not logged in
      console.log("[ADMIN] Redirecting: No user logged in");
      navigate("/");
    }
    // Don't redirect if we're still waiting for profile data
    else if (!isAdmin && profile !== null && !isLoading) {
      // Only redirect if we've confirmed user is not admin (profile loaded and checked)
      console.log("[ADMIN] Redirecting: User is not admin", {
        role: profile?.role,
      });
      navigate("/");
    } else {
      console.log(
        "[ADMIN] User might be admin or still loading, allowing access for now",
      );
    }
  }, [user, profile, isAdmin, isLoading, navigate, refreshProfile]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Only show the no permission alert if we're sure the user is not an admin
  // (profile has loaded and they're definitely not an admin)
  if ((!user && !isLoading) || (profile !== null && !isAdmin && !isLoading)) {
    console.log("Showing no permission alert, user is definitely not admin");
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If user is admin but hasn't verified with password yet
  if (isAdmin && !isAdminVerified) {
    console.log("Showing admin password form, user is admin but not verified");
    return (
      <AdminPasswordForm
        onSuccess={() => {
          console.log("Admin password verified, refreshing profile");
          refreshProfile();
        }}
      />
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Admin Dashboard</CardTitle>
          <CardDescription>
            Manage your MovieMatch application data and users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="data" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Management
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                User Management
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Data
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="space-y-4">
              <h3 className="text-lg font-medium">Content Database</h3>
              <p className="text-muted-foreground">
                View and manage movies and TV shows in the database.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Movies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">
                      Total movies
                    </p>
                    <Button className="mt-4" variant="outline" size="sm">
                      View All
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">TV Shows</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">
                      Total TV shows
                    </p>
                    <Button className="mt-4" variant="outline" size="sm">
                      View All
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">
                      Generated recommendations
                    </p>
                    <Button className="mt-4" variant="outline" size="sm">
                      View All
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <h3 className="text-lg font-medium">User Management</h3>
              <p className="text-muted-foreground">
                View and manage user accounts and permissions.
              </p>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  User management features will be implemented soon.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="import" className="space-y-4">
              <h3 className="text-lg font-medium">Import Data</h3>
              <p className="text-muted-foreground">
                Upload CSV files to populate the database with movies and TV
                shows.
              </p>
              <div className="mt-6">
                <CsvManagement />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
