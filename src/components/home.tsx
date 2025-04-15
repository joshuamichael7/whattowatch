import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Film, ListFilter, PlayCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Import the OMDB client functions
import { getTrendingContent, getContentById } from "@/lib/omdbClient";

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

// Use environment variable for API key with fallback for development
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY || "b80c6107";

// Flag to determine whether to use direct API calls or Netlify function
const USE_DIRECT_API =
  import.meta.env.DEV && !import.meta.env.VITE_USE_NETLIFY_FUNCTIONS;

const HomePage = () => {
  const [trendingMovies, setTrendingMovies] = useState<OmdbMovie[]>([]);
  const [popularTVShows, setPopularTVShows] = useState<OmdbMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (USE_DIRECT_API) {
          // Direct API calls for development
          // Fetch trending movies using more specific search terms
          const popularMovies = [
            "Avengers",
            "Star Wars",
            "Jurassic",
            "Batman",
            "Spider",
            "Harry Potter",
            "Fast",
          ];
          const randomMovieIndex = Math.floor(
            Math.random() * popularMovies.length,
          );
          const movieResponse = await fetch(
            `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${popularMovies[randomMovieIndex]}&type=movie&page=1`,
          );
          const movieData: OmdbSearchResponse = await movieResponse.json();

          if (movieData.Response === "False") {
            throw new Error(movieData.Error || "Failed to fetch movies");
          }

          // Fetch popular TV shows using more specific search terms
          const popularShows = [
            "Breaking",
            "Game of",
            "Stranger",
            "Friends",
            "Office",
            "Walking",
            "Crown",
          ];
          const randomShowIndex = Math.floor(
            Math.random() * popularShows.length,
          );
          const tvResponse = await fetch(
            `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${popularShows[randomShowIndex]}&type=series&page=1`,
          );
          const tvData: OmdbSearchResponse = await tvResponse.json();

          if (tvData.Response === "False") {
            throw new Error(tvData.Error || "Failed to fetch TV shows");
          }

          // Get detailed info including ratings for each movie
          const movieDetailsPromises = movieData.Search.slice(0, 4).map(
            (movie) =>
              fetch(
                `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${movie.imdbID}`,
              ).then((res) => res.json()),
          );
          const movieDetails = await Promise.all(movieDetailsPromises);

          // Get detailed info including ratings for each TV show
          const tvDetailsPromises = tvData.Search.slice(0, 4).map((show) =>
            fetch(
              `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${show.imdbID}`,
            ).then((res) => res.json()),
          );
          const tvDetails = await Promise.all(tvDetailsPromises);

          setTrendingMovies(movieDetails);
          setPopularTVShows(tvDetails);
        } else {
          // Use omdbClient for production (Netlify functions)
          // Fetch trending movies
          const movieData = await getTrendingContent("movie", 4);

          // Fetch trending TV shows
          const tvData = await getTrendingContent("tv", 4);

          // Get detailed info for each movie
          const movieDetailsPromises = movieData.map((movie) =>
            getContentById(movie.id),
          );
          const movieDetails = await Promise.all(movieDetailsPromises);

          // Get detailed info for each TV show
          const tvDetailsPromises = tvData.map((show) =>
            getContentById(show.id),
          );
          const tvDetails = await Promise.all(tvDetailsPromises);

          // Map the returned data to match the expected format
          const formattedMovies = movieDetails.filter(Boolean).map((movie) => ({
            Title: movie.title,
            Year: movie.release_date,
            imdbID: movie.id,
            Type: "movie",
            Poster: movie.poster_path,
            imdbRating: movie.vote_average.toString(),
          }));

          const formattedShows = tvDetails.filter(Boolean).map((show) => ({
            Title: show.title,
            Year: show.release_date || show.first_air_date,
            imdbID: show.id,
            Type: "series",
            Poster: show.poster_path,
            imdbRating: show.vote_average.toString(),
          }));

          setTrendingMovies(formattedMovies);
          setPopularTVShows(formattedShows);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovies();
  }, []);
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex items-center">
            <PlayCircle className="h-6 w-6 text-primary mr-2" />
            <h1 className="text-xl font-bold">MovieMatch</h1>
          </div>
          <nav className="flex flex-1 items-center justify-end space-x-4">
            <Button variant="ghost">Home</Button>
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Discover</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/plot-similarity-test">Plot Similarity Test</Link>
            </Button>
            <Button variant="outline">Sign In</Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 z-0" />
        <div className="container relative z-10 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl space-y-4"
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Discover your next favorite movie or show
            </h1>
            <p className="text-xl text-muted-foreground">
              Get personalized recommendations based on your preferences and
              favorites.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => (window.location.href = "/dashboard")}
              >
                <Search className="h-5 w-5" />
                Find Similar Content
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => (window.location.href = "/dashboard")}
              >
                <ListFilter className="h-5 w-5" />
                Take Preference Quiz
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container py-12">
        <Tabs defaultValue="discover" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="discover">Discover</TabsTrigger>
            <TabsTrigger value="similar">Find Similar</TabsTrigger>
            <TabsTrigger value="quiz">Preference Quiz</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">
                Trending Now
              </h2>
              <Button variant="outline" size="sm">
                View All
              </Button>
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
                    image={
                      movie.Poster !== "N/A"
                        ? movie.Poster
                        : "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&q=80"
                    }
                    id={movie.imdbID}
                  />
                ))
              )}
            </div>

            <Separator className="my-8" />

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">
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
                    image={
                      show.Poster !== "N/A"
                        ? show.Poster
                        : "https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=400&q=80"
                    }
                    id={show.imdbID}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="similar" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight mb-4">
                Find Similar Content
              </h2>
              <p className="text-muted-foreground mb-6">
                Enter a movie or TV show you love, and we'll find similar
                content you might enjoy.
              </p>
              <div className="flex w-full max-w-2xl gap-2">
                <input
                  type="text"
                  placeholder="Search for a movie or TV show..."
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button type="submit">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>

            <div className="mt-12 text-center text-muted-foreground">
              <Film className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                Search for your favorite content to see similar recommendations
              </p>
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="space-y-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight mb-4">
                Preference Quiz
              </h2>
              <p className="text-muted-foreground mb-6">
                Answer a few questions to help us understand your taste and
                provide personalized recommendations.
              </p>
              <Button
                size="lg"
                className="w-full sm:w-auto"
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
                icon={<Search className="h-8 w-8" />}
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
              <h3 className="text-lg font-semibold">MovieMatch</h3>
              <p className="text-sm text-muted-foreground">
                Discover your next favorite movie or TV show with personalized
                recommendations.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Navigation</h4>
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
              <h4 className="text-sm font-semibold mb-3">Features</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Preference Quiz
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
              <h4 className="text-sm font-semibold mb-3">Legal</h4>
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
}

const MovieCard = ({
  title = "Interstellar",
  year = "2014",
  rating = "8.6",
  image = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&q=80",
  id,
}: MediaCardProps) => {
  return (
    <Link to={id ? `/movie/${id}` : "#"} className="block">
      <Card className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
          <img
            src={image}
            alt={title}
            className="object-cover w-full h-full transition-transform group-hover:scale-105"
          />
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-medium py-1 px-2 rounded-md">
            {rating}
          </div>
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
  image = "https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=400&q=80",
  id,
}: MediaCardProps) => {
  return (
    <Link to={id ? `/tv/${id}` : "#"} className="block">
      <Card className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
        <div className="aspect-[2/3] relative overflow-hidden bg-muted">
          <img
            src={image}
            alt={title}
            className="object-cover w-full h-full transition-transform group-hover:scale-105"
          />
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-xs font-medium py-1 px-2 rounded-md">
            {rating}
          </div>
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
  description = "Feature description goes here.",
}) => {
  return (
    <Card>
      <CardContent className="p-6 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

export default HomePage;
