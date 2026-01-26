/**
 * FilterController - Handles sorting and filtering logic
 */

import * as MovieModel from '../model/MovieModel.js';
import * as MovieListView from '../view/MovieListView.js';

// DOM element references
let filterToggleBtn = null;
let filterPanel = null;
let sortSelect = null;
let filterGenreSelect = null;
let filterDirectorSelect = null;
let filterYearSelect = null;
let filterFormatSelect = null;
let resetFiltersBtn = null;

/**
 * Initialize FilterController with DOM elements
 * @param {Object} elements - Object containing DOM element references
 */
export const initFilterController = (elements) => {
    filterToggleBtn = elements.filterToggleBtn;
    filterPanel = elements.filterPanel;
    sortSelect = elements.sortSelect;
    filterGenreSelect = elements.filterGenreSelect;
    filterDirectorSelect = elements.filterDirectorSelect;
    filterYearSelect = elements.filterYearSelect;
    filterFormatSelect = elements.filterFormatSelect;
    resetFiltersBtn = elements.resetFiltersBtn;
};

/**
 * Sets up all filter event listeners
 * @param {Function} refreshView - Callback to refresh the movie list view
 */
export const setupFilterListeners = (refreshView) => {
    // Filter toggle
    if (filterPanel) {
        filterPanel.style.display = 'none';
    }
    if (filterToggleBtn) {
        filterToggleBtn.textContent = 'Filter';
        filterToggleBtn.addEventListener('click', () => {
            if (filterPanel.style.display === 'none') {
                filterPanel.style.display = 'block';
                filterToggleBtn.textContent = 'Hide Filters';
            } else {
                filterPanel.style.display = 'none';
                filterToggleBtn.textContent = 'Filter';
            }
        });
    }

    // Sort change
    if (sortSelect) {
        sortSelect.value = MovieModel.getCurrentSort();
        sortSelect.addEventListener('change', (event) => {
            MovieModel.setCurrentSort(event.target.value);
            refreshView();
        });
    }

    // Filter changes
    if (filterGenreSelect) {
        filterGenreSelect.addEventListener('change', (event) => {
            MovieModel.setCurrentFilterGenre(event.target.value);
            refreshView();
        });
    }

    if (filterDirectorSelect) {
        filterDirectorSelect.addEventListener('change', (event) => {
            MovieModel.setCurrentFilterDirector(event.target.value);
            refreshView();
        });
    }

    if (filterYearSelect) {
        filterYearSelect.addEventListener('change', (event) => {
            MovieModel.setCurrentFilterYear(event.target.value);
            refreshView();
        });
    }

    if (filterFormatSelect) {
        filterFormatSelect.addEventListener('change', (event) => {
            MovieModel.setCurrentFilterFormat(event.target.value);
            refreshView();
        });
    }

    // Reset filters
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            filterGenreSelect.value = 'all';
            filterDirectorSelect.value = 'all';
            filterYearSelect.value = 'all';
            filterFormatSelect.value = 'all';
            MovieModel.resetFilters();
            refreshView();
        });
    }
};

/**
 * Refreshes the filter dropdowns
 */
export const refreshFilters = () => {
    const watchedMovies = MovieModel.getWatchedMovies();
    const currentFilters = {
        genre: MovieModel.getCurrentFilterGenre(),
        director: MovieModel.getCurrentFilterDirector(),
        year: MovieModel.getCurrentFilterYear(),
        format: MovieModel.getCurrentFilterFormat()
    };
    MovieListView.renderFilters(watchedMovies, currentFilters);
};
