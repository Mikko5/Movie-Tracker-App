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
import * as ModalManager from './ModalManager.js';

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
let appVersionText = null;
let checkUpdateBtn = null;
let downloadUpdateBtn = null;
let installUpdateBtn = null;
let updateStatusText = null;

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
    appVersionText = elements.appVersionText;
    checkUpdateBtn = elements.checkUpdateBtn;
    downloadUpdateBtn = elements.downloadUpdateBtn;
    installUpdateBtn = elements.installUpdateBtn;
    updateStatusText = elements.updateStatusText;
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
    ModalManager.push('details', {
        movie: movieData,
        entryId: null,
        watchedMovies: MovieModel.getWatchedMovies()
    });
};

/**
 * Sets up all event listeners
 */
export const setupEventListeners = () => {
    // Register all modals with the ModalManager first
    registerModals();
    // Movie card click (event delegation)
    if (movieList) {
        movieList.addEventListener('click', (event) => {
            const movieCard = event.target.closest('.movie-card');
            if (movieCard) {
                const entryId = movieCard.dataset.entryId;
                const movie = MovieModel.findMovieByEntryId(entryId);
                if (movie) {
                    ModalManager.push('info', movie);
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
                ModalManager.pop(); // Close info modal
                MovieModel.setMovieToAdd(movie);
                ModalManager.push('details', {
                    movie: movie,
                    entryId: currentEntryId,
                    watchedMovies: MovieModel.getWatchedMovies()
                });
            }
        });
    }

    // Delete button in info modal
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            ModalManager.pop(); // Close info modal
            ModalManager.push('deleteConfirm');
        });
    }

    // Confirm delete
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            handleDelete();
            ModalManager.pop(); // Close delete confirm modal
        });
    }

    // Cancel delete
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            ModalManager.pop(); // Close delete confirm modal
        });
    }

    // Details modal close buttons
    if (detailsCloseBtn) {
        detailsCloseBtn.addEventListener('click', () => ModalManager.pop());
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => ModalManager.pop());
    }

    // Info modal close button
    if (infoCloseBtn) {
        infoCloseBtn.addEventListener('click', () => ModalManager.pop());
    }

    // Settings modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => ModalManager.push('settings'));
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', () => ModalManager.pop());
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

    // --- Auto Updater Event Listeners ---
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', () => {
            updateStatusText.textContent = 'Checking for updates...';
            window.electronAPI.invoke('check-for-updates');
        });
    }

    if (downloadUpdateBtn) {
        downloadUpdateBtn.addEventListener('click', () => {
            updateStatusText.textContent = 'Downloading update...';
            downloadUpdateBtn.style.display = 'none';
            window.electronAPI.invoke('download-update');
        });
    }

    if (installUpdateBtn) {
        installUpdateBtn.addEventListener('click', () => {
            window.electronAPI.invoke('quit-and-install');
        });
    }

    // Listen to updater status from main process
    if (window.electronAPI.onUpdaterStatus) {
        window.electronAPI.onUpdaterStatus((data) => {
            if (!updateStatusText) return;

            switch (data.status) {
                case 'checking':
                    updateStatusText.textContent = 'Checking for updates...';
                    break;
                case 'available':
                    updateStatusText.textContent = `Update available: ${data.info.version}`;
                    checkUpdateBtn.style.display = 'none';
                    downloadUpdateBtn.style.display = 'inline-block';
                    break;
                case 'not-available':
                    updateStatusText.textContent = 'App is up to date.';
                    break;
                case 'progress':
                    const percent = data.progress.percent.toFixed(1);
                    updateStatusText.textContent = `Downloading... ${percent}%`;
                    break;
                case 'downloaded':
                    updateStatusText.textContent = 'Update downloaded and ready to install.';
                    downloadUpdateBtn.style.display = 'none';
                    installUpdateBtn.style.display = 'inline-block';
                    break;
                case 'error':
                    updateStatusText.textContent = `Update error: ${data.error}`;
                    break;
            }
        });
    }

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
 * Handles escape key for modal closing - delegates to ModalManager stack
 * @param {Event} event - The keydown event
 */
const handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
        ModalManager.handleEscape();
    }
};

/**
 * Register all modals with the ModalManager
 */
const registerModals = () => {
    ModalManager.register('poster', {
        open: (data) => PosterGridView.openPosterModal(data.posters, data.callback),
        close: () => PosterGridView.closePosterModal(),
        isVisible: () => PosterGridView.isPosterModalVisible()
    });

    ModalManager.register('search', {
        open: () => ModalView.showSearchOverlay(),
        close: () => ModalView.hideSearchOverlay(),
        isVisible: () => ModalView.isSearchOverlayVisible()
    });

    ModalManager.register('deleteConfirm', {
        open: () => ModalView.showDeleteConfirmModal(),
        close: () => ModalView.hideDeleteConfirmModal(),
        isVisible: () => ModalView.isDeleteConfirmModalVisible()
    });

    ModalManager.register('details', {
        open: (data) => ModalView.openDetailsModal(data.movie, data.entryId, data.watchedMovies),
        close: () => ModalView.closeDetailsModal(),
        isVisible: () => ModalView.isDetailsModalVisible()
    });

    ModalManager.register('info', {
        open: (movie) => ModalView.openInfoModal(movie),
        close: () => ModalView.closeInfoModal(),
        isVisible: () => ModalView.isInfoModalVisible()
    });

    ModalManager.register('settings', {
        open: () => ModalView.showSettingsModal(),
        close: () => ModalView.hideSettingsModal(),
        isVisible: () => ModalView.isSettingsModalVisible()
    });
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
            ModalManager.push('poster', {
                posters: posters,
                callback: (selectedPath) => {
                    movieToAdd.customPoster = selectedPath;
                    ModalView.setCustomPosterInput(selectedPath);
                }
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

    // Fetch and display app version
    if (appVersionText) {
        try {
            const version = await window.electronAPI.invoke('get-app-version');
            appVersionText.textContent = `Version: ${version}`;
        } catch (e) {
            console.error('Failed to get app version:', e);
        }
    }

    initCustomRatingDropdown();
    refreshFiltersAndView();
};
