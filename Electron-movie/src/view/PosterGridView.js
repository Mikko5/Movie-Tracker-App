/**
 * PosterGridView - Handles the poster selection grid modal
 */

// Use higher resolution for poster grid thumbnails
const POSTER_THUMBNAIL_URL = 'https://image.tmdb.org/t/p/w300';

// DOM elements
let posterModal = null;
let posterGrid = null;
let posterCloseBtn = null;

// State
let allPosters = [];
let loadedCount = 0;
let onPosterSelect = null;
const INITIAL_LOAD = 25;  // 5x5 grid
const LOAD_MORE = 10;     // 2 rows

/**
 * Initialize PosterGridView with DOM elements
 * @param {Object} elements - Object containing DOM element references
 */
export const initPosterGridView = (elements) => {
    posterModal = elements.posterModal;
    posterGrid = elements.posterGrid;
    posterCloseBtn = elements.posterCloseBtn;

    // Close button event
    if (posterCloseBtn) {
        posterCloseBtn.addEventListener('click', closePosterModal);
    }

    // Click outside to close
    if (posterModal) {
        posterModal.addEventListener('click', (e) => {
            if (e.target === posterModal) {
                closePosterModal();
            }
        });
    }

    // Setup infinite scroll
    if (posterGrid) {
        posterGrid.addEventListener('scroll', handleScroll);
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
    onPosterSelect = null;
};

/**
 * Renders a batch of posters to the grid
 * @param {number} startIndex - Starting index in allPosters array
 * @param {number} count - Number of posters to render
 */
const renderPosterBatch = (startIndex, count) => {
    const endIndex = Math.min(startIndex + count, allPosters.length);

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
        posterGrid.appendChild(posterItem);
    }

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
    closePosterModal();
};

/**
 * Handles scroll event for infinite loading
 */
const handleScroll = () => {
    if (!posterGrid) return;

    const { scrollTop, scrollHeight, clientHeight } = posterGrid;

    // Load more when within 100px of bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
        if (loadedCount < allPosters.length) {
            renderPosterBatch(loadedCount, LOAD_MORE);
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
