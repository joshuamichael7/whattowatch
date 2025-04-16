import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, CheckCircle, AlertCircle } from "lucide-react";

const CsvUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append("file", file);

      // Upload the file to a temporary location on the server
      // This step would require a separate endpoint to handle file uploads
      const uploadResponse = await fetch("/.netlify/functions/upload-csv", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const { filePath } = await uploadResponse.json();

      // Now call the populate-database function with the file path
      const populateResponse = await fetch(
        "/.netlify/functions/populate-database",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filePath }),
        },
      );

      if (!populateResponse.ok) {
        throw new Error("Failed to populate database");
      }

      const result = await populateResponse.json();

      setUploadStatus({
        success: true,
        message: `Successfully added ${result.totalItems} items to the database`,
      });
    } catch (error) {
      console.error("Error uploading CSV:", error);
      setUploadStatus({
        success: false,
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          CSV Data Uploader
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            <p className="text-sm text-muted-foreground">
              Select a CSV file containing movie/TV show data to upload to the
              database
            </p>
          </div>

          {uploadStatus && (
            <Alert
              variant={uploadStatus.success ? "default" : "destructive"}
              className="mt-4"
            >
              {uploadStatus.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{uploadStatus.message}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload and Process CSV"
            )}
          </Button>

          <div className="text-sm text-muted-foreground mt-4">
            <p>
              Note: This will upload your CSV file and process it to populate
              the Supabase database with content data. Make sure your CSV has
              the correct column structure.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CsvUploader;
