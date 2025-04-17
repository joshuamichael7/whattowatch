// Netlify function to handle CSV file uploads
const fs = require("fs");
const path = require("path");
const os = require("os");
const formidable = require("formidable");

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    console.log("Starting CSV upload process");

    // Create a temporary directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), "csv-uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Get the content type from the headers
    const contentType =
      event.headers["content-type"] || event.headers["Content-Type"];

    console.log("Content-Type:", contentType);

    // Create a unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.csv`;
    const filePath = path.join(tempDir, fileName);

    // Handle multipart form data
    if (contentType && contentType.includes("multipart/form-data")) {
      console.log("Processing multipart form data");

      // Create a new formidable form instance
      const form = new formidable.IncomingForm({
        uploadDir: tempDir,
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
      });

      // Parse the form data
      const formData = await new Promise((resolve, reject) => {
        // Handle both modern and legacy formidable API formats
        form.parse(event, (err, fields, files) => {
          if (err) {
            console.error("Error parsing form:", err);
            return reject(err);
          }
          resolve({ fields, files });
        });
      });

      console.log("Form data parsed:", JSON.stringify(formData, null, 2));

      // Extract the file from the parsed form data
      const files = formData.files;
      const fileField = files.file;

      if (!fileField) {
        console.error("No file found in the upload");
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No file uploaded" }),
        };
      }

      // Handle both array and direct object formats
      const uploadedFile = Array.isArray(fileField) ? fileField[0] : fileField;

      // Handle different property names in formidable versions
      const uploadedFilePath = uploadedFile.filepath || uploadedFile.path;
      const originalFilename =
        uploadedFile.originalFilename || uploadedFile.name;

      console.log("File uploaded successfully:", {
        path: uploadedFilePath,
        originalName: originalFilename,
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "File uploaded successfully",
          filePath: uploadedFilePath,
          originalName: originalFilename,
        }),
      };
    } else {
      // Handle direct file upload (non-multipart)
      console.log("Processing direct file upload");

      // Check if we have a body
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No request body" }),
        };
      }

      // Handle base64 encoded body (common in Netlify Functions)
      const body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : event.body;

      // Write the file directly to disk
      fs.writeFileSync(filePath, body);

      console.log("File saved directly:", filePath);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "File uploaded successfully",
          filePath: filePath,
        }),
      };
    }
  } catch (error) {
    console.error("Error uploading file:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Internal Server Error",
        message: error.message,
        stack: error.stack,
      }),
    };
  }
};
