/**
 * MovieController - Main application logic and coordination
 */

import * as MovieModel from '../model/MovieModel.js';
import * as ApiService from '../model/ApiService.js';
import * as MovieListView from '../view/MovieListView.js';
import * as ModalView from '../view/ModalView.js';
import * as PosterGridView from '../view/PosterGridView.js';
import { showMessage, showDetailsModalMessage, initCustomRatingDropdown } from '../view/UIHelpers.js';
import * as FilterController from './FilterController.js';
import * as SearchController from './SearchController.js';

// DOM element references
let movieList = null;
let detailsForm = null;
let editBtn = null;
let deleteBtn = null;
let confirmDeleteBtn = null;
let cancelDeleteBtn = null;
let detailsCloseBtn = null;
let cancelBtn = null;
let infoCloseBtn = null;
let settingsBtn = null;
let settingsCloseBtn = null;
let todayBtn = null;
let watchDateInput = null;
let selectSaveLocationBtn = null;
let showPostersBtn = null;
let customPosterInput = null;

/**
 * Initialize MovieController with DOM elements
 * @param {Object} elements - Object containing DOM element references
 */
export const initMovieController = (elements) => {
    movieList = elements.movieList;
    detailsForm = elements.detailsForm;
    editBtn = elements.editBtn;
    deleteBtn = elements.deleteBtn;
    confirmDeleteBtn = elements.confirmDeleteBtn;
    cancelDeleteBtn = elements.cancelDeleteBtn;
    detailsCloseBtn = elements.detailsCloseBtn;
    cancelBtn = elements.cancelBtn;
    infoCloseBtn = elements.infoCloseBtn;
    settingsBtn = elements.settingsBtn;
    settingsCloseBtn = elements.settingsCloseBtn;
    todayBtn = elements.todayBtn;
    watchDateInput = elements.watchDateInput;
    selectSaveLocationBtn = elements.selectSaveLocationBtn;
    showPostersBtn = elements.showPostersBtn;
    customPosterInput = elements.customPosterInput;
};

/**
 * Refreshes the movie list view
 */
export const refreshView = () => {
    const movies = MovieModel.getFilteredAndSortedMovies();
    MovieListView.renderMovies(movies);
};

/**
 * Refreshes filters and view
 */
export const refreshFiltersAndView = () => {
    FilterController.refreshFilters();
    refreshView();
};

/**
 * Handles movie selection from search
 * @param {Object} movieData - The movie data from TMDB
 */
const handleMovieSelected = (movieData) => {
    MovieModel.setMovieToAdd(movieData);
    MovieModel.setCurrentEntryId(null);
    ModalView.openDetailsModal(movieData, null, MovieModel.getWatchedMovies());
};

/**
 * Sets up all event listeners
 */
export const setupEventListeners = () => {
    // Movie card click (event delegation)
    if (movieList) {
        movieList.addEventListener('click', (event) => {
            const movieCard = event.target.closest('.movie-card');
            if (movieCard) {
                const entryId = movieCard.dataset.entryId;
                const movie = MovieModel.findMovieByEntryId(entryId);
                if (movie) {
                    ModalView.openInfoModal(movie);
                    MovieModel.setCurrentEntryId(entryId);
                }
            }
        });
    }

    // Edit button in info modal
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const currentEntryId = MovieModel.getCurrentEntryId();
            const movie = MovieModel.findMovieByEntryId(currentEntryId);
            if (movie) {
                ModalView.closeInfoModal();
                MovieModel.setMovieToAdd(movie);
                ModalView.openDetailsModal(movie, currentEntryId, MovieModel.getWatchedMovies());
            }
        });
    }

    // Delete button in info modal
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            ModalView.closeInfoModal();
            ModalView.showDeleteConfirmModal();
        });
    }

    // Confirm delete
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            handleDelete();
            ModalView.hideDeleteConfirmModal();
        });
    }

    // Cancel delete
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            ModalView.hideDeleteConfirmModal();
        });
    }

    // Details modal close buttons
    if (detailsCloseBtn) {
        detailsCloseBtn.addEventListener('click', ModalView.closeDetailsModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', ModalView.closeDetailsModal);
    }

    // Info modal close button
    if (infoCloseBtn) {
        infoCloseBtn.addEventListener('click', ModalView.closeInfoModal);
    }

    // Settings modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', ModalView.showSettingsModal);
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', ModalView.hideSettingsModal);
    }

    // Today button
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            watchDateInput.value = new Date().toISOString().split('T')[0];
        });
    }

    // Form submission
    if (detailsForm) {
        detailsForm.addEventListener('submit', handleFormSubmit);
    }

    // Save location button
    if (selectSaveLocationBtn) {
        selectSaveLocationBtn.addEventListener('click', handleSelectSaveLocation);
    }

    // Show posters button
    if (showPostersBtn) {
        showPostersBtn.addEventListener('click', handleShowPosters);
    }

    // Window click for modal closing
    window.addEventListener('click', handleWindowClick);

    // Escape key handling
    window.addEventListener('keydown', handleEscapeKey);

    // JSON file changes
    window.electronAPI.onJsonUpdated(() => {
        loadApp();
    });

    // Setup search listeners
    SearchController.setupSearchListeners(handleMovieSelected);

    // Setup filter listeners
    FilterController.setupFilterListeners(refreshView);
};

/**
 * Handles form submission for add/edit movie
 * @param {Event} event - The submit event
 */
const handleFormSubmit = (event) => {
    event.preventDefault();

    const formData = ModalView.getDetailsFormData();
    const movieToAdd = MovieModel.getMovieToAdd();
    const currentEntryId = MovieModel.getCurrentEntryId();

    if (formData.userRating === 0) {
        showDetailsModalMessage('Please provide a rating.');
        return;
    }
    if (!formData.watchDate) {
        showDetailsModalMessage('Please provide a date watched.');
        return;
    }

    // Update movieToAdd with form data
    movieToAdd.userRating = formData.userRating;
    movieToAdd.watchDate = formData.watchDate;
    movieToAdd.isRewatch = formData.isRewatch;
    movieToAdd.comment = formData.comment;
    movieToAdd.format = formData.format;
    movieToAdd.customPoster = formData.customPoster;

    if (currentEntryId !== null) { // Edit mode
        if (MovieModel.updateMovie(currentEntryId, movieToAdd)) {
            showMessage(`${movieToAdd.title} updated successfully!`, 'success');
        }
    } else { // Add mode
        MovieModel.addMovie(movieToAdd);
        showMessage(`${movieToAdd.title} added successfully!`, 'success');
    }

    MovieModel.saveState(showMessage);
    refreshFiltersAndView();

    ModalView.closeDetailsModal();
    SearchController.clearSearch();
};

/**
 * Handles the deletion of a movie
 */
const handleDelete = () => {
    const currentEntryId = MovieModel.getCurrentEntryId();
    if (MovieModel.deleteMovie(currentEntryId)) {
        MovieModel.saveState(showMessage);
        refreshFiltersAndView();
        showMessage('Movie removed successfully!', 'success');
        ModalView.closeInfoModal();
    }
};

/**
 * Handles window click for modal closing
 * @param {Event} event - The click event
 */
const handleWindowClick = (event) => {
    if (event.target.classList.contains('modal')) {
        if (ModalView.isDetailsModalVisible()) {
            ModalView.closeDetailsModal();
        } else if (ModalView.isInfoModalVisible()) {
            ModalView.closeInfoModal();
        } else if (ModalView.isDeleteConfirmModalVisible()) {
            ModalView.hideDeleteConfirmModal();
        } else if (ModalView.isSettingsModalVisible()) {
            ModalView.hideSettingsModal();
        }
    }
    if (event.target === document.getElementById('search-overlay')) {
        ModalView.hideSearchOverlay();
    }
};

/**
 * Handles escape key for modal closing
 * @param {Event} event - The keydown event
 */
const handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
        // Check poster modal first (it appears on top of details modal)
        if (PosterGridView.isPosterModalVisible()) {
            PosterGridView.closePosterModal();
        } else if (ModalView.isSearchOverlayVisible()) {
            ModalView.hideSearchOverlay();
        } else if (ModalView.isDeleteConfirmModalVisible()) {
            ModalView.hideDeleteConfirmModal();
        } else if (ModalView.isDetailsModalVisible()) {
            ModalView.closeDetailsModal();
        } else if (ModalView.isInfoModalVisible()) {
            ModalView.closeInfoModal();
        } else if (ModalView.isSettingsModalVisible()) {
            ModalView.hideSettingsModal();
        }
    }
};

/**
 * Handles save location button click
 */
const handleSelectSaveLocation = async () => {
    const result = await window.electronAPI.invoke('select-save-location');
    if (result.success) {
        showMessage('Save location updated successfully!', 'success');
        loadApp();
    }
};

/**
 * Handles show posters button click - opens poster grid
 */
const handleShowPosters = async () => {
    const movieToAdd = MovieModel.getMovieToAdd();
    if (movieToAdd && movieToAdd.id) {
        const posters = await ApiService.getAllPosters(movieToAdd.id, showMessage);
        if (posters && posters.length > 0) {
            PosterGridView.openPosterModal(posters, (selectedPath) => {
                movieToAdd.customPoster = selectedPath;
                ModalView.setCustomPosterInput(selectedPath);
            });
        }
    } else {
        showMessage('No movie selected or TMDB ID missing.', 'error');
    }
};

/**
 * Loads the application state and initializes the view
 */
export const loadApp = async () => {
    const elements = {
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn')
    };

    const apiKey = await MovieModel.loadState(showMessage, elements);
    if (apiKey) {
        ApiService.setApiKey(apiKey);
    }

    // Check if in development mode
    const isDev = await window.electronAPI.invoke('is-dev');
    const saveLocBtn = document.getElementById('select-save-location-btn');
    if (isDev && saveLocBtn) {
        saveLocBtn.disabled = true;
        saveLocBtn.textContent = 'Save Location (Fixed in Dev)';
        saveLocBtn.title = 'Save location is hardcoded in development mode.';
        saveLocBtn.style.opacity = '0.5';
        saveLocBtn.style.cursor = 'not-allowed';
    }

    initCustomRatingDropdown();
    refreshFiltersAndView();
};
