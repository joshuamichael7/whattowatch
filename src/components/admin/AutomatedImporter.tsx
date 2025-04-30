import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Play,
  Pause,
  RotateCcw,
  Save,
  AlertCircle,
  CheckCircle,
  Clock,
  Cloud,
  Info,
  XCircle,
  SkipForward,
  BarChart,
  Server,
  TrendingUp,
} from "lucide-react";
import {
  defaultImportProgress,
  ImportProgress,
  processBatch,
} from "@/services/dataImportService";
import {
  defaultTmdbImportProgress,
  TmdbImportProgress,
  importTmdbData,
  parseTmdbJsonList,
} from "@/services/tmdbImportService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AutomatedImporter: React.FC = () => {
  // Import mode toggle between OMDB and TMDB
  const [dataSource, setDataSource] = useState<"omdb" | "tmdb">("omdb");

  // OMDB import progress state
  const [progress, setProgress] = useState<ImportProgress>(
    defaultImportProgress,
  );

  // TMDB import progress state
  const [tmdbProgress, setTmdbProgress] = useState<TmdbImportProgress>(
    defaultTmdbImportProgress,
  );
  const [startId, setStartId] = useState<string>("tt0000001");
  const [endId, setEndId] = useState<string>("tt0010000");
  const [batchSize, setBatchSize] = useState<number>(10);
  const [batchCount, setBatchCount] = useState<number>(1000);
  const [useServerless, setUseServerless] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [prioritizePopular, setPrioritizePopular] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<"range" | "list">("range");
  const [tmdbJsonData, setTmdbJsonData] = useState<string>("");
  const [clearExistingData, setClearExistingData] = useState<boolean>(false);
  const [imdbIdList, setImdbIdList] = useState<string>("");
  const [invalidIds, setInvalidIds] = useState<string[]>([]);
  const [errorDetails, setErrorDetails] = useState<{ [key: string]: string[] }>(
    {},
  );
  const [processingSpeed, setProcessingSpeed] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] =
    useState<string>("");
  const shouldContinueRef = useRef<boolean>(true);
  const startTimeRef = useRef<Date | null>(null);

  // Track errors by category with additional context
  const trackError = (
    id: string,
    errorMessage: string,
    additionalContext: string = "",
  ) => {
    setErrorDetails((prev) => {
      const category = categorizeError(errorMessage);
      const errorEntry = additionalContext
        ? `${id} (${additionalContext})`
        : id;

      // Limit the number of errors per category to prevent UI overload
      const existingErrors = prev[category] || [];
      const maxErrorsPerCategory = 100;

      // If we already have too many errors of this type, only add if it's a new pattern
      if (existingErrors.length >= maxErrorsPerCategory) {
        // Only add if this seems like a new pattern (simple heuristic)
        const shouldAdd = existingErrors.every(
          (entry) => !entry.startsWith(id.substring(0, 4)), // Check if we already have errors with similar ID prefix
        );

        if (!shouldAdd) return prev;

        // Remove oldest error to make room
        const updatedErrors = [...existingErrors.slice(1), errorEntry];
        return {
          ...prev,
          [category]: updatedErrors,
        };
      }

      return {
        ...prev,
        [category]: [...existingErrors, errorEntry],
      };
    });
  };

  // Categorize errors for better reporting
  const categorizeError = (errorMessage: string): string => {
    // Convert to lowercase for case-insensitive matching
    const lowerCaseError = errorMessage.toLowerCase();

    // Not Found errors
    if (
      lowerCaseError.includes("content not found") ||
      lowerCaseError.includes("not found") ||
      lowerCaseError.includes("404") ||
      lowerCaseError.includes("no results") ||
      lowerCaseError.includes("does not exist")
    )
      return "Not Found";

    // API Limit errors
    if (
      lowerCaseError.includes("api limit") ||
      lowerCaseError.includes("rate limit") ||
      lowerCaseError.includes("too many requests") ||
      lowerCaseError.includes("429") ||
      lowerCaseError.includes("quota exceeded") ||
      lowerCaseError.includes("throttled") ||
      lowerCaseError.includes("limit reached")
    )
      return "API Limits";

    // Network errors
    if (
      lowerCaseError.includes("network") ||
      lowerCaseError.includes("timeout") ||
      lowerCaseError.includes("connection") ||
      lowerCaseError.includes("econnrefused") ||
      lowerCaseError.includes("etimedout") ||
      lowerCaseError.includes("unreachable") ||
      lowerCaseError.includes("dns") ||
      lowerCaseError.includes("socket")
    )
      return "Network Issues";

    // Vector DB errors
    if (
      lowerCaseError.includes("vector") ||
      lowerCaseError.includes("pinecone") ||
      lowerCaseError.includes("database") ||
      lowerCaseError.includes("index not found") ||
      lowerCaseError.includes("upsert failed") ||
      lowerCaseError.includes("embedding") ||
      lowerCaseError.includes("dimension mismatch")
    )
      return "Vector DB Issues";

    // Data Format errors
    if (
      lowerCaseError.includes("parse") ||
      lowerCaseError.includes("json") ||
      lowerCaseError.includes("format") ||
      lowerCaseError.includes("invalid") ||
      lowerCaseError.includes("malformed") ||
      lowerCaseError.includes("syntax") ||
      lowerCaseError.includes("unexpected token")
    )
      return "Data Format Issues";

    // Authentication errors
    if (
      lowerCaseError.includes("authentication") ||
      lowerCaseError.includes("unauthorized") ||
      lowerCaseError.includes("401") ||
      lowerCaseError.includes("403") ||
      lowerCaseError.includes("permission") ||
      lowerCaseError.includes("forbidden") ||
      lowerCaseError.includes("access denied") ||
      lowerCaseError.includes("invalid key") ||
      lowerCaseError.includes("invalid token")
    )
      return "Authentication Issues";

    // Server errors
    if (
      lowerCaseError.includes("server") ||
      lowerCaseError.includes("500") ||
      lowerCaseError.includes("502") ||
      lowerCaseError.includes("503") ||
      lowerCaseError.includes("504") ||
      lowerCaseError.includes("internal error") ||
      lowerCaseError.includes("bad gateway") ||
      lowerCaseError.includes("service unavailable")
    )
      return "Server Issues";

    // Content-specific errors
    if (
      lowerCaseError.includes("adult content") ||
      lowerCaseError.includes("content filter") ||
      lowerCaseError.includes("restricted") ||
      lowerCaseError.includes("mature content")
    )
      return "Content Restrictions";

    // Duplicate errors
    if (
      lowerCaseError.includes("duplicate") ||
      lowerCaseError.includes("already exists") ||
      lowerCaseError.includes("conflict") ||
      lowerCaseError.includes("409")
    )
      return "Duplicate Content";

    return "Other Errors";
  };

  // Validate IMDB IDs from the textarea input
  const validateImdbIds = (idList: string): string[] => {
    const ids = idList.split(/\r?\n/).filter((id) => id.trim() !== "");
    const invalidIds = ids.filter((id) => !id.match(/^tt\d+$/));
    return invalidIds;
  };

  // Parse valid IMDB IDs from the textarea input
  const parseImdbIds = (idList: string): string[] => {
    return idList
      .split(/\r?\n/)
      .map((id) => id.trim())
      .filter((id) => id !== "" && id.match(/^tt\d+$/));
  };

  const startImport = async () => {
    if (
      (dataSource === "omdb" && progress.isRunning) ||
      (dataSource === "tmdb" && tmdbProgress.isRunning)
    )
      return;

    // Reset error tracking before starting a new import
    setErrorDetails({});

    // If TMDB is selected, use the TMDB import process
    if (dataSource === "tmdb") {
      await startTmdbImport();
      return;
    }

    // OMDB import process
    if (importMode === "list") {
      // Validate the IMDB ID list
      const invalidIds = validateImdbIds(imdbIdList);
      if (invalidIds.length > 0) {
        setInvalidIds(invalidIds);
        return;
      }

      const idList = parseImdbIds(imdbIdList);
      if (idList.length === 0) {
        setProgress((prev) => ({
          ...prev,
          logs: [...prev.logs, "Error: No valid IMDB IDs found in the list"],
          lastUpdated: new Date(),
        }));
        return;
      }

      // Reset progress
      setProgress((prev) => ({
        ...defaultImportProgress,
        isRunning: true,
        logs: [
          `Starting import of ${idList.length} IMDB IDs with batch size ${batchSize}`,
        ],
        lastUpdated: new Date(),
      }));

      shouldContinueRef.current = true;
      startTimeRef.current = new Date();

      try {
        // For now, only client-side processing for list mode
        // TODO: Add serverless support for list mode
        await processBatch(
          "", // startId not used in list mode
          idList.length,
          batchSize,
          (updater) => {
            setProgress((prev) => {
              const updated = updater(prev);

              // Calculate processing speed and ETA
              if (startTimeRef.current && updated.processed > 0) {
                const elapsedSeconds =
                  (new Date().getTime() - startTimeRef.current.getTime()) /
                  1000;
                const speed = updated.processed / elapsedSeconds;
                setProcessingSpeed(speed);

                const remainingItems = batchCount - updated.processed;
                if (speed > 0) {
                  const remainingSeconds = remainingItems / speed;
                  setEstimatedTimeRemaining(
                    formatTimeRemaining(remainingSeconds),
                  );
                }
              }

              // Track errors for IMDB items
              if (updated.logs && updated.logs.length > 0) {
                const latestLog = updated.logs[updated.logs.length - 1];
                if (
                  latestLog.includes("Error") ||
                  latestLog.includes("Failed")
                ) {
                  // Extract IMDB ID and error message from log
                  const idMatch = latestLog.match(/IMDB ID: (tt\d+)/);
                  const errorMatch =
                    latestLog.match(/Error: (.+)/) ||
                    latestLog.match(/Failed to add "(.+?)" to vector database/);

                  if (idMatch && idMatch[1]) {
                    const imdbId = idMatch[1];
                    const errorMessage = errorMatch
                      ? errorMatch[1]
                      : "Unknown error";
                    // Extract title if available
                    const titleMatch = latestLog.match(
                      /"([^"]+)" to vector database/,
                    );
                    const title = titleMatch ? titleMatch[1] : "";
                    trackError(imdbId, errorMessage, title);
                  }
                }
              }

              return updated;
            });
          },
          () => shouldContinueRef.current,
          idList, // Pass the list of IDs
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setProgress((prev) => ({
          ...prev,
          isRunning: false,
          logs: [...prev.logs, `Error: ${errorMessage}`],
          lastUpdated: new Date(),
        }));
      } finally {
        setProgress((prev) => ({
          ...prev,
          isRunning: false,
          lastUpdated: new Date(),
        }));
      }
    } else {
      // Range mode - original implementation
      // Reset progress
      setProgress((prev) => ({
        ...defaultImportProgress,
        startId,
        endId,
        currentId: startId,
        isRunning: true,
        logs: [
          `Starting import from ${startId} to ${endId} with batch size ${batchSize}`,
        ],
        lastUpdated: new Date(),
      }));

      shouldContinueRef.current = true;
      startTimeRef.current = new Date();

      try {
        if (useServerless) {
          // Use the Netlify function for serverless processing
          await startServerlessImport();
        } else {
          // Use the client-side processing
          await processBatch(
            startId,
            batchCount,
            batchSize,
            (updater) => {
              setProgress((prev) => {
                const updated = updater(prev);

                // Calculate processing speed and ETA
                if (startTimeRef.current && updated.processed > 0) {
                  const elapsedSeconds =
                    (new Date().getTime() - startTimeRef.current.getTime()) /
                    1000;
                  const speed = updated.processed / elapsedSeconds;
                  setProcessingSpeed(speed);

                  const remainingItems = batchCount - updated.processed;
                  if (speed > 0) {
                    const remainingSeconds = remainingItems / speed;
                    setEstimatedTimeRemaining(
                      formatTimeRemaining(remainingSeconds),
                    );
                  }
                }

                // Track errors for IMDB items
                if (updated.logs && updated.logs.length > 0) {
                  const latestLog = updated.logs[updated.logs.length - 1];
                  if (
                    latestLog.includes("Error") ||
                    latestLog.includes("Failed")
                  ) {
                    // Extract IMDB ID and error message from log
                    const idMatch = latestLog.match(/IMDB ID: (tt\d+)/);
                    const errorMatch =
                      latestLog.match(/Error: (.+)/) ||
                      latestLog.match(
                        /Failed to add "(.+?)" to vector database/,
                      );

                    if (idMatch && idMatch[1]) {
                      const imdbId = idMatch[1];
                      const errorMessage = errorMatch
                        ? errorMatch[1]
                        : "Unknown error";
                      // Extract title if available
                      const titleMatch = latestLog.match(
                        /"([^"]+)" to vector database/,
                      );
                      const title = titleMatch ? titleMatch[1] : "";
                      trackError(imdbId, errorMessage, title);
                    }
                  }
                }

                return updated;
              });
            },
            () => shouldContinueRef.current,
            undefined,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        setProgress((prev) => ({
          ...prev,
          isRunning: false,
          logs: [...prev.logs, `Error: ${errorMessage}`],
          lastUpdated: new Date(),
        }));
      } finally {
        setProgress((prev) => ({
          ...prev,
          isRunning: false,
          lastUpdated: new Date(),
        }));
      }
    }
  };

  const startServerlessImport = async () => {
    try {
      // Call the Netlify function
      const response = await fetch("/.netlify/functions/automated-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startId,
          count: batchCount,
          batchSize,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      // Update progress with results from the serverless function
      setProgress((prev) => ({
        ...prev,
        currentId: result.currentId || prev.currentId,
        processed: result.processed || 0,
        successful: result.successful || 0,
        failed: result.failed || 0,
        skipped: result.skipped || 0,
        isRunning: false,
        logs: [...prev.logs, ...(result.logs || [])],
        lastUpdated: new Date(),
      }));

      if (!result.success) {
        throw new Error(result.error || "Unknown error in serverless function");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setProgress((prev) => ({
        ...prev,
        logs: [...prev.logs, `Serverless error: ${errorMessage}`],
        lastUpdated: new Date(),
      }));
      throw error;
    }
  };

  const stopImport = () => {
    shouldContinueRef.current = false;

    if (dataSource === "omdb") {
      setProgress((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          "Import process stopping... (will complete current batch)",
        ],
        lastUpdated: new Date(),
      }));
    } else {
      setTmdbProgress((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          "TMDB import process stopping... (will complete current batch)",
        ],
        lastUpdated: new Date(),
      }));
    }
  };

  const resetImport = () => {
    if (
      (dataSource === "omdb" && progress.isRunning) ||
      (dataSource === "tmdb" && tmdbProgress.isRunning)
    )
      return;

    if (dataSource === "omdb") {
      setProgress(defaultImportProgress);
      setInvalidIds([]);
    } else {
      setTmdbProgress(defaultTmdbImportProgress);
      setTmdbJsonData("");
    }
  };

  const calculateProgressPercentage = (): number => {
    if (dataSource === "omdb") {
      if (!progress.processed) return 0;
      return Math.min(100, (progress.processed / batchCount) * 100);
    } else {
      if (!tmdbProgress.processed) return 0;
      return Math.min(
        100,
        (tmdbProgress.processed / tmdbProgress.totalItems) * 100,
      );
    }
  };

  // Start TMDB import process
  const startTmdbImport = async () => {
    if (tmdbProgress.isRunning) return;

    // Validate TMDB JSON data
    const tmdbItems = parseTmdbJsonList(tmdbJsonData);
    if (tmdbItems.length === 0) {
      setTmdbProgress((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          "Error: No valid TMDB items found in the provided JSON",
        ],
        lastUpdated: new Date(),
      }));
      return;
    }

    // Reset progress and start import
    setTmdbProgress((prev) => ({
      ...defaultTmdbImportProgress,
      isRunning: true,
      totalItems: tmdbItems.length,
      logs: [
        `Starting import of ${tmdbItems.length} TMDB items with batch size ${batchSize}`,
      ],
      lastUpdated: new Date(),
    }));

    shouldContinueRef.current = true;
    startTimeRef.current = new Date();

    try {
      await importTmdbData(
        tmdbJsonData,
        batchSize,
        (updater) => {
          setTmdbProgress((prev) => {
            const updated = updater(prev);

            // Calculate processing speed and ETA
            if (startTimeRef.current && updated.processed > 0) {
              const elapsedSeconds =
                (new Date().getTime() - startTimeRef.current.getTime()) / 1000;
              const speed = updated.processed / elapsedSeconds;
              setProcessingSpeed(speed);

              const remainingItems = updated.totalItems - updated.processed;
              if (speed > 0) {
                const remainingSeconds = remainingItems / speed;
                setEstimatedTimeRemaining(
                  formatTimeRemaining(remainingSeconds),
                );
              }
            }

            // Track errors for TMDB items
            if (updated.logs && updated.logs.length > 0) {
              const latestLog = updated.logs[updated.logs.length - 1];
              if (latestLog.includes("Error") || latestLog.includes("Failed")) {
                // Extract TMDB ID and error message from log
                const idMatch = latestLog.match(/TMDB ID: (\d+)/);
                const errorMatch =
                  latestLog.match(/Error: (.+)/) ||
                  latestLog.match(/Failed to add "(.+?)" to vector database/);

                if (idMatch && idMatch[1]) {
                  const tmdbId = idMatch[1];
                  const errorMessage = errorMatch
                    ? errorMatch[1]
                    : "Unknown error";
                  // Extract title if available
                  const titleMatch = latestLog.match(
                    /"([^"]+)" to vector database/,
                  );
                  const title = titleMatch ? titleMatch[1] : "";
                  trackError(tmdbId, errorMessage, title);
                }
              }
            }

            return updated;
          });
        },
        () => shouldContinueRef.current,
        clearExistingData,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setTmdbProgress((prev) => ({
        ...prev,
        isRunning: false,
        logs: [...prev.logs, `Error: ${errorMessage}`],
        lastUpdated: new Date(),
      }));
    } finally {
      setTmdbProgress((prev) => ({
        ...prev,
        isRunning: false,
        lastUpdated: new Date(),
      }));
    }
  };

  // Format time remaining in a human-readable format
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Automated Content Importer
        </CardTitle>
        <CardDescription>
          Import content from OMDB or TMDB to Pinecone database
        </CardDescription>

        {/* Data Source Toggle */}
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Data Source</label>
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="omdb-source"
                name="data-source"
                checked={dataSource === "omdb"}
                onChange={() => setDataSource("omdb")}
                disabled={progress.isRunning || tmdbProgress.isRunning}
                className="h-4 w-4"
              />
              <Label htmlFor="omdb-source">OMDB (IMDb IDs)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="tmdb-source"
                name="data-source"
                checked={dataSource === "tmdb"}
                onChange={() => setDataSource("tmdb")}
                disabled={progress.isRunning || tmdbProgress.isRunning}
                className="h-4 w-4"
              />
              <Label htmlFor="tmdb-source">TMDB (JSON List)</Label>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {dataSource === "omdb" ? (
          /* OMDB Import Options */
          <>
            {/* Import Mode Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Import Mode</label>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="range-mode"
                    name="import-mode"
                    checked={importMode === "range"}
                    onChange={() => setImportMode("range")}
                    disabled={progress.isRunning}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="range-mode">ID Range</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="list-mode"
                    name="import-mode"
                    checked={importMode === "list"}
                    onChange={() => setImportMode("list")}
                    disabled={progress.isRunning}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="list-mode">ID List</Label>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* TMDB Import Options */
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">TMDB JSON Data</label>
              <div className="space-y-1">
                <textarea
                  value={tmdbJsonData}
                  onChange={(e) => setTmdbJsonData(e.target.value)}
                  disabled={tmdbProgress.isRunning}
                  placeholder={
                    'Enter TMDB JSON data, one object per line:\n{"id": 550, "original_title": "Fight Club", "adult": false, "popularity": 0.5, "video": false}\n{"id": 551, "original_title": "Another Movie", "adult": false, "popularity": 0.4, "video": false}'
                  }
                  className="w-full h-32 p-2 border rounded-md font-mono text-sm text-black dark:text-white bg-white dark:bg-gray-800"
                  style={{ color: "inherit" }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {parseTmdbJsonList(tmdbJsonData).length} valid items
                  </span>
                  <button
                    onClick={() => setTmdbJsonData("")}
                    className="text-blue-500 hover:underline"
                    disabled={tmdbProgress.isRunning || !tmdbJsonData}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Clear Existing Data Option */}
              <div className="flex items-center space-x-2 mt-4">
                <Switch
                  id="clear-existing-data"
                  checked={clearExistingData}
                  onCheckedChange={setClearExistingData}
                  disabled={tmdbProgress.isRunning}
                />
                <Label
                  htmlFor="clear-existing-data"
                  className="flex items-center gap-2"
                >
                  <Server className="h-4 w-4" />
                  Clear existing vector database before import
                </Label>
              </div>
            </div>
          </>
        )}

        {/* Configuration */}
        {importMode === "range" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start IMDB ID</label>
              <Input
                value={startId}
                onChange={(e) => setStartId(e.target.value)}
                disabled={progress.isRunning}
                placeholder="e.g. tt0000001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                End IMDB ID (for reference)
              </label>
              <Input
                value={endId}
                onChange={(e) => setEndId(e.target.value)}
                disabled={progress.isRunning}
                placeholder="e.g. tt0010000"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Batch Size</label>
              <Input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                disabled={progress.isRunning}
                min={1}
                max={50}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Number of IDs to Process
              </label>
              <Input
                type="number"
                value={batchCount}
                onChange={(e) =>
                  setBatchCount(parseInt(e.target.value) || 1000)
                }
                disabled={progress.isRunning}
                min={1}
                max={10000}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-medium">IMDB ID List</label>
            <div className="space-y-1">
              <textarea
                value={imdbIdList}
                onChange={(e) => {
                  setImdbIdList(e.target.value);
                  setInvalidIds([]);
                }}
                disabled={progress.isRunning}
                placeholder="Enter IMDB IDs, one per line (e.g. tt0111161)\ntt0068646\ntt0071562\n..."
                className="w-full h-32 p-2 border rounded-md font-mono text-sm text-black dark:text-white bg-white dark:bg-gray-800"
                style={{ color: "inherit" }}
              />
              {invalidIds.length > 0 && (
                <div className="text-red-500 text-sm">
                  <p>Invalid IMDB IDs detected:</p>
                  <ul className="list-disc pl-5">
                    {invalidIds.slice(0, 5).map((id, index) => (
                      <li key={index}>{id}</li>
                    ))}
                    {invalidIds.length > 5 && (
                      <li>...and {invalidIds.length - 5} more</li>
                    )}
                  </ul>
                  <p>
                    IMDB IDs must be in the format tt followed by numbers (e.g.
                    tt0111161)
                  </p>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{parseImdbIds(imdbIdList).length} valid IDs</span>
                <button
                  onClick={() => setImdbIdList("")}
                  className="text-blue-500 hover:underline"
                  disabled={progress.isRunning || !imdbIdList}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Batch Size</label>
                <Input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                  disabled={progress.isRunning}
                  min={1}
                  max={50}
                />
              </div>
            </div>
          </div>
        )}

        {/* Processing Options */}
        <div className="space-y-4">
          {/* Serverless Mode */}
          <div className="flex items-center space-x-2">
            <Switch
              id="serverless-mode"
              checked={useServerless}
              onCheckedChange={setUseServerless}
              disabled={progress.isRunning || importMode === "list"}
            />
            <Label
              htmlFor="serverless-mode"
              className="flex items-center gap-2"
            >
              <Cloud className="h-4 w-4" />
              Use serverless processing
            </Label>
            <div className="text-xs text-muted-foreground ml-2">
              {importMode === "list"
                ? "Serverless processing not available for ID List mode"
                : useServerless
                  ? "Processing will run on the server (better for large batches)"
                  : "Processing will run in your browser (better for small batches)"}
            </div>
          </div>

          {/* Prioritize Popular Content */}
          <div className="flex items-center space-x-2">
            <Switch
              id="prioritize-popular"
              checked={prioritizePopular}
              onCheckedChange={setPrioritizePopular}
              disabled={progress.isRunning}
            />
            <Label
              htmlFor="prioritize-popular"
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Prioritize popular content
            </Label>
            <div className="text-xs text-muted-foreground ml-2">
              Attempt to process more popular content first (based on IMDB ID
              patterns)
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {dataSource === "omdb" ? (
                <>
                  {progress.processed} / {batchCount} (
                  {calculateProgressPercentage().toFixed(1)}%)
                </>
              ) : (
                <>
                  {tmdbProgress.processed} / {tmdbProgress.totalItems} (
                  {calculateProgressPercentage().toFixed(1)}%)
                </>
              )}
            </span>
          </div>
          <Progress value={calculateProgressPercentage()} className="h-2" />
        </div>

        {/* Processing Speed and ETA */}
        {(progress.isRunning || tmdbProgress.isRunning) && (
          <div className="flex justify-between items-center text-sm">
            <div>
              <span className="font-medium">Speed:</span>{" "}
              <span>{processingSpeed.toFixed(2)} items/sec</span>
            </div>
            <div>
              <span className="font-medium">ETA:</span>{" "}
              <span>{estimatedTimeRemaining || "Calculating..."}</span>
            </div>
          </div>
        )}

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-muted rounded-md p-2 text-center">
                <div className="text-2xl font-bold">
                  {dataSource === "omdb"
                    ? progress.processed
                    : tmdbProgress.processed}
                </div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="bg-muted rounded-md p-2 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {dataSource === "omdb"
                    ? progress.successful
                    : tmdbProgress.successful}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="bg-muted rounded-md p-2 text-center">
                <div className="text-2xl font-bold text-red-500">
                  {dataSource === "omdb"
                    ? progress.failed
                    : tmdbProgress.failed}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="bg-muted rounded-md p-2 text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {dataSource === "omdb"
                    ? progress.skipped
                    : tmdbProgress.skipped}
                </div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>

            {/* Current Status */}
            <div className="flex items-center gap-2">
              {dataSource === "omdb" ? (
                <>
                  <span className="text-sm font-medium">Current ID:</span>
                  <Badge variant="outline">
                    {progress.currentId || startId}
                  </Badge>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">Progress:</span>
                  <Badge variant="outline">
                    {tmdbProgress.currentIndex} / {tmdbProgress.totalItems}
                  </Badge>
                </>
              )}
              <span className="text-sm font-medium ml-4">Status:</span>
              {dataSource === "omdb" ? (
                progress.isRunning ? (
                  <Badge className="bg-blue-500">Running</Badge>
                ) : progress.processed > 0 ? (
                  <Badge className="bg-green-500">Completed</Badge>
                ) : (
                  <Badge variant="outline">Ready</Badge>
                )
              ) : tmdbProgress.isRunning ? (
                <Badge className="bg-blue-500">Running</Badge>
              ) : tmdbProgress.processed > 0 ? (
                <Badge className="bg-green-500">Completed</Badge>
              ) : (
                <Badge variant="outline">Ready</Badge>
              )}
            </div>

            {/* Error Summary */}
            {Object.keys(errorDetails).length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Error Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(errorDetails).map(([category, ids]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between bg-muted rounded-md p-2"
                    >
                      <div className="flex items-center gap-2">
                        {category === "Not Found" ? (
                          <XCircle className="h-4 w-4 text-yellow-500" />
                        ) : category === "API Limits" ? (
                          <Clock className="h-4 w-4 text-orange-500" />
                        ) : category === "Network Issues" ? (
                          <Cloud className="h-4 w-4 text-blue-500" />
                        ) : category === "Vector DB Issues" ? (
                          <Server className="h-4 w-4 text-purple-500" />
                        ) : category === "Authentication Issues" ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Info className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="text-xs">{category}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {ids.length}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Rate */}
            {(dataSource === "omdb"
              ? progress.processed
              : tmdbProgress.processed) > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Success Rate</span>
                  <span className="text-sm">
                    {dataSource === "omdb"
                      ? (
                          (progress.successful / progress.processed) *
                          100
                        ).toFixed(1)
                      : (
                          (tmdbProgress.successful / tmdbProgress.processed) *
                          100
                        ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-green-500 h-2.5 rounded-full"
                    style={{
                      width: `${
                        dataSource === "omdb"
                          ? (progress.successful / progress.processed) * 100
                          : (tmdbProgress.successful / tmdbProgress.processed) *
                            100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-4">
            {Object.keys(errorDetails).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(errorDetails).map(([category, ids]) => (
                  <div key={category} className="border rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {category === "Not Found" ? (
                          <XCircle className="h-4 w-4 text-yellow-500" />
                        ) : category === "API Limits" ? (
                          <Clock className="h-4 w-4 text-orange-500" />
                        ) : category === "Network Issues" ? (
                          <Cloud className="h-4 w-4 text-blue-500" />
                        ) : category === "Vector DB Issues" ? (
                          <Server className="h-4 w-4 text-purple-500" />
                        ) : category === "Authentication Issues" ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : category === "Server Issues" ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : category === "Data Format Issues" ? (
                          <AlertCircle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Info className="h-4 w-4 text-gray-500" />
                        )}
                        <h3 className="font-medium">{category}</h3>
                      </div>
                      <Badge variant="outline">{ids.length}</Badge>
                    </div>
                    <div className="mt-2">
                      <details>
                        <summary className="text-sm text-blue-500 cursor-pointer">
                          Show affected IDs
                        </summary>
                        <div className="mt-2 text-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1">
                          {ids.map((id, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-100 px-2 py-1 rounded dark:bg-gray-800 overflow-hidden text-ellipsis"
                              title={id}
                            >
                              {id}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2" />
                <p>No errors recorded yet</p>
              </div>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Logs</span>
                <span className="text-xs text-muted-foreground">
                  Last updated:{" "}
                  {dataSource === "omdb"
                    ? progress.lastUpdated.toLocaleTimeString()
                    : tmdbProgress.lastUpdated.toLocaleTimeString()}
                </span>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {(dataSource === "omdb"
                  ? progress.logs
                  : tmdbProgress.logs
                ).map((log, index) => (
                  <div key={index} className="py-1 text-sm">
                    {log.includes("Error") ? (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                        <span>{log}</span>
                      </div>
                    ) : log.includes("Successfully") ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>{log}</span>
                      </div>
                    ) : log.includes("skipping") || log.includes("Skipped") ? (
                      <div className="flex items-start gap-2">
                        <SkipForward className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <span>{log}</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                        <span>{log}</span>
                      </div>
                    )}
                  </div>
                ))}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex justify-between">
        <div>
          <Button
            variant="outline"
            onClick={resetImport}
            disabled={progress.isRunning || tmdbProgress.isRunning}
            className="mr-2"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
        <div>
          {!(dataSource === "omdb"
            ? progress.isRunning
            : tmdbProgress.isRunning) ? (
            <Button
              onClick={startImport}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Import
            </Button>
          ) : (
            <Button onClick={stopImport} variant="destructive">
              <Pause className="h-4 w-4 mr-2" />
              Stop Import
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default AutomatedImporter;
