import { ContentItem } from "@/types/omdb";

/**
 * Debug utility to track the Rated field throughout the recommendation process
 */
export function logFullOmdbResponse(stage: string, data: any) {
  console.log(`[RATED_DEBUG] ${stage} - Full OMDB data:`, JSON.stringify(data));

  // Check specifically for the Rated field
  console.log(`[RATED_DEBUG] ${stage} - Rated field:`, {
    hasRatedProperty: "Rated" in data,
    ratedValue: data.Rated,
    ratedType: typeof data.Rated,
    allKeys: Object.keys(data),
  });
}

export function logContentItem(stage: string, item: ContentItem) {
  console.log(`[RATED_DEBUG] ${stage} - ContentItem rating fields:`, {
    hasRatedProperty: "Rated" in item,
    ratedValue: item.Rated,
    content_rating: item.content_rating,
    contentRating: item.contentRating,
    allKeys: Object.keys(item),
  });
}
