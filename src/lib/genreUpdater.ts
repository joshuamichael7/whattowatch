import { supabase } from "./supabaseClient";
import { getContentById } from "./omdbClient";
import { mapGenreStringsToIds } from "./utils";

/**
 * Updates missing genres for content items that have IMDB IDs but no genres
 * @returns Statistics about the update process
 */
export async function updateMissingGenres(batchSize: number = 5): Promise<{
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
    // batchSize is now a parameter with default value of 5
    for (let i = 0; i < contentWithoutGenres.length; i += batchSize) {
      const batch = contentWithoutGenres.slice(i, i + batchSize);

      // Process items in parallel within each batch
      await Promise.all(
        batch.map(async (item) => {
          try {
            console.log(`Processing ${item.title} (${item.imdb_id})`);

            // Force a direct call to OMDB API via Netlify function instead of using Supabase cache
            // We need to bypass the Supabase check in getContentById to get fresh data from OMDB
            const apiEndpoint = "/.netlify/functions/omdb";
            const params = new URLSearchParams({
              i: item.imdb_id,
              plot: "full",
            });

            console.log(
              `Fetching data directly from OMDB API for ${item.title} (${item.imdb_id})`,
            );
            const response = await fetch(`${apiEndpoint}?${params.toString()}`);
            const omdbData = await response.json();

            // Process the OMDB data
            let contentDetails = null;
            if (omdbData && omdbData.Response === "True") {
              // Extract genre information
              const genreString = omdbData.Genre || "";
              const genreStrings = genreString
                .split(", ")
                .filter((g) => g.trim() !== "");

              console.log(
                `OMDB returned genres for ${item.title}: ${genreString}`,
              );

              contentDetails = {
                ...omdbData,
                genre_strings: genreStrings,
                id: item.id,
                imdb_id: item.imdb_id,
                title: item.title,
              };
            } else {
              console.log(
                `OMDB API returned no data for ${item.title}: ${omdbData?.Error || "Unknown error"}`,
              );
            }

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
            const genreIds = mapGenreStringsToIds(contentDetails.genre_strings);
            console.log(
              `Mapped genres for ${item.title}: ${JSON.stringify(genreIds)}`,
            );

            // Update the content in Supabase
            console.log(`Updating Supabase for ${item.title} with:`, {
              genre_strings: contentDetails.genre_strings,
              genre_ids: genreIds,
            });

            // Use direct update instead of RPC function since the function isn't available
            const { error: updateError } = await supabase
              .from("content")
              .update({
                genre_strings: contentDetails.genre_strings,
                genre_ids: genreIds,
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);

            if (!updateError) {
              // Double-check that the update was successful
              const { data: checkData, error: checkError } = await supabase
                .from("content")
                .select("genre_strings, genre_ids")
                .eq("id", item.id)
                .single();

              if (!checkError && checkData) {
                console.log(`Verification check for ${item.title}:`, checkData);
              } else {
                console.error(
                  `Verification check failed for ${item.title}:`,
                  checkError,
                );
              }
            }

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
