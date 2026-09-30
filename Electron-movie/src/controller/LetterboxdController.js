/**
 * LetterboxdController - Handles all UI logic for Letterboxd Syncing and Bulk Import
 */

import * as MovieModel from '../model/MovieModel.js';
import * as ApiService from '../model/ApiService.js';
import * as ModalManager from './ModalManager.js';
import { showMessage } from '../view/UIHelpers.js';
import { refreshFiltersAndView } from './MovieController.js';

let letterboxdUsernameInput = null;
let saveLetterboxdBtn = null;
let syncLetterboxdBtn = null;
let letterboxdSyncStatus = null;
let letterboxdExportLink = null;
let letterboxdDropZone = null;
let letterboxdFileInput = null;
let letterboxdBulkStatusContainer = null;
let letterboxdBulkStatus = null;
let letterboxdEnrichmentBarContainer = null;
let letterboxdEnrichmentBar = null;
let syncModalTitle = null;
let syncConfirmStats = null;
let syncConfirmModal = null;
let syncConfirmMessage = null;
let syncMoviesList = null;
let cancelSyncBtn = null;
let confirmSyncBtn = null;

let newLetterboxdMovies = []; // Stores movies pending sync/import confirmation
let isBulkImport = false;
let isEnriching = false;

export const initLetterboxdController = (elements) => {
    letterboxdUsernameInput = elements.letterboxdUsernameInput;
    saveLetterboxdBtn = elements.saveLetterboxdBtn;
    syncLetterboxdBtn = elements.syncLetterboxdBtn;
    letterboxdSyncStatus = elements.letterboxdSyncStatus;
    letterboxdExportLink = elements.letterboxdExportLink;
    letterboxdDropZone = elements.letterboxdDropZone;
    letterboxdFileInput = elements.letterboxdFileInput;
    letterboxdBulkStatusContainer = elements.letterboxdBulkStatusContainer;
    letterboxdBulkStatus = elements.letterboxdBulkStatus;
    letterboxdEnrichmentBarContainer = elements.letterboxdEnrichmentBarContainer;
    letterboxdEnrichmentBar = elements.letterboxdEnrichmentBar;
    syncModalTitle = elements.syncModalTitle;
    syncConfirmStats = elements.syncConfirmStats;
    syncConfirmModal = elements.syncConfirmModal;
    syncConfirmMessage = elements.syncConfirmMessage;
    syncMoviesList = elements.syncMoviesList;
    cancelSyncBtn = elements.cancelSyncBtn;
    confirmSyncBtn = elements.confirmSyncBtn;

    ModalManager.register('syncConfirm', {
        open: () => { if (syncConfirmModal) syncConfirmModal.style.display = 'block'; },
        close: () => { if (syncConfirmModal) syncConfirmModal.style.display = 'none'; },
        isVisible: () => syncConfirmModal && syncConfirmModal.style.display === 'block'
    });
};

export const loadLetterboxdState = async () => {
    const settings = await window.electronAPI.invoke('get-letterboxd-settings');
    if (letterboxdUsernameInput && settings.username) {
        letterboxdUsernameInput.value = settings.username;
        if (syncLetterboxdBtn) syncLetterboxdBtn.style.display = 'inline-block';
    } else {
        if (syncLetterboxdBtn) syncLetterboxdBtn.style.display = 'none';
    }
};

/**
 * Background worker: enriches newly imported movies with TMDB posters and details
 * respecting the Cloudflare proxy rate limits (~280ms pacing, auto-resumes after app restart)
 */
export const startBackgroundEnrichment = async () => {
    if (isEnriching) return;
    
    const watched = MovieModel.getWatchedMovies();
    const pending = watched.filter(m => !m.poster_path);
    if (pending.length === 0) return;

    isEnriching = true;
    if (letterboxdBulkStatusContainer) letterboxdBulkStatusContainer.style.display = 'block';
    if (letterboxdEnrichmentBarContainer) letterboxdEnrichmentBarContainer.style.display = 'block';

    const total = pending.length;
    let completed = 0;

    for (const movie of pending) {
        try {
            if (letterboxdBulkStatus) {
                letterboxdBulkStatus.textContent = `Enriching movie posters: ${completed + 1} of ${total} (${movie.title})...`;
            }
            if (letterboxdEnrichmentBar) {
                letterboxdEnrichmentBar.style.width = `${Math.round(((completed) / total) * 100)}%`;
            }

            // Pacing: 280ms interval to stay comfortably under 40 requests / 10s
            await new Promise(resolve => setTimeout(resolve, 280));

            const searchResults = await ApiService.searchMoviesByTitle(movie.title, () => {});
            if (searchResults && searchResults.length > 0) {
                const releaseYear = (movie.release_date || '').slice(0, 4);
                const match = searchResults.find(r => r.release_date && r.release_date.startsWith(releaseYear)) || searchResults[0];

                if (match) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                    const fullDetails = await ApiService.getMovieDetails(match.id, () => {});
                    if (fullDetails) {
                        const updated = {
                            ...movie,
                            id: fullDetails.id,
                            poster_path: fullDetails.poster_path,
                            customPoster: movie.customPoster || fullDetails.poster_path,
                            release_date: fullDetails.release_date || movie.release_date,
                            runtime: fullDetails.runtime || movie.runtime,
                            genres: fullDetails.genres || movie.genres,
                            imdb_id: fullDetails.imdb_id || movie.imdb_id,
                            director: fullDetails.director || movie.director,
                            score: fullDetails.score || movie.score
                        };

                        MovieModel.updateMovie(movie.entryId, updated);
                        await window.electronAPI.invoke('db:update-movie', movie.entryId, updated);
                        refreshFiltersAndView({ preserveScroll: true });
                    }
                }
            }
        } catch (err) {
            console.error('Error enriching movie:', movie.title, err);
        }

        completed++;
        if (letterboxdEnrichmentBar) {
            letterboxdEnrichmentBar.style.width = `${Math.round((completed / total) * 100)}%`;
        }
    }

    isEnriching = false;
    if (letterboxdBulkStatus) {
        letterboxdBulkStatus.textContent = `Completed enriching ${total} movies!`;
    }
    if (letterboxdEnrichmentBar) {
        letterboxdEnrichmentBar.style.width = '100%';
    }
    setTimeout(() => {
        if (!isEnriching && letterboxdEnrichmentBarContainer) {
            letterboxdEnrichmentBarContainer.style.display = 'none';
        }
    }, 4000);
};

/**
 * Handles ZIP file validation and import preparation
 * @param {File} file 
 */
export const handleZipImport = async (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
        showMessage('Please drop a valid .zip archive from Letterboxd.', 'error');
        return;
    }

    if (letterboxdBulkStatusContainer) letterboxdBulkStatusContainer.style.display = 'block';
    if (letterboxdBulkStatus) letterboxdBulkStatus.textContent = 'Validating Letterboxd export ZIP...';

    try {
        let result;
        // In Electron, dropped files typically have a path property
        if (file.path) {
            result = await window.electronAPI.invoke('parse-letterboxd-zip', file.path);
        } else {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            result = await window.electronAPI.invoke('parse-letterboxd-zip', buffer);
        }

        if (result.error) {
            if (letterboxdBulkStatus) letterboxdBulkStatus.textContent = `Error: ${result.error}`;
            showMessage(result.error, 'error');
            return;
        }

        const { totalFound, duplicatesSkipped, newMovies } = result;

        if (newMovies.length === 0) {
            const msg = `All ${totalFound} movies are already in your library!`;
            if (letterboxdBulkStatus) letterboxdBulkStatus.textContent = msg;
            showMessage(msg, 'info');
            return;
        }

        if (letterboxdBulkStatus) {
            letterboxdBulkStatus.textContent = `Found ${newMovies.length} new movies (${duplicatesSkipped} already in library).`;
        }

        // Prepare confirmation modal
        isBulkImport = true;
        newLetterboxdMovies = newMovies;

        if (syncModalTitle) syncModalTitle.textContent = 'Bulk Import from Letterboxd';
        if (syncConfirmStats) {
            syncConfirmStats.style.display = 'block';
            syncConfirmStats.innerHTML = `
                <div><strong>Total Found:</strong> ${totalFound}</div>
                <div><strong>Already in Library:</strong> ${duplicatesSkipped} (skipped)</div>
                <div style="color: #00e054;"><strong>New Movies to Import:</strong> ${newMovies.length}</div>
            `;
        }

        if (syncConfirmMessage) {
            syncConfirmMessage.textContent = `Add these ${newMovies.length} new movies to your library?`;
        }

        if (syncMoviesList) {
            syncMoviesList.innerHTML = '';
            newMovies.forEach(movie => {
                const li = document.createElement('li');
                const watchDateText = movie.watchDate ? ` ${movie.watchDate}` : '';
                li.textContent = `${movie.title}${watchDateText}`;
                li.style.marginBottom = '6px';
                li.style.borderBottom = '1px solid #333';
                li.style.paddingBottom = '4px';
                syncMoviesList.appendChild(li);
            });
        }

        ModalManager.push('syncConfirm');
    } catch (err) {
        console.error('Failed to handle Letterboxd ZIP:', err);
        showMessage(err.message || 'Failed to read ZIP file', 'error');
        if (letterboxdBulkStatus) letterboxdBulkStatus.textContent = 'Import failed.';
    }
};

export const setupEventListeners = () => {
    if (saveLetterboxdBtn && letterboxdUsernameInput) {
        saveLetterboxdBtn.addEventListener('click', async () => {
            const username = letterboxdUsernameInput.value.trim();
            const settings = await window.electronAPI.invoke('get-letterboxd-settings');
            settings.username = username;
            await window.electronAPI.invoke('set-letterboxd-settings', settings);
            if (username) {
                if (syncLetterboxdBtn) syncLetterboxdBtn.style.display = 'inline-block';
            } else {
                if (syncLetterboxdBtn) syncLetterboxdBtn.style.display = 'none';
            }
            showMessage('Letterboxd username saved!');
        });
    }

    if (letterboxdExportLink) {
        letterboxdExportLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.send('open-external-link', 'https://letterboxd.com/user/exportdata/');
        });
    }

    // Drag and drop zone handling
    if (letterboxdDropZone) {
        letterboxdDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            letterboxdDropZone.classList.add('dragover');
        });

        letterboxdDropZone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            letterboxdDropZone.classList.add('dragover');
        });

        letterboxdDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            letterboxdDropZone.classList.remove('dragover');
        });

        letterboxdDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            letterboxdDropZone.classList.remove('dragover');

            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length > 0) {
                handleZipImport(files[0]);
            }
        });

        letterboxdDropZone.addEventListener('click', () => {
            if (letterboxdFileInput) {
                letterboxdFileInput.value = '';
                letterboxdFileInput.click();
            }
        });
    }

    if (letterboxdFileInput) {
        letterboxdFileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                handleZipImport(files[0]);
            }
        });
    }

    if (syncLetterboxdBtn) {
        syncLetterboxdBtn.addEventListener('click', async () => {
            if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = 'Fetching RSS feed...';
            syncLetterboxdBtn.disabled = true;

            const settings = await window.electronAPI.invoke('get-letterboxd-settings');
            if (!settings.username) {
                if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = 'Please save a username first.';
                syncLetterboxdBtn.disabled = false;
                return;
            }

            // Fetch all RSS items by passing null for lastSyncId
            const result = await window.electronAPI.invoke('fetch-letterboxd-rss', settings.username, null);
            syncLetterboxdBtn.disabled = false;

            if (result.error) {
                if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = `Sync failed: ${result.error}`;
                return;
            }

            // Cross-reference with our local database to find truly new movies
            const watchedMovies = MovieModel.getWatchedMovies();
            const existingSyncIds = new Set(watchedMovies.map(m => m.letterboxdSyncId).filter(Boolean));
            const existingUrls = new Set(watchedMovies.map(m => m.letterboxdUrl).filter(Boolean));

            // Extract numeric digits from existing sync IDs
            const existingNumericIds = new Set();
            watchedMovies.forEach(m => {
                if (m.letterboxdSyncId) {
                    const digits = String(m.letterboxdSyncId).replace(/\D/g, '');
                    if (digits) existingNumericIds.add(digits);
                }
            });

            const allItems = result.newMovies || [];
            const newMovies = allItems.filter(movie => {
                // 1. Direct letterboxdId match
                if (existingSyncIds.has(movie.letterboxdId)) return false;

                // 2. Numeric ID match (connects RSS to bulk import!)
                const movieDigits = String(movie.letterboxdId).replace(/\D/g, '');
                if (movieDigits && existingNumericIds.has(movieDigits)) return false;

                // 3. Direct URL match
                if (movie.link && existingUrls.has(movie.link)) return false;

                // 4. Fallback Title + Year + Watched Date match
                const isDuplicate = watchedMovies.some(existing => {
                    const matchTitle = existing.title && existing.title.trim().toLowerCase() === movie.title.trim().toLowerCase();
                    const matchYear = (existing.release_date || '').slice(0, 4) === String(movie.year);
                    const existingDate = String(existing.watchDate || '').slice(0, 10);
                    const movieDate = String(movie.pubDate || '').slice(0, 10);
                    return matchTitle && matchYear && existingDate && movieDate && existingDate === movieDate;
                });

                return !isDuplicate;
            });

            if (newMovies.length === 0) {
                if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = 'Already up to date!';
                return;
            }

            if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = `Found ${newMovies.length} new movies!`;
            
            // Show confirmation modal
            isBulkImport = false;
            newLetterboxdMovies = newMovies;
            if (syncModalTitle) syncModalTitle.textContent = 'Sync New Movies from Letterboxd';
            if (syncConfirmStats) syncConfirmStats.style.display = 'none';
            if (syncConfirmMessage) syncConfirmMessage.textContent = `Found ${newMovies.length} new movies. Add them to your local library?`;
            
            if (syncMoviesList) {
                syncMoviesList.innerHTML = '';
                newMovies.forEach(movie => {
                    const li = document.createElement('li');
                    const watchDateText = movie.pubDate ? ` ${movie.pubDate.slice(0, 10)}` : '';
                    li.textContent = `${movie.title}${watchDateText}`;
                    li.style.marginBottom = '5px';
                    li.style.borderBottom = '1px solid #333';
                    li.style.paddingBottom = '5px';
                    syncMoviesList.appendChild(li);
                });
            }
            
            ModalManager.push('syncConfirm');
        });
    }

    if (cancelSyncBtn) {
        cancelSyncBtn.addEventListener('click', () => {
            newLetterboxdMovies = [];
            isBulkImport = false;
            ModalManager.pop();
        });
    }

    if (confirmSyncBtn) {
        confirmSyncBtn.addEventListener('click', async () => {
            confirmSyncBtn.disabled = true;

            // Handle Bulk Import (Fast tier + Background enrichment)
            if (isBulkImport) {
                confirmSyncBtn.textContent = 'Importing...';
                try {
                    // Bulk insert into SQLite database
                    await window.electronAPI.invoke('db:bulk-add', newLetterboxdMovies);
                    
                    // Add to in-memory MovieModel state
                    newLetterboxdMovies.forEach(m => MovieModel.addMovie(m));
                    refreshFiltersAndView();

                    showMessage(`Successfully imported ${newLetterboxdMovies.length} movies!`, 'success');
                    if (letterboxdBulkStatus) {
                        letterboxdBulkStatus.textContent = `Imported ${newLetterboxdMovies.length} movies! Background poster sync starting...`;
                    }

                    const importedCount = newLetterboxdMovies.length;
                    newLetterboxdMovies = [];
                    isBulkImport = false;
                    confirmSyncBtn.disabled = false;
                    confirmSyncBtn.textContent = 'Confirm & Add';
                    ModalManager.pop();

                    // Trigger crash-resilient background enrichment
                    startBackgroundEnrichment();
                } catch (err) {
                    console.error('Failed to complete bulk import:', err);
                    showMessage('Bulk import failed. Please try again.', 'error');
                    confirmSyncBtn.disabled = false;
                    confirmSyncBtn.textContent = 'Confirm & Add';
                }
                return;
            }

            // Normal RSS Sync confirmation handling
            confirmSyncBtn.textContent = 'Adding...';

            let count = 0;
            // Iterate in reverse so oldest new movie is added first
            for (let i = newLetterboxdMovies.length - 1; i >= 0; i--) {
                const lbMovie = newLetterboxdMovies[i];
                
                // Pacing: brief 150ms breather between movies to smooth API traffic
                if (count > 0) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }

                // Update progress on button
                confirmSyncBtn.textContent = `Adding (${newLetterboxdMovies.length - i}/${newLetterboxdMovies.length})...`;
                
                // Fetch TMDB data
                let movieToAdd;
                let tmdbData = null;
                
                if (lbMovie.tmdbId) {
                    tmdbData = { id: lbMovie.tmdbId };
                } else {
                    const searchResults = await ApiService.searchMoviesByTitle(lbMovie.title, showMessage);
                    if (searchResults && searchResults.length > 0) {
                        const match = searchResults.find(r => r.release_date && r.release_date.startsWith(String(lbMovie.year))) || searchResults[0];
                        tmdbData = match;
                    }
                }
                
                if (tmdbData) {
                    const fullDetails = await ApiService.getMovieDetails(tmdbData.id, showMessage);
                    if (fullDetails) {
                        let watchDateStr = new Date().toISOString().split('T')[0];
                        if (lbMovie.pubDate) {
                            try {
                                watchDateStr = new Date(lbMovie.pubDate).toISOString().split('T')[0];
                            } catch (e) {
                                watchDateStr = lbMovie.pubDate.substring(0, 10);
                            }
                        }

                        movieToAdd = {
                            ...fullDetails,
                            userRating: lbMovie.rating || 0,
                            watchDate: watchDateStr,
                            isRewatch: lbMovie.isRewatch || false,
                            comment: '',
                            format: '',
                            customPoster: '',
                            letterboxdSyncId: lbMovie.letterboxdId,
                            letterboxdUrl: lbMovie.link
                        };
                    }
                }
                
                // Fallback if search or details failed
                if (!movieToAdd) {
                    let watchDateStr = new Date().toISOString().split('T')[0];
                    if (lbMovie.pubDate) {
                        try {
                            watchDateStr = new Date(lbMovie.pubDate).toISOString().split('T')[0];
                        } catch (e) {
                            watchDateStr = lbMovie.pubDate.substring(0, 10);
                        }
                    }
                    
                    movieToAdd = {
                        entryId: Date.now().toString() + Math.random().toString(36).substring(2),
                        id: Date.now() + Math.random(),
                        title: lbMovie.title,
                        poster_path: null,
                        release_date: lbMovie.year ? `${lbMovie.year}-01-01` : '',
                        runtime: 0,
                        genres: [],
                        director: 'N/A',
                        imdb_id: '',
                        userRating: lbMovie.rating || 0,
                        watchDate: watchDateStr,
                        isRewatch: lbMovie.isRewatch || false,
                        comment: '',
                        format: '',
                        customPoster: '',
                        letterboxdSyncId: lbMovie.letterboxdId,
                        letterboxdUrl: lbMovie.link
                    };
                }
                
                MovieModel.addMovie(movieToAdd);
                count++;
            }

            // Save state
            await MovieModel.saveState(showMessage);
            refreshFiltersAndView();
            showMessage(`Added ${count} movies from Letterboxd!`, 'success');

            newLetterboxdMovies = [];
            confirmSyncBtn.disabled = false;
            confirmSyncBtn.textContent = 'Confirm & Add';
            if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = 'Sync complete!';
            
            ModalManager.pop();
        });
    }
};

