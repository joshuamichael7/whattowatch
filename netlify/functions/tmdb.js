const axios = require("axios");

// Base URL for TMDB API
const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

// Helper function to make API calls
async function makeApiCall(endpoint, params = {}) {
  try {
    const accessToken = process.env.TMDB_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error("TMDB access token not found in environment variables");
    }

    const response = await axios.get(`${TMDB_API_BASE_URL}${endpoint}`, {
      params: { ...params },
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error calling TMDB API at ${endpoint}:`, error);
    throw error;
  }
}

// Transform TMDB search result to ContentItem format
function transformTmdbSearchResult(item) {
  const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");

  return {
    id: `tmdb-${mediaType}-${item.id}`,
    title: mediaType === "tv" ? item.name : item.title,
    original_title:
      mediaType === "tv"
        ? item.original_name || item.name
        : item.original_title || item.title,
    poster_path: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : "",
    backdrop_path: item.backdrop_path
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
      : "",
    media_type: mediaType,
    release_date: item.release_date || item.first_air_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    genre_ids: item.genre_ids || [],
    overview: item.overview || "",
    popularity: item.popularity || 0,
    tmdb_id: item.id.toString(),
  };
}

// Transform TMDB movie details to ContentItem format
function transformTmdbMovieDetails(movie) {
  // Extract US streaming providers if available
  const usProviders = movie["watch/providers"]?.results?.US || {};
  const streamingProviders = {};

  // Process streaming options (flatrate, rent, buy)
  if (usProviders.flatrate) {
    usProviders.flatrate.forEach((provider) => {
      streamingProviders[provider.provider_name] =
        `https://www.themoviedb.org/movie/${movie.id}/watch`;
    });
  }

  // Extract top cast (first 10 actors)
  const actors =
    movie.credits?.cast
      ?.slice(0, 10)
      ?.map((actor) => actor.name)
      ?.join(", ") || "";

  // Extract director
  const director =
    movie.credits?.crew
      ?.filter((person) => person.job === "Director")
      ?.map((person) => person.name)
      ?.join(", ") || "";

  // Extract writers (Screenplay, Writer, Story)
  const writer =
    movie.credits?.crew
      ?.filter((person) =>
        ["Screenplay", "Writer", "Story"].includes(person.job),
      )
      ?.map((person) => person.name)
      ?.join(", ") || "";

  // Extract genre names
  const genreStrings = movie.genres?.map((genre) => genre.name) || [];

  // Extract US content rating from release_dates
  let contentRating = "";
  if (movie.release_dates && movie.release_dates.results) {
    const usReleaseInfo = movie.release_dates.results.find(
      (country) => country.iso_3166_1 === "US",
    );

    if (
      usReleaseInfo &&
      usReleaseInfo.release_dates &&
      usReleaseInfo.release_dates.length > 0
    ) {
      // Use the first certification found
      const certification = usReleaseInfo.release_dates.find(
        (date) => date.certification,
      )?.certification;
      if (certification) {
        contentRating = certification;
      }
    }
  }

  return {
    id: `tmdb-movie-${movie.id}`,
    tmdb_id: movie.id.toString(),
    imdb_id: movie.imdb_id,
    title: movie.title,
    original_title: movie.original_title || movie.title,
    poster_path: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : "",
    backdrop_path: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
      : "",
    media_type: "movie",
    release_date: movie.release_date,
    vote_average: movie.vote_average || 0,
    vote_count: movie.vote_count || 0,
    genre_ids: movie.genres?.map((genre) => genre.id) || [],
    genre_strings: genreStrings,
    overview: movie.overview || "",
    runtime: movie.runtime || 0,
    content_rating: contentRating,
    streaming_providers:
      Object.keys(streamingProviders).length > 0 ? streamingProviders : null,
    popularity: movie.popularity || 0,
    year: movie.release_date ? movie.release_date.substring(0, 4) : "",
    plot: movie.overview || "",
    director,
    actors,
    writer,
    language: movie.original_language,
    country:
      movie.production_countries?.map((country) => country.name)?.join(", ") ||
      "",
    tagline: movie.tagline || "",
  };
}

// Transform TMDB TV show details to ContentItem format
function transformTmdbTvDetails(show) {
  // Extract US streaming providers if available
  const usProviders = show["watch/providers"]?.results?.US || {};
  const streamingProviders = {};

  // Process streaming options (flatrate, rent, buy)
  if (usProviders.flatrate) {
    usProviders.flatrate.forEach((provider) => {
      streamingProviders[provider.provider_name] =
        `https://www.themoviedb.org/tv/${show.id}/watch`;
    });
  }

  // Extract top cast (first 10 actors)
  const actors =
    show.credits?.cast
      ?.slice(0, 10)
      ?.map((actor) => actor.name)
      ?.join(", ") || "";

  // Extract creators
  const director =
    show.created_by?.map((person) => person.name)?.join(", ") || "";

  // Extract genre names
  const genreStrings = show.genres?.map((genre) => genre.name) || [];

  // Extract US content rating from content_ratings
  let contentRating = "";
  if (show.content_ratings && show.content_ratings.results) {
    const usRatingInfo = show.content_ratings.results.find(
      (country) => country.iso_3166_1 === "US",
    );

    if (usRatingInfo && usRatingInfo.rating) {
      contentRating = usRatingInfo.rating;
    }
  }

  return {
    id: `tmdb-tv-${show.id}`,
    tmdb_id: show.id.toString(),
    imdb_id: show.external_ids?.imdb_id || "",
    title: show.name,
    original_title: show.original_name || show.name,
    poster_path: show.poster_path
      ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
      : "",
    backdrop_path: show.backdrop_path
      ? `https://image.tmdb.org/t/p/original${show.backdrop_path}`
      : "",
    media_type: "tv",
    first_air_date: show.first_air_date,
    vote_average: show.vote_average || 0,
    vote_count: show.vote_count || 0,
    genre_ids: show.genres?.map((genre) => genre.id) || [],
    genre_strings: genreStrings,
    overview: show.overview || "",
    runtime: show.episode_run_time?.[0] || 0,
    content_rating: contentRating,
    streaming_providers:
      Object.keys(streamingProviders).length > 0 ? streamingProviders : null,
    popularity: show.popularity || 0,
    year: show.first_air_date ? show.first_air_date.substring(0, 4) : "",
    plot: show.overview || "",
    director, // Using creators as directors for TV shows
    actors,
    language: show.original_language,
    country: show.origin_country?.join(", ") || "",
    tagline: show.tagline || "",
    number_of_seasons: show.number_of_seasons || 0,
    number_of_episodes: show.number_of_episodes || 0,
  };
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const { operation } = params;

    if (!operation) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing operation parameter" }),
      };
    }

    let result;

    switch (operation) {
      case "search":
        const { query, type = "multi" } = params;
        if (!query) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing query parameter" }),
          };
        }

        const endpoint = `/search/${type}`;
        const searchData = await makeApiCall(endpoint, {
          query,
          include_adult: false,
          language: "en-US",
          page: 1,
        });

        result = {
          results: searchData.results.map(transformTmdbSearchResult),
        };
        break;

      case "movie":
        const { id: movieId } = params;
        if (!movieId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing id parameter" }),
          };
        }

        const movieData = await makeApiCall(`/movie/${movieId}`, {
          append_to_response: "credits,watch/providers,release_dates",
          language: "en-US",
        });

        result = transformTmdbMovieDetails(movieData);
        break;

      case "tv":
        const { id: tvId } = params;
        if (!tvId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: "Missing id parameter" }),
          };
        }

        const tvData = await makeApiCall(`/tv/${tvId}`, {
          append_to_response:
            "credits,watch/providers,content_ratings,external_ids",
          language: "en-US",
        });

        result = transformTmdbTvDetails(tvData);
        break;

      case "trending":
        const { mediaType = "all", timeWindow = "week", limit = 20 } = params;
        const trendingData = await makeApiCall(
          `/trending/${mediaType}/${timeWindow}`,
          {},
        );

        result = {
          results: trendingData.results
            .slice(0, parseInt(limit))
            .map(transformTmdbSearchResult),
        };
        break;

      case "movie_changes":
        const { start_date, end_date } = params;
        const movieChangesParams = {};
        if (start_date) movieChangesParams.start_date = start_date;
        if (end_date) movieChangesParams.end_date = end_date;

        const movieChangesData = await makeApiCall(
          "/movie/changes",
          movieChangesParams,
        );

        result = {
          results: movieChangesData.results.map((item) => item.id),
        };
        break;

      case "tv_changes":
        const { start_date: tvStartDate, end_date: tvEndDate } = params;
        const tvChangesParams = {};
        if (tvStartDate) tvChangesParams.start_date = tvStartDate;
        if (tvEndDate) tvChangesParams.end_date = tvEndDate;

        const tvChangesData = await makeApiCall("/tv/changes", tvChangesParams);

        result = {
          results: tvChangesData.results.map((item) => item.id),
        };
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown operation: ${operation}` }),
        };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error in TMDB function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error processing TMDB request",
        message: error.message,
      }),
    };
  }
};
