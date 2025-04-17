import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Upload, Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";

const CsvManagement: React.FC = () => {
  const { user, profile, session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!user || !profile || profile.role !== "admin") {
      setResult({
        success: false,
        message: "You don't have permission to upload CSV files.",
      });
      return;
    }

    setUploading(true);
    setProgress(10);
    setResult(null);

    try {
      console.log(
        "Uploading file:",
        file.name,
        "Size:",
        file.size,
        "Type:",
        file.type,
      );

      // Read the file as base64
      const fileReader = new FileReader();
      const filePromise = new Promise((resolve, reject) => {
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = () => reject(new Error("Failed to read file"));
      });
      fileReader.readAsDataURL(file);

      // Wait for file to be read
      const fileDataUrl = (await filePromise) as string;
      // Remove the data URL prefix (e.g., "data:text/csv;base64,")
      const base64Data = fileDataUrl.split(",")[1];

      setProgress(30);

      // Upload the file using the simple-upload function
      const uploadResponse = await axios.post(
        "/.netlify/functions/simple-upload",
        { fileData: base64Data },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
        },
      );

      console.log("Upload response:", uploadResponse.data);
      setProgress(60);

      // If upload successful, process the file
      if (uploadResponse.data.success) {
        const filePath = uploadResponse.data.filePath;
        console.log(
          "File uploaded successfully, processing at path:",
          filePath,
        );

        // Process the uploaded file
        const processResponse = await axios.post(
          "/.netlify/functions/populate-database",
          { filePath },
          {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          },
        );

        console.log("Process response:", processResponse.data);
        setProgress(100);
        setResult({
          success: true,
          message: "CSV file processed successfully",
          details: processResponse.data,
        });
      } else {
        throw new Error(uploadResponse.data.error || "Upload failed");
      }
    } catch (error: any) {
      console.error("Error uploading CSV:", error);
      let errorDetails = error.message;

      // Extract more detailed error information if available
      if (error.response) {
        console.error("Error response:", error.response);
        errorDetails =
          error.response.data?.error ||
          error.response.data?.message ||
          error.response.data ||
          `Server error: ${error.response.status}`;

        // If the error response contains a stack trace, log it but don't show to user
        if (error.response.data?.stack) {
          console.error("Error stack:", error.response.data.stack);
        }
      }

      setResult({
        success: false,
        message: "Error processing CSV file",
        details: errorDetails,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Upload className="h-5 w-5" />
          CSV Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Upload CSV files to populate the content database. The file should
            contain movie and TV show data with columns matching the expected
            format.
          </p>

          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="max-w-md"
            />
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="whitespace-nowrap"
            >
              {uploading ? "Processing..." : "Upload & Process"}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2 mt-4">
              <Progress value={progress} className="h-2 w-full" />
              <p className="text-xs text-muted-foreground">
                {progress < 60
                  ? "Uploading file..."
                  : "Processing data and inserting into database..."}
              </p>
            </div>
          )}

          {result && (
            <Alert
              variant={result.success ? "default" : "destructive"}
              className="mt-4"
            >
              {result.success ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <div className="font-medium">{result.message}</div>
                {result.success && result.details && (
                  <div className="text-xs mt-2">
                    <div>Total items: {result.details.totalItems}</div>
                    <div>
                      Batches processed:{" "}
                      {
                        result.details.results.filter((r: any) => r.success)
                          .length
                      }
                    </div>
                  </div>
                )}
                {!result.success && result.details && (
                  <div className="text-xs mt-2 text-red-500">
                    {typeof result.details === "string"
                      ? result.details
                      : JSON.stringify(result.details)}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-medium mb-2">Expected CSV Format</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Required columns:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Title - Movie or TV show title</li>
              <li>Year - Release year</li>
              <li>Type - "movie" or "series"</li>
              <li>Poster - URL to poster image</li>
              <li>imdbID - IMDB identifier</li>
              <li>Plot - Brief description</li>
              <li>Rated - Content rating (e.g., PG-13)</li>
              <li>Runtime - Duration in minutes</li>
              <li>Genre - Comma-separated genres</li>
              <li>Director - Director name(s)</li>
              <li>Actors - Main cast</li>
              <li>imdbRating - Rating from IMDB</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CsvManagement;
