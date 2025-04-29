import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { searchSimilarContentByText } from "@/services/vectorService";
import { ContentItem } from "@/types/omdb";
import RecommendationGrid from "@/components/RecommendationGrid";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const VectorSearchTester: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery) return;

    setIsSearching(true);
    setError(null);

    try {
      const results = await searchSimilarContentByText(searchQuery);
      setSearchResults(results);

      if (results.length === 0) {
        setError(
          "No results found. Make sure you have imported content into the vector database.",
        );
      }
    } catch (err) {
      setError("An error occurred while searching. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Vector Search Tester</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Search Vector Database</CardTitle>
          <CardDescription>
            Enter a query to search for similar content in the vector database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="searchQuery" className="sr-only">
                Search Query
              </Label>
              <Input
                id="searchQuery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter a description, plot, or theme to search for"
                disabled={isSearching}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery}
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-8">
          {error}
        </div>
      )}

      {searchResults.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Search Results</h2>
          <RecommendationGrid recommendations={searchResults} />
        </div>
      )}
    </div>
  );
};

export default VectorSearchTester;
