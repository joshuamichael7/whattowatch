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

  // Poll for status updates when running
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (status.isRunning) {
      interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status.isRunning]);

  const fetchStatus = async () => {
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>TMDB Import Monitor</CardTitle>
        <CardDescription>
          Monitor the progress of the server-side TMDB data import
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Status</span>
            <span className="text-sm">
              {status.isRunning ? (
                <span className="text-green-500 font-medium">Running</span>
              ) : (
                <span className="text-muted-foreground">Idle</span>
              )}
            </span>
          </div>

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
          <span className="text-sm font-medium">Logs</span>
          <ScrollArea className="h-40 border rounded-md p-2">
            {status.logs.length > 0 ? (
              <div className="space-y-1">
                {status.logs.map((log, index) => (
                  <div key={index} className="text-sm">
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No logs available
              </div>
            )}
          </ScrollArea>
        </div>

        {error && (
          <div className="text-sm text-red-500 p-2 border border-red-200 rounded bg-red-50">
            {error}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(status.lastUpdated).toLocaleString()}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={fetchStatus} disabled={loading}>
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
