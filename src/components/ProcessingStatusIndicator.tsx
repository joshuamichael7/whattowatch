import React, { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ProcessingStatus {
  isRunning: boolean;
  processed: number;
  successful: number;
  failed: number;
  total: number;
  lastUpdated: string;
  logs: string[];
}

const ProcessingStatusIndicator = () => {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch status from server
  const fetchStatus = async () => {
    try {
      const response = await fetch(
        "/.netlify/functions/check-processing-status",
      );
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching processing status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for status updates
  useEffect(() => {
    fetchStatus();

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!status || status.total === 0) return 0;
    return Math.round((status.processed / status.total) * 100);
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!status || !status.lastUpdated) return "";

    const lastUpdated = new Date(status.lastUpdated);
    const now = new Date();
    const diffSeconds = Math.floor(
      (now.getTime() - lastUpdated.getTime()) / 1000,
    );

    if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
    if (diffSeconds < 3600)
      return `${Math.floor(diffSeconds / 60)} minutes ago`;
    return `${Math.floor(diffSeconds / 3600)} hours ago`;
  };

  // Don't show anything if there's no processing happening and no data
  if (!isLoading && (!status || (status.total === 0 && !status.isRunning))) {
    return null;
  }

  return (
    <div className="bg-background border rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Recommendation Processing</h3>
        {status?.isRunning ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        ) : (
          <Badge variant={status?.processed > 0 ? "default" : "outline"}>
            {status?.processed > 0 ? "Completed" : "Idle"}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-destructive text-sm">{error}</div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>
                {status?.processed || 0} / {status?.total || 0} recommendations
              </span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {status?.successful || 0} successful, {status?.failed || 0}{" "}
                failed
              </span>
              <span>Last updated: {formatLastUpdated()}</span>
            </div>
          </div>

          {status?.logs && status.logs.length > 0 && (
            <div className="mt-3 pt-3 border-t text-xs">
              <div className="text-muted-foreground mb-1">Recent activity:</div>
              <div className="max-h-20 overflow-y-auto">
                {status.logs.slice(-3).map((log, index) => (
                  <div key={index} className="text-xs py-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProcessingStatusIndicator;
