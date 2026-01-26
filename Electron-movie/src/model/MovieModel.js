/**
 * MovieModel - Handles movie data state and CRUD operations
 */

// API Base URLs
export const API_BASE_URL = 'https://api.themoviedb.org/3';
export const SEARCH_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w92';
export const MOVIE_LIST_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w300';
export const PLACEHOLDER_BASE_URL = 'https://placehold.co';

// State
let watchedMovies = [];
let movieToAdd = {};
let currentEntryId = null;
let currentSort = 'date-desc';
let currentFilterGenre = 'all';
let currentFilterDirector = 'all';
let currentFilterYear = 'all';
let currentFilterFormat = 'all';

// Getters
export const getWatchedMovies = () => watchedMovies;
export const getMovieToAdd = () => movieToAdd;
export const getCurrentEntryId = () => currentEntryId;
export const getCurrentSort = () => currentSort;
export const getCurrentFilterGenre = () => currentFilterGenre;
export const getCurrentFilterDirector = () => currentFilterDirector;
export const getCurrentFilterYear = () => currentFilterYear;
export const getCurrentFilterFormat = () => currentFilterFormat;

// Setters
export const setWatchedMovies = (movies) => { watchedMovies = movies; };
export const setMovieToAdd = (movie) => { movieToAdd = movie; };
export const setCurrentEntryId = (id) => { currentEntryId = id; };
export const setCurrentSort = (sort) => { currentSort = sort; };
export const setCurrentFilterGenre = (genre) => { currentFilterGenre = genre; };
export const setCurrentFilterDirector = (director) => { currentFilterDirector = director; };
export const setCurrentFilterYear = (year) => { currentFilterYear = year; };
export const setCurrentFilterFormat = (format) => { currentFilterFormat = format; };

/**
 * Loads movies and API key from the main process.
 * @param {Function} showMessage - Callback to display messages
 * @param {Object} elements - DOM elements object
 * @returns {Promise<string|null>} The TMDB API key
 */
export const loadState = async (showMessage, elements) => {
    const { searchInput, searchBtn } = elements;

    // Load movies from movie-data.json via IPC
    const movies = await window.electronAPI.invoke('read-json');
    if (movies && !movies.error) {
        watchedMovies = movies;
    } else {
        watchedMovies = [];
        if (movies && movies.error) console.error("Error reading JSON:", movies.error);
    }

    // Load API key from main process
    const tmdbApiKey = await window.electronAPI.invoke('get-api-key');
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not found. Please set it in the .env file.', 'error');
        searchInput.disabled = true;
        searchBtn.disabled = true;
    } else {
        searchInput.disabled = false;
        searchBtn.disabled = false;
    }

    // Reset filters on load
    currentSort = 'date-desc';
    currentFilterGenre = 'all';
    currentFilterDirector = 'all';
    currentFilterYear = 'all';
    currentFilterFormat = 'all';

    return tmdbApiKey;
};

/**
 * Saves the current movies to movie-data.json via the main process.
 * @param {Function} showMessage - Callback to display error messages
 */
export const saveState = async (showMessage) => {
    const result = await window.electronAPI.invoke('write-json', watchedMovies);
    if (result.error) {
        showMessage('Failed to save movies.', 'error');
        console.error('Error writing JSON:', result.error);
    }
};

/**
 * Adds a movie to the watched list
 * @param {Object} movie - The movie to add
 */
export const addMovie = (movie) => {
    watchedMovies.push(movie);
};

/**
 * Updates a movie in the watched list
 * @param {string} entryId - The entry ID of the movie to update
 * @param {Object} movie - The updated movie data
 * @returns {boolean} Whether the update was successful
 */
export const updateMovie = (entryId, movie) => {
    const index = watchedMovies.findIndex(m => m.entryId === entryId);
    if (index > -1) {
        watchedMovies[index] = movie;
        return true;
    }
    return false;
};

/**
 * Deletes a movie from the watched list
 * @param {string} entryId - The entry ID of the movie to delete
 * @returns {boolean} Whether the deletion was successful
 */
export const deleteMovie = (entryId) => {
    const index = watchedMovies.findIndex(m => m.entryId === entryId);
    if (index > -1) {
        watchedMovies.splice(index, 1);
        return true;
    }
    return false;
};

/**
 * Finds a movie by its entry ID
 * @param {string} entryId - The entry ID to search for
 * @returns {Object|undefined} The found movie or undefined
 */
export const findMovieByEntryId = (entryId) => {
    return watchedMovies.find(m => m.entryId === entryId);
};

/**
 * Returns filtered and sorted movies based on current settings
 * @returns {Array} Filtered and sorted movies
 */
export const getFilteredAndSortedMovies = () => {
    // Filter movies based on the selected criteria
    const filteredMovies = watchedMovies.filter(movie => {
        const matchesGenre = currentFilterGenre === 'all' || (movie.genres && movie.genres.includes(currentFilterGenre));
        const matchesDirector = currentFilterDirector === 'all' || (movie.director && movie.director === currentFilterDirector);
        const matchesYear = currentFilterYear === 'all' || (movie.release_date && movie.release_date.substring(0, 4) === currentFilterYear);
        const matchesFormat = currentFilterFormat === 'all' || (movie.format && movie.format === currentFilterFormat);

        return matchesGenre && matchesDirector && matchesYear && matchesFormat;
    });

    // Sort the filtered movies
    filteredMovies.sort((a, b) => {
        switch (currentSort) {
            case 'date-desc':
                return new Date(b.watchDate) - new Date(a.watchDate);
            case 'date-asc':
                return new Date(a.watchDate) - new Date(b.watchDate);
            case 'rating-desc':
                return (b.userRating || 0) - (a.userRating || 0);
            case 'rating-asc':
                return (a.userRating || 0) - (b.userRating || 0);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            default:
                return 0;
        }
    });

    return filteredMovies;
};

/**
 * Resets all filters to default values
 */
export const resetFilters = () => {
    currentFilterGenre = 'all';
    currentFilterDirector = 'all';
    currentFilterYear = 'all';
    currentFilterFormat = 'all';
};
