import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import axios from "axios";

interface ImportStatus {
  isRunning: boolean;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  totalItems: number;
  logs: string[];
  lastUpdated: string;
}

const TmdbImportMonitor: React.FC = () => {
  const [status, setStatus] = useState<ImportStatus>({
    isRunning: false,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    totalItems: 0,
    logs: [],
    lastUpdated: new Date().toISOString(),
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Poll for status updates when running
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // Initial fetch when component mounts
    fetchStatus();

    if (autoRefresh) {
      const intervalTime = status.isRunning ? 3000 : 10000; // Poll more frequently when running
      interval = setInterval(fetchStatus, intervalTime);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [status.isRunning, autoRefresh]);

  const fetchStatus = async () => {
    console.log("Fetching import status...");
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        "/.netlify/functions/automated-import-status",
      );

      if (response.data) {
        setStatus(response.data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch import status",
      );
      console.error("Error fetching status:", err);
    } finally {
      setLoading(false);
    }
  };

  const startImport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        "/.netlify/functions/automated-import-control",
        {
          action: "start",
        },
      );

      if (response.data) {
        setStatus(response.data);
        // Ensure auto-refresh is enabled when starting an import
        setAutoRefresh(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start import");
      console.error("Error starting import:", err);
    } finally {
      setLoading(false);
    }
  };

  const stopImport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(
        "/.netlify/functions/automated-import-control",
        {
          action: "stop",
        },
      );

      if (response.data) {
        setStatus(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop import");
      console.error("Error stopping import:", err);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage =
    status.totalItems > 0
      ? Math.round((status.processed / status.totalItems) * 100)
      : 0;

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    const lastUpdate = new Date(status.lastUpdated).getTime();
    const now = new Date().getTime();
    const diffSeconds = Math.floor((now - lastUpdate) / 1000);

    if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
    if (diffSeconds < 3600)
      return `${Math.floor(diffSeconds / 60)} minutes ago`;
    return `${Math.floor(diffSeconds / 3600)} hours ago`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>TMDB Import Monitor</CardTitle>
            <CardDescription>
              Monitor the progress of the server-side TMDB data import
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant={status.isRunning ? "default" : "outline"}
              className={status.isRunning ? "bg-green-500" : ""}
            >
              {status.isRunning ? "Running" : "Idle"}
            </Badge>
            {status.isRunning && (
              <span className="text-xs text-green-600">
                Continues in background
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-sm mt-4">
            <div className="bg-muted/40 p-2 rounded">
              <div className="font-medium">{status.processed}</div>
              <div className="text-xs text-muted-foreground">Processed</div>
            </div>
            <div className="bg-muted/40 p-2 rounded">
              <div className="font-medium text-green-600">
                {status.successful}
              </div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </div>
            <div className="bg-muted/40 p-2 rounded">
              <div className="font-medium text-red-600">{status.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="bg-muted/40 p-2 rounded">
              <div className="font-medium text-yellow-600">
                {status.skipped}
              </div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Logs</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`}
                />
                {autoRefresh ? "Auto" : "Manual"}
              </Button>
            </div>
          </div>
          <ScrollArea className="h-60 border rounded-md p-2">
            {status.logs.length > 0 ? (
              <div className="space-y-1">
                {status.logs.map((log, index) => {
                  const isError =
                    log.toLowerCase().includes("error") ||
                    log.toLowerCase().includes("failed");
                  const isSuccess =
                    log.toLowerCase().includes("success") ||
                    log.toLowerCase().includes("added");

                  return (
                    <div
                      key={index}
                      className={`text-sm flex items-start gap-1 ${isError ? "text-red-600" : isSuccess ? "text-green-600" : ""}`}
                    >
                      {isError && (
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      )}
                      {isSuccess && (
                        <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      )}
                      <span>{log}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No logs available
              </div>
            )}
          </ScrollArea>
        </div>

        {error && (
          <div className="text-sm text-red-500 p-2 border border-red-200 rounded bg-red-50 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="text-xs text-muted-foreground flex justify-between">
          <span>
            Last updated: {new Date(status.lastUpdated).toLocaleString()}
          </span>
          <span>{getTimeSinceUpdate()}</span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
        <div className="space-x-2">
          {status.isRunning ? (
            <Button
              variant="destructive"
              onClick={stopImport}
              disabled={loading}
            >
              Stop Import
            </Button>
          ) : (
            <Button onClick={startImport} disabled={loading}>
              Start Import
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default TmdbImportMonitor;
