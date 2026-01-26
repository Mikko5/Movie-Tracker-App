/**
 * ApiService - Handles all TMDB API calls
 */

import { API_BASE_URL, SEARCH_IMAGE_BASE_URL } from './MovieModel.js';

let tmdbApiKey = null;

/**
 * Sets the API key for TMDB requests
 * @param {string} key - The API key
 */
export const setApiKey = (key) => {
    tmdbApiKey = key;
};

/**
 * Gets the current API key
 * @returns {string|null} The API key
 */
export const getApiKey = () => tmdbApiKey;

/**
 * Fetches movies from TMDB based on a search query.
 * @param {string} query The movie title to search for.
 * @param {Function} showMessage - Callback to display error messages
 * @returns {Promise<Array|null>} The search results array or null on failure.
 */
export const searchMoviesByTitle = async (query, showMessage) => {
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not loaded. Cannot search.', 'error');
        return null;
    }
    if (!query) {
        return null;
    }
    const headers = {
        'Authorization': `Bearer ${tmdbApiKey}`
    };
    try {
        const searchUrl = `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}`;
        const searchResponse = await fetch(searchUrl, { headers });
        if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            showMessage(`API Error: ${errorData.status_message || 'Unknown error. Check your API key.'}`, 'error');
            return null;
        }
        const searchData = await searchResponse.json();
        return searchData.results;
    } catch (error) {
        showMessage('Failed to fetch search results. Please check your API key and network connection.', 'error');
        console.error('Fetch error:', error);
        return null;
    }
};

/**
 * Fetches a single movie's details by its TMDB ID.
 * @param {number} tmdbId The TMDB ID of the movie.
 * @param {Function} showMessage - Callback to display error messages
 * @returns {Promise<Object|null>} The movie details object or null on failure.
 */
export const getMovieDetails = async (tmdbId, showMessage) => {
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not loaded. Cannot fetch movie details.', 'error');
        return null;
    }
    const headers = {
        'Authorization': `Bearer ${tmdbApiKey}`
    };
    try {
        const [movieResponse, creditsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/movie/${tmdbId}`, { headers }),
            fetch(`${API_BASE_URL}/movie/${tmdbId}/credits`, { headers })
        ]);
        if (!movieResponse.ok || !creditsResponse.ok) {
            const errorData = await (movieResponse.ok ? creditsResponse : movieResponse).json();
            showMessage(`API Error: ${errorData.status_message || 'Could not fetch movie details.'}`, 'error');
            return null;
        }
        const movieData = await movieResponse.json();
        const creditsData = await creditsResponse.json();
        const director = creditsData.crew.find(member => member.job === 'Director');
        const genres = movieData.genres.map(genre => genre.name);
        const fullMovieData = {
            id: movieData.id,
            entryId: crypto.randomUUID(),
            title: movieData.title,
            poster_path: movieData.poster_path,
            release_date: movieData.release_date,
            runtime: movieData.runtime,
            genres: genres,
            director: director ? director.name : 'N/A',
            imdb_id: movieData.imdb_id
        };
        return fullMovieData;
    } catch (error) {
        showMessage('Failed to add movie. Please try again.', 'error');
        console.error('Add movie error:', error);
        return null;
    }
};

/**
 * Fetches all available posters for a movie
 * @param {number} tmdbId - The TMDB ID of the movie
 * @param {Function} showMessage - Callback to display error messages
 * @returns {Promise<Array|null>} Array of poster paths or null on failure
 */
export const getAllPosters = async (tmdbId, showMessage) => {
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not loaded. Cannot fetch posters.', 'error');
        return null;
    }
    const headers = {
        'Authorization': `Bearer ${tmdbApiKey}`
    };
    try {
        const posterResponse = await fetch(`${API_BASE_URL}/movie/${tmdbId}/images?include_image_language=null%2Cen`, { headers });
        const data = await posterResponse.json();
        if (data.posters && data.posters.length > 0) {
            return data.posters.map(p => p.file_path);
        } else {
            showMessage('No posters found for this movie.', 'error');
            return null;
        }
    } catch (error) {
        console.error(error);
        return null;
    }
};

/**
 * Fetches a random poster for a movie (legacy function)
 * @param {number} tmdbId - The TMDB ID of the movie
 * @param {Function} showMessage - Callback to display error messages
 * @returns {Promise<string|null>} A random poster path or null on failure
 */
export const listAllPosters = async (tmdbId, showMessage) => {
    const posters = await getAllPosters(tmdbId, showMessage);
    if (posters && posters.length > 0) {
        return posters[Math.floor(Math.random() * posters.length)];
    }
    return null;
};
