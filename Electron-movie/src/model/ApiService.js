/**
 * ApiService - Handles all TMDB API calls
 */

import { API_BASE_URL, APP_CLIENT_KEY, SEARCH_IMAGE_BASE_URL } from './MovieModel.js';

let tmdbApiKey = null;
const DIRECT_TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Sets the API key for TMDB requests (from .env or local storage)
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
 * Executes an API request with automatic fallback.
 * - Primary (Default): Always routes through the Cloudflare Worker edge proxy first to benefit
 *   from global edge caching, 0ms repeated views, and 50% request reduction.
 * - Automatic Fallback: ONLY if the proxy is not working (network failure or 5xx server error)
 *   AND a personal API key is available (via .env or local storage), it automatically retries directly
 *   against api.themoviedb.org using the fallback key.
 *
 * @param {string} endpointAndQuery - The endpoint path and query string (e.g. '/search/movie?query=Avatar')
 * @returns {Promise<Response>} The HTTP Response object
 */
export const fetchWithFallback = async (endpointAndQuery) => {
    const proxyUrl = `${API_BASE_URL}${endpointAndQuery}`;
    const proxyHeaders = {
        'Accept': 'application/json',
        'X-App-Key': APP_CLIENT_KEY
    };

    let proxyError = null;
    let proxyResponse = null;

    try {
        proxyResponse = await fetch(proxyUrl, { headers: proxyHeaders });
        // If the proxy responds successfully or with a valid client error (e.g. 404), return it immediately
        if (proxyResponse.ok || (proxyResponse.status < 500 && proxyResponse.status !== 0)) {
            return proxyResponse;
        }
    } catch (err) {
        proxyError = err;
    }

    // Proxy is down or returned a 5xx server error -> attempt direct fallback if .env / local key is present
    if (tmdbApiKey) {
        console.warn('Cloudflare proxy unavailable. Retrying directly with fallback TMDB key...');
        let directUrl = `${DIRECT_TMDB_BASE_URL}${endpointAndQuery}`;
        const directHeaders = { 'Accept': 'application/json' };

        if (tmdbApiKey.length > 100) {
            directHeaders['Authorization'] = `Bearer ${tmdbApiKey}`;
        } else {
            const separator = directUrl.includes('?') ? '&' : '?';
            directUrl = `${directUrl}${separator}api_key=${tmdbApiKey}`;
        }

        try {
            return await fetch(directUrl, { headers: directHeaders });
        } catch (fallbackErr) {
            console.error('Fallback direct TMDB fetch also failed:', fallbackErr);
            throw fallbackErr;
        }
    }

    // If no fallback key exists, throw the original proxy error or return the 5xx response
    if (proxyError) {
        throw proxyError;
    }
    return proxyResponse;
};

/**
 * Fetches movies from TMDB based on a search query.
 * @param {string} query The movie title to search for.
 * @param {Function} showMessage - Callback to display error messages
 * @returns {Promise<Array|null>} The search results array or null on failure.
 */
export const searchMoviesByTitle = async (query, showMessage) => {
    if (!query || !query.trim()) {
        return null;
    }
    
    try {
        const searchResponse = await fetchWithFallback(`/search/movie?query=${encodeURIComponent(query.trim())}`);
        if (!searchResponse.ok) {
            const errorData = await searchResponse.json().catch(() => ({}));
            showMessage(`API Error: ${errorData.error || errorData.status_message || 'Could not fetch search results.'}`, 'error');
            return null;
        }
        const searchData = await searchResponse.json();
        return searchData.results || [];
    } catch (error) {
        showMessage('Failed to fetch search results. Please check your network connection.', 'error');
        console.error('Fetch error:', error);
        return null;
    }
};

/**
 * Fetches a single movie's details and credits in a single combined request via append_to_response=credits.
 * @param {number} tmdbId The TMDB ID of the movie.
 * @param {Function} showMessage - Callback to display error messages
 * @returns {Promise<Object|null>} The movie details object or null on failure.
 */
export const getMovieDetails = async (tmdbId, showMessage) => {
    if (!tmdbId) {
        return null;
    }
    
    try {
        const movieResponse = await fetchWithFallback(`/movie/${tmdbId}?append_to_response=credits`);
        if (!movieResponse.ok) {
            const errorData = await movieResponse.json().catch(() => ({}));
            if (movieResponse.status !== 404) {
                showMessage(`API Error: ${errorData.error || errorData.status_message || 'Could not fetch movie details.'}`, 'error');
            }
            return null;
        }
        
        const movieData = await movieResponse.json();
        const director = movieData.credits?.crew?.find(member => member.job === 'Director');
        const genres = movieData.genres ? movieData.genres.map(genre => genre.name) : [];
        
        const fullMovieData = {
            id: movieData.id,
            entryId: crypto.randomUUID(),
            title: movieData.title,
            poster_path: movieData.poster_path,
            release_date: movieData.release_date,
            runtime: movieData.runtime,
            genres: genres,
            director: director ? director.name : 'N/A',
            imdb_id: movieData.imdb_id || ''
        };
        return fullMovieData;
    } catch (error) {
        console.error('Fetch details error:', error);
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
    // TMDB IDs are integers. If it has a decimal, it's a fallback ID generated by our app (usually for TV episodes).
    if (!tmdbId || tmdbId.toString().includes('.')) {
        showMessage('TV show and episode posters are currently not available.', 'error');
        return null;
    }
    
    try {
        const posterResponse = await fetchWithFallback(`/movie/${tmdbId}/images?include_image_language=null%2Cen`);
        if (!posterResponse.ok) {
            return null;
        }
        
        const data = await posterResponse.json();
        if (data.posters && data.posters.length > 0) {
            return data.posters.map(p => p.file_path);
        } else {
            showMessage('No posters found.', 'error');
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
