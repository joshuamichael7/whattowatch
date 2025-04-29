import { ContentItem } from "@/types/omdb";
import {
  batchAddContentToVectorDb,
  searchSimilarContentByText,
  searchSimilarContent,
} from "@/services/vectorService";

/**
 * Add content to the vector database
 * @param content The content item to add
 * @returns Success status
 */
export async function addContentToVectorDb(content: any): Promise<boolean> {
  return (await batchAddContentToVectorDb([content], 1)) === 1;
}

/**
 * Add multiple content items to the vector database in batches
 * @param contentItems Array of content items to add
 * @param batchSize Size of each batch
 * @returns Number of successfully added items
 */
export async function batchAddContentToVectorDb(
  contentItems: any[],
  batchSize: number = 10,
): Promise<number> {
  return await batchAddContentToVectorDb(contentItems, batchSize);
}

/**
 * Search for similar content based on a query
 * @param query The query text
 * @param limit Maximum number of results to return
 * @returns Array of similar content items
 */
export async function searchSimilarContentByText(
  query: string,
  limit: number = 10,
): Promise<ContentItem[]> {
  return await searchSimilarContentByText(query, limit);
}

/**
 * Search for similar content based on a content item
 * @param contentItem The content item to find similar content for
 * @param limit Maximum number of results to return
 * @returns Array of similar content items
 */
export async function searchSimilarContent(
  contentItem: ContentItem | any,
  limit: number = 10,
): Promise<ContentItem[]> {
  return await searchSimilarContent(contentItem, limit);
}
