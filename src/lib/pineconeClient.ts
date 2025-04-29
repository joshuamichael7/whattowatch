import axios from "axios";

/**
 * Create a new Pinecone index for OMDB content
 */
export async function createPineconeIndex(): Promise<boolean> {
  try {
    const response = await axios.post(
      "/.netlify/functions/pinecone-operations",
      {
        operation: "createIndex",
      },
    );
    return response.data.success;
  } catch (error) {
    console.error("Error creating Pinecone index:", error);
    return false;
  }
}

/**
 * Upsert content vectors to Pinecone
 */
export async function upsertVectors(vectors: any[]): Promise<boolean> {
  try {
    const response = await axios.post(
      "/.netlify/functions/pinecone-operations",
      {
        operation: "upsertVectors",
        params: { vectors },
      },
    );
    return response.data.success;
  } catch (error) {
    console.error("Error upserting vectors to Pinecone:", error);
    return false;
  }
}

/**
 * Query Pinecone for similar content
 */
export async function querySimilarContent(text: string, limit: number = 10) {
  try {
    const response = await axios.post(
      "/.netlify/functions/pinecone-operations",
      {
        operation: "querySimilarContent",
        params: { text, limit },
      },
    );
    return response.data.matches || [];
  } catch (error) {
    console.error("Error querying Pinecone:", error);
    return [];
  }
}
