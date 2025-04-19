import React from "react";
import { Link, useLocation } from "react-router-dom";
import { PlayCircle, Home, Compass, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserProfileButton from "../UserProfileButton";

interface HeaderProps {
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ title = "What to Watch" }) => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex items-center cursor-pointer">
          <Link to="/" className="flex items-center">
            <PlayCircle className="h-6 w-6 text-primary mr-2" />
            <h1 className="text-xl font-bold">{title}</h1>
          </Link>
        </div>
        <nav className="flex flex-1 items-center justify-end space-x-4">
          <Button
            variant={location.pathname === "/" ? "default" : "ghost"}
            asChild
          >
            <Link to="/" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button
            variant={location.pathname === "/dashboard" ? "default" : "ghost"}
            asChild
          >
            <Link to="/dashboard" className="flex items-center gap-1">
              <Compass className="h-4 w-4" />
              Discover
            </Link>
          </Button>
          <Button
            variant={
              location.pathname === "/user-dashboard" ? "default" : "ghost"
            }
            asChild
          >
            <Link to="/user-dashboard" className="flex items-center gap-1">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <UserProfileButton />
        </nav>
      </div>
    </header>
  );
};

export default Header;
