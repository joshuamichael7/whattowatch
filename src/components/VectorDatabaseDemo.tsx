import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Loader2, Check } from "lucide-react";
import { toast } from "./ui/use-toast";
import {
  initVectorDatabase,
  addContentToVectorDb,
  searchSimilarContentByText,
} from "@/services/vectorService";
import { getContentById } from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";

const VectorDatabaseDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState("setup");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [contentId, setContentId] = useState("");
  const [isStoring, setIsStoring] = useState(false);
  const [storeSuccess, setStoreSuccess] = useState<boolean | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResults, setQueryResults] = useState<ContentItem[]>([]);
  const [contentDetails, setContentDetails] = useState<ContentItem | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initialize the vector database on component mount
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      setError(null);
      try {
        // Vector database initialization has been removed
        console.log("Vector database functionality has been removed");
        // Set initialized to true to allow component to function
        setIsInitialized(true);
      } catch (err) {
        setError("Error initializing vector database");
        console.error("Vector DB initialization error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const success = await initVectorDatabase();
      if (success) {
        setIsInitialized(true);
        toast({
          title: "Vector Database Initialized",
          description: "Pinecone index created successfully",
        });
      } else {
        toast({
          title: "Initialization Failed",
          description: "Failed to create Pinecone index",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error initializing vector database:", err);
      setError("Error initializing vector database");
      toast({
        title: "Initialization Error",
        description: "An error occurred while initializing the vector database",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Handle storing content in the vector database
  const handleStoreContent = async () => {
    if (!contentId.trim()) {
      setError("Please enter a valid content ID");
      return;
    }

    setIsStoring(true);
    setStoreSuccess(null);
    setError(null);

    try {
      console.log(`Getting content details for ID: ${contentId}`);
      // Get content details
      const content = await getContentById(contentId);
      if (!content) {
        console.error(`Content with ID ${contentId} not found`);
        setError(`Content with ID ${contentId} not found`);
        setIsStoring(false);
        return;
      }

      console.log(`Content details retrieved:`, {
        title: content.title,
        id: content.id,
        imdb_id: content.imdb_id,
        media_type: content.media_type,
      });
      setContentDetails(content as ContentItem);

      // Store in vector database
      console.log(
        `Attempting to add content to vector database: ${content.title}`,
      );
      const success = await addContentToVectorDb(content as ContentItem);
      console.log(`Vector database add result: ${success}`);
      setStoreSuccess(success);
      if (!success) {
        setError("Failed to store content in vector database");
      } else {
        toast({
          title: "Content Added",
          description: `Successfully added "${content.title}" to vector database`,
        });
      }
    } catch (err) {
      console.error("Vector DB storage error:", err);
      console.error(
        "Error details:",
        err instanceof Error ? err.message : String(err),
      );
      setError(
        `Error storing content in vector database: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsStoring(false);
    }
  };

  // Handle searching by text query
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setIsQuerying(true);
    setQueryResults([]);
    setError(null);

    try {
      const results = await searchSimilarContentByText(searchQuery);
      setQueryResults(results);

      if (results.length === 0) {
        setError("No similar content found for your query");
      }
    } catch (err) {
      setError("Error searching vector database");
      console.error("Vector DB search error:", err);
    } finally {
      setIsQuerying(false);
    }
  };

  // Handle querying similar content from the vector database
  const handleQuerySimilarContent = async () => {
    if (!contentId.trim()) {
      setError("Please enter a valid content ID");
      return;
    }

    setIsQuerying(true);
    setQueryResults([]);
    setError(null);

    try {
      // First get the content details
      const content = await getContentById(contentId);
      if (!content) {
        setError(`Content with ID ${contentId} not found`);
        setIsQuerying(false);
        return;
      }

      // Create rich text representation for the content
      const text = [
        `Title: ${content.title || ""}`,
        `Type: ${content.media_type || ""}`,
        `Year: ${content.year || ""}`,
        `Plot: ${content.overview || content.synopsis || ""}`,
        `Genre: ${content.genre_strings ? content.genre_strings.join(", ") : ""}`,
        `Director: ${content.director || ""}`,
        `Writer: ${content.writer || ""}`,
        `Actors: ${content.actors || ""}`,
        `Language: ${content.language || ""}`,
        `Country: ${content.country || ""}`,
        `Released: ${content.release_date || ""}`,
        `Runtime: ${content.runtime || ""}`,
        `Rated: ${content.content_rating || ""}`,
        `IMDb Rating: ${content.vote_average || ""}`,
      ]
        .filter((line) => !line.endsWith(": "))
        .join("\n");

      // Query similar content using text
      const results = await searchSimilarContentByText(text, 5);
      setQueryResults(results);

      if (results.length === 0) {
        setError("No similar content found or vector database not configured");
      }
    } catch (err) {
      setError("Error querying similar content");
      console.error("Vector DB query error:", err);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Vector Database Demo</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="add">Add Content</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Initialize Vector Database</CardTitle>
              <CardDescription>
                Create a Pinecone index for storing movie and TV show data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                This will create a new Pinecone index with the following
                configuration:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>
                  Index name: <code>omdb-database</code>
                </li>
                <li>
                  Dimension: <code>1024</code>
                </li>
                <li>
                  Metric: <code>cosine</code>
                </li>
                <li>
                  Cloud: <code>aws</code>
                </li>
                <li>
                  Region: <code>us-east-1</code>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Note: Make sure you have set the <code>PINECONE_API_KEY</code>{" "}
                environment variable in your Netlify environment settings.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleInitialize}
                disabled={isInitializing || isInitialized}
                className="w-full"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : isInitialized ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Initialized
                  </>
                ) : (
                  "Initialize Vector Database"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Content to Vector Database</CardTitle>
              <CardDescription>
                Add a movie or TV show to the vector database using its IMDB ID
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="contentId"
                    className="block text-sm font-medium mb-2"
                  >
                    Content ID (IMDB ID)
                  </label>
                  <Input
                    id="contentId"
                    value={contentId}
                    onChange={(e) => setContentId(e.target.value)}
                    placeholder="e.g., tt0111161"
                    disabled={!isInitialized || isStoring}
                  />
                </div>

                {storeSuccess !== null && (
                  <div
                    className={`mt-4 p-3 rounded-md ${
                      storeSuccess
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {storeSuccess
                      ? "Content stored successfully"
                      : "Failed to store content"}
                  </div>
                )}

                {contentDetails && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Content Details:</h3>
                    <p>
                      <strong>Title:</strong> {contentDetails.title}
                    </p>
                    <p>
                      <strong>Type:</strong> {contentDetails.media_type}
                    </p>
                    <p>
                      <strong>Release Date:</strong>{" "}
                      {contentDetails.release_date ||
                        contentDetails.first_air_date ||
                        "Unknown"}
                    </p>
                    <p>
                      <strong>Rating:</strong> {contentDetails.vote_average}
                    </p>
                  </div>
                )}

                {error && <p className="text-red-500 mt-2">{error}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleStoreContent}
                disabled={!isInitialized || !contentId.trim() || isStoring}
                className="w-full"
              >
                {isStoring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Content...
                  </>
                ) : (
                  "Add Content"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Search Vector Database</CardTitle>
              <CardDescription>
                Search for similar content using natural language
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="searchQuery"
                    className="block text-sm font-medium mb-2"
                  >
                    Search Query
                  </label>
                  <Textarea
                    id="searchQuery"
                    placeholder="e.g., A Korean drama about a man in his 40s and a woman in her 20s who help each other through life's struggles"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isQuerying}
                    rows={4}
                  />
                </div>

                {error && <p className="text-red-500 mt-2">{error}</p>}

                {queryResults.length > 0 && (
                  <div className="space-y-4 mt-4">
                    <h3 className="font-medium">Search Results</h3>
                    {queryResults.map((result, index) => (
                      <div key={index} className="p-4 border rounded-md">
                        <div className="flex items-start gap-4">
                          {result.poster_path && (
                            <img
                              src={result.poster_path}
                              alt={result.title}
                              className="w-20 h-auto rounded"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          )}
                          <div>
                            <h4 className="font-medium">
                              {result.title}{" "}
                              {result.year ? `(${result.year})` : ""}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {result.media_type}
                            </p>
                            <p className="text-sm mt-1">{result.overview}</p>
                            {result.similarity !== undefined && (
                              <p className="text-sm font-medium mt-1">
                                Similarity:{" "}
                                {(result.similarity * 100).toFixed(2)}%
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSearch}
                disabled={!isInitialized || !searchQuery.trim() || isQuerying}
                className="w-full"
              >
                {isQuerying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  "Search"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-sm text-gray-500">
        <p>
          Note: Make sure you have set the <code>PINECONE_API_KEY</code>{" "}
          environment variable in your Netlify environment settings.
        </p>
      </div>
    </div>
  );
};

export default VectorDatabaseDemo;
