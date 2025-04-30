import { ContentItem } from "@/types/omdb";
import {
  createPineconeIndex,
  upsertVectors,
  querySimilarContent,
} from "@/lib/pineconeClient";
import { v4 as uuidv4 } from "uuid";

/**
 * Initialize the vector database
 */
export async function initVectorDatabase(): Promise<boolean> {
  try {
    console.log("Checking Pinecone connection");
    // Instead of creating an index, just check if we can connect to Pinecone
    const response = await fetch("/.netlify/functions/pinecone-operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "checkConnection",
      }),
    });

    if (!response.ok) {
      throw new Error(`Function returned status: ${response.status}`);
    }

    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error("Error checking Pinecone connection:", error);
    return false;
  }
}

/**
 * Add content to the vector database
 * @param content The content item to add
 * @returns Success status
 */
export async function addContentToVectorDb(
  content: ContentItem,
): Promise<boolean> {
  try {
    console.log("Using Netlify function for vector database operations");
    console.log("Content to add:", {
      id: content.id,
      imdb_id: content.imdb_id,
      tmdb_id: content.tmdb_id,
      title: content.title,
      media_type: content.media_type,
    });

    // IMPORTANT: Make sure we have an ID (IMDB ID or TMDB ID)
    if (!content.imdb_id && !content.tmdb_id) {
      console.error("Cannot add content without IMDB ID or TMDB ID");
      return false;
    }

    // Use TMDB ID if available, otherwise use IMDB ID
    const contentId = content.tmdb_id
      ? `tmdb-${content.media_type === "movie" ? "movie" : "tv"}-${content.tmdb_id}`
      : content.imdb_id;

    // Create metadata from content fields - ensure all values are strings
    const metadata: Record<string, string> = {
      title: String(content.title || ""),
      year: String(
        content.release_date
          ? new Date(content.release_date).getFullYear()
          : content.year || "",
      ),
      type: String(content.media_type || ""),
      imdbID: String(content.imdb_id || ""),
      tmdbID: String(content.tmdb_id || ""),
      plot: String(content.overview || content.synopsis || ""),
      genre: String(
        (content.genre_strings ? content.genre_strings.join(", ") : "") ||
          (content.genres
            ? content.genres.map((g: any) => g.name).join(", ")
            : ""),
      ),
      director: String(content.director || ""),
      actors: String(
        content.actors ||
          (content.cast
            ? content.cast
                .slice(0, 10)
                .map((c: any) => c.name)
                .join(", ")
            : ""),
      ),
      language: String(content.language || content.original_language || ""),
      country: String(
        content.country ||
          content.production_countries?.map((c: any) => c.name).join(", ") ||
          "",
      ),
      poster: String(content.poster_path || ""),
      rated: String(content.content_rating || ""),
      runtime: String(content.runtime || ""),
      rating: String(content.vote_average || ""),
      votes: String(content.vote_count || ""),
      popularity: String(content.popularity || ""),
      streamingProviders: String(
        content.streaming_providers
          ? Object.keys(content.streaming_providers).join(", ")
          : "",
      ),
    };

    // Create text for embedding - filter out empty fields
    const textLines = [
      `Title: ${content.title || ""}`,
      `Type: ${content.media_type || ""}`,
      `Year: ${content.release_date ? new Date(content.release_date).getFullYear() : content.year || ""}`,
      `Plot: ${content.overview || content.synopsis || ""}`,
      `Genre: ${
        (content.genre_strings ? content.genre_strings.join(", ") : "") ||
        (content.genres
          ? content.genres.map((g: any) => g.name).join(", ")
          : "")
      }`,
      `Director: ${
        content.director ||
        (content.crew
          ? content.crew
              .filter((c: any) => c.job === "Director")
              .map((c: any) => c.name)
              .join(", ")
          : "")
      }`,
      `Writer: ${
        content.writer ||
        (content.crew
          ? content.crew
              .filter((c: any) => c.job === "Screenplay" || c.job === "Writer")
              .map((c: any) => c.name)
              .join(", ")
          : "")
      }`,
      `Actors: ${
        content.actors ||
        (content.cast
          ? content.cast
              .slice(0, 10)
              .map((c: any) => c.name)
              .join(", ")
          : "")
      }`,
      `Language: ${content.language || content.original_language || ""}`,
      `Country: ${content.country || (content.production_countries ? content.production_countries.map((c: any) => c.name).join(", ") : "")}`,
      `Released: ${content.release_date || ""}`,
      `Runtime: ${content.runtime || ""}`,
      `Rated: ${content.content_rating || ""}`,
      `Rating: ${content.vote_average ? content.vote_average.toString() : ""}`,
      `Popularity: ${content.popularity ? content.popularity.toString() : ""}`,
      `Streaming On: ${content.streaming_providers ? Object.keys(content.streaming_providers).join(", ") : ""}`,
      `TMDB ID: ${content.tmdb_id || ""}`,
      `IMDB ID: ${content.imdb_id || ""}`,
    ].filter((line) => {
      const parts = line.split(": ");
      return parts.length > 1 && parts[1] !== "" && parts[1] !== "N/A";
    });

    // Create vector record - using Pinecone's built-in embeddings
    const vector = {
      id: contentId, // Use TMDB ID if available, otherwise use IMDB ID
      metadata,
      text: textLines.join("\n"),
    };

    console.log("Sending vector to Pinecone:", {
      id: vector.id,
      metadata: Object.keys(vector.metadata),
      textLength: vector.text.length,
      textSample: vector.text.substring(0, 100) + "...",
    });

    // Use Netlify function to upsert to Pinecone
    console.log("Calling Netlify function to upsert vector");
    const response = await fetch("/.netlify/functions/pinecone-operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "upsertVectors",
        params: { vectors: [vector] },
      }),
    });

    console.log(`Netlify function response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Pinecone API error (${response.status}):`, errorText);
      throw new Error(`Function returned status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Pinecone response:", data);
    return data.success || false;
  } catch (error) {
    console.error("Error adding content to vector database:", error);
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    return false;
  }
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
  let successCount = 0;

  try {
    // Process in batches
    for (let i = 0; i < contentItems.length; i += batchSize) {
      const batch = contentItems.slice(i, i + batchSize);
      const vectors = [];

      // Generate vectors for each item in the batch
      for (const content of batch) {
        // Use TMDB ID if available, otherwise use IMDB ID
        const contentId = content.tmdb_id
          ? `tmdb-${content.media_type === "movie" ? "movie" : "tv"}-${content.tmdb_id}`
          : content.imdbID || content.imdb_id || uuidv4();

        // Create metadata
        const metadata = {
          title: content.title || "",
          year: content.release_date
            ? new Date(content.release_date).getFullYear().toString()
            : content.year || "",
          type: content.media_type || "",
          imdbID: content.imdb_id || "",
          tmdbID: content.tmdb_id ? content.tmdb_id.toString() : "",
          plot: content.overview || content.synopsis || "",
          genre:
            (content.genre_strings ? content.genre_strings.join(", ") : "") ||
            (content.genres
              ? content.genres.map((g: any) => g.name).join(", ")
              : ""),
          director:
            content.director ||
            (content.crew
              ? content.crew
                  .filter((c: any) => c.job === "Director")
                  .map((c: any) => c.name)
                  .join(", ")
              : ""),
          actors:
            content.actors ||
            (content.cast
              ? content.cast
                  .slice(0, 10)
                  .map((c: any) => c.name)
                  .join(", ")
              : ""),
          language: content.language || content.original_language || "",
          country:
            content.country ||
            (content.production_countries
              ? content.production_countries.map((c: any) => c.name).join(", ")
              : ""),
          poster: content.poster_path || "",
          rated: content.content_rating || "",
          runtime: content.runtime ? content.runtime.toString() : "",
          rating: content.vote_average ? content.vote_average.toString() : "",
          votes: content.vote_count ? content.vote_count.toString() : "",
          popularity: content.popularity ? content.popularity.toString() : "",
          streamingProviders: content.streaming_providers
            ? Object.keys(content.streaming_providers).join(", ")
            : "",
        };

        // Create text for integrated embedding
        const text = [
          `Title: ${content.title || ""}`,
          `Type: ${content.media_type || ""}`,
          `Year: ${content.release_date ? new Date(content.release_date).getFullYear() : content.year || ""}`,
          `Plot: ${content.overview || content.synopsis || ""}`,
          `Genre: ${
            (content.genre_strings ? content.genre_strings.join(", ") : "") ||
            (content.genres
              ? content.genres.map((g: any) => g.name).join(", ")
              : "")
          }`,
          `Director: ${
            content.director ||
            (content.crew
              ? content.crew
                  .filter((c: any) => c.job === "Director")
                  .map((c: any) => c.name)
                  .join(", ")
              : "")
          }`,
          `Writer: ${
            content.writer ||
            (content.crew
              ? content.crew
                  .filter(
                    (c: any) => c.job === "Screenplay" || c.job === "Writer",
                  )
                  .map((c: any) => c.name)
                  .join(", ")
              : "")
          }`,
          `Actors: ${
            content.actors ||
            (content.cast
              ? content.cast
                  .slice(0, 10)
                  .map((c: any) => c.name)
                  .join(", ")
              : "")
          }`,
          `Language: ${content.language || content.original_language || ""}`,
          `Country: ${content.country || (content.production_countries ? content.production_countries.map((c: any) => c.name).join(", ") : "")}`,
          `Released: ${content.release_date || ""}`,
          `Runtime: ${content.runtime || ""}`,
          `Rated: ${content.content_rating || ""}`,
          `Rating: ${content.vote_average ? content.vote_average.toString() : ""}`,
          `Popularity: ${content.popularity ? content.popularity.toString() : ""}`,
          `Streaming On: ${content.streaming_providers ? Object.keys(content.streaming_providers).join(", ") : ""}`,
          `TMDB ID: ${content.tmdb_id || ""}`,
          `IMDB ID: ${content.imdb_id || ""}`,
        ]
          .filter((line) => {
            const parts = line.split(": ");
            return parts.length > 1 && parts[1] !== "" && parts[1] !== "N/A";
          })
          .join("\n");

        // Create vector
        vectors.push({
          id: contentId,
          metadata,
          text,
        });
      }

      // Upsert batch to Pinecone
      if (vectors.length > 0) {
        const success = await upsertVectors(vectors);
        if (success) {
          successCount += vectors.length;
        }
      }

      // Log progress
      console.log(
        `Processed ${i + batch.length} of ${contentItems.length} items`,
      );
    }

    return successCount;
  } catch (error) {
    console.error("Error batch adding content to vector database:", error);
    return successCount;
  }
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
  try {
    console.log(`Searching for similar content with query: "${query}"`);

    // Call the Netlify function to query Pinecone
    const response = await fetch("/.netlify/functions/pinecone-operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "querySimilarContent",
        params: { text: query, limit, namespace: "content" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Pinecone API error (${response.status}):`, errorText);
      throw new Error(`Function returned status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Pinecone query response:", data);

    if (!data.matches || !Array.isArray(data.matches)) {
      console.error("Invalid response format from Pinecone");
      return [];
    }

    // Convert matches to ContentItem format
    return data.matches.map((match: any) => {
      const metadata = match.metadata || {};
      return {
        id: match.id,
        title: metadata.title || "Unknown Title",
        imdb_id: metadata.imdbID,
        media_type: metadata.type || "unknown",
        overview: metadata.plot || "",
        poster_path: metadata.poster || "",
        content_rating: metadata.rated,
        vote_average: parseFloat(metadata.imdbRating) || 0,
        vote_count: parseInt(metadata.imdbVotes?.replace(/,/g, "")) || 0,
        genre_strings: metadata.genre?.split(", "),
        year: metadata.year,
        runtime: metadata.runtime,
        director: metadata.director,
        actors: metadata.actors,
        language: metadata.language,
        country: metadata.country,
        similarity: match.score,
      } as ContentItem;
    });
  } catch (error) {
    console.error("Error searching similar content by text:", error);
    return [];
  }
}

/**
 * Search for similar content based on a content item
 * @param contentItem The content item to find similar content for
 * @param limit Maximum number of results to return
 * @returns Array of similar content items
 */
export async function searchSimilarContent(
  contentItem: ContentItem,
  limit: number = 10,
): Promise<ContentItem[]> {
  try {
    // Create text representation for the content item
    const text = [
      `Title: ${contentItem.title || ""}`,
      `Type: ${contentItem.media_type || ""}`,
      `Year: ${contentItem.release_date ? new Date(contentItem.release_date).getFullYear() : contentItem.year || ""}`,
      `Plot: ${contentItem.overview || contentItem.synopsis || ""}`,
      `Genre: ${
        (contentItem.genre_strings
          ? contentItem.genre_strings.join(", ")
          : "") ||
        (contentItem.genres
          ? contentItem.genres.map((g: any) => g.name).join(", ")
          : "")
      }`,
      `Director: ${
        contentItem.director ||
        (contentItem.crew
          ? contentItem.crew
              .filter((c: any) => c.job === "Director")
              .map((c: any) => c.name)
              .join(", ")
          : "")
      }`,
      `Actors: ${
        contentItem.actors ||
        (contentItem.cast
          ? contentItem.cast
              .slice(0, 10)
              .map((c: any) => c.name)
              .join(", ")
          : "")
      }`,
      `Language: ${contentItem.language || contentItem.original_language || ""}`,
      `Country: ${contentItem.country || (contentItem.production_countries ? contentItem.production_countries.map((c: any) => c.name).join(", ") : "")}`,
      `TMDB ID: ${contentItem.tmdb_id || ""}`,
      `IMDB ID: ${contentItem.imdb_id || ""}`,
    ]
      .filter((line) => {
        const parts = line.split(": ");
        return parts.length > 1 && parts[1] !== "" && parts[1] !== "N/A";
      })
      .join("\n");

    // Query Pinecone using integrated embeddings
    return await searchSimilarContentByText(text, limit);
  } catch (error) {
    console.error("Error searching similar content:", error);
    return [];
  }
}
