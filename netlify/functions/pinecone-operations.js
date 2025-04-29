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
      case "checkConnection": {
        // Just check if we can initialize Pinecone client
        const client = await initPinecone();
        const success = !!client;
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success,
            message: success
              ? "Successfully connected to Pinecone"
              : "Failed to connect to Pinecone",
          }),
        };
      }

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

        // Log the first vector for debugging
        if (vectors.length > 0) {
          console.log("Processing vector with ID:", vectors[0].id);
          console.log(
            "Vector metadata keys:",
            Object.keys(vectors[0].metadata || {}),
          );
          console.log("Vector has text:", !!vectors[0].text);
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

    // Create the index - using dimension 1024 for Pinecone's built-in embeddings
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
  console.log("Starting upsertVectors function");
  const index = await getPineconeIndex();
  if (!index) {
    console.error("Failed to get Pinecone index");
    return false;
  }

  try {
    console.log(`Upserting ${vectors.length} vectors to Pinecone`);
    console.log("Pinecone API Key exists:", !!process.env.PINECONE_API_KEY);
    console.log(
      "Pinecone Index Name:",
      process.env.PINECONE_INDEX_NAME || "omdb-database",
    );

    // Log the first vector for debugging
    if (vectors.length > 0) {
      const firstVector = vectors[0];
      console.log("First vector:", {
        id: firstVector.id,
        metadata: Object.keys(firstVector.metadata || {}),
        hasText: !!firstVector.text,
        textLength: firstVector.text ? firstVector.text.length : 0,
      });

      // Log the full text for debugging
      if (firstVector.text) {
        console.log("Vector text sample:", firstVector.text.substring(0, 200));
      }

      // Validate vector ID
      if (!firstVector.id) {
        console.error("Vector is missing ID - this is required");
        return false;
      }

      // Validate text for embedding
      if (!firstVector.text || firstVector.text.length < 10) {
        console.error(
          "Vector text is missing or too short for effective embedding",
        );
        return false;
      }
    }

    // Define the namespace for content
    const namespace = "content";
    console.log(`Using namespace for upsert: ${namespace}`);

    try {
      // Format vectors for upsertRecords with integrated embedding
      const formattedRecords = vectors.map((vector) => {
        // Create a record object with _id and chunk_text field
        const record = {
          _id: String(vector.id),
          chunk_text: vector.text, // Using chunk_text as the field for embedding
        };

        // Add metadata fields directly to the record
        if (vector.metadata) {
          Object.entries(vector.metadata).forEach(([key, value]) => {
            // Convert all values to strings to avoid Pinecone errors
            record[key] =
              value !== null && value !== undefined ? String(value) : "";
          });
        }

        return record;
      });

      console.log(
        "About to call index.namespace(namespace).upsertRecords with formatted records",
      );
      console.log("Sample record format:", formattedRecords[0]);

      // Use the namespace-specific upsertRecords method for integrated embedding
      const upsertResponse = await index
        .namespace(namespace)
        .upsertRecords(formattedRecords);
      console.log("Upsert response:", upsertResponse);
      console.log("Vectors successfully upserted to Pinecone");
      return true;
    } catch (upsertError) {
      console.error(
        "Error during index.namespace(namespace).upsertRecords call:",
        upsertError,
      );
      console.error("Error message:", upsertError.message);
      console.error("Error details:", JSON.stringify(upsertError, null, 2));

      // Check if this is an index not found error
      if (
        upsertError.message &&
        upsertError.message.includes("index not found")
      ) {
        console.log("Index not found error - attempting to create index");
        await createPineconeIndex();
        console.log("Index created, retrying upsert");
        // Retry with the namespace-specific upsertRecords method
        await index.namespace(namespace).upsertRecords(formattedRecords);
        return true;
      }

      throw upsertError;
    }
  } catch (error) {
    console.error("Error upserting vectors to Pinecone:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    return false;
  }
}

/**
 * Query Pinecone for similar content
 */
async function querySimilarContent(text, limit = 10, namespace = "content") {
  const index = await getPineconeIndex();
  if (!index) return [];

  try {
    console.log(`Querying Pinecone with text: "${text.substring(0, 50)}..."`);

    // Use Pinecone's query method with namespace and integrated embedding
    console.log(`Using namespace for query: ${namespace}`);
    const queryResponse = await index.namespace(namespace).query({
      topK: limit,
      includeMetadata: true,
      text: text, // Using text for Pinecone's built-in embedding
    });

    console.log(
      `Pinecone query returned ${queryResponse.matches?.length || 0} matches`,
    );

    // Log the first match for debugging
    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log("First match:", {
        id: queryResponse.matches[0].id,
        score: queryResponse.matches[0].score,
        metadata: queryResponse.matches[0].metadata,
      });
    }

    return queryResponse.matches || [];
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    return [];
  }
}
