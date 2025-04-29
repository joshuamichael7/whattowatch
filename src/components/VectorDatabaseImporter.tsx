import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { batchAddContentToVectorDb } from "@/services/vectorService";
import { useAuth } from "@/contexts/AuthContext";
import { getContentById, searchContent } from "@/lib/omdbClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const VectorDatabaseImporter: React.FC = () => {
  const { isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [batchSize, setBatchSize] = useState(10);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const handleSearchAndImport = async () => {
    if (!searchQuery) {
      toast({
        title: "Search Query Required",
        description: "Please enter a search query to find content",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setTotalProcessed(0);
    setSuccessCount(0);
    setErrorCount(0);
    setLogs([]);

    try {
      addLog(`Searching for content with query: "${searchQuery}"`);

      // Search for content
      const searchResults = await searchContent(searchQuery);

      if (!searchResults || searchResults.length === 0) {
        addLog("No search results found");
        toast({
          title: "No Results",
          description: "No content found for your search query",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      addLog(`Found ${searchResults.length} search results`);

      // Get detailed content for each search result
      const detailedContent = [];
      let processedCount = 0;

      for (const result of searchResults) {
        try {
          addLog(`Getting details for "${result.title}" (${result.id})`);
          const content = await getContentById(result.id);

          if (content) {
            detailedContent.push(content);
            addLog(`Successfully retrieved details for "${content.title}"`);
          } else {
            addLog(`Failed to get details for "${result.title}"`);
            setErrorCount((prev) => prev + 1);
          }
        } catch (error) {
          addLog(`Error getting details for "${result.title}": ${error}`);
          setErrorCount((prev) => prev + 1);
        }

        processedCount++;
        setProgress(Math.floor((processedCount / searchResults.length) * 50));
        setTotalProcessed(processedCount);
      }

      addLog(`Retrieved details for ${detailedContent.length} content items`);

      // Add content to vector database
      if (detailedContent.length > 0) {
        addLog(`Adding ${detailedContent.length} items to vector database`);
        const addedCount = await batchAddContentToVectorDb(
          detailedContent,
          batchSize,
        );

        setSuccessCount(addedCount);
        setErrorCount(detailedContent.length - addedCount);
        setProgress(100);

        addLog(`Successfully added ${addedCount} items to vector database`);

        toast({
          title: "Import Complete",
          description: `Added ${addedCount} items to vector database`,
          variant: "default",
        });
      }
    } catch (error) {
      addLog(`Error during import: ${error}`);
      toast({
        title: "Import Error",
        description: "An error occurred during the import process",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportById = async () => {
    // For demo purposes, we'll import a few hardcoded IDs
    const imdbIds = [
      "tt7923710", // My Mister
      "tt4248912", // Healer
      "tt6103218", // The K2
      "tt3075822", // Two Weeks
      "tt5223110", // Remember
    ];

    setIsImporting(true);
    setProgress(0);
    setTotalProcessed(0);
    setSuccessCount(0);
    setErrorCount(0);
    setLogs([]);

    try {
      addLog(`Importing ${imdbIds.length} content items by IMDB ID`);

      const detailedContent = [];
      let processedCount = 0;

      for (const imdbId of imdbIds) {
        try {
          addLog(`Getting details for IMDB ID: ${imdbId}`);
          const content = await getContentById(imdbId);

          if (content) {
            detailedContent.push(content);
            addLog(`Successfully retrieved details for "${content.title}"`);
          } else {
            addLog(`Failed to get details for IMDB ID: ${imdbId}`);
            setErrorCount((prev) => prev + 1);
          }
        } catch (error) {
          addLog(`Error getting details for IMDB ID ${imdbId}: ${error}`);
          setErrorCount((prev) => prev + 1);
        }

        processedCount++;
        setProgress(Math.floor((processedCount / imdbIds.length) * 50));
        setTotalProcessed(processedCount);
      }

      addLog(`Retrieved details for ${detailedContent.length} content items`);

      // Add content to vector database
      if (detailedContent.length > 0) {
        addLog(`Adding ${detailedContent.length} items to vector database`);
        const addedCount = await batchAddContentToVectorDb(
          detailedContent,
          batchSize,
        );

        setSuccessCount(addedCount);
        setErrorCount(detailedContent.length - addedCount);
        setProgress(100);

        addLog(`Successfully added ${addedCount} items to vector database`);

        toast({
          title: "Import Complete",
          description: `Added ${addedCount} items to vector database`,
          variant: "default",
        });
      }
    } catch (error) {
      addLog(`Error during import: ${error}`);
      toast({
        title: "Import Error",
        description: "An error occurred during the import process",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Admin Access Required</h2>
        <p>You need admin privileges to access this feature.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Vector Database Importer</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Import by Search</CardTitle>
            <CardDescription>
              Search for content and import it into the vector database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="searchQuery">Search Query</Label>
                <Input
                  id="searchQuery"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter a movie or TV show title"
                  disabled={isImporting}
                />
              </div>

              <div>
                <Label htmlFor="batchSize">Batch Size</Label>
                <Select
                  value={batchSize.toString()}
                  onValueChange={(value) => setBatchSize(parseInt(value))}
                  disabled={isImporting}
                >
                  <SelectTrigger id="batchSize">
                    <SelectValue placeholder="Select batch size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleSearchAndImport}
              disabled={isImporting || !searchQuery}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Search & Import"
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Sample Content</CardTitle>
            <CardDescription>
              Import sample Korean dramas into the vector database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>This will import the following content:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>My Mister (tt7923710)</li>
                <li>Healer (tt4248912)</li>
                <li>The K2 (tt6103218)</li>
                <li>Two Weeks (tt3075822)</li>
                <li>Remember (tt5223110)</li>
              </ul>

              <div>
                <Label htmlFor="idBatchSize">Batch Size</Label>
                <Select
                  value={batchSize.toString()}
                  onValueChange={(value) => setBatchSize(parseInt(value))}
                  disabled={isImporting}
                >
                  <SelectTrigger id="idBatchSize">
                    <SelectValue placeholder="Select batch size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleImportById}
              disabled={isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Sample Content"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {isImporting && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">Import Progress</h2>
          <Progress value={progress} className="h-2 mb-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{totalProcessed} processed</span>
            <span>{progress}% complete</span>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-2">Import Results</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalProcessed}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-green-600">Success</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {successCount}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-red-600">Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{errorCount}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-2">Import Logs</h2>
        <div className="bg-muted p-4 rounded-md h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No logs yet</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1 text-sm">
                <span className="text-muted-foreground">{log}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default VectorDatabaseImporter;
