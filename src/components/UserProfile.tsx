import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile, signOut } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, LogOut, Save, User } from "lucide-react";

interface UserProfileProps {
  onClose?: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user, profile, refreshProfile, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [contentPreferences, setContentPreferences] = useState<string[]>([]);

  // Load profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setNotificationsEnabled(profile.notifications_enabled || false);
      setContentPreferences(profile.content_preferences || []);
    }
  }, [profile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      const { error } = await updateUserProfile(user.id, {
        display_name: displayName,
        bio,
        notifications_enabled: notificationsEnabled,
        content_preferences: contentPreferences,
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("Profile updated successfully");
        // Refresh profile immediately to get the latest data
        await refreshProfile();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while updating your profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGenrePreference = (genre: string) => {
    if (contentPreferences.includes(genre)) {
      setContentPreferences(contentPreferences.filter((g) => g !== genre));
    } else {
      setContentPreferences([...contentPreferences, genre]);
    }
  };

  if (!user || !profile) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-2xl font-bold">Your Profile</CardTitle>
            <CardDescription>
              Manage your account and preferences
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="mt-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="profile" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
              />
              <p className="text-sm text-muted-foreground">
                Your email address is used for login and cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you want to be known on MovieMatch"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us a bit about yourself and your movie preferences"
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
              <Label htmlFor="notifications">
                Enable email notifications for new recommendations
              </Label>
            </div>

            <Button
              onClick={handleSaveProfile}
              className="mt-4"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6 mt-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Genre Preferences</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select genres you enjoy to get better recommendations
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  "Action",
                  "Adventure",
                  "Animation",
                  "Comedy",
                  "Crime",
                  "Documentary",
                  "Drama",
                  "Fantasy",
                  "Horror",
                  "Mystery",
                  "Romance",
                  "Sci-Fi",
                  "Thriller",
                  "Western",
                ].map((genre) => (
                  <Badge
                    key={genre}
                    variant={
                      contentPreferences.includes(genre) ? "default" : "outline"
                    }
                    className="px-3 py-1 text-sm cursor-pointer hover:bg-primary/90 transition-colors"
                    onClick={() => toggleGenrePreference(genre)}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <Button
              onClick={handleSaveProfile}
              className="mt-4"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Preferences
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-6">
        <p className="text-sm text-muted-foreground">
          Member since {new Date(profile.created_at).toLocaleDateString()}
        </p>
        <Button
          variant="destructive"
          onClick={handleSignOut}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing out...
            </>
          ) : (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default UserProfile;
