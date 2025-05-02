import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LogEntry {
  timestamp: string;
  message: string;
  type: "info" | "error" | "success";
  timeAgo: string;
}

const BackgroundProcessingLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadLogs = () => {
    try {
      const logsStr = localStorage.getItem("backgroundProcessingLogs") || "[]";
      const parsedLogs = JSON.parse(logsStr);

      // Update the timeAgo field for each log
      const updatedLogs = parsedLogs.map((log: LogEntry) => ({
        ...log,
        timeAgo: formatDistanceToNow(new Date(log.timestamp), {
          addSuffix: true,
        }),
      }));

      setLogs(updatedLogs);
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = () => {
    try {
      localStorage.setItem("backgroundProcessingLogs", "[]");
      setLogs([]);
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  useEffect(() => {
    loadLogs();

    // Set up auto-refresh if enabled
    let intervalId: number | undefined;
    if (autoRefresh) {
      intervalId = window.setInterval(loadLogs, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "error":
        return "destructive";
      case "success":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-background">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Background Processing Logs</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Auto-refresh On
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Auto-refresh Off
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={loadLogs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No background processing logs found.
        </div>
      ) : (
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {logs.map((log, index) => (
              <div key={index} className="p-3 border rounded-md bg-muted/30">
                <div className="flex justify-between items-start mb-1">
                  <Badge variant={getBadgeVariant(log.type)}>
                    {log.type.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {log.timeAgo}
                  </span>
                </div>
                <p className="text-sm">{log.message}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(log.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default BackgroundProcessingLogs;
