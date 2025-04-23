/**
 * Helper functions for title matching and similarity
 */

/**
 * Calculate similarity between two titles
 * @param title1 First title
 * @param title2 Second title
 * @returns Similarity score between 0 and 1
 */
export function calculateTitleSimilarity(
  title1: string,
  title2: string,
): number {
  if (!title1 || !title2) return 0;

  // Convert to lowercase
  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();

  // Check for exact match or substring match
  if (t1 === t2) return 1.0;
  if (t1.includes(t2) || t2.includes(t1)) return 0.9;

  // Use simple word overlap for longer titles
  const words1 = t1.split(/\s+/);
  const words2 = t2.split(/\s+/);

  const uniqueWords1 = new Set(words1);
  const uniqueWords2 = new Set(words2);

  let matchCount = 0;
  for (const word of uniqueWords1) {
    if (uniqueWords2.has(word)) matchCount++;
  }

  const totalUniqueWords = uniqueWords1.size + uniqueWords2.size - matchCount;
  const wordSimilarity =
    totalUniqueWords > 0 ? matchCount / totalUniqueWords : 0;

  return wordSimilarity;
}

/**
 * Check if two titles match or are similar enough
 * @param aiTitle Title from AI recommendation
 * @param dbTitle Title from database
 * @returns Boolean indicating if titles match
 */
export function doTitlesMatch(aiTitle: string, dbTitle: string): boolean {
  // Check for direct inclusion
  const aiLower = aiTitle.toLowerCase();
  const dbLower = dbTitle.toLowerCase();

  if (aiLower.includes(dbLower) || dbLower.includes(aiLower)) {
    return true;
  }

  // Check similarity score
  const similarity = calculateTitleSimilarity(aiTitle, dbTitle);
  return similarity >= 0.5;
}
