import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Settings, History, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";

interface UserProfileButtonProps {
  className?: string;
}

const UserProfileButton: React.FC<UserProfileButtonProps> = ({
  className = "",
}) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    email: string;
    avatar?: string;
  } | null>(null);

  // Check if user is logged in on component mount
  React.useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setIsLoggedIn(true);
        // Get user profile from Supabase
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.session.user.id)
          .single();

        if (userData) {
          setUser({
            name:
              userData.display_name ||
              data.session.user.email?.split("@")[0] ||
              "User",
            email: data.session.user.email || "",
            avatar: userData.avatar_url,
          });
        } else {
          setUser({
            name: data.session.user.email?.split("@")[0] || "User",
            email: data.session.user.email || "",
          });
        }
      }
    };

    checkUser();
  }, []);

  const handleLogin = async () => {
    // For demo purposes, we'll just toggle the state
    // In a real app, this would redirect to a login page or show a login modal
    setIsLoggedIn(true);
    setUser({
      name: "Demo User",
      email: "user@example.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=demo",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setUser(null);
  };

  if (!isLoggedIn) {
    return (
      <Button variant="outline" asChild className={className}>
        <Link to="/auth">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={`${className}`}>
          {user?.name || "User"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/user-dashboard">
            <Heart className="mr-2 h-4 w-4" />
            <span>My Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard">
            <History className="mr-2 h-4 w-4" />
            <span>Discover</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserProfileButton;
