/**
 * ModalView - Handles all modal rendering and display logic
 */

import { renderStarsHtml, selectRating } from './UIHelpers.js';

// DOM element references
let detailsModal = null;
let detailsModalTitle = null;
let saveBtn = null;
let watchDateInput = null;
let rewatchCheckbox = null;
let commentInput = null;
let formatInput = null;
let customPosterInput = null;
let detailsModalMessageBox = null;

let infoModal = null;
let infoTitle = null;
let infoDirector = null;
let infoGenres = null;
let infoRuntime = null;
let infoDate = null;
let infoRewatch = null;
let infoFormat = null;
let infoFormatP = null;
let infocomment = null;
let infocommentP = null;
let imdbBtn = null;
let letterboxdBtn = null;

let deleteConfirmModal = null;
let settingsModal = null;
let searchOverlay = null;

/**
 * Initialize ModalView with DOM elements
 * @param {Object} elements - Object containing DOM element references
 */
export const initModalView = (elements) => {
    detailsModal = elements.detailsModal;
    detailsModalTitle = elements.detailsModalTitle;
    saveBtn = elements.saveBtn;
    watchDateInput = elements.watchDateInput;
    rewatchCheckbox = elements.rewatchCheckbox;
    commentInput = elements.commentInput;
    formatInput = elements.formatInput;
    customPosterInput = elements.customPosterInput;
    detailsModalMessageBox = elements.detailsModalMessageBox;

    infoModal = elements.infoModal;
    infoTitle = elements.infoTitle;
    infoDirector = elements.infoDirector;
    infoGenres = elements.infoGenres;
    infoRuntime = elements.infoRuntime;
    infoDate = elements.infoDate;
    infoRewatch = elements.infoRewatch;
    infoFormat = elements.infoFormat;
    infoFormatP = elements.infoFormatP;
    infocomment = elements.infocomment;
    infocommentP = elements.infocommentP;
    imdbBtn = elements.imdbBtn;
    letterboxdBtn = elements.letterboxdBtn;

    deleteConfirmModal = elements.deleteConfirmModal;
    settingsModal = elements.settingsModal;
    searchOverlay = elements.searchOverlay;
};

/**
 * Opens the details modal for adding or editing a movie.
 * @param {Object} movie The movie object to add or edit.
 * @param {string} [entryId=null] The unique ID of the movie entry if editing.
 * @param {Array} watchedMovies - All watched movies for finding existing movie data
 * @returns {Object} The movie to add
 */
export const openDetailsModal = (movie, entryId, watchedMovies) => {
    detailsModalMessageBox.style.display = 'none';

    if (entryId !== null) { // Edit mode
        detailsModalTitle.textContent = `Edit details for: ${movie.title}`;
        saveBtn.textContent = 'Save Changes';

        const movieToEdit = watchedMovies.find(m => m.entryId === entryId);
        if (movieToEdit) {
            const rating = movieToEdit.userRating || "0";
            const stars = rating > 0
                ? `<div class="rating-stars-card">${renderStarsHtml(rating, true)}</div> <span>(${rating})</span>`
                : 'Select a rating...';
            selectRating(rating.toString(), stars);

            watchDateInput.value = movieToEdit.watchDate || '';
            rewatchCheckbox.checked = movieToEdit.isRewatch || false;
            commentInput.value = movieToEdit.comment || '';
            formatInput.value = movieToEdit.format || '';
            customPosterInput.value = movieToEdit.customPoster || '';
        }
    } else { // Add mode
        detailsModalTitle.textContent = `Add details for: ${movie.title}`;
        saveBtn.textContent = 'Add to List';

        selectRating("0", 'Select a rating...');

        watchDateInput.value = new Date().toISOString().split('T')[0];
        rewatchCheckbox.checked = false;
        commentInput.value = "";
        formatInput.value = "";
        customPosterInput.value = '';
    }

    detailsModal.style.display = 'block';
    return movie;
};

/**
 * Closes the details modal.
 */
export const closeDetailsModal = () => {
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
};

/**
 * Opens the modal to view movie details.
 * @param {Object} movie The movie object to display.
 */
export const openInfoModal = (movie) => {
    infoTitle.textContent = movie.title;
    infoDirector.textContent = movie.director || 'N/A';
    infoGenres.textContent = movie.genres && movie.genres.length > 0 ? movie.genres.join(', ') : 'N/A';
    infoRuntime.textContent = movie.runtime ? `${movie.runtime} min` : 'N/A';
    infoDate.textContent = movie.watchDate || 'N/A';
    infoRewatch.textContent = movie.isRewatch ? 'Yes' : 'No';

    // Set up external links
    imdbBtn.onclick = () => {
        window.electronAPI.send('open-external-link', `https://www.imdb.com/title/${movie.imdb_id}`);
    };
    letterboxdBtn.onclick = () => {
        if (movie.letterboxdUrl) {
            window.electronAPI.send('open-external-link', movie.letterboxdUrl);
        } else {
            window.electronAPI.send('open-external-link', `https://letterboxd.com/search/films/${encodeURIComponent(movie.title)}`);
        }
    };

    // Show or hide Watched On and Comments based on data
    if (movie.format) {
        infoFormat.textContent = movie.format;
        infoFormatP.style.display = 'block';
    } else {
        infoFormatP.style.display = 'none';
    }

    if (movie.comment) {
        infocomment.textContent = movie.comment;
        infocommentP.style.display = 'block';
    } else {
        infocommentP.style.display = 'none';
    }

    infoModal.style.display = 'block';
};

/**
 * Closes the movie info modal.
 */
export const closeInfoModal = () => {
    if (infoModal) {
        infoModal.style.display = 'none';
    }
};

/**
 * Shows the delete confirmation modal
 */
export const showDeleteConfirmModal = () => {
    if (deleteConfirmModal) {
        deleteConfirmModal.style.display = 'block';
    }
};

/**
 * Hides the delete confirmation modal
 */
export const hideDeleteConfirmModal = () => {
    if (deleteConfirmModal) {
        deleteConfirmModal.style.display = 'none';
    }
};

/**
 * Shows the settings modal
 */
export const showSettingsModal = () => {
    if (settingsModal) {
        settingsModal.style.display = 'block';
    }
};

/**
 * Hides the settings modal
 */
export const hideSettingsModal = () => {
    if (settingsModal) {
        settingsModal.style.display = 'none';
    }
};

/**
 * Shows the search overlay
 */
export const showSearchOverlay = () => {
    if (searchOverlay) {
        searchOverlay.classList.remove('search-overlay-hidden');
        searchOverlay.classList.add('search-overlay-visible');
    }
};

/**
 * Hides the search overlay
 */
export const hideSearchOverlay = () => {
    if (searchOverlay) {
        searchOverlay.classList.remove('search-overlay-visible');
        searchOverlay.classList.add('search-overlay-hidden');
    }
};

/**
 * Checks if search overlay is visible
 * @returns {boolean}
 */
export const isSearchOverlayVisible = () => {
    return searchOverlay && searchOverlay.classList.contains('search-overlay-visible');
};

/**
 * Checks if details modal is visible
 * @returns {boolean}
 */
export const isDetailsModalVisible = () => {
    return detailsModal && detailsModal.style.display === 'block';
};

/**
 * Checks if info modal is visible
 * @returns {boolean}
 */
export const isInfoModalVisible = () => {
    return infoModal && infoModal.style.display === 'block';
};

/**
 * Checks if delete confirm modal is visible
 * @returns {boolean}
 */
export const isDeleteConfirmModalVisible = () => {
    return deleteConfirmModal && deleteConfirmModal.style.display === 'block';
};

/**
 * Checks if settings modal is visible
 * @returns {boolean}
 */
export const isSettingsModalVisible = () => {
    return settingsModal && settingsModal.style.display === 'block';
};

/**
 * Gets form data from the details modal
 * @returns {Object} Form data
 */
export const getDetailsFormData = () => {
    return {
        userRating: parseFloat(document.getElementById('rating-value').value),
        watchDate: watchDateInput.value,
        isRewatch: rewatchCheckbox.checked,
        comment: commentInput.value.trim(),
        format: formatInput.value.trim(),
        customPoster: customPosterInput.value.trim()
    };
};

/**
 * Sets the custom poster input value
 * @param {string} value - The poster path
 */
export const setCustomPosterInput = (value) => {
    if (customPosterInput) {
        customPosterInput.value = value;
    }
};
