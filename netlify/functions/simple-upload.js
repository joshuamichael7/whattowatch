// Simple file upload function for CSV files
const fs = require("fs");
const path = require("path");
const os = require("os");

exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight OK" }),
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Check if we have a body
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No file data received" }),
      };
    }

    // Create temp directory
    const tempDir = path.join(os.tmpdir(), "csv-uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create a unique filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.csv`;
    const filePath = path.join(tempDir, fileName);

    // Parse the JSON body to get the base64 data
    const { fileData } = JSON.parse(event.body);
    if (!fileData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No file data in request" }),
      };
    }

    // Convert base64 to buffer and write to file
    const fileBuffer = Buffer.from(fileData, "base64");
    fs.writeFileSync(filePath, fileBuffer);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "File uploaded successfully",
        filePath: filePath,
      }),
    };
  } catch (error) {
    console.error("Error in simple-upload:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Upload failed",
        message: error.message,
      }),
    };
  }
};
