import React from "react";
import { Link } from "react-router-dom";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MovieDetailPageHeaderProps {
  title?: string;
}

const MovieDetailPageHeader: React.FC<MovieDetailPageHeaderProps> = ({
  title = "MovieMatch",
}) => {
  return (
    <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex items-center">
          <PlayCircle className="h-6 w-6 text-primary mr-2" />
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        <nav className="flex flex-1 items-center justify-end space-x-4">
          <Button variant="ghost" asChild>
            <Link to="/">Home</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/dashboard">Discover</Link>
          </Button>
          <Button variant="ghost">About</Button>
          <Button variant="outline">Sign In</Button>
        </nav>
      </div>
    </header>
  );
};

export default MovieDetailPageHeader;
