/**
 * MovieListView - Handles rendering of movie cards, filters, and search results
 */

import { MOVIE_LIST_IMAGE_BASE_URL, SEARCH_IMAGE_BASE_URL, PLACEHOLDER_BASE_URL } from '../model/MovieModel.js';
import { renderStarsHtml, createPosterImage, formatDateDMY } from './UIHelpers.js';

// DOM element references
let movieList = null;
let searchResultsContainer = null;
let filterGenreSelect = null;
let filterDirectorSelect = null;
let filterYearSelect = null;
let filterFormatSelect = null;
let filterPanel = null;
let sortSelect = null;

/**
 * Initialize MovieListView with DOM elements
 * @param {Object} elements - Object containing DOM element references
 */
export const initMovieListView = (elements) => {
    movieList = elements.movieList;
    searchResultsContainer = elements.searchResultsContainer;
    filterGenreSelect = elements.filterGenreSelect;
    filterDirectorSelect = elements.filterDirectorSelect;
    filterYearSelect = elements.filterYearSelect;
    filterFormatSelect = elements.filterFormatSelect;
    filterPanel = elements.filterPanel;
    sortSelect = elements.sortSelect;
};

/**
 * Populates all filter dropdowns based on the current movie list.
 * @param {Array} watchedMovies - The array of watched movies
 * @param {Object} currentFilters - Current filter values
 */
export const renderFilters = (watchedMovies, currentFilters) => {
    if (filterPanel && filterPanel.style.display !== 'none') {
        filterPanel.style.display = 'block';
    }

    const genres = new Set();
    const directors = new Set();
    const years = new Set();
    const formats = new Set();

    watchedMovies.forEach(movie => {
        if (movie.genres) {
            movie.genres.forEach(genre => genres.add(genre));
        }
        if (movie.director) {
            directors.add(movie.director);
        }
        if (movie.release_date) {
            years.add(movie.release_date.substring(0, 4));
        }
        if (movie.format) {
            formats.add(movie.format);
        }
    });

    // Populate Genre Filter
    filterGenreSelect.innerHTML = '<option value="all">All Genres</option>';
    Array.from(genres).sort().forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        filterGenreSelect.appendChild(option);
    });
    filterGenreSelect.value = currentFilters.genre;

    // Populate Director Filter
    filterDirectorSelect.innerHTML = '<option value="all">All Directors</option>';
    Array.from(directors).sort().forEach(director => {
        const option = document.createElement('option');
        option.value = director;
        option.textContent = director;
        filterDirectorSelect.appendChild(option);
    });
    filterDirectorSelect.value = currentFilters.director;

    // Populate Year Filter
    filterYearSelect.innerHTML = '<option value="all">All Years</option>';
    Array.from(years)
        .sort((a, b) => b - a)
        .forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            filterYearSelect.appendChild(option);
        });
    filterYearSelect.value = currentFilters.year;

    // Populate Format Filter
    filterFormatSelect.innerHTML = '<option value="all">All Formats</option>';
    Array.from(formats).sort().forEach(format => {
        const option = document.createElement('option');
        option.value = format;
        option.textContent = format;
        filterFormatSelect.appendChild(option);
    });
    filterFormatSelect.value = currentFilters.format;
};

/**
 * Renders the movies from the array to the DOM.
 * @param {Array} movies - Filtered and sorted movies array
 */
export const renderMovies = (movies) => {
    movieList.innerHTML = '';
    if (movies.length === 0) {
        movieList.innerHTML = `<p style="text-align: center; color: #aaa;">No movies match the current filter/sort options.</p>`;
        return;
    }

    movies.forEach((movie) => {
        const movieCard = document.createElement('li');
        movieCard.classList.add('movie-card');
        movieCard.dataset.entryId = movie.entryId;

        const ratingHtml = movie.userRating
            ? `<div class="rating-stars-card">${renderStarsHtml(movie.userRating, true)}</div>`
            : '<div class="rating-stars-card" style="height: 1.2rem;"></div>';
        const watchDate = movie.watchDate ? formatDateDMY(movie.watchDate) : 'N/A';
        const releaseYear = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';

        // Build URLs
        const customPosterUrl = movie.customPoster ? `${MOVIE_LIST_IMAGE_BASE_URL}${movie.customPoster}` : null;
        const originalPosterUrl = movie.poster_path ? `${MOVIE_LIST_IMAGE_BASE_URL}${movie.poster_path}` : null;
        const placeholderUrl = `${PLACEHOLDER_BASE_URL}/300x450/303030/dcdcdc?text=${encodeURIComponent(movie.title)}`;

        const posterUrls = [customPosterUrl, originalPosterUrl, placeholderUrl].filter(Boolean);
        const img = createPosterImage(posterUrls, `Poster for ${movie.title}`);

        movieCard.innerHTML = `
            <div class="movie-info">
                <h3 class="movie-card-title">${movie.title}</h3>
                <p class="movie-card-year">${releaseYear}</p>
                <div class="movie-card-details">
                    <span class="movie-card-date">${watchDate}</span>
                    ${ratingHtml}
                </div>
            </div>
        `;
        movieCard.prepend(img);

        movieList.appendChild(movieCard);

        // Adjust year margin
        const titleEl = movieCard.querySelector('.movie-card-title');
        const yearEl = movieCard.querySelector('.movie-card-year');
        if (titleEl && yearEl) {
            if (titleEl.offsetTop === yearEl.offsetTop) {
                yearEl.style.marginLeft = '6px';
            } else {
                yearEl.style.marginLeft = '0';
            }
        }
    });
};

/**
 * Renders search results to the DOM.
 * @param {Array} results The array of movie results from the API.
 * @param {string} searchValue Current search input value
 */
export const renderSearchResults = (results, searchValue = '') => {
    searchResultsContainer.innerHTML = '';
    if (results.length === 0 && searchValue.trim() !== '') {
        searchResultsContainer.innerHTML = `<p style="text-align: center; color: #aaa;">No results found. Try a different title.</p>`;
        return;
    }

    results.forEach(movie => {
        const resultItem = document.createElement('li');
        resultItem.classList.add('search-result-item');
        const posterUrl = movie.poster_path
            ? `${SEARCH_IMAGE_BASE_URL}${movie.poster_path}`
            : `${PLACEHOLDER_BASE_URL}/92x138/303030/dcdcdc?text=${encodeURIComponent(movie.title)}`;

        resultItem.innerHTML = `
            <img src="${posterUrl}" alt="Poster for ${movie.title}" onerror="this.onerror=null;this.src='${PLACEHOLDER_BASE_URL}/92x138/303030/dcdcdc?text=${encodeURIComponent(movie.title)}';">
            <div class="result-info">
                <h4>${movie.title}</h4>
                <p>${movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'}</p>
            </div>
            <button class="add-btn" data-tmdb-id="${movie.id}">Add</button>
        `;

        searchResultsContainer.appendChild(resultItem);
    });
};

/**
 * Clears the search results container
 */
export const clearSearchResults = () => {
    if (searchResultsContainer) {
        searchResultsContainer.innerHTML = '';
    }
};
