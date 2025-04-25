import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search as SearchIcon,
  Film,
  ListFilter,
  Loader2,
  RefreshCw,
  Popcorn,
  Tv,
  Sparkles,
  ArrowRight,
  UserPlus,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import Header from "./layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { initializeTheme, themeNames, ThemeOption } from "@/lib/themeManager";

// Import the custom hook for trending content
import { useTrendingContent } from "@/hooks/useTrendingContent";
import { useAuth } from "@/contexts/AuthContext";

// Define interfaces for OMDB API responses
interface OmdbSearchResponse {
  Search: OmdbMovie[];
  totalResults: string;
  Response: string;
  Error?: string;
}

interface OmdbMovie {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
  imdbRating?: string;
}

// Always use Netlify functions in production
const USE_DIRECT_API = false;

const HomePage = () => {
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<OmdbMovie[]>([]);
  const [searchIsLoading, setSearchIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeOption>("default");

  // Use the custom hook to fetch trending content
  const { trendingMovies, popularTVShows, isLoading, error, refetch } =
    useTrendingContent();

  // Get user auth context
  const { user, profile, isAuthenticated } = useAuth();

  // Initialize theme and check user preferences
  useEffect(() => {
    // Initialize theme with random selection
    const theme = initializeTheme(true);
    setCurrentTheme(theme);

    // Show signup prompt for non-authenticated users (with a delay)
    if (!isAuthenticated) {
      const timer = setTimeout(() => {
        setShowSignupPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Check if user has preferences
    if (profile?.preferences) {
      setHasPreferences(true);
    }
  }, [profile, isAuthenticated]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;

    try {
      setSearchIsLoading(true);
      setSearchError(null);
      // Use Netlify function to search
      const response = await fetch(
        `/.netlify/functions/omdb?s=${encodeURIComponent(searchValue)}&type=movie,series`,
      );
      const data = await response.json();

      if (data.Response === "False") {
        throw new Error(data.Error || "No results found");
      }

      // Process results here
      console.log("Search results:", data);
      setSearchResults(data.Search || []);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
      console.error("Search error:", err);
    } finally {
      setSearchIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      {/* Signup Prompt */}
      <AnimatePresence>
        {showSignupPrompt && !isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 inset-x-0 z-50 flex justify-center px-4"
          >
            <div className="bg-card border border-primary/30 shadow-lg rounded-lg p-4 max-w-md w-full flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-primary/20 p-2 rounded-full mr-3">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Create a free account</p>
                  <p className="text-sm text-muted-foreground">
                    Save your preferences and get better recommendations!
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="default" asChild>
                  <Link to="/register">Sign Up</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSignupPrompt(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-background to-background z-0" />

        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-20 left-[10%] text-primary/20 opacity-30"
            animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Film size={60} />
          </motion.div>
          <motion.div
            className="absolute bottom-40 right-[15%] text-secondary/20 opacity-30"
            animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          >
            <Tv size={50} />
          </motion.div>
          <motion.div
            className="absolute top-1/2 right-[30%] text-accent/20 opacity-30"
            animate={{ y: [0, 10, 0], rotate: [0, 10, 0] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          >
            <Popcorn size={40} />
          </motion.div>
        </div>

        <div className="container relative z-10 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center space-y-6"
          >
            <Badge className="mb-4 px-3 py-1 text-sm bg-primary/20 text-primary border-primary/30">
              {themeNames[currentTheme]} Theme
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight font-heading">
              What are you in the mood to watch?
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Let AI help you find your next favorite movie or show based on
              your unique taste.
            </p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 pt-6 justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Button
                size="lg"
                className="text-lg px-8 py-6 animate-pulse-glow group transition-all duration-300"
                onClick={() => (window.location.href = "/dashboard")}
              >
                <span>Start Now</span>
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 group transition-all duration-300"
                onClick={() => (window.location.href = "/dashboard")}
              >
                <Sparkles className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                <span>Find Similar</span>
              </Button>
            </motion.div>

            {/* Preference Builder Prompt for users without preferences */}
            {isAuthenticated && !hasPreferences && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-12 p-6 bg-card border border-primary/30 rounded-lg shadow-lg max-w-xl mx-auto"
              >
                <h3 className="text-xl font-semibold mb-2 font-heading">
                  Personalize Your Experience
                </h3>
                <p className="text-muted-foreground mb-4">
                  Take our quick preference quiz to get recommendations tailored
                  just for you.
                </p>
                <Button
                  onClick={() => (window.location.href = "/dashboard")}
                  className="w-full sm:w-auto"
                >
                  Take the Quiz
                </Button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container py-12">
        <Tabs defaultValue="discover" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="similar">Find Similar</TabsTrigger>
            <TabsTrigger value="quiz">What to Watch</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight font-heading">
                Trending Now
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {isLoading ? (
                <div className="col-span-full flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading movies...</span>
                </div>
              ) : error ? (
                <div className="col-span-full text-center py-8 text-destructive">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Try Again
                  </Button>
                </div>
              ) : trendingMovies.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <p>No movies found</p>
                </div>
              ) : (
                trendingMovies.map((movie) => (
                  <MovieCard
                    key={movie.imdbID}
                    title={movie.Title}
                    year={movie.Year}
                    rating={movie.imdbRating || "N/A"}
                    image={movie.Poster}
                    id={movie.imdbID}
                    type={movie.Type}
                  />
                ))
              )}
            </div>

            <Separator className="my-8" />

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight font-heading">
                Popular TV Shows
              </h2>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {isLoading ? (
                <div className="col-span-full flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2">Loading TV shows...</span>
                </div>
              ) : error ? (
                <div className="col-span-full text-center py-8 text-destructive">
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                  >
                    Try Again
                  </Button>
                </div>
              ) : popularTVShows.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <p>No TV shows found</p>
                </div>
              ) : (
                popularTVShows.map((show) => (
                  <TVShowCard
                    key={show.imdbID}
                    title={show.Title}
                    year={show.Year}
                    rating={show.imdbRating || "N/A"}
                    image={show.Poster}
                    id={show.imdbID}
                    type={show.Type}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="similar" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight mb-4 font-heading">
                Find Similar Content
              </h2>
              <p className="text-muted-foreground mb-6">
                Enter a movie or TV show you love, and we'll find similar
                content you might enjoy.
              </p>
              <form
                onSubmit={handleSearch}
                className="flex w-full max-w-2xl gap-2"
              >
                <input
                  type="text"
                  placeholder="Search for a movie or TV show..."
                  className="flex h-12 w-full rounded-md border border-input bg-background px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={searchIsLoading}
                  className="h-12 px-6"
                >
                  {searchIsLoading ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <SearchIcon className="h-5 w-5 mr-2" />
                  )}
                  Search
                </Button>
              </form>
            </div>

            {searchIsLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Searching...</span>
              </div>
            ) : searchError ? (
              <div className="text-center py-8 text-destructive">
                <p>{searchError}</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSearchError(null)}
                >
                  Try Again
                </Button>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {searchResults.map((item) =>
                  item.Type === "series" ? (
                    <TVShowCard
                      key={item.imdbID}
                      title={item.Title}
                      year={item.Year}
                      rating={item.imdbRating || "N/A"}
                      image={item.Poster}
                      id={item.imdbID}
                      type={item.Type}
                    />
                  ) : (
                    <MovieCard
                      key={item.imdbID}
                      title={item.Title}
                      year={item.Year}
                      rating={item.imdbRating || "N/A"}
                      image={item.Poster}
                      id={item.imdbID}
                      type={item.Type}
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="mt-12 text-center text-muted-foreground">
                <Film className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>
                  Search for your favorite content to see similar
                  recommendations
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="quiz" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight mb-4 font-heading">
                What to Watch
              </h2>
              <p className="text-muted-foreground mb-6">
                Answer a few questions to help us understand your taste and
                provide personalized recommendations.
              </p>
              <Button
                size="lg"
                className="w-full sm:w-auto px-8 py-6 text-lg"
                onClick={() => (window.location.href = "/dashboard")}
              >
                Start Quiz
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <FeatureCard
                icon={<ListFilter className="h-8 w-8" />}
                title="Personalized Recommendations"
                description="Get tailored suggestions based on your unique preferences."
              />
              <FeatureCard
                icon={<SearchIcon className="h-8 w-8" />}
                title="Discover New Content"
                description="Find hidden gems and new releases that match your taste."
              />
              <FeatureCard
                icon={<Film className="h-8 w-8" />}
                title="Filter by Content Type"
                description="Specify age ratings and content warnings for appropriate suggestions."
              />
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="container py-8 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold font-heading">MovieMatch</h3>
              <p className="text-sm text-muted-foreground">
                Discover your next favorite movie or TV show with personalized
                recommendations.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 font-heading">
                Navigation
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Discover
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    About
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 font-heading">
                Features
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    What to Watch
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Similar Content
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Content Filters
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3 font-heading">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>
              © {new Date().getFullYear()} MovieMatch. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface MediaCardProps {
  title?: string;
  year?: string;
  rating?: string;
  image?: string;
  id?: string;
  type?: string;
}

const MovieCard = ({
  title = "Interstellar",
  year = "2014",
  rating = "8.6",
  image = "",
  id,
}: MediaCardProps) => {
  // Handle case where image is N/A or empty
  const posterUrl =
    image && image !== "N/A"
      ? image
      : "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&q=80";

  return (
    <Link to={id ? `/movie/${id}` : "#"} className="block">
      <Card className="overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50">
        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
          <img
            src={posterUrl}
            alt={title}
            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src =
                "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=500&q=80";
            }}
          />
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-medium py-1 px-2 rounded-md">
            {rating}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold truncate">{title}</h3>
          <p className="text-sm text-muted-foreground">{year}</p>
        </CardContent>
      </Card>
    </Link>
  );
};

const TVShowCard = ({
  title = "Stranger Things",
  year = "2016",
  rating = "8.7",
  image = "",
  id,
}: MediaCardProps) => {
  // Handle case where image is N/A or empty
  const posterUrl =
    image && image !== "N/A"
      ? image
      : "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&q=80";

  return (
    <Link to={id ? `/tv/${id}` : "#"} className="block">
      <Card className="overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/50">
        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
          <img
            src={posterUrl}
            alt={title}
            className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src =
                "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&q=80";
            }}
          />
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-medium py-1 px-2 rounded-md">
            {rating}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold truncate">{title}</h3>
          <p className="text-sm text-muted-foreground">{year}</p>
        </CardContent>
      </Card>
    </Link>
  );
};

const FeatureCard = ({
  icon,
  title = "Feature Title",
  description = "Feature description",
}: {
  icon: React.ReactNode;
  title?: string;
  description?: string;
}) => {
  return (
    <Card className="p-6 flex flex-col items-center text-center hover:shadow-md transition-all duration-300 border-border/50 hover:border-primary/50 group">
      <div className="p-3 rounded-full bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 font-heading">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Card>
  );
};

export default HomePage;
