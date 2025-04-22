import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { updateMissingGenres } from "@/lib/genreUpdater";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UpdateResult {
  total: number;
  updated: number;
  failed: number;
  details: Array<{ id: string; title: string; status: string; error?: string }>;
}

const GenreUpdater: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [progress, setProgress] = useState(0);

  const handleUpdateGenres = async () => {
    setIsUpdating(true);
    setProgress(10);
    setResult(null);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 5;
          if (newProgress >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return newProgress;
        });
      }, 1000);

      // Call the update function
      const result = await updateMissingGenres();

      // Clear the interval and set final progress
      clearInterval(progressInterval);
      setProgress(100);
      setResult(result);
    } catch (error) {
      console.error("Error updating genres:", error);
      setResult({
        total: 0,
        updated: 0,
        failed: 0,
        details: [
          {
            id: "error",
            title: "Error",
            status: "failed",
            error: String(error),
          },
        ],
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Genre Data Updater
        </CardTitle>
        <CardDescription>
          Find content with IMDB IDs but missing genres and update them using
          the OMDB API
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isUpdating ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <Progress value={progress} className="h-2" />
              </div>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Updating genre information. This may take a few minutes...
            </p>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">{result.total}</div>
                <div className="text-sm text-muted-foreground">Total Items</div>
              </div>
              <div className="bg-green-100 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.updated}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  Updated
                </div>
              </div>
              <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.failed}
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  Failed
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Update Details</h3>
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-2">
                  {result.details.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 rounded-md border"
                    >
                      {item.status === "updated" ? (
                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {item.title}
                          </span>
                          <Badge
                            variant={
                              item.status === "updated"
                                ? "default"
                                : "destructive"
                            }
                            className="ml-auto shrink-0"
                          >
                            {item.status}
                          </Badge>
                        </div>
                        {item.error && (
                          <p className="text-xs text-red-500 mt-1">
                            {item.error}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              This utility will find content items with IMDB IDs but missing
              genre information, then fetch the genre data from OMDB and update
              the database.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              The process uses the Netlify function with the OMDB API key to
              fetch the data.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleUpdateGenres}
          disabled={isUpdating}
          className="w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Updating Genres...
            </>
          ) : (
            "Update Missing Genres"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GenreUpdater;
