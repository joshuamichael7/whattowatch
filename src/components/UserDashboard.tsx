import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Settings,
  ListFilter,
  Heart,
  Clock,
  Film,
} from "lucide-react";
import RecommendationGrid from "./RecommendationGrid";

const UserDashboard: React.FC = () => {
  const { user, profile, isAuthenticated } = useAuth();
  const [hasPreferences, setHasPreferences] = useState(false);
  const [activeTab, setActiveTab] = useState("recommendations");

  useEffect(() => {
    // Check if user has preferences set
    // This is a placeholder - in a real app, you would check the user's preferences from the database
    if (profile?.preferences) {
      setHasPreferences(true);
    }
  }, [profile]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to view your dashboard</CardTitle>
            <CardDescription>
              Create an account or sign in to access your personalized dashboard
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome,{" "}
              {profile?.display_name || user?.email?.split("@")[0] || "User"}
            </h1>
            <p className="text-muted-foreground">
              Your personalized entertainment dashboard
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings size={16} />
            Preferences
          </Button>
        </div>

        {!hasPreferences ? (
          <Card className="mb-8 border-dashed border-2 bg-muted/50">
            <CardHeader>
              <CardTitle>Customize Your Experience</CardTitle>
              <CardDescription>
                Take our quick preference quiz to get personalized
                recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                We don't have enough information about your preferences yet.
                Tell us what you like to watch, and we'll recommend content
                tailored just for you.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link to="/dashboard" className="flex items-center gap-2">
                  Take the Quiz <ArrowRight size={16} />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="history">Watch History</TabsTrigger>
          </TabsList>

          <TabsContent value="recommendations" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Your Recommendations</h2>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard" className="flex items-center gap-2">
                  <ListFilter size={16} />
                  Update Preferences
                </Link>
              </Button>
            </div>
            <RecommendationGrid />
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Your Watchlist</h2>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Film size={16} />
                Browse More
              </Button>
            </div>
            {/* Placeholder for watchlist content */}
            <Card className="p-8 text-center">
              <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">
                Your watchlist is empty
              </h3>
              <p className="text-muted-foreground mb-4">
                Save movies and shows you want to watch later
              </p>
              <Button asChild>
                <Link to="/">Browse Content</Link>
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Watch History</h2>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Clock size={16} />
                Clear History
              </Button>
            </div>
            {/* Placeholder for watch history content */}
            <Card className="p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No watch history yet</h3>
              <p className="text-muted-foreground mb-4">
                Movies and shows you watch will appear here
              </p>
              <Button asChild>
                <Link to="/">Start Watching</Link>
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
};

export default UserDashboard;
