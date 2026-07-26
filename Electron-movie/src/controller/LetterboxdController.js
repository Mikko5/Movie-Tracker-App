/**
 * LetterboxdController - Handles all UI logic for Letterboxd Syncing
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
let syncConfirmModal = null;
let syncConfirmMessage = null;
let syncMoviesList = null;
let cancelSyncBtn = null;
let confirmSyncBtn = null;

let newLetterboxdMovies = []; // Stores movies pending sync confirmation

export const initLetterboxdController = (elements) => {
    letterboxdUsernameInput = elements.letterboxdUsernameInput;
    saveLetterboxdBtn = elements.saveLetterboxdBtn;
    syncLetterboxdBtn = elements.syncLetterboxdBtn;
    letterboxdSyncStatus = elements.letterboxdSyncStatus;
    syncConfirmModal = elements.syncConfirmModal;
    syncConfirmMessage = elements.syncConfirmMessage;
    syncMoviesList = elements.syncMoviesList;
    cancelSyncBtn = elements.cancelSyncBtn;
    confirmSyncBtn = elements.confirmSyncBtn;

    ModalManager.register('syncConfirm', {
        open: () => { if(syncConfirmModal) syncConfirmModal.style.display = 'block'; },
        close: () => { if(syncConfirmModal) syncConfirmModal.style.display = 'none'; },
        isVisible: () => syncConfirmModal && syncConfirmModal.style.display === 'block'
    });
};

export const setupEventListeners = () => {
    if (saveLetterboxdBtn && letterboxdUsernameInput) {
        saveLetterboxdBtn.addEventListener('click', async () => {
            const username = letterboxdUsernameInput.value.trim();
            const settings = await window.electronAPI.invoke('get-letterboxd-settings');
            settings.username = username;
            await window.electronAPI.invoke('set-letterboxd-settings', settings);
            showMessage('Letterboxd username saved!');
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

            // Cross-reference with our local JSON database to find truly new movies
            const watchedMovies = MovieModel.getWatchedMovies();
            const existingSyncIds = new Set(watchedMovies.map(m => m.letterboxdSyncId).filter(Boolean));
            
            // Result from main process contains all items because we passed null for lastSyncId
            const allItems = result.newMovies || [];
            const newMovies = allItems.filter(movie => !existingSyncIds.has(movie.letterboxdId));

            if (newMovies.length === 0) {
                if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = 'Already up to date!';
                return;
            }

            if (letterboxdSyncStatus) letterboxdSyncStatus.textContent = `Found ${newMovies.length} new movies!`;
            
            // Show confirmation modal
            newLetterboxdMovies = newMovies;
            if (syncConfirmMessage) syncConfirmMessage.textContent = `Found ${newMovies.length} new movies. Add them to your local library?`;
            
            if (syncMoviesList) {
                syncMoviesList.innerHTML = '';
                newMovies.forEach(movie => {
                    const li = document.createElement('li');
                    li.textContent = movie.title;
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
            ModalManager.pop();
        });
    }

    if (confirmSyncBtn) {
        confirmSyncBtn.addEventListener('click', async () => {
            confirmSyncBtn.disabled = true;
            confirmSyncBtn.textContent = 'Adding...';

            let count = 0;
            // Iterate in reverse so oldest new movie is added first
            for (let i = newLetterboxdMovies.length - 1; i >= 0; i--) {
                const lbMovie = newLetterboxdMovies[i];
                
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
                        tmdbData = searchResults[0]; // Take first match
                    }
                }
                
                if (tmdbData) {
                    const fullDetails = await ApiService.getMovieDetails(tmdbData.id, showMessage);
                    if (fullDetails) {
                        // Safely format the date to YYYY-MM-DD
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
                            letterboxdSyncId: lbMovie.letterboxdId
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
                        letterboxdSyncId: lbMovie.letterboxdId
                    };
                }
                
                MovieModel.addMovie(movieToAdd);
                count++;

                // Small delay to prevent TMDB rate limiting (40 req/sec max, but play it safe)
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Save state
            MovieModel.saveState(showMessage);
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
