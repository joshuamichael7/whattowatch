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
    console.log("Using Netlify function for vector database operations");
    const response = await fetch("/.netlify/functions/pinecone-operations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "createIndex",
      }),
    });

    if (!response.ok) {
      throw new Error(`Function returned status: ${response.status}`);
    }

    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error("Error initializing vector database:", error);
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

    // Create metadata from OMDB fields
    const metadata = {
      title: content.Title || content.title,
      year: content.Year || content.year,
      type: content.Type || content.media_type,
      imdbID: content.imdbID || content.imdb_id,
      plot: content.Plot || content.overview || content.synopsis,
      genre:
        content.Genre ||
        (content.genre_strings ? content.genre_strings.join(", ") : ""),
      director: content.Director || content.director,
      actors: content.Actors || content.actors,
      language: content.Language || content.language,
      country: content.Country || content.country,
      poster: content.Poster || content.poster_path,
      rated: content.Rated || content.content_rating,
      runtime: content.Runtime || content.runtime,
      imdbRating: content.imdbRating || content.vote_average,
      imdbVotes: content.imdbVotes || content.vote_count,
    };

    // Create vector record
    const vector = {
      id: content.imdbID || content.imdb_id || uuidv4(),
      metadata,
      values: [], // Empty values array as we're using text-based embedding
      text: [
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
        .join("\n"),
    };

    console.log("Sending vector to Pinecone:", {
      id: vector.id,
      metadata: vector.metadata,
    });

    // Use Netlify function to upsert to Pinecone
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
        // Create metadata
        const metadata = {
          title: content.Title || content.title,
          year: content.Year || content.year,
          type: content.Type || content.media_type,
          imdbID: content.imdbID || content.imdb_id,
          plot: content.Plot || content.overview || content.synopsis,
          genre:
            content.Genre ||
            (content.genre_strings ? content.genre_strings.join(", ") : ""),
          director: content.Director || content.director,
          actors: content.Actors || content.actors,
          language: content.Language || content.language,
          country: content.Country || content.country,
          poster: content.Poster || content.poster_path,
          rated: content.Rated || content.content_rating,
          runtime: content.Runtime || content.runtime,
          imdbRating: content.imdbRating || content.vote_average,
          imdbVotes: content.imdbVotes || content.vote_count,
        };

        // Create text for integrated embedding
        const text = [
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

        // Create vector
        vectors.push({
          id: content.imdbID || content.imdb_id || uuidv4(),
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
    // Query Pinecone using integrated embeddings
    const matches = await querySimilarContent(query, limit);

    // Convert matches to ContentItem format
    return matches.map((match) => {
      const metadata = match.metadata;
      return {
        id: match.id,
        title: metadata.title,
        imdb_id: metadata.imdbID,
        media_type: metadata.type,
        overview: metadata.plot,
        poster_path: metadata.poster,
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
      `Title: ${contentItem.title || contentItem.Title || ""}`,
      `Type: ${contentItem.media_type || contentItem.Type || ""}`,
      `Year: ${contentItem.year || contentItem.Year || ""}`,
      `Plot: ${contentItem.overview || contentItem.Plot || contentItem.synopsis || ""}`,
      `Genre: ${contentItem.genre_strings ? contentItem.genre_strings.join(", ") : contentItem.Genre || ""}`,
      `Director: ${contentItem.director || contentItem.Director || ""}`,
      `Actors: ${contentItem.actors || contentItem.Actors || ""}`,
      `Language: ${contentItem.language || contentItem.Language || ""}`,
      `Country: ${contentItem.country || contentItem.Country || ""}`,
    ]
      .filter((line) => !line.endsWith(": "))
      .join("\n");

    // Query Pinecone using integrated embeddings
    return await searchSimilarContentByText(text, limit);
  } catch (error) {
    console.error("Error searching similar content:", error);
    return [];
  }
}
