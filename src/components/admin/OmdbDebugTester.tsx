import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

const OmdbDebugTester = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [imdbId, setImdbId] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/.netlify/functions/omdb-debug?s=${encodeURIComponent(searchQuery)}`,
      );
      const data = await response.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleIdLookup = async () => {
    if (!imdbId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/.netlify/functions/omdb-debug?i=${encodeURIComponent(imdbId)}&plot=full`,
      );
      const data = await response.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>OMDB Debug Tester</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="search">
          <TabsList className="mb-4">
            <TabsTrigger value="search">Search by Title</TabsTrigger>
            <TabsTrigger value="id">Lookup by IMDB ID</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter movie or TV show title"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="id" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter IMDB ID (e.g., tt0111161)"
                value={imdbId}
                onChange={(e) => setImdbId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleIdLookup()}
              />
              <Button onClick={handleIdLookup} disabled={loading}>
                {loading ? "Looking up..." : "Lookup"}
              </Button>
            </div>
          </TabsContent>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {response && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Response:</h3>
              <div className="bg-muted p-3 rounded-md">
                <ScrollArea className="h-[400px]">
                  <pre className="text-xs whitespace-pre-wrap">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </ScrollArea>
              </div>

              {response.Rated && (
                <div className="mt-4 p-3 bg-primary/10 text-primary rounded-md">
                  <h4 className="font-medium">Content Rating Found:</h4>
                  <p className="text-lg font-bold">{response.Rated}</p>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default OmdbDebugTester;
