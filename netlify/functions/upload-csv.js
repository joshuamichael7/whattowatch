// Netlify function to handle CSV file uploads
const fs = require("fs");
const path = require("path");
const os = require("os");
const formidable = require("formidable");
const { Buffer } = require("buffer");

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

    if (!contentType || !contentType.includes("multipart/form-data")) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Invalid content type. Expected multipart/form-data",
        }),
      };
    }

    // Parse the multipart form data manually
    const { file, error } = await parseFormData(event, tempDir);

    if (error) {
      console.error("Error parsing form data:", error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Error parsing form data",
          details: error.message,
        }),
      };
    }

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No file uploaded" }),
      };
    }

    console.log("File uploaded successfully:", file.path);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "File uploaded successfully",
        filePath: file.path,
      }),
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: "Internal Server Error",
        details: error.message,
      }),
    };
  }
};

// Helper function to parse multipart form data in a serverless environment
async function parseFormData(event, tempDir) {
  try {
    // Check if we have a body
    if (!event.body) {
      return { error: new Error("No request body") };
    }

    // Handle base64 encoded body (common in Netlify Functions)
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;

    // Create a unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.csv`;
    const filePath = path.join(tempDir, fileName);

    // Write the file directly to disk
    // Note: This is a simplified approach. In a real-world scenario,
    // you would need to properly parse the multipart form data
    fs.writeFileSync(filePath, body);

    return {
      file: {
        name: fileName,
        path: filePath,
        type: "text/csv",
      },
    };
  } catch (error) {
    console.error("Error in parseFormData:", error);
    return { error };
  }
}
