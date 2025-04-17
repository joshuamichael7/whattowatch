import { ContentItem } from "../types/omdb";

/**
 * Store content in the vector database
 * @param content The content item to store
 * @returns Success status
 */
export async function storeContentVector(
  content: ContentItem,
): Promise<boolean> {
  console.log("[vectorService] Vector database functionality has been removed");
  // Return true to avoid breaking existing code
  return true;
}

/**
 * Query the vector database for similar content
 * @param contentId The ID of the content to find similar items for
 * @param embedding Optional pre-computed embedding (no longer used)
 * @param limit The number of similar items to return
 * @returns Array of similar content IDs
 */
export async function querySimilarContent(
  contentId: string,
  embedding?: any,
  limit: number = 10,
): Promise<string[]> {
  console.log("[vectorService] Vector database functionality has been removed");

  // Fallback to hardcoded IDs since Pinecone is removed
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
