// Netlify function to handle CSV file uploads
const fs = require("fs");
const path = require("path");
const os = require("os");
const formidable = require("formidable");

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    // Parse the multipart form data
    const { fields, files } = await parseFormData(event);

    if (!files.file) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No file uploaded" }),
      };
    }

    const file = files.file;

    // Create a temporary directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), "csv-uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate a unique filename
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(tempDir, fileName);

    // Move the uploaded file to the temporary directory
    await fs.promises.copyFile(file.path, filePath);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "File uploaded successfully",
        filePath: filePath,
      }),
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal Server Error",
        details: error.message,
      }),
    };
  }
};

// Helper function to parse multipart form data
function parseFormData(event) {
  return new Promise((resolve, reject) => {
    const form = new formidable.IncomingForm();

    // Parse the raw request body
    form.parse(event, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}
