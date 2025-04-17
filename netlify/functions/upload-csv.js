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
      const form = formidable({
        uploadDir: tempDir,
        filename: () => fileName,
        keepExtensions: true,
      });

      // Parse the form data
      const [fields, files] = await new Promise((resolve, reject) => {
        form.parse(event, (err, fields, files) => {
          if (err) return reject(err);
          resolve([fields, files]);
        });
      });

      console.log("Files received:", files);

      if (!files || !files.file) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "No file uploaded" }),
        };
      }

      // Get the uploaded file path
      const uploadedFile = files.file[0] || files.file;
      const uploadedFilePath = uploadedFile.filepath || uploadedFile.path;

      console.log("File uploaded successfully:", uploadedFilePath);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "File uploaded successfully",
          filePath: uploadedFilePath,
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
        details: error.message,
        stack: error.stack,
      }),
    };
  }
};
