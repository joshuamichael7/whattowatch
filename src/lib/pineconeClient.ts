import axios from "axios";

/**
 * Create a new Pinecone index for content
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
 * Clear all vectors from Pinecone index
 */
export async function clearPineconeIndex(): Promise<boolean> {
  try {
    console.log("Clearing Pinecone index...");
    const response = await axios.post(
      "/.netlify/functions/pinecone-operations",
      {
        operation: "deleteAllVectors",
      },
    );
    console.log("Pinecone index cleared:", response.data);
    return response.data.success;
  } catch (error) {
    console.error("Error clearing Pinecone index:", error);
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

/**
 * Get the status of the Pinecone index
 */
export async function getPineconeStatus(): Promise<any> {
  try {
    const response = await axios.post(
      "/.netlify/functions/pinecone-operations",
      {
        operation: "describeIndex",
      },
    );
    return response.data;
  } catch (error) {
    console.error("Error getting Pinecone status:", error);
    return null;
  }
}

/**
 * Delete specific vectors from Pinecone by ID
 */
export async function deleteVectors(ids: string[]): Promise<boolean> {
  try {
    const response = await axios.post(
      "/.netlify/functions/pinecone-operations",
      {
        operation: "deleteVectors",
        params: { ids },
      },
    );
    return response.data.success;
  } catch (error) {
    console.error("Error deleting vectors from Pinecone:", error);
    return false;
  }
}
