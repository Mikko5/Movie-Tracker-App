/**
 * UIHelpers - DOM utility functions for messages, stars, and images
 */

import { MOVIE_LIST_IMAGE_BASE_URL, PLACEHOLDER_BASE_URL } from '../model/MovieModel.js';

// DOM element references (set in init)
let messageBox = null;
let detailsModalMessageBox = null;
let ratingValue = null;
let ratingText = null;
let ratingContainer = null;
let ratingOptions = null;
let ratingTrigger = null;

/**
 * Initialize UI helper with DOM elements
 * @param {Object} elements - Object containing DOM element references
 */
export const initUIHelpers = (elements) => {
    messageBox = elements.messageBox;
    detailsModalMessageBox = elements.detailsModalMessageBox;
    ratingValue = elements.ratingValue;
    ratingText = elements.ratingText;
    ratingContainer = elements.ratingContainer;
    ratingOptions = elements.ratingOptions;
    ratingTrigger = elements.ratingTrigger;
};

/**
 * Displays a message in the main message box.
 * @param {string} message The message to display.
 * @param {string} type The type of message ('success' or 'error').
 */
export const showMessage = (message, type) => {
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = '';
    messageBox.classList.add(type);
    messageBox.style.display = 'block';
    setTimeout(() => {
        messageBox.style.display = 'none';
    }, 3000);
};

/**
 * Displays a message inside the add/edit movie modal.
 * @param {string} message The message to display.
 */
export const showDetailsModalMessage = (message) => {
    if (!detailsModalMessageBox) return;
    detailsModalMessageBox.textContent = message;
    detailsModalMessageBox.style.display = 'block';
    setTimeout(() => {
        detailsModalMessageBox.style.display = 'none';
    }, 3000);
};

/**
 * Renders the stars for a movie rating, returning HTML string.
 * @param {number} rating The movie's rating (0.5 to 5).
 * @param {boolean} isCard Whether to use the card-specific classes.
 * @returns {string} The HTML string for the stars.
 */
export const renderStarsHtml = (rating, isCard = false) => {
    let starsHtml = '';
    const roundedRating = Math.round(rating * 2) / 2;
    const baseClass = isCard ? 'rating-star-card' : 'rating-star';

    for (let i = 1; i <= 5; i++) {
        if (roundedRating >= i) {
            starsHtml += `<span class="${baseClass} filled">★</span>`;
        } else if (roundedRating === i - 0.5) {
            starsHtml += `<span class="${baseClass} half">★</span>`;
        } else {
            starsHtml += `<span class="${baseClass} empty">★</span>`;
        }
    }
    return starsHtml;
};

/**
 * Selects a rating in the custom dropdown.
 * @param {string} value The rating value.
 * @param {string} htmlContent The HTML content to display in the trigger.
 */
export const selectRating = (value, htmlContent) => {
    if (!ratingValue) return;
    ratingValue.value = value;
    if (value === '0') {
        ratingText.textContent = 'Select a rating...';
    } else {
        ratingText.innerHTML = htmlContent;
    }
    ratingContainer.classList.remove('open');

    // Update selected class
    const options = ratingOptions.querySelectorAll('.custom-option');
    options.forEach(opt => {
        if (opt.dataset.value === value) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
};

/**
 * Initializes the custom rating dropdown.
 */
export const initCustomRatingDropdown = () => {
    if (!ratingOptions) return;

    // Generate options
    ratingOptions.innerHTML = '';

    // Add "Select a rating..." option (value 0)
    const defaultOption = document.createElement('div');
    defaultOption.classList.add('custom-option');
    defaultOption.dataset.value = '0';
    defaultOption.textContent = 'Select a rating...';
    defaultOption.addEventListener('click', () => selectRating('0', 'Select a rating...'));
    ratingOptions.appendChild(defaultOption);

    // Add 0.5 to 5.0
    for (let i = 0.5; i <= 5; i += 0.5) {
        const option = document.createElement('div');
        option.classList.add('custom-option');
        option.dataset.value = i.toString();

        const stars = renderStarsHtml(i, true);
        option.innerHTML = `<div class="rating-stars-card">${stars}</div> <span>(${i})</span>`;

        option.addEventListener('click', () => selectRating(i.toString(), option.innerHTML));
        ratingOptions.appendChild(option);
    }

    // Toggle dropdown
    if (ratingTrigger) {
        ratingTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            ratingContainer.classList.toggle('open');
        });
    }

    // Close when clicking outside
    window.addEventListener('click', (e) => {
        if (ratingContainer && !ratingContainer.contains(e.target)) {
            ratingContainer.classList.remove('open');
        }
    });
};

/**
 * Creates an <img> element that will try each poster URL in order until one loads successfully.
 * @param {string[]} posterUrls - Array of poster image URLs to try, in order of preference.
 * @param {string} altText - The alt text for the image.
 * @returns {HTMLImageElement} The image element with fallback logic.
 */
export const createPosterImage = (posterUrls, altText) => {
    let posterIndex = 0;
    const img = document.createElement('img');
    img.alt = altText;
    img.src = posterUrls[posterIndex];
    img.onerror = function () {
        posterIndex++;
        if (posterIndex < posterUrls.length) {
            this.src = posterUrls[posterIndex];
        } else {
            this.onerror = null;
        }
    };
    return img;
};

/**
 * Formats a date string to DD-MM-YYYY format
 * @param {string} dateStr - The date string to format
 * @returns {string} Formatted date or 'N/A'
 */
export const formatDateDMY = (dateStr) => {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}-${month}-${year}`;
};

/**
 * A simple debounce function to limit API calls.
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};
