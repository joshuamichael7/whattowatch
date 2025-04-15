import { ContentItem } from "../types/omdb";
import axios from "axios";
import * as tf from "@tensorflow/tfjs";
import * as use from "@tensorflow-models/universal-sentence-encoder";
import { getEnvVar } from "../lib/utils";

// Configuration for the vector database
export interface VectorDBConfig {
  apiKey: string;
  apiEndpoint: string;
  indexName: string;
  namespace?: string;
  dimensions?: number;
}

// Import Pinecone client
import { Pinecone } from "@pinecone-database/pinecone";

// Default configuration for Pinecone
const defaultConfig: VectorDBConfig = {
  apiKey: getEnvVar("PINECONE_API_KEY", ""),
  apiEndpoint: getEnvVar("VECTOR_DB_ENDPOINT", ""),
  indexName: getEnvVar("VECTOR_DB_INDEX_NAME", "movie-recommendations"),
  namespace: getEnvVar("VECTOR_DB_NAMESPACE", "omdb-content"),
  dimensions: parseInt(getEnvVar("VECTOR_DB_DIMENSIONS", "512")), // This should match the embedding dimensions from your model
};

// Pinecone client instance
let pineconeClient: Pinecone | null = null;
let pineconeIndex: any = null;

// Cache for the Universal Sentence Encoder model
let useModel: any = null;

/**
 * Initialize the TensorFlow.js and load the Universal Sentence Encoder model
 */
async function initTensorFlow(): Promise<boolean> {
  try {
    if (!useModel) {
      console.log(
        "[vectorService] Loading Universal Sentence Encoder model...",
      );
      // Load the model
      useModel = await use.load();
      console.log("[vectorService] Universal Sentence Encoder model loaded");
    }
    return true;
  } catch (error) {
    console.error("[vectorService] Error loading USE model:", error);
    return false;
  }
}

/**
 * Generate embeddings for a text using the Universal Sentence Encoder
 * @param text The text to generate embeddings for
 * @returns The embedding vector as a number array
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    // Initialize TensorFlow and load the model if not already loaded
    const initialized = await initTensorFlow();
    if (!initialized || !useModel) {
      console.error("[vectorService] USE model not initialized");
      return null;
    }

    // Generate embeddings
    const embeddings = await useModel.embed(text);
    const embeddingArray = await embeddings.array();
    return embeddingArray[0]; // Return the first embedding (should be the only one)
  } catch (error) {
    console.error("[vectorService] Error generating embedding:", error);
    return null;
  }
}

/**
 * Initialize the vector database connection
 * @param customConfig Optional custom configuration
 * @returns Success status
 */
export async function initVectorDB(
  customConfig?: Partial<VectorDBConfig>,
): Promise<boolean> {
  try {
    // Merge default config with custom config
    const config = { ...defaultConfig, ...customConfig };

    if (!config.apiKey) {
      console.warn("[vectorService] Pinecone API key not configured");
      return false;
    }

    // Initialize TensorFlow.js and load the USE model
    const tfInitialized = await initTensorFlow();
    if (!tfInitialized) {
      console.error("[vectorService] Failed to initialize TensorFlow");
      return false;
    }

    // Initialize Pinecone client
    try {
      pineconeClient = new Pinecone({
        apiKey: config.apiKey,
      });

      // Get the index
      pineconeIndex = pineconeClient.index(config.indexName);

      console.log(
        `[vectorService] Pinecone initialized with index ${config.indexName}`,
      );
      return true;
    } catch (pineconeError) {
      console.error(
        "[vectorService] Error initializing Pinecone:",
        pineconeError,
      );
      return false;
    }
  } catch (error) {
    console.error("[vectorService] Error initializing vector DB:", error);
    return false;
  }
}

/**
 * Store content in the vector database
 * @param content The content item to store
 * @param embedding The vector embedding for the content
 * @returns Success status
 */
export async function storeContentVector(
  content: ContentItem,
  embedding?: number[],
): Promise<boolean> {
  try {
    if (!pineconeClient || !pineconeIndex) {
      console.warn(
        "[vectorService] Pinecone not initialized. Skipping vector storage.",
      );
      return false;
    }

    // Generate embedding if not provided
    let contentEmbedding = embedding;
    if (!contentEmbedding) {
      // Combine title and overview for better embedding
      const textToEmbed = `${content.title}. ${content.overview || ""}`;
      contentEmbedding = await generateEmbedding(textToEmbed);

      if (!contentEmbedding) {
        console.error("[vectorService] Failed to generate embedding");
        return false;
      }
    }

    // Prepare metadata for storage
    const metadata = {
      id: content.id,
      title: content.title,
      media_type: content.media_type,
      release_date: content.release_date || content.first_air_date,
      vote_average: content.vote_average,
      genre_ids: content.genre_ids ? JSON.stringify(content.genre_ids) : "",
    };

    // Upsert the vector to Pinecone
    try {
      await pineconeIndex.namespace(defaultConfig.namespace).upsert([
        {
          id: content.id,
          values: contentEmbedding,
          metadata: metadata,
        },
      ]);

      console.log(
        `[vectorService] Stored content "${content.title}" in Pinecone with ${contentEmbedding.length} dimensions`,
      );
      return true;
    } catch (pineconeError) {
      console.error(
        "[vectorService] Error upserting to Pinecone:",
        pineconeError,
      );
      return false;
    }
  } catch (error) {
    console.error("[vectorService] Error storing content in vector DB:", error);
    return false;
  }
}

/**
 * Query the vector database for similar content
 * @param contentId The ID of the content to find similar items for
 * @param embedding Optional pre-computed embedding
 * @param limit The number of similar items to return
 * @returns Array of similar content IDs
 */
export async function querySimilarContent(
  contentId: string,
  embedding?: number[],
  limit: number = 10,
): Promise<string[]> {
  try {
    if (!pineconeClient || !pineconeIndex) {
      console.warn(
        "[vectorService] Pinecone not initialized. Skipping vector query.",
      );
      return [];
    }

    // If embedding is not provided, we need to get the content and generate an embedding
    if (!embedding) {
      try {
        // Import dynamically to avoid circular dependencies
        const { getContentById } = await import("../lib/omdbClient");
        const content = await getContentById(contentId);

        if (!content) {
          console.warn(
            `[vectorService] Content with ID ${contentId} not found`,
          );
          return [];
        }

        // Generate embedding from content
        const textToEmbed = `${content.title}. ${content.overview || ""}`;
        embedding = await generateEmbedding(textToEmbed);

        if (!embedding) {
          console.error(
            "[vectorService] Failed to generate embedding for query",
          );
          return [];
        }
      } catch (err) {
        console.error("[vectorService] Error generating query embedding:", err);
        return [];
      }
    }

    try {
      // Query Pinecone for similar vectors
      const queryResponse = await pineconeIndex
        .namespace(defaultConfig.namespace)
        .query({
          topK: limit,
          vector: embedding,
          includeMetadata: true,
        });

      console.log(
        `[vectorService] Queried Pinecone for similar content to "${contentId}" with ${embedding.length} dimensions (limit: ${limit})`,
      );

      // Extract the IDs from the matches
      const similarIds = queryResponse.matches
        .filter((match) => match.id !== contentId) // Filter out the original content
        .map((match) => match.id);

      return similarIds;
    } catch (pineconeError) {
      console.error("[vectorService] Error querying Pinecone:", pineconeError);

      // Fallback to hardcoded IDs if Pinecone query fails
      console.warn(
        "[vectorService] Falling back to hardcoded similar content IDs",
      );
      const movieIds = [
        "tt0111161",
        "tt0068646",
        "tt0071562",
        "tt0468569",
        "tt0050083",
      ];
      const tvIds = [
        "tt0944947",
        "tt0903747",
        "tt0108778",
        "tt0098904",
        "tt0386676",
      ];

      // Return a subset of IDs based on the content ID prefix (tt0 pattern suggests movies)
      const isMovie = contentId.startsWith("tt0");
      const similarIds = isMovie ? movieIds : tvIds;

      // Filter out the original content ID
      return similarIds.filter((id) => id !== contentId).slice(0, limit);
    }
  } catch (error) {
    console.error("[vectorService] Error querying vector DB:", error);
    return [];
  }
}
