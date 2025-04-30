import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  defaultTmdbImportProgress,
  importTmdbData,
  TmdbImportProgress,
} from "@/services/tmdbImportService";

export default function TmdbImporter() {
  const [jsonInput, setJsonInput] = useState("");
  const [batchSize, setBatchSize] = useState(10);
  const [clearExisting, setClearExisting] = useState(false);
  const [progress, setProgress] = useState<TmdbImportProgress>(
    defaultTmdbImportProgress,
  );
  const shouldContinueRef = useRef(true);

  const handleImport = useCallback(async () => {
    if (!jsonInput.trim()) {
      setProgress((prev) => ({
        ...prev,
        logs: [...prev.logs, "Please provide TMDB JSON data"],
      }));
      return;
    }

    // Reset progress
    setProgress({
      ...defaultTmdbImportProgress,
      isRunning: true,
      logs: ["Starting TMDB import..."],
    });

    // Reset continue flag
    shouldContinueRef.current = true;

    try {
      await importTmdbData(
        jsonInput,
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
  }, [jsonInput, batchSize, clearExisting]);

  const handleStop = useCallback(() => {
    shouldContinueRef.current = false;
    setProgress((prev) => ({
      ...prev,
      logs: [...prev.logs, "Import process stopping..."],
    }));
  }, []);

  const progressPercentage =
    progress.totalItems > 0
      ? Math.round((progress.processed / progress.totalItems) * 100)
      : 0;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>TMDB Data Importer</CardTitle>
          <CardDescription>
            Import movie and TV show data from TMDB into the vector database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jsonInput">
              TMDB JSON Data (one object per line)
            </Label>
            <Textarea
              id="jsonInput"
              placeholder='{"adult":false,"id":3924,"original_title":"Blondie","popularity":1.8709,"video":false}'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="h-40"
              disabled={progress.isRunning}
            />
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
                <div key={index} className="text-sm">
                  {log}
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
            Clear
          </Button>

          {progress.isRunning ? (
            <Button variant="destructive" onClick={handleStop}>
              Stop Import
            </Button>
          ) : (
            <Button onClick={handleImport}>Start Import</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
