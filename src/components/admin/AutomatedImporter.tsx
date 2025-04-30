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
} from "lucide-react";
import {
  defaultImportProgress,
  ImportProgress,
  processBatch,
} from "@/services/dataImportService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const AutomatedImporter: React.FC = () => {
  const [progress, setProgress] = useState<ImportProgress>(
    defaultImportProgress,
  );
  const [startId, setStartId] = useState<string>("tt0000001");
  const [endId, setEndId] = useState<string>("tt0010000");
  const [batchSize, setBatchSize] = useState<number>(10);
  const [batchCount, setBatchCount] = useState<number>(1000);
  const [useServerless, setUseServerless] = useState<boolean>(false);
  const shouldContinueRef = useRef<boolean>(true);

  const startImport = async () => {
    if (progress.isRunning) return;

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
          setProgress,
          () => shouldContinueRef.current,
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
    setProgress((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        "Import process stopping... (will complete current batch)",
      ],
      lastUpdated: new Date(),
    }));
  };

  const resetImport = () => {
    if (progress.isRunning) return;
    setProgress(defaultImportProgress);
  };

  const calculateProgressPercentage = (): number => {
    if (!progress.processed) return 0;
    return Math.min(100, (progress.processed / batchCount) * 100);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Automated OMDB to Pinecone Importer
        </CardTitle>
        <CardDescription>
          Automatically import content from OMDB to Pinecone by IMDB ID range
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Configuration */}
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
              onChange={(e) => setBatchCount(parseInt(e.target.value) || 1000)}
              disabled={progress.isRunning}
              min={1}
              max={10000}
            />
          </div>
        </div>

        {/* Processing Mode */}
        <div className="flex items-center space-x-2">
          <Switch
            id="serverless-mode"
            checked={useServerless}
            onCheckedChange={setUseServerless}
            disabled={progress.isRunning}
          />
          <Label htmlFor="serverless-mode" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Use serverless processing
          </Label>
          <div className="text-xs text-muted-foreground ml-2">
            {useServerless
              ? "Processing will run on the server (better for large batches)"
              : "Processing will run in your browser (better for small batches)"}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {progress.processed} / {batchCount} (
              {calculateProgressPercentage().toFixed(1)}%)
            </span>
          </div>
          <Progress value={calculateProgressPercentage()} className="h-2" />
        </div>

        {/* Processing Speed and ETA */}
        {progress.isRunning && (
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
                <div className="text-2xl font-bold">{progress.processed}</div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="bg-muted rounded-md p-2 text-center">
                <div className="text-2xl font-bold text-green-500">
                  {progress.successful}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="bg-muted rounded-md p-2 text-center">
                <div className="text-2xl font-bold text-red-500">
                  {progress.failed}
                </div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="bg-muted rounded-md p-2 text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {progress.skipped}
                </div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>

            {/* Current Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Current ID:</span>
              <Badge variant="outline">{progress.currentId || startId}</Badge>
              <span className="text-sm font-medium ml-4">Status:</span>
              {progress.isRunning ? (
                <Badge className="bg-blue-500">Running</Badge>
              ) : progress.processed > 0 ? (
                <Badge className="bg-green-500">Completed</Badge>
              ) : (
                <Badge variant="outline">Ready</Badge>
              )}
            </div>

            {/* Success Rate */}
            {progress.processed > 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Success Rate</span>
                  <span className="text-sm">
                    {((progress.successful / progress.processed) * 100).toFixed(
                      1,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-green-500 h-2.5 rounded-full"
                    style={{
                      width: `${(progress.successful / progress.processed) * 100}%`,
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
                        <XCircle className="h-4 w-4 text-red-500" />
                        <h3 className="font-medium">{category}</h3>
                      </div>
                      <Badge variant="outline">{ids.length}</Badge>
                    </div>
                    <div className="mt-2">
                      <details>
                        <summary className="text-sm text-blue-500 cursor-pointer">
                          Show affected IDs
                        </summary>
                        <div className="mt-2 text-sm grid grid-cols-3 gap-1">
                          {ids.map((id, idx) => (
                            <code
                              key={idx}
                              className="bg-gray-100 px-1 rounded"
                            >
                              {id}
                            </code>
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
                  Last updated: {progress.lastUpdated.toLocaleTimeString()}
                </span>
              </div>
              <ScrollArea className="h-[300px] border rounded-md p-2">
                {progress.logs.map((log, index) => (
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
                    ) : log.includes("skipping") ? (
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
            disabled={progress.isRunning}
            className="mr-2"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
        <div>
          {!progress.isRunning ? (
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
