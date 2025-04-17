import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Loader2, Database, RefreshCw, Check, AlertCircle } from "lucide-react";
import { searchContent, getContentById } from "@/lib/omdbClient";
import { storeContentVector } from "@/services/vectorService";
import { ContentItem } from "@/types/omdb";

interface DataPipelineManagerProps {
  batchSize?: number;
  maxItems?: number;
}

const DataPipelineManager: React.FC<DataPipelineManagerProps> = ({
  batchSize = 10,
  maxItems = 100,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedItems, setProcessedItems] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "running" | "completed" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // Popular search terms for seeding the database
  const popularSearchTerms = [
    "action",
    "comedy",
    "drama",
    "thriller",
    "sci-fi",
    "adventure",
    "romance",
    "horror",
    "mystery",
    "fantasy",
    "animation",
    "superhero",
    "space",
    "time travel",
    "dystopian",
    "zombie",
    "spy",
    "musical",
    "western",
    "documentary",
  ];

  // Add a log entry
  const addLog = (message: string) => {
    setLog((prev) => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  // Helper function to safely access environment variables
  const getEnvVar = (key: string, defaultValue: string = ""): string => {
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key] || defaultValue;
    } else if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env[key]
    ) {
      return import.meta.env[key] || defaultValue;
    }
    return defaultValue;
  };

  // Start the data pipeline
  const startPipeline = async () => {
    if (!getEnvVar("PINECONE_API_KEY")) {
      setError(
        "Pinecone API key not configured. Please check environment variables.",
      );
      return;
    }

    setIsRunning(true);
    setStatus("running");
    setProgress(0);
    setProcessedItems(0);
    setError(null);
    setLog([]);

    addLog("Starting data pipeline...");

    try {
      // Vector database initialization removed
      addLog("Vector database functionality has been removed");
      // Continue with the pipeline without vector database

      // Randomly select search terms to use with weighted categories
      const categories = {
        genres: popularSearchTerms.filter((term) =>
          [
            "action",
            "comedy",
            "drama",
            "thriller",
            "sci-fi",
            "adventure",
            "romance",
            "horror",
            "mystery",
            "fantasy",
            "animation",
          ].includes(term),
        ),
        specific: popularSearchTerms.filter((term) =>
          [
            "superhero",
            "space",
            "time travel",
            "dystopian",
            "zombie",
            "spy",
            "musical",
            "western",
            "documentary",
          ].includes(term),
        ),
      };

      // Select terms with more weight on genres (70% genres, 30% specific)
      const selectedTerms = [];
      const genreCount = Math.ceil(
        Math.min(7, popularSearchTerms.length * 0.7),
      );
      const specificCount = Math.min(3, popularSearchTerms.length - genreCount);

      // Add randomly selected genres
      selectedTerms.push(
        ...categories.genres
          .sort(() => 0.5 - Math.random())
          .slice(0, genreCount),
      );

      // Add randomly selected specific terms
      selectedTerms.push(
        ...categories.specific
          .sort(() => 0.5 - Math.random())
          .slice(0, specificCount),
      );

      addLog(
        `Selected ${selectedTerms.length} search terms: ${selectedTerms.join(", ")}`,
      );

      // Search for content using each term with retry mechanism
      const contentIds = new Set<string>();
      const maxRetries = 3;

      for (const term of selectedTerms) {
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < maxRetries) {
          try {
            addLog(
              `Searching for "${term}"${retryCount > 0 ? ` (retry ${retryCount})` : ""}...`,
            );
            const results = await searchContent(term, "all");

            if (results.length > 0) {
              addLog(`Found ${results.length} results for "${term}"`);
              results.forEach((item) => contentIds.add(item.id));
              success = true;
            } else {
              addLog(
                `No results found for "${term}", retrying with modified search...`,
              );
              // Try with a more specific search on retry
              if (retryCount === 1) {
                const modifiedTerm = term + " movie";
                addLog(`Trying modified search: "${modifiedTerm}"`);
                const modifiedResults = await searchContent(
                  modifiedTerm,
                  "movie",
                );
                if (modifiedResults.length > 0) {
                  addLog(
                    `Found ${modifiedResults.length} results for "${modifiedTerm}"`,
                  );
                  modifiedResults.forEach((item) => contentIds.add(item.id));
                  success = true;
                }
              }
            }
          } catch (err) {
            addLog(`Error searching for "${term}": ${err}`);
          }

          retryCount++;
          if (!success && retryCount < maxRetries) {
            // Wait before retrying to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        // Break if we have enough content IDs
        if (contentIds.size >= maxItems) {
          addLog(
            `Reached target of ${maxItems} unique content IDs, stopping search`,
          );
          break;
        }
      }

      const uniqueIds = Array.from(contentIds).slice(0, maxItems);
      setTotalItems(uniqueIds.length);
      addLog(`Collected ${uniqueIds.length} unique content IDs`);

      if (uniqueIds.length === 0) {
        throw new Error(
          "No content IDs found. Please try again with different search terms.",
        );
      }

      // Process in batches with dynamic batch sizing based on total items
      const dynamicBatchSize = uniqueIds.length <= 20 ? 5 : batchSize;
      const batches = [];
      for (let i = 0; i < uniqueIds.length; i += dynamicBatchSize) {
        batches.push(uniqueIds.slice(i, i + dynamicBatchSize));
      }
      setTotalBatches(batches.length);

      // Process each batch with error tracking
      let totalErrors = 0;
      const maxAllowedErrors = Math.ceil(uniqueIds.length * 0.3); // Allow up to 30% errors

      for (let i = 0; i < batches.length; i++) {
        setCurrentBatch(i + 1);
        const batch = batches[i];
        addLog(
          `Processing batch ${i + 1}/${batches.length} (${batch.length} items)`,
        );

        // Process each item in the batch with individual error handling
        const batchPromises = batch.map(async (id) => {
          try {
            // Get detailed content with retry
            let content = null;
            let retryCount = 0;

            while (!content && retryCount < 3) {
              try {
                content = await getContentById(id);
                if (!content && retryCount < 2) {
                  addLog(
                    `Content with ID ${id} not found, retrying (${retryCount + 1}/3)...`,
                  );
                  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retry
                }
              } catch (fetchErr) {
                addLog(
                  `Error fetching content ID ${id} (attempt ${retryCount + 1}/3): ${fetchErr}`,
                );
              }
              retryCount++;
            }

            if (!content) {
              addLog(
                `Content with ID ${id} not found after ${retryCount} attempts`,
              );
              return false;
            }

            // Vector database storage removed
            addLog(
              `Processed "${content.title}" (${content.media_type}) - vector storage skipped`,
            );
            return success;
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            addLog(`Error processing content ID ${id}: ${errorMessage}`);
            return false;
          }
        });

        // Wait for all items in the batch to be processed
        const batchResults = await Promise.all(batchPromises);
        const successCount = batchResults.filter(Boolean).length;
        const errorCount = batchResults.length - successCount;
        totalErrors += errorCount;

        setProcessedItems((prev) => prev + successCount);
        setProgress(Math.round(((i + 1) / batches.length) * 100));

        addLog(
          `Batch ${i + 1} completed: ${successCount}/${batch.length} items processed successfully (${errorCount} errors)`,
        );

        // Check if we've exceeded the error threshold
        if (totalErrors > maxAllowedErrors) {
          addLog(
            `Error threshold exceeded (${totalErrors}/${uniqueIds.length}). Stopping pipeline.`,
          );
          throw new Error(
            `Too many errors (${totalErrors}/${uniqueIds.length}). Pipeline stopped.`,
          );
        }

        // Add a small delay between batches to avoid overwhelming the API
        if (i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setStatus("completed");
      addLog(
        `Data pipeline completed successfully. Processed ${setProcessedItems} items with ${totalErrors} errors.`,
      );
    } catch (err) {
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Error in data pipeline: ${errorMessage}`);
      addLog(`Error in data pipeline: ${errorMessage}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Data Pipeline Manager</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2 h-5 w-5" />
            Vector Database Data Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-muted-foreground mb-2">
              This tool extracts data from OMDB and stores it in the vector
              database for similarity searching. It will process up to{" "}
              {maxItems} items in batches of {batchSize}.
            </p>

            <div className="flex items-center gap-4 mt-4">
              <Button
                onClick={startPipeline}
                disabled={isRunning}
                className="flex items-center"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start Data Pipeline
                  </>
                )}
              </Button>

              <div className="flex items-center">
                {status === "idle" && <span>Ready to start</span>}
                {status === "running" && (
                  <span className="text-amber-500 flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running
                  </span>
                )}
                {status === "completed" && (
                  <span className="text-green-500 flex items-center">
                    <Check className="mr-2 h-4 w-4" />
                    Completed
                  </span>
                )}
                {status === "error" && (
                  <span className="text-red-500 flex items-center">
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Error
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          {(isRunning || status === "completed") && (
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span>Progress: {progress}%</span>
                <span>
                  Batch {currentBatch}/{totalBatches}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="text-sm text-muted-foreground mt-1">
                Processed {processedItems} of {totalItems} items
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          {/* Log Output */}
          {log.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Log</h3>
              <div className="bg-muted p-3 rounded-md max-h-60 overflow-y-auto text-xs font-mono">
                {log.map((entry, index) => (
                  <div key={index} className="mb-1">
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataPipelineManager;
