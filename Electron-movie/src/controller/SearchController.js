/**
 * SearchController - Handles search functionality and TMDB movie selection
 */

import * as ApiService from '../model/ApiService.js';
import * as MovieModel from '../model/MovieModel.js';
import * as MovieListView from '../view/MovieListView.js';
import * as ModalView from '../view/ModalView.js';
import { showMessage, debounce } from '../view/UIHelpers.js';

// DOM element references
let searchInput = null;
let searchBtn = null;
let searchResultsContainer = null;
let searchOverlay = null;
let openSearchBtn = null;
let closeSearchBtn = null;

/**
 * Initialize SearchController with DOM elements
 * @param {Object} elements - Object containing DOM element references
 */
export const initSearchController = (elements) => {
    searchInput = elements.searchInput;
    searchBtn = elements.searchBtn;
    searchResultsContainer = elements.searchResultsContainer;
    searchOverlay = elements.searchOverlay;
    openSearchBtn = elements.openSearchBtn;
    closeSearchBtn = elements.closeSearchBtn;
};

/**
 * Sets up all search event listeners
 * @param {Function} onMovieSelected - Callback when a movie is selected to add
 */
export const setupSearchListeners = (onMovieSelected) => {
    // Debounced search handler
    const debouncedSearch = debounce(async (query) => {
        if (query.length > 2) {
            const results = await ApiService.searchMoviesByTitle(query, showMessage);
            if (results) {
                MovieListView.renderSearchResults(results, query);
            }
        } else {
            MovieListView.renderSearchResults([], '');
        }
    }, 500);

    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            debouncedSearch(event.target.value.trim());
        });
    }

    // Clear button
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchInput.value = '';
            MovieListView.renderSearchResults([], '');
            searchInput.focus();
        });
    }

    // Open search overlay
    if (openSearchBtn) {
        openSearchBtn.addEventListener('click', () => {
            ModalView.showSearchOverlay();
            searchInput.focus();
        });
    }

    // Close search overlay
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            ModalView.hideSearchOverlay();
            searchInput.value = '';
            MovieListView.renderSearchResults([], '');
        });
    }

    // Search results click (event delegation)
    if (searchResultsContainer) {
        searchResultsContainer.addEventListener('click', async (event) => {
            const clickedButton = event.target.closest('.add-btn');
            if (clickedButton) {
                clickedButton.disabled = true;
                clickedButton.textContent = 'Adding...';

                const tmdbId = parseInt(clickedButton.dataset.tmdbId);
                const movieData = await ApiService.getMovieDetails(tmdbId, showMessage);

                if (movieData) {
                    // Close the search overlay
                    ModalView.hideSearchOverlay();
                    searchInput.value = '';
                    MovieListView.renderSearchResults([], '');

                    // Notify that a movie was selected
                    onMovieSelected(movieData);
                } else {
                    // Re-enable button if getting details failed
                    clickedButton.disabled = false;
                    clickedButton.textContent = 'Add';
                }
            }
        });
    }
};

/**
 * Clears the search state
 */
export const clearSearch = () => {
    if (searchInput) {
        searchInput.value = '';
    }
    MovieListView.renderSearchResults([], '');
};
