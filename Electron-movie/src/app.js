/**
 * App Entry Point - Initializes all MVC components
 */

import * as MovieModel from './model/MovieModel.js';
import * as ApiService from './model/ApiService.js';
import * as UIHelpers from './view/UIHelpers.js';
import * as MovieListView from './view/MovieListView.js';
import * as ModalView from './view/ModalView.js';
import * as MovieController from './controller/MovieController.js';
import * as SearchController from './controller/SearchController.js';
import * as FilterController from './controller/FilterController.js';

/**
 * Gets all DOM element references
 * @returns {Object} Object containing all DOM element references
 */
const getDOMElements = () => {
    return {
        // Message boxes
        messageBox: document.getElementById('message-box'),
        detailsModalMessageBox: document.getElementById('modal-message-box'),

        // Rating dropdown
        ratingValue: document.getElementById('rating-value'),
        ratingText: document.getElementById('rating-text'),
        ratingContainer: document.querySelector('.custom-select-container'),
        ratingOptions: document.getElementById('rating-options'),
        ratingTrigger: document.getElementById('rating-trigger'),

        // Movie list
        movieList: document.getElementById('movie-list'),

        // Search
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn'),
        searchResultsContainer: document.getElementById('search-results'),
        searchOverlay: document.getElementById('search-overlay'),
        openSearchBtn: document.getElementById('open-search-btn'),
        closeSearchBtn: document.getElementById('close-search-btn'),

        // Filters
        filterToggleBtn: document.getElementById('filter-toggle-btn'),
        filterPanel: document.getElementById('filter-panel'),
        sortSelect: document.getElementById('sort-select'),
        filterGenreSelect: document.getElementById('filter-genre-select'),
        filterDirectorSelect: document.getElementById('filter-director-select'),
        filterYearSelect: document.getElementById('filter-year-select'),
        filterFormatSelect: document.getElementById('filter-format-select'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),

        // Details modal
        detailsModal: document.getElementById('movie-details-modal'),
        detailsModalTitle: document.getElementById('modal-movie-title'),
        detailsForm: document.getElementById('details-form'),
        detailsCloseBtn: document.querySelector('.add-close-btn'),
        saveBtn: document.getElementById('save-btn'),
        cancelBtn: document.getElementById('cancel-btn'),
        watchDateInput: document.getElementById('watch-date-input'),
        todayBtn: document.getElementById('today-btn'),
        rewatchCheckbox: document.getElementById('rewatch-checkbox'),
        commentInput: document.getElementById('comment-input'),
        formatInput: document.getElementById('format-input'),
        customPosterInput: document.getElementById('custom-poster-input'),
        showPostersBtn: document.getElementById('show-poster-btn'),

        // Info modal
        infoModal: document.getElementById('movie-info-modal'),
        infoCloseBtn: document.querySelector('.info-close-btn'),
        infoTitle: document.getElementById('info-modal-title'),
        infoDirector: document.getElementById('info-director'),
        infoGenres: document.getElementById('info-genres'),
        infoRuntime: document.getElementById('info-runtime'),
        infoDate: document.getElementById('info-date'),
        infoRewatch: document.getElementById('info-rewatch'),
        infoFormat: document.getElementById('info-format'),
        infoFormatP: document.getElementById('info-format-p'),
        infocomment: document.getElementById('info-comment'),
        infocommentP: document.getElementById('info-comment-p'),
        editBtn: document.getElementById('edit-btn'),
        deleteBtn: document.getElementById('delete-btn'),
        imdbBtn: document.getElementById('imdb-btn'),
        letterboxdBtn: document.getElementById('letterboxd-btn'),

        // Delete confirmation modal
        deleteConfirmModal: document.getElementById('delete-confirm-modal'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),

        // Settings modal
        settingsBtn: document.getElementById('settings-btn'),
        settingsModal: document.getElementById('settings-modal'),
        settingsCloseBtn: document.querySelector('.settings-close-btn'),
        selectSaveLocationBtn: document.getElementById('select-save-location-btn')
    };
};

/**
 * Initializes the application
 */
const initApp = () => {
    const elements = getDOMElements();

    // Initialize all modules with DOM elements
    UIHelpers.initUIHelpers(elements);
    MovieListView.initMovieListView(elements);
    ModalView.initModalView(elements);
    MovieController.initMovieController(elements);
    SearchController.initSearchController(elements);
    FilterController.initFilterController(elements);

    // Setup event listeners
    MovieController.setupEventListeners();

    // Load the application
    MovieController.loadApp();
};

// Initialize when DOM is ready
window.onload = initApp;
