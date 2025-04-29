# Pinecone Setup Guide for MovieMatch

## Overview

This guide explains how to set up Pinecone for the MovieMatch recommendation engine. Pinecone is used as a vector database to store movie and TV show data for semantic search and similarity matching.

## Pinecone Index Structure

### What You Need to Know

1. **No Custom Fields Required**: Pinecone doesn't require you to define custom fields in advance. It has two main components:
   - **Vector embeddings**: Generated automatically from the text you provide
   - **Metadata**: Key-value pairs that store additional information

2. **IMDB ID as Primary Key**: We use the IMDB ID (e.g., "tt7923710") as the primary ID for each vector in Pinecone.

3. **Text Field for Embedding**: Pinecone automatically generates embeddings from the text field. We combine all relevant content information into this field.

4. **Metadata for Filtering**: All OMDB fields are stored as metadata for filtering and retrieval.

## Setup Steps

1. **Create a Pinecone Account**:
   - Go to [Pinecone's website](https://www.pinecone.io/) and sign up
   - Choose the free tier to start with

2. **Get Your API Key**:
   - After creating an account, navigate to the API Keys section
   - Copy your API key

3. **Set Environment Variables in Netlify**:
   - Add `PINECONE_API_KEY` with your API key value
   - Add `PINECONE_INDEX_NAME` with value `omdb-database` (or your preferred name)

4. **Create the Index**:
   - The app will automatically create the index if it doesn't exist
   - Index configuration:
     - Name: `omdb-database` (or your custom name from env variable)
     - Dimension: 1536 (for OpenAI's text-embedding-ada-002)
     - Metric: cosine (best for semantic similarity)
     - Cloud: AWS
     - Region: us-east-1

## How Data is Structured

Each record in Pinecone contains:

1. **id**: The IMDB ID (e.g., "tt7923710")

2. **text**: A formatted string combining all content details for embedding:
   ```
   Title: My Mister
   Type: tv
   Year: 2018
   Plot: A man in his 40s withstands the weight of life...
   Genre: Drama, Family
   Director: Kim Won-seok
   ...
   ```

3. **metadata**: All OMDB fields stored as key-value pairs:
   ```json
   {
     "title": "My Mister",
     "year": "2018",
     "type": "tv",
     "plot": "A man in his 40s withstands the weight of life...",
     "genre": "Drama, Family",
     "director": "Kim Won-seok",
     "actors": "Lee Sun-kyun, IU, Lee Ji-ah",
     "language": "Korean",
     "country": "South Korea",
     "rated": "TV-14",
     ...
   }
   ```

## How the App Processes OMDB Data

1. When you add content to the vector database:
   - The app extracts the IMDB ID from the OMDB response
   - It creates a formatted text string from all relevant fields
   - It converts all OMDB fields to metadata key-value pairs
   - It sends this data to Pinecone with the IMDB ID as the vector ID

2. When you search for similar content:
   - The app creates a text query from your search terms
   - Pinecone converts this to a vector embedding
   - Pinecone finds vectors with similar embeddings
   - The app retrieves the metadata for these vectors

## Troubleshooting

If you encounter issues:

1. Check that your API key is correctly set in the environment variables
2. Ensure your Pinecone account has sufficient quota for your operations
3. Check the browser console and Netlify function logs for error messages

## Additional Resources

- [Pinecone Documentation](https://docs.pinecone.io/)
- [Vector Database Concepts](https://www.pinecone.io/learn/vector-database/)
