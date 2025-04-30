import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import {
  AlertCircle,
  Database,
  Upload,
  Users,
  ShieldCheck,
  Check,
  Layout,
  Tag,
} from "lucide-react";
import CsvManagement from "./admin/CsvManagement";
import AdminPasswordReset from "./admin/AdminPasswordReset";
import AdminPasswordForm from "./AdminPasswordForm";
import HomepageContentManager from "./admin/HomepageContentManager";
import GenreUpdater from "./GenreUpdater";

const AdminDashboard: React.FC = () => {
  const { user, profile, isLoading, isAdmin, isAdminVerified, refreshProfile } =
    useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    console.log("[ADMIN_DASHBOARD] Auth details:", {
      user,
      profile,
      isAdmin,
      isAdminVerified,
      isLoading,
    });
  }, [user, profile, isAdmin, isAdminVerified, isLoading]);

  React.useEffect(() => {
    if (isLoading && !isAdmin) {
      console.log(
        "[ADMIN] Still loading and not yet identified as admin, waiting...",
      );
      return;
    }

    console.log("[ADMIN] Auth check:", {
      userId: user?.id,
      email: user?.email,
      profileExists: !!profile,
      profileRole: profile?.role,
      isAdmin,
      isAdminVerified,
    });

    if (!isLoading && user && !profile) {
      console.log(
        "[ADMIN] User exists but no profile found, checking admin by email",
      );
    }

    if (!user) {
      console.log("[ADMIN] Redirecting: No user logged in");
      navigate("/");
    } else if (!isAdmin && !isLoading) {
      console.log("[ADMIN] Redirecting: User is not admin");
      navigate("/");
    }
  }, [user, isAdmin, isLoading, navigate, profile]);

  if (isLoading && !isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

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

  if (isAdmin && !isAdminVerified) {
    console.log("Showing admin password form, user is admin but not verified");
    return (
      <AdminPasswordForm
        onSuccess={() => {
          console.log("Admin password verified, setting admin verified");
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
            <TabsList className="grid w-full grid-cols-6 mb-8">
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Management
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                User Management
              </TabsTrigger>
              <TabsTrigger value="homepage" className="flex items-center gap-2">
                <Layout className="h-4 w-4" />
                Homepage
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Data
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="genres" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Genres
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
              <div className="mt-4 space-y-2">
                <Button asChild className="w-full">
                  <Link to="/admin-debug">Admin Role Debugger</Link>
                </Button>
                <Button asChild className="w-full">
                  <Link to="/vector-database">Vector Database Manager</Link>
                </Button>
                <Button asChild className="w-full">
                  <Link to="/vector-database-demo">Vector Database Demo</Link>
                </Button>
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

            <TabsContent value="homepage" className="space-y-4">
              <h3 className="text-lg font-medium">
                Homepage Content Management
              </h3>
              <p className="text-muted-foreground">
                Curate and manage the content displayed on the homepage.
              </p>
              <div className="mt-6">
                <HomepageContentManager />
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

            <TabsContent value="automated" className="space-y-4">
              <h3 className="text-lg font-medium">
                Automated OMDB to Pinecone Import
              </h3>
              <p className="text-muted-foreground">
                Automatically import content from OMDB to Pinecone by IMDB ID
                range.
              </p>
              <div className="mt-6">
                <AutomatedImporter />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <h3 className="text-lg font-medium">Security Settings</h3>
              <p className="text-muted-foreground">
                Manage admin password and security settings.
              </p>
              <div className="mt-6">
                <AdminPasswordReset />
              </div>
            </TabsContent>

            <TabsContent value="genres" className="space-y-4">
              <h3 className="text-lg font-medium">Genre Management</h3>
              <p className="text-muted-foreground">
                Update missing genres for content items using OMDB data.
              </p>
              <div className="mt-6">
                <GenreUpdater />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
