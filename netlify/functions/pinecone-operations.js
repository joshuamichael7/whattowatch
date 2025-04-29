const { Pinecone } = require("@pinecone-database/pinecone");

// Initialize the Pinecone client
let pineconeClient = null;

/**
 * Initialize the Pinecone client with API key
 */
async function initPinecone() {
  if (pineconeClient) return pineconeClient;

  try {
    const apiKey = process.env.PINECONE_API_KEY;

    if (!apiKey) {
      console.error("Pinecone API key not found");
      return null;
    }

    console.log("Initializing Pinecone client...");
    pineconeClient = new Pinecone({
      apiKey,
    });

    console.log("Pinecone client initialized successfully");
    return pineconeClient;
  } catch (error) {
    console.error("Error initializing Pinecone client:", error);
    return null;
  }
}

/**
 * Get the Pinecone index for content
 */
async function getPineconeIndex() {
  const client = await initPinecone();
  if (!client) return null;

  const indexName = process.env.PINECONE_INDEX_NAME || "omdb-database";

  try {
    return client.index(indexName);
  } catch (error) {
    console.error(`Error getting Pinecone index ${indexName}:`, error);
    return null;
  }
}

// Handler for Netlify function
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
    // Parse the request body
    const { operation, params } = event.body ? JSON.parse(event.body) : {};

    if (!operation) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Missing operation in request body",
        }),
      };
    }

    // Handle different operations
    switch (operation) {
      case "createIndex": {
        const result = await createPineconeIndex();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: result }),
        };
      }

      case "upsertVectors": {
        const { vectors } = params || {};
        if (!vectors || !Array.isArray(vectors)) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Invalid vectors parameter" }),
          };
        }
        const result = await upsertVectors(vectors);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: result }),
        };
      }

      case "querySimilarContent": {
        const { text, limit } = params || {};
        if (!text) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing text parameter" }),
          };
        }
        const matches = await querySimilarContent(text, limit);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ matches }),
        };
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown operation: ${operation}` }),
        };
    }
  } catch (error) {
    console.error("Error in pinecone-operations function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error processing Pinecone operation",
        message: error.message,
      }),
    };
  }
};

/**
 * Create a new Pinecone index for OMDB content
 */
async function createPineconeIndex() {
  const client = await initPinecone();
  if (!client) return false;

  const indexName = process.env.PINECONE_INDEX_NAME || "omdb-database";

  try {
    // Check if index already exists
    const indexes = await client.listIndexes();
    if (indexes.some((idx) => idx.name === indexName)) {
      console.log(`Index ${indexName} already exists`);
      return true;
    }

    // Create the index
    await client.createIndex({
      name: indexName,
      dimension: 1024,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });

    console.log(`Index ${indexName} created successfully`);
    return true;
  } catch (error) {
    console.error(`Error creating Pinecone index ${indexName}:`, error);
    return false;
  }
}

/**
 * Upsert content vectors to Pinecone
 */
async function upsertVectors(vectors) {
  const index = await getPineconeIndex();
  if (!index) return false;

  try {
    console.log(`Upserting ${vectors.length} vectors to Pinecone`);

    // Log the first vector for debugging
    if (vectors.length > 0) {
      console.log("First vector:", {
        id: vectors[0].id,
        metadata: vectors[0].metadata,
        hasText: !!vectors[0].text,
        textLength: vectors[0].text ? vectors[0].text.length : 0,
      });
    }

    // Ensure each vector has the required format for Pinecone
    const formattedVectors = vectors.map((vector) => ({
      id: vector.id,
      metadata: vector.metadata,
      // values is optional when using text
      values: vector.values || [],
      // Use text for Pinecone's text embedding API
      text: vector.text,
    }));

    await index.upsert(formattedVectors);
    console.log("Vectors successfully upserted to Pinecone");
    return true;
  } catch (error) {
    console.error("Error upserting vectors to Pinecone:", error);
    console.error("Error details:", error.message);
    return false;
  }
}

/**
 * Query Pinecone for similar content
 */
async function querySimilarContent(text, limit = 10) {
  const index = await getPineconeIndex();
  if (!index) return [];

  try {
    const queryResponse = await index.query({
      vector: [], // Not needed when using text directly
      topK: limit,
      includeMetadata: true,
      includeValues: false,
      filter: {},
      text: text, // Using Pinecone's integrated embedding
    });

    return queryResponse.matches || [];
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    return [];
  }
}
