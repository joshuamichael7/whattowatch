import axios from "axios";
import { ContentItem } from "@/types/omdb";

/**
 * Generate an embedding for text using OpenAI's API
 * @param text The text to generate an embedding for
 * @returns The embedding vector or null if there was an error
 */
export async function generateEmbedding(
  text: string,
): Promise<number[] | null> {
  try {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OpenAI API key not found");
      return null;
    }

    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      {
        input: text,
        model: "text-embedding-ada-002",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    return response.data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

/**
 * Generate a content embedding from OMDB data
 * @param content The OMDB content item
 * @returns The embedding vector or null if there was an error
 */
export async function generateContentEmbedding(
  content: ContentItem | any,
): Promise<number[] | null> {
  try {
    // Create a text representation of the content for embedding
    const textToEmbed = [
      `Title: ${content.Title || content.title || ""}`,
      `Type: ${content.Type || content.media_type || ""}`,
      `Year: ${content.Year || content.year || ""}`,
      `Plot: ${content.Plot || content.overview || content.synopsis || ""}`,
      `Genre: ${content.Genre || (content.genre_strings ? content.genre_strings.join(", ") : "")}`,
      `Director: ${content.Director || content.director || ""}`,
      `Actors: ${content.Actors || content.actors || ""}`,
      `Language: ${content.Language || content.language || ""}`,
      `Country: ${content.Country || content.country || ""}`,
    ]
      .filter((line) => !line.endsWith(": "))
      .join("\n");

    return await generateEmbedding(textToEmbed);
  } catch (error) {
    console.error("Error generating content embedding:", error);
    return null;
  }
}

/**
 * Generate a query embedding from text
 * @param query The query text
 * @returns The embedding vector or null if there was an error
 */
export async function generateQueryEmbedding(
  query: string,
): Promise<number[] | null> {
  return await generateEmbedding(query);
}
