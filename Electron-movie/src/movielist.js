// Filter toggle logic
const filterToggleBtn = document.getElementById('filter-toggle-btn');
const filterPanel = document.getElementById('filter-panel');
// Hide filter panel by default
filterPanel.style.display = 'none';
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
// DOM elements
let tmdbApiKey = null;
const searchOverlay = document.getElementById('search-overlay');
const openSearchBtn = document.getElementById('open-search-btn');
const closeSearchBtn = document.getElementById('close-search-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResultsContainer = document.getElementById('search-results');
const movieList = document.getElementById('movie-list');
const messageBox = document.getElementById('message-box');
const sortSelect = document.getElementById('sort-select');
const filterGenreSelect = document.getElementById('filter-genre-select');
const filterDirectorSelect = document.getElementById('filter-director-select');
const filterYearSelect = document.getElementById('filter-year-select');
const filterFormatSelect = document.getElementById('filter-format-select');

// Details modal (add/edit) elements
const detailsModal = document.getElementById('movie-details-modal');
const detailsModalTitle = document.getElementById('modal-movie-title');
const detailsCloseBtn = document.querySelector('.add-close-btn');
const detailsForm = document.getElementById('details-form');
// Custom Rating Dropdown Elements
const ratingTrigger = document.getElementById('rating-trigger');
const ratingOptions = document.getElementById('rating-options');
const ratingValue = document.getElementById('rating-value');
const ratingText = document.getElementById('rating-text');
const ratingContainer = document.querySelector('.custom-select-container');
const watchDateInput = document.getElementById('watch-date-input');
const todayBtn = document.getElementById('today-btn');
const rewatchCheckbox = document.getElementById('rewatch-checkbox');
const commentInput = document.getElementById('comment-input');
const formatInput = document.getElementById('format-input');
const customPosterInput = document.getElementById('custom-poster-input')
const cancelBtn = document.getElementById('cancel-btn');
const saveBtn = document.getElementById('save-btn');
const detailsModalMessageBox = document.getElementById('modal-message-box');

// Movie info modal elements
const infoModal = document.getElementById('movie-info-modal');
const infoCloseBtn = document.querySelector('.info-close-btn');
const infoTitle = document.getElementById('info-modal-title');
const infoDirector = document.getElementById('info-director');
const infoGenres = document.getElementById('info-genres');
const infoRuntime = document.getElementById('info-runtime');
const infoDate = document.getElementById('info-date');
const infoRewatch = document.getElementById('info-rewatch');
const infocomment = document.getElementById('info-comment');
const infoFormat = document.getElementById('info-format');
const infoFormatP = document.getElementById('info-format-p');
const infocommentP = document.getElementById('info-comment-p');
const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-btn');
const imdbBtn = document.getElementById('imdb-btn');
const letterboxdBtn = document.getElementById('letterboxd-btn');

// Delete confirmation modal elements
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

// Settings modal elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.querySelector('.settings-close-btn');


// TMDB API Base URLs
const API_BASE_URL = 'https://api.themoviedb.org/3';
const SEARCH_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w92';
// const 
//      --url 'https://api.themoviedb.org/3/movie/1061474/images?include_image_language=null%2Cen' \

const MOVIE_LIST_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w300';
const PLACEHOLDER_BASE_URL = 'https://placehold.co';

// Main movie data array and a temporary object for the movie being added
let watchedMovies = [];
let movieToAdd = {};
let currentEntryId = null; // The unique ID of the movie being edited/viewed
let currentSort = 'date-desc';
let currentFilterGenre = 'all';
let currentFilterDirector = 'all';
let currentFilterYear = 'all';
let currentFilterFormat = 'all';

/**
 * Displays a message in the main message box.
 * @param {string} message The message to display.
 * @param {string} type The type of message ('success' or 'error').
 */
const showMessage = (message, type) => {
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
const showDetailsModalMessage = (message) => {
    detailsModalMessageBox.textContent = message;
    detailsModalMessageBox.style.display = 'block';
    setTimeout(() => {
        detailsModalMessageBox.style.display = 'none';
    }, 3000);
};

/**
 * Loads movies and API key from the main process.
 */
const loadState = async () => {
    // Load movies from movie-data.json via IPC
    const movies = await window.electronAPI.invoke('read-json');
    if (movies && !movies.error) {
        watchedMovies = movies;
    } else {
        watchedMovies = []; // Start with an empty list if file is empty or has an error
        if (movies.error) console.error("Error reading JSON:", movies.error);
    }

    // Load API key from main process
    tmdbApiKey = await window.electronAPI.invoke('get-api-key');
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not found. Please set it in the .env file.', 'error');
        searchInput.disabled = true;
        searchBtn.disabled = true;
    } else {
        searchInput.disabled = false;
        searchBtn.disabled = false;
    }

    // No need to load sort/filter from localStorage anymore, but we can keep the variables
    // Or reset them on each load
    currentSort = 'date-desc';
    sortSelect.value = currentSort;
    currentFilterGenre = 'all';
    currentFilterDirector = 'all';
    currentFilterYear = 'all';
    currentFilterFormat = 'all';

    renderFilters();
    renderMovies();
    initCustomRatingDropdown();

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
};

/**
 * Saves the current movies to movie-data.json via the main process.
 */
const saveState = async () => {
    const result = await window.electronAPI.invoke('write-json', watchedMovies);
    if (result.error) {
        showMessage('Failed to save movies.', 'error');
        console.error('Error writing JSON:', result.error);
    }
};

/**
 * Populates all filter dropdowns based on the current movie list.
 */
const renderFilters = () => {
    // If filter panel is open and there are no filter options, close it
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
    filterGenreSelect.value = currentFilterGenre;

    // Populate Director Filter
    filterDirectorSelect.innerHTML = '<option value="all">All Directors</option>';
    Array.from(directors).sort().forEach(director => {
        const option = document.createElement('option');
        option.value = director;
        option.textContent = director;
        filterDirectorSelect.appendChild(option);
    });
    filterDirectorSelect.value = currentFilterDirector;

    // Populate Year Filter from movies only
    filterYearSelect.innerHTML = '<option value="all">All Years</option>';
    Array.from(years)
        .sort((a, b) => b - a)
        .forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            filterYearSelect.appendChild(option);
        });
    filterYearSelect.value = currentFilterYear;

    // Populate Watched On (Format) Filter
    filterFormatSelect.innerHTML = '<option value="all">All Formats</option>';
    Array.from(formats).sort().forEach(format => {
        const option = document.createElement('option');
        option.value = format;
        option.textContent = format;
        filterFormatSelect.appendChild(option);
    });
    filterFormatSelect.value = currentFilterFormat;
};

/**
 * Renders the stars for a movie rating, returning HTML string.
 * @param {number} rating The movie's rating (0.5 to 5).
 * @param {boolean} isCard Whether to use the card-specific classes.
 * @returns {string} The HTML string for the stars.
 */
const renderStarsHtml = (rating, isCard = false) => {
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
const selectRating = (value, htmlContent) => {
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
const initCustomRatingDropdown = () => {
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

        const stars = renderStarsHtml(i, true); // Use card style for dropdown
        option.innerHTML = `<div class="rating-stars-card">${stars}</div> <span>(${i})</span>`;

        option.addEventListener('click', () => selectRating(i.toString(), option.innerHTML));
        ratingOptions.appendChild(option);
    }

    // Toggle dropdown
    if (ratingTrigger) {
        ratingTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent closing immediately
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
 * Renders the movies from the watchedMovies array to the DOM.
 */
const renderMovies = () => {
    // Filter movies based on the selected criteria
    const filteredMovies = watchedMovies.filter(movie => {
        const matchesGenre = currentFilterGenre === 'all' || (movie.genres && movie.genres.includes(currentFilterGenre));
        const matchesDirector = currentFilterDirector === 'all' || (movie.director && movie.director === currentFilterDirector);
        const matchesYear = currentFilterYear === 'all' || (movie.release_date && movie.release_date.substring(0, 4) === currentFilterYear);
        const matchesFormat = currentFilterFormat === 'all' || (movie.format && movie.format === currentFilterFormat);

        return matchesGenre && matchesDirector && matchesYear && matchesFormat;
    });

    // Sort the filtered movies
    filteredMovies.sort((a, b) => {
        switch (currentSort) {
            case 'date-desc':
                return new Date(b.watchDate) - new Date(a.watchDate);
            case 'date-asc':
                return new Date(a.watchDate) - new Date(b.watchDate);
            case 'rating-desc':
                return (b.userRating || 0) - (a.userRating || 0);
            case 'rating-asc':
                return (a.userRating || 0) - (b.userRating || 0);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            default:
                return 0;
        }
    });

    movieList.innerHTML = '';
    if (filteredMovies.length === 0) {
        movieList.innerHTML = `<p style="text-align: center; color: #aaa;">No movies match the current filter/sort options.</p>`;
        return;
    }

    function setPosterWithFallback(originalUrl, movie) {
        return originalUrl ? originalUrl : `${PLACEHOLDER_BASE_URL}/300x450/303030/dcdcdc?text=${encodeURIComponent(movie.title)}`;
    }

    function formatDateDMY(dateStr) {
        if (!dateStr) return 'N/A';
        const [year, month, day] = dateStr.split('T')[0].split('-');
        return `${day}-${month}-${year}`;
    }


    filteredMovies.forEach((movie) => {

        const movieCard = document.createElement('li');
        movieCard.classList.add('movie-card');
        movieCard.dataset.entryId = movie.entryId;

        const ratingHtml = movie.userRating ? `<div class="rating-stars-card">${renderStarsHtml(movie.userRating, true)}</div>` : '<div class="rating-stars-card" style="height: 1.2rem;"></div>';
        const watchDate = movie.watchDate ? formatDateDMY(movie.watchDate) : 'N/A';
        const releaseYear = movie.release_date ? movie.release_date.substring(0, 4) : 'N/A';

        // Build URLs
        const customPosterUrl = movie.customPoster ? `${MOVIE_LIST_IMAGE_BASE_URL}${movie.customPoster}` : null;
        const originalPosterUrl = movie.poster_path ? `${MOVIE_LIST_IMAGE_BASE_URL}${movie.poster_path}` : null;
        const placeholderUrl = `${PLACEHOLDER_BASE_URL}/300x450/303030/dcdcdc?text=${encodeURIComponent(movie.title)}`;


        // Create an array of poster URLs to try in order
        const posterUrls = [customPosterUrl, originalPosterUrl, placeholderUrl].filter(Boolean);
        const img = createPosterImage(posterUrls, `Poster for ${movie.title}`)

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
        movieCard.prepend(img)

        movieList.appendChild(movieCard);
        // Adjust year margin: if title and year on same line, add left margin, else reset
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
 * Creates an <img> element that will try each poster URL in order until one loads successfully.
 * If all fail, the last fallback is used.
 * @param {string[]} posterUrls - Array of poster image URLs to try, in order of preference.
 * @param {string} altText - The alt text for the image.
 * @returns {HTMLImageElement} The image element with fallback logic.
 */
function createPosterImage(posterUrls, altText) {
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
}

/**
 * Renders search results to the DOM.
 * @param {Array} results The array of movie results from the API.
 */
const renderSearchResults = (results) => {
    searchResultsContainer.innerHTML = '';
    if (results.length === 0 && searchInput.value.trim() !== '') {
        searchResultsContainer.innerHTML = `<p style="text-align: center; color: #aaa;">No results found. Try a different title.</p>`;
        return;
    }

    results.forEach(movie => {
        const resultItem = document.createElement('li');
        resultItem.classList.add('search-result-item');
        console.log(movie.poster_path)
        const posterUrl = movie.poster_path ? `${SEARCH_IMAGE_BASE_URL}${movie.poster_path}` : `${PLACEHOLDER_BASE_URL}/92x138/303030/dcdcdc?text=${encodeURIComponent(movie.title)}`;

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
 * Opens the details modal for adding or editing a movie.
 * @param {object} movie The movie object to add or edit.
 * @param {string} [entryId=null] The unique ID of the movie entry if editing.
 */
const openDetailsModal = (movie, entryId = null) => {
    currentEntryId = entryId;
    movieToAdd = movie;
    detailsModalMessageBox.style.display = 'none';

    if (entryId !== null) { // Edit mode
        detailsModalTitle.textContent = `Edit details for: ${movie.title}`;
        saveBtn.textContent = 'Save Changes';

        const movieToEdit = watchedMovies.find(m => m.entryId === entryId);
        if (movieToEdit) {
            const rating = movieToEdit.userRating || "0";
            const stars = rating > 0 ? `<div class="rating-stars-card">${renderStarsHtml(rating, true)}</div> <span>(${rating})</span>` : 'Select a rating...';
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
};

/**
 * Closes the details modal.
 */
const closeDetailsModal = () => {
    detailsModal.style.display = 'none';
};

/**
 * Opens the modal to view movie details.
 * @param {object} movie The movie object to display.
 */
const openInfoModal = (movie) => {
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
        window.electronAPI.send('open-external-link', `https://letterboxd.com/search/films/${encodeURIComponent(movie.title)}`);
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
const closeInfoModal = () => {
    infoModal.style.display = 'none';
};

/**
 * Fetches movies from TMDB based on a search query.
 * @param {string} query The movie title to search for.
 * @returns {Promise<object|null>} The search results object or null on failure.
 */
const searchMoviesByTitle = async (query) => {
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not loaded. Cannot search.', 'error');
        return null;
    }
    if (!query) {
        renderSearchResults([]);
        return null;
    }
    const headers = {
        'Authorization': `Bearer ${tmdbApiKey}`
    };
    try {
        const searchUrl = `${API_BASE_URL}/search/movie?query=${encodeURIComponent(query)}`;
        const searchResponse = await fetch(searchUrl, { headers });
        if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            showMessage(`API Error: ${errorData.status_message || 'Unknown error. Check your API key.'}`, 'error');
            return null;
        }
        const searchData = await searchResponse.json();
        return searchData.results;
    } catch (error) {
        showMessage('Failed to fetch search results. Please check your API key and network connection.', 'error');
        console.error('Fetch error:', error);
        return null;
    }
};

/**
 * Fetches a single movie's details by its TMDB ID.
 * @param {number} tmdbId The TMDB ID of the movie.
 * @returns {Promise<object|null>} The movie details object or null on failure.
 */
const getMovieDetails = async (tmdbId) => {
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not loaded. Cannot fetch movie details.', 'error');
        return null;
    }
    const headers = {
        'Authorization': `Bearer ${tmdbApiKey}`
    };
    try {
        const [movieResponse, creditsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/movie/${tmdbId}`, { headers }),
            fetch(`${API_BASE_URL}/movie/${tmdbId}/credits`, { headers })
        ]);
        if (!movieResponse.ok || !creditsResponse.ok) {
            const errorData = await (movieResponse.ok ? creditsResponse : movieResponse).json();
            showMessage(`API Error: ${errorData.status_message || 'Could not fetch movie details.'}`, 'error');
            return null;
        }
        const movieData = await movieResponse.json();
        const creditsData = await creditsResponse.json();
        const director = creditsData.crew.find(member => member.job === 'Director');
        const genres = movieData.genres.map(genre => genre.name);
        const fullMovieData = {
            id: movieData.id,
            entryId: crypto.randomUUID(), // Assign a unique ID for this specific entry
            title: movieData.title,
            poster_path: movieData.poster_path,
            release_date: movieData.release_date,
            runtime: movieData.runtime,
            genres: genres,
            director: director ? director.name : 'N/A',
            imdb_id: movieData.imdb_id
        };
        return fullMovieData;
    } catch (error) {
        showMessage('Failed to add movie. Please try again.', 'error');
        console.error('Add movie error:', error);
        return null;
    }
};



async function listAllPosters(movieToAdd, tmdbId) {
    console.log(tmdbId)
    if (!tmdbApiKey) {
        showMessage('TMDB API Key not loaded. Cannot fetch movie details.', 'error');
        return null;
    }
    const headers = {
        'Authorization': `Bearer ${tmdbApiKey}`
    };
    try {
        const posterResponse = await fetch(`${API_BASE_URL}/movie/${tmdbId}/images?include_image_language=null%2Cen`, { headers });
        const data = await posterResponse.json();
        if (data.posters && data.posters.length > 0) {

            const randomItem = data.posters[Math.floor(Math.random() * data.posters.length)];
            console.log(data.posters)
            console.log(randomItem.file_path)
            movieToAdd.customPoster = randomItem.file_path
            if (customPosterInput) {
                customPosterInput.value = randomItem.file_path;
            }
        } else {
            showMessage('No posters found for this movie.', 'error');
        }

    }
    catch (error) {
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const showPostersBtn = document.getElementById('show-poster-btn');
    if (showPostersBtn) {
        showPostersBtn.addEventListener('click', () => {
            if (movieToAdd && movieToAdd.id) {
                listAllPosters(movieToAdd, movieToAdd.id)
            } else {
                showMessage('No movie selected or TMDB ID missing.', 'error');
            }
        });
    }
});

/**
 * A simple debounce function to limit API calls.
 * @param {Function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 */
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

/**
 * Handles the deletion of a movie.
 */
const handleDelete = () => {
    const index = watchedMovies.findIndex(m => m.entryId === currentEntryId);
    if (index > -1) {
        watchedMovies.splice(index, 1);
        saveState();
        renderFilters();
        renderMovies();
        showMessage('Movie removed successfully!', 'success');
        closeInfoModal();
    }
};

// Debounced search handler
const debouncedSearch = debounce(async (query) => {
    if (query.length > 2) {
        const results = await searchMoviesByTitle(query);
        if (results) {
            renderSearchResults(results);
        }
    } else {
        renderSearchResults([]);
    }
}, 500);

// Event listeners
searchInput.addEventListener('input', (event) => {
    debouncedSearch(event.target.value.trim());
});

searchBtn.addEventListener('click', () => {
    searchInput.value = '';
    renderSearchResults([]);
    searchInput.focus();
});

openSearchBtn.addEventListener('click', () => {
    searchOverlay.classList.remove('search-overlay-hidden');
    searchOverlay.classList.add('search-overlay-visible');
    searchInput.focus();
});

closeSearchBtn.addEventListener('click', () => {
    searchOverlay.classList.remove('search-overlay-visible');
    searchOverlay.classList.add('search-overlay-hidden');
    searchInput.value = '';
    renderSearchResults([]);
});

sortSelect.addEventListener('change', (event) => {
    currentSort = event.target.value;
    renderMovies();
});

filterGenreSelect.addEventListener('change', (event) => {
    currentFilterGenre = event.target.value;
    renderMovies();
});

filterDirectorSelect.addEventListener('change', (event) => {
    currentFilterDirector = event.target.value;
    renderMovies();
});

filterYearSelect.addEventListener('change', (event) => {
    currentFilterYear = event.target.value;
    renderMovies();
});

filterFormatSelect.addEventListener('change', (event) => {
    currentFilterFormat = event.target.value;
    renderMovies();
});

// Use event delegation on the search results container
searchResultsContainer.addEventListener('click', async (event) => {
    const clickedButton = event.target.closest('.add-btn');
    if (clickedButton) {
        clickedButton.disabled = true;
        clickedButton.textContent = 'Adding...';

        const tmdbId = parseInt(clickedButton.dataset.tmdbId);
        const movieData = await getMovieDetails(tmdbId);

        if (movieData) {
            // Close the search overlay
            searchOverlay.classList.remove('search-overlay-visible');
            searchOverlay.classList.add('search-overlay-hidden');
            searchInput.value = '';
            renderSearchResults([]);

            // Open the details modal
            openDetailsModal(movieData);
        } else {
            // Re-enable button if getting details failed
            clickedButton.disabled = false;
            clickedButton.textContent = 'Add';
        }
    }
});

// Use event delegation on the movie list to open the info modal
movieList.addEventListener('click', (event) => {
    const movieCard = event.target.closest('.movie-card');
    if (movieCard) {
        const entryId = movieCard.dataset.entryId;
        const movie = watchedMovies.find(m => m.entryId === entryId);
        if (movie) {
            openInfoModal(movie);
            currentEntryId = entryId;
        }
    }
});

// Edit button inside the info modal
editBtn.addEventListener('click', () => {
    const movie = watchedMovies.find(m => m.entryId === currentEntryId);
    if (movie) {
        closeInfoModal();
        openDetailsModal(movie, currentEntryId);
    }
});

// Delete button inside the info modal
deleteBtn.addEventListener('click', () => {
    closeInfoModal();
    deleteConfirmModal.style.display = 'block';
});

// Confirm delete button
confirmDeleteBtn.addEventListener('click', () => {
    handleDelete();
    deleteConfirmModal.style.display = 'none';
});

// Cancel delete button
cancelDeleteBtn.addEventListener('click', () => {
    deleteConfirmModal.style.display = 'none';
});


// Details modal event listeners
detailsCloseBtn.addEventListener('click', closeDetailsModal);
cancelBtn.addEventListener('click', closeDetailsModal);

// Info movie modal event listener
infoCloseBtn.addEventListener('click', closeInfoModal);

// Close modals when clicking outside of them or pressing Escape
window.addEventListener('click', (event) => {
    if (event.target == detailsModal) {
        closeDetailsModal();
    }
    if (event.target == infoModal) {
        closeInfoModal();
    }
    if (event.target == deleteConfirmModal) {
        deleteConfirmModal.style.display = 'none';
    }
    if (event.target == settingsModal) {
        settingsModal.style.display = 'none';
    }
    if (event.target == searchOverlay) {
        searchOverlay.classList.remove('search-overlay-visible');
        searchOverlay.classList.add('search-overlay-hidden');
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (searchOverlay.classList.contains('search-overlay-visible')) {
            searchOverlay.classList.remove('search-overlay-visible');
            searchOverlay.classList.add('search-overlay-hidden');
        } else if (detailsModal.style.display === 'block') {
            closeDetailsModal();
        } else if (infoModal.style.display === 'block') {
            closeInfoModal();
        } else if (deleteConfirmModal.style.display === 'block') {
            deleteConfirmModal.style.display = 'none';
        } else if (settingsModal.style.display === 'block') {
            settingsModal.style.display = 'none';
        }
    }
});

// Settings modal event listeners
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });
}

if (settingsCloseBtn) {
    settingsCloseBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
}

todayBtn.addEventListener('click', () => {
    watchDateInput.value = new Date().toISOString().split('T')[0];
});

detailsForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const userRating = parseFloat(ratingValue.value);
    const watchDate = watchDateInput.value;
    const isRewatch = rewatchCheckbox.checked;
    const comment = commentInput.value.trim();
    const format = formatInput.value.trim();
    const customPoster = customPosterInput.value.trim();

    if (userRating === 0) {
        showDetailsModalMessage('Please provide a rating.');
        return;
    }
    if (!watchDate) {
        showDetailsModalMessage('Please provide a date watched.');
        return;
    }

    // Update movieToAdd with form data
    movieToAdd.userRating = userRating;
    movieToAdd.watchDate = watchDate;
    movieToAdd.isRewatch = isRewatch;
    movieToAdd.comment = comment;
    movieToAdd.format = format;
    movieToAdd.customPoster = customPoster

    if (currentEntryId !== null) { // Edit mode
        const index = watchedMovies.findIndex(m => m.entryId === currentEntryId);
        if (index > -1) {
            watchedMovies[index] = movieToAdd;
            showMessage(`${movieToAdd.title} updated successfully!`, 'success');
        }
    } else { // Add mode
        watchedMovies.push(movieToAdd);
        showMessage(`${movieToAdd.title} added successfully!`, 'success');
    }

    saveState();
    renderFilters();
    renderMovies();

    closeDetailsModal();
    searchInput.value = '';
    renderSearchResults([]);
});

// Save location button handler
document.getElementById('select-save-location-btn').addEventListener('click', async () => {
    const result = await window.electronAPI.invoke('select-save-location');
    if (result.success) {
        showMessage('Save location updated successfully!', 'success');
        // Reload the data from the new location
        loadState();
    }
});

// Listen for JSON file changes
window.electronAPI.onJsonUpdated(() => {
    loadState();
});

// Initial load
window.onload = function () {
    loadState();
    // Reset filters logic
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            filterGenreSelect.value = 'all';
            filterDirectorSelect.value = 'all';
            filterYearSelect.value = 'all';
            filterFormatSelect.value = 'all';
            currentFilterGenre = 'all';
            currentFilterDirector = 'all';
            currentFilterYear = 'all';
            currentFilterFormat = 'all';
            renderMovies();
        });
    }
};
// --- movie-data.json parse/modify logic ---
document.addEventListener('DOMContentLoaded', () => {
    const modifyBtn = document.getElementById('modify-test-json-btn');
    if (modifyBtn) {
        modifyBtn.addEventListener('click', async () => {
            // This button is for demonstration and doesn't write to the file system in the renderer.
            // The actual file I/O is handled via IPC in saveState().
            console.log('Button clicked. Current movie data:', watchedMovies);
            alert('This button is for testing. Check the console for the current movie data.');
        });
    }
});
