import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import {
  defaultTmdbImportProgress,
  TmdbImportProgress,
  importTmdbData,
  loadTmdbIdsFromFile,
} from "@/services/tmdbImportService";

export default function StaticTmdbImporter() {
  const [batchSize, setBatchSize] = useState(10);
  const [clearExisting, setClearExisting] = useState(false);
  const [progress, setProgress] = useState<TmdbImportProgress>(
    defaultTmdbImportProgress,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [tmdbIds, setTmdbIds] = useState<any[]>([]);
  const shouldContinueRef = React.useRef(true);

  // Load TMDB IDs from file on component mount
  useEffect(() => {
    const loadIds = async () => {
      setIsLoading(true);
      try {
        const ids = await loadTmdbIdsFromFile();
        setTmdbIds(ids);
        setProgress((prev) => ({
          ...prev,
          logs: [...prev.logs, `Loaded ${ids.length} TMDB IDs from file`],
          totalItems: ids.length,
        }));
      } catch (error) {
        setProgress((prev) => ({
          ...prev,
          logs: [
            ...prev.logs,
            `Error loading TMDB IDs: ${error instanceof Error ? error.message : String(error)}`,
          ],
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadIds();
  }, []);

  const handleImport = async () => {
    if (progress.isRunning || tmdbIds.length === 0) return;

    // Convert the loaded IDs to a JSON string format that the import function expects
    const jsonString = tmdbIds.map((item) => JSON.stringify(item)).join("\n");

    // Reset progress
    setProgress({
      ...defaultTmdbImportProgress,
      isRunning: true,
      totalItems: tmdbIds.length,
      logs: [
        `Starting import of ${tmdbIds.length} TMDB items with batch size ${batchSize}`,
      ],
    });

    // Reset continue flag
    shouldContinueRef.current = true;

    try {
      await importTmdbData(
        jsonString,
        batchSize,
        setProgress,
        () => shouldContinueRef.current,
        clearExisting,
      );
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        isRunning: false,
        logs: [
          ...prev.logs,
          `Error during import: ${error instanceof Error ? error.message : String(error)}`,
        ],
      }));
    }
  };

  const handleStop = () => {
    shouldContinueRef.current = false;
    setProgress((prev) => ({
      ...prev,
      logs: [...prev.logs, "Import process stopping..."],
    }));
  };

  const progressPercentage =
    progress.totalItems > 0
      ? Math.round((progress.processed / progress.totalItems) * 100)
      : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Static TMDB Data Importer</CardTitle>
        <CardDescription>
          Import movie and TV show data from the static TMDB IDs file into the
          vector database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">TMDB IDs from File</h3>
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading TMDB IDs...
                </span>
              ) : tmdbIds.length > 0 ? (
                `${tmdbIds.length} TMDB IDs loaded from file`
              ) : (
                "No TMDB IDs loaded"
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setIsLoading(true);
              try {
                const ids = await loadTmdbIdsFromFile();
                setTmdbIds(ids);
                setProgress((prev) => ({
                  ...prev,
                  logs: [
                    ...prev.logs,
                    `Reloaded ${ids.length} TMDB IDs from file`,
                  ],
                  totalItems: ids.length,
                }));
              } catch (error) {
                setProgress((prev) => ({
                  ...prev,
                  logs: [
                    ...prev.logs,
                    `Error reloading TMDB IDs: ${error instanceof Error ? error.message : String(error)}`,
                  ],
                }));
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading || progress.isRunning}
          >
            Reload IDs
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="batchSize">Batch Size</Label>
            <Input
              id="batchSize"
              type="number"
              min="1"
              max="50"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
              disabled={progress.isRunning}
            />
          </div>

          <div className="flex items-center space-x-2 pt-8">
            <Switch
              id="clearExisting"
              checked={clearExisting}
              onCheckedChange={setClearExisting}
              disabled={progress.isRunning}
            />
            <Label htmlFor="clearExisting">
              Clear existing data before import
            </Label>
          </div>
        </div>

        {progress.isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Progress: {progressPercentage}%</span>
              <span>
                {progress.processed} / {progress.totalItems} items
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>Successful: {progress.successful}</div>
              <div>Failed: {progress.failed}</div>
              <div>Skipped: {progress.skipped}</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Logs</Label>
          <ScrollArea className="h-40 border rounded-md p-2 bg-muted/20">
            {progress.logs.map((log, index) => (
              <div key={index} className="text-sm py-1">
                {log.includes("Error") || log.includes("Failed") ? (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{log}</span>
                  </div>
                ) : log.includes("Successfully") || log.includes("Added") ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{log}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{log}</span>
                  </div>
                )}
              </div>
            ))}
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setProgress(defaultTmdbImportProgress)}
          disabled={progress.isRunning}
        >
          Clear Logs
        </Button>

        {progress.isRunning ? (
          <Button variant="destructive" onClick={handleStop}>
            Stop Import
          </Button>
        ) : (
          <Button
            onClick={handleImport}
            disabled={isLoading || tmdbIds.length === 0}
          >
            Start Import
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
