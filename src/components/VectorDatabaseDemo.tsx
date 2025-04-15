import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Loader2 } from "lucide-react";
import {
  initVectorDB,
  storeContentVector,
  querySimilarContent,
} from "@/services/vectorService";
import { getContentById } from "@/lib/omdbClient";
import { ContentItem } from "@/types/omdb";

const VectorDatabaseDemo: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [contentId, setContentId] = useState("");
  const [isStoring, setIsStoring] = useState(false);
  const [storeSuccess, setStoreSuccess] = useState<boolean | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResults, setQueryResults] = useState<string[]>([]);
  const [contentDetails, setContentDetails] = useState<ContentItem | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Initialize the vector database on component mount
  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      setError(null);
      try {
        const success = await initVectorDB();
        setIsInitialized(success);
        if (!success) {
          setError(
            "Failed to initialize vector database. Check API keys and endpoint.",
          );
        }
      } catch (err) {
        setError("Error initializing vector database");
        console.error("Vector DB initialization error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, []);

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
      // Get content details
      const content = await getContentById(contentId);
      if (!content) {
        setError(`Content with ID ${contentId} not found`);
        setIsStoring(false);
        return;
      }

      setContentDetails(content);

      // Store in vector database
      const success = await storeContentVector(content);
      setStoreSuccess(success);
      if (!success) {
        setError("Failed to store content in vector database");
      }
    } catch (err) {
      setError("Error storing content in vector database");
      console.error("Vector DB storage error:", err);
    } finally {
      setIsStoring(false);
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
      // Query similar content
      const results = await querySimilarContent(contentId, undefined, 5);
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">
        Vector Database Integration Demo
      </h1>

      {/* Initialization Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Vector Database Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center">
            <div className="mr-4">
              {isInitializing ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : isInitialized ? (
                <div className="h-6 w-6 rounded-full bg-green-500"></div>
              ) : (
                <div className="h-6 w-6 rounded-full bg-red-500"></div>
              )}
            </div>
            <div>
              {isInitializing
                ? "Initializing vector database..."
                : isInitialized
                  ? "Vector database initialized successfully"
                  : "Vector database not initialized"}
            </div>
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* Content ID Input */}
      <div className="mb-6">
        <label htmlFor="contentId" className="block text-sm font-medium mb-2">
          Content ID (IMDB ID)
        </label>
        <div className="flex gap-2">
          <Input
            id="contentId"
            value={contentId}
            onChange={(e) => setContentId(e.target.value)}
            placeholder="e.g., tt0111161"
            disabled={!isInitialized || isStoring || isQuerying}
          />
        </div>
      </div>

      {/* Operations Tabs */}
      <Tabs defaultValue="store">
        <TabsList className="mb-4">
          <TabsTrigger value="store">Store Content</TabsTrigger>
          <TabsTrigger value="query">Query Similar Content</TabsTrigger>
        </TabsList>

        {/* Store Content Tab */}
        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle>Store Content in Vector Database</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleStoreContent}
                disabled={!isInitialized || !contentId.trim() || isStoring}
              >
                {isStoring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Storing...
                  </>
                ) : (
                  "Store Content"
                )}
              </Button>

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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Query Similar Content Tab */}
        <TabsContent value="query">
          <Card>
            <CardHeader>
              <CardTitle>Query Similar Content</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleQuerySimilarContent}
                disabled={!isInitialized || !contentId.trim() || isQuerying}
              >
                {isQuerying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Querying...
                  </>
                ) : (
                  "Find Similar Content"
                )}
              </Button>

              {queryResults.length > 0 ? (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Similar Content:</h3>
                  <ul className="list-disc pl-5">
                    {queryResults.map((id) => (
                      <li key={id}>{id}</li>
                    ))}
                  </ul>
                </div>
              ) : isQuerying ? (
                <p className="mt-4">Searching for similar content...</p>
              ) : error ? (
                <p className="mt-4 text-red-500">{error}</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 text-sm text-gray-500">
        <p>
          Note: This demo requires proper configuration of the vector database
          API keys and endpoints in your environment variables.
        </p>
      </div>
    </div>
  );
};

export default VectorDatabaseDemo;
