/**
 * PosterGridView - Handles the poster selection grid modal
 */

// Native TMDB w300 resolution (crisp quality, lightweight ~21KB payload)
const POSTER_THUMBNAIL_URL = 'https://image.tmdb.org/t/p/w300';

// DOM elements
let posterModal = null;
let posterGrid = null;
let posterCloseBtn = null;
let modalCloseHandler = null;

// State
let allPosters = [];
let loadedCount = 0;
let onPosterSelect = null;
let isLoadingMore = false;
const INITIAL_LOAD = 25;  // 5x5 grid
const LOAD_MORE = 10;     // 2 rows

/**
 * Initialize PosterGridView with DOM elements
 * @param {Object} elements - Object containing DOM element references
 * @param {Function} [onClose] - Optional handler to pop modal from stack
 */
export const initPosterGridView = (elements, onClose = null) => {
    posterModal = elements.posterModal;
    posterGrid = elements.posterGrid;
    posterCloseBtn = elements.posterCloseBtn;
    modalCloseHandler = onClose;

    // Close button event
    if (posterCloseBtn) {
        posterCloseBtn.addEventListener('click', () => {
            if (modalCloseHandler) {
                modalCloseHandler();
            } else {
                closePosterModal();
            }
        });
    }

    // Click outside to close
    if (posterModal) {
        posterModal.addEventListener('click', (e) => {
            if (e.target === posterModal) {
                if (modalCloseHandler) {
                    modalCloseHandler();
                } else {
                    closePosterModal();
                }
            }
        });
    }

    // Setup infinite scroll
    if (posterGrid) {
        posterGrid.addEventListener('scroll', handleScroll, { passive: true });
    }
};

/**
 * Opens the poster modal with all available posters
 * @param {Array} posters - Array of poster paths
 * @param {Function} selectCallback - Callback when a poster is selected
 */
export const openPosterModal = (posters, selectCallback) => {
    if (!posterModal || !posterGrid) return;

    allPosters = posters;
    loadedCount = 0;
    onPosterSelect = selectCallback;

    // Clear previous content
    posterGrid.innerHTML = '';

    // Load initial batch
    renderPosterBatch(0, INITIAL_LOAD);

    // Show modal
    posterModal.style.display = 'block';
};

/**
 * Closes the poster modal
 */
export const closePosterModal = () => {
    if (posterModal) {
        posterModal.style.display = 'none';
    }
    allPosters = [];
    loadedCount = 0;
    isLoadingMore = false;
    onPosterSelect = null;
};

/**
 * Renders a batch of posters to the grid using DocumentFragment
 * @param {number} startIndex - Starting index in allPosters array
 * @param {number} count - Number of posters to render
 */
const renderPosterBatch = (startIndex, count) => {
    const endIndex = Math.min(startIndex + count, allPosters.length);
    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i < endIndex; i++) {
        const posterPath = allPosters[i];
        const posterItem = document.createElement('div');
        posterItem.classList.add('poster-item');
        posterItem.dataset.path = posterPath;

        const img = document.createElement('img');
        img.loading = 'lazy';  // Native lazy loading
        img.src = `${POSTER_THUMBNAIL_URL}${posterPath}`;
        img.alt = `Poster option ${i + 1}`;

        posterItem.appendChild(img);
        posterItem.addEventListener('click', () => handlePosterClick(posterPath));
        fragment.appendChild(posterItem);
    }

    posterGrid.appendChild(fragment);
    loadedCount = endIndex;
};

/**
 * Handles poster click - selects the poster and closes modal
 * @param {string} posterPath - The selected poster path
 */
const handlePosterClick = (posterPath) => {
    if (onPosterSelect) {
        onPosterSelect(posterPath);
    }
    if (modalCloseHandler) {
        modalCloseHandler();
    } else {
        closePosterModal();
    }
};

/**
 * Handles scroll event for infinite loading
 */
const handleScroll = () => {
    if (!posterGrid || isLoadingMore) return;

    const { scrollTop, scrollHeight, clientHeight } = posterGrid;

    // Load more when within 100px of bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
        if (loadedCount < allPosters.length) {
            isLoadingMore = true;
            renderPosterBatch(loadedCount, LOAD_MORE);
            isLoadingMore = false;
        }
    }
};

/**
 * Checks if poster modal is visible
 * @returns {boolean}
 */
export const isPosterModalVisible = () => {
    return posterModal && posterModal.style.display === 'block';
};
