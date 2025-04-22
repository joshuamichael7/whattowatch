import { supabase } from "./supabaseClient";
import { getContentById } from "./omdbClient";
import { mapGenreStringsToIds } from "./utils";

/**
 * Updates missing genres for content items that have IMDB IDs but no genres
 * @returns Statistics about the update process
 */
export async function updateMissingGenres(): Promise<{
  total: number;
  updated: number;
  failed: number;
  details: Array<{ id: string; title: string; status: string; error?: string }>;
}> {
  console.log("Starting to update content items with missing genres");

  const details: Array<{
    id: string;
    title: string;
    status: string;
    error?: string;
  }> = [];
  let updated = 0;
  let failed = 0;

  try {
    // Find content with IMDB IDs but missing genres
    const { data: contentWithoutGenres, error } = await supabase
      .from("content")
      .select("id, title, imdb_id")
      .not("imdb_id", "is", null)
      .or(
        "genre_strings.is.null,genre_strings.eq.{},genre_ids.is.null,genre_ids.eq.{}",
      );

    if (error) {
      console.error("Error finding content without genres:", error);
      return { total: 0, updated: 0, failed: 0, details };
    }

    console.log(
      `Found ${contentWithoutGenres.length} content items without genres`,
    );

    // Process each item in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < contentWithoutGenres.length; i += batchSize) {
      const batch = contentWithoutGenres.slice(i, i + batchSize);

      // Process items in parallel within each batch
      await Promise.all(
        batch.map(async (item) => {
          try {
            console.log(`Processing ${item.title} (${item.imdb_id})`);

            // Use our omdbClient to get content details from OMDB via Netlify function
            const contentDetails = await getContentById(item.imdb_id);

            if (!contentDetails) {
              console.log(`No details found for ${item.title}`);
              details.push({
                id: item.id,
                title: item.title,
                status: "failed",
                error: "No details found",
              });
              failed++;
              return;
            }

            // Check if we got genre information
            if (
              !contentDetails.genre_strings ||
              contentDetails.genre_strings.length === 0
            ) {
              console.log(`No genre information found for ${item.title}`);
              details.push({
                id: item.id,
                title: item.title,
                status: "failed",
                error: "No genre information found",
              });
              failed++;
              return;
            }

            // Map genre strings to IDs
            const genreIds =
              contentDetails.genre_ids && contentDetails.genre_ids.length > 0
                ? contentDetails.genre_ids
                : mapGenreStringsToIds(contentDetails.genre_strings);

            // Update the content in Supabase
            const { error: updateError } = await supabase
              .from("content")
              .update({
                genre_strings: contentDetails.genre_strings,
                genre_ids: genreIds,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);

            if (updateError) {
              console.error(`Error updating ${item.title}:`, updateError);
              details.push({
                id: item.id,
                title: item.title,
                status: "failed",
                error: updateError.message,
              });
              failed++;
              return;
            }

            console.log(
              `Successfully updated ${item.title} with genres: ${contentDetails.genre_strings.join(", ")}`,
            );
            details.push({ id: item.id, title: item.title, status: "updated" });
            updated++;
          } catch (error) {
            console.error(`Error processing ${item.title}:`, error);
            details.push({
              id: item.id,
              title: item.title,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            });
            failed++;
          }
        }),
      );

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < contentWithoutGenres.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return {
      total: contentWithoutGenres.length,
      updated,
      failed,
      details,
    };
  } catch (error) {
    console.error("Error updating missing genres:", error);
    return {
      total: 0,
      updated,
      failed,
      details,
    };
  }
}
