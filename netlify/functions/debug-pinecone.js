const { Pinecone } = require("@pinecone-database/pinecone");

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

  try {
    // Initialize Pinecone client
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Pinecone API key not found" }),
      };
    }

    console.log("Initializing Pinecone client for debugging...");
    const pc = new Pinecone({
      apiKey,
    });

    // List all indexes
    console.log("Listing Pinecone indexes...");
    const indexes = await pc.listIndexes();
    console.log(
      `Found ${indexes.length} indexes:`,
      indexes.map((idx) => idx.name),
    );

    // Get index details
    const indexName = process.env.PINECONE_INDEX_NAME || "omdb-database";
    console.log(`Getting details for index: ${indexName}`);

    let indexDetails;
    try {
      indexDetails = await pc.describeIndex(indexName);
      console.log(`Index details:`, indexDetails);
    } catch (indexError) {
      console.log(`Error getting index details: ${indexError.message}`);
      indexDetails = { error: indexError.message };
    }

    // Try a simple upsert with a test vector
    console.log("Testing vector upsert...");
    const testVector = {
      id: "test-vector",
      values: Array(1024)
        .fill(0)
        .map(() => Math.random()), // 1024-dimensional random vector
      metadata: { test: "true" },
    };

    let upsertResult;
    try {
      const index = pc.index(indexName);
      // Use a test namespace for debugging
      const testNamespace = "test";
      console.log(`Using test namespace: ${testNamespace}`);
      upsertResult = await index.namespace(testNamespace).upsert([testVector]);
      console.log("Test upsert result:", upsertResult);
    } catch (upsertError) {
      console.log(`Error during test upsert: ${upsertError.message}`);
      upsertResult = { error: upsertError.message };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        apiKeyExists: !!apiKey,
        apiKeyFirstChars: apiKey ? `${apiKey.substring(0, 5)}...` : null,
        indexes: indexes.map((idx) => ({ name: idx.name, status: idx.status })),
        indexDetails,
        upsertResult,
        environment: {
          PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || "not set",
          NODE_VERSION: process.version,
        },
      }),
    };
  } catch (error) {
    console.error("Error in debug-pinecone function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error debugging Pinecone connection",
        message: error.message,
        stack: error.stack,
      }),
    };
  }
};
