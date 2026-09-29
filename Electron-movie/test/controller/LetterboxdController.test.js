import * as LetterboxdController from '../../src/controller/LetterboxdController.js';
import * as ModalManager from '../../src/controller/ModalManager.js';
import * as MovieModel from '../../src/model/MovieModel.js';
import * as ApiService from '../../src/model/ApiService.js';

// Mock dependencies
jest.mock('../../src/controller/ModalManager.js', () => ({
    push: jest.fn(),
    pop: jest.fn(),
    register: jest.fn()
}));

jest.mock('../../src/model/MovieModel.js', () => ({
    getWatchedMovies: jest.fn(),
    addMovie: jest.fn(),
    saveState: jest.fn()
}));

jest.mock('../../src/model/ApiService.js', () => ({
    searchMoviesByTitle: jest.fn(),
    getMovieDetails: jest.fn()
}));

jest.mock('../../src/view/UIHelpers.js', () => ({
    showMessage: jest.fn()
}));

jest.mock('../../src/controller/MovieController.js', () => ({
    refreshFiltersAndView: jest.fn()
}));

describe('LetterboxdController', () => {
    let elements;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup DOM elements
        document.body.innerHTML = `
            <input id="letterboxd-username-input" />
            <button id="save-letterboxd-btn"></button>
            <button id="sync-letterboxd-btn"></button>
            <div id="letterboxd-sync-status"></div>
            <div id="sync-confirm-modal"></div>
            <div id="sync-confirm-message"></div>
            <ul id="sync-movies-list"></ul>
            <button id="cancel-sync-btn"></button>
            <button id="confirm-sync-btn"></button>
        `;

        elements = {
            letterboxdUsernameInput: document.getElementById('letterboxd-username-input'),
            saveLetterboxdBtn: document.getElementById('save-letterboxd-btn'),
            syncLetterboxdBtn: document.getElementById('sync-letterboxd-btn'),
            letterboxdSyncStatus: document.getElementById('letterboxd-sync-status'),
            syncConfirmModal: document.getElementById('sync-confirm-modal'),
            syncConfirmMessage: document.getElementById('sync-confirm-message'),
            syncMoviesList: document.getElementById('sync-movies-list'),
            cancelSyncBtn: document.getElementById('cancel-sync-btn'),
            confirmSyncBtn: document.getElementById('confirm-sync-btn')
        };

        // Mock window.electronAPI
        window.electronAPI = {
            invoke: jest.fn()
        };

        LetterboxdController.initLetterboxdController(elements);
        LetterboxdController.setupEventListeners();
    });

    test('saving username invokes set-letterboxd-settings', async () => {
        elements.letterboxdUsernameInput.value = 'testuser';
        window.electronAPI.invoke.mockResolvedValueOnce({ username: '' }).mockResolvedValueOnce(true);

        elements.saveLetterboxdBtn.click();

        // Wait for async operations
        await new Promise(process.nextTick);

        expect(window.electronAPI.invoke).toHaveBeenCalledWith('get-letterboxd-settings');
        expect(window.electronAPI.invoke).toHaveBeenCalledWith('set-letterboxd-settings', { username: 'testuser' });
        expect(elements.syncLetterboxdBtn.style.display).toBe('inline-block');
    });

    test('saving empty username hides sync button', async () => {
        elements.letterboxdUsernameInput.value = '   ';
        window.electronAPI.invoke.mockResolvedValueOnce({ username: 'olduser' }).mockResolvedValueOnce(true);

        elements.saveLetterboxdBtn.click();

        await new Promise(process.nextTick);

        expect(window.electronAPI.invoke).toHaveBeenCalledWith('set-letterboxd-settings', { username: '' });
        expect(elements.syncLetterboxdBtn.style.display).toBe('none');
    });

    test('loadLetterboxdState populates username and shows sync button if set', async () => {
        window.electronAPI.invoke.mockResolvedValueOnce({ username: 'saveduser' });
        
        await LetterboxdController.loadLetterboxdState();
        
        expect(elements.letterboxdUsernameInput.value).toBe('saveduser');
        expect(elements.syncLetterboxdBtn.style.display).toBe('inline-block');
    });

    test('loadLetterboxdState hides sync button if no username is set', async () => {
        window.electronAPI.invoke.mockResolvedValueOnce({ username: '' });
        
        await LetterboxdController.loadLetterboxdState();
        
        expect(elements.syncLetterboxdBtn.style.display).toBe('none');
    });

    test('sync button shows error if no username saved', async () => {
        window.electronAPI.invoke.mockResolvedValueOnce({}); // no username

        elements.syncLetterboxdBtn.click();

        await new Promise(process.nextTick);

        expect(elements.letterboxdSyncStatus.textContent).toBe('Please save a username first.');
    });

    test('sync button fetches rss and shows confirm modal for new movies', async () => {
        window.electronAPI.invoke.mockImplementation((channel) => {
            if (channel === 'get-letterboxd-settings') return Promise.resolve({ username: 'testuser' });
            if (channel === 'fetch-letterboxd-rss') return Promise.resolve({ 
                newMovies: [
                    { title: 'New Movie 1', letterboxdId: '123' },
                    { title: 'New Movie 2', letterboxdId: '456' }
                ]
            });
            return Promise.resolve();
        });

        MovieModel.getWatchedMovies.mockReturnValue([{ letterboxdSyncId: 'old-1' }]);

        elements.syncLetterboxdBtn.click();

        // Wait a couple of ticks for promises to resolve
        await new Promise(process.nextTick);
        await new Promise(process.nextTick);

        expect(elements.letterboxdSyncStatus.textContent).toBe('Found 2 new movies!');
        expect(elements.syncMoviesList.children).toHaveLength(2);
        expect(ModalManager.push).toHaveBeenCalledWith('syncConfirm');
    });

    test('confirmSyncBtn adds new movies with TMDB details and saves state', async () => {
        window.electronAPI.invoke.mockImplementation((channel) => {
            if (channel === 'get-letterboxd-settings') return Promise.resolve({ username: 'testuser' });
            if (channel === 'fetch-letterboxd-rss') return Promise.resolve({
                newMovies: [
                    { title: 'New Movie 1', letterboxdId: '123', tmdbId: 101, rating: 4, pubDate: '2026-09-20' }
                ]
            });
            return Promise.resolve();
        });

        MovieModel.getWatchedMovies.mockReturnValue([]);
        ApiService.getMovieDetails.mockResolvedValueOnce({
            id: 101,
            title: 'New Movie 1',
            poster_path: '/poster.jpg',
            director: 'Director One',
            genres: ['Drama'],
            runtime: 110
        });

        // 1. Trigger sync to populate newLetterboxdMovies
        elements.syncLetterboxdBtn.click();
        await new Promise(resolve => setTimeout(resolve, 10));

        // 2. Click confirm sync
        elements.confirmSyncBtn.click();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(ApiService.getMovieDetails).toHaveBeenCalledWith(101, expect.any(Function));
        expect(MovieModel.addMovie).toHaveBeenCalledWith(expect.objectContaining({
            id: 101,
            title: 'New Movie 1',
            userRating: 4,
            director: 'Director One',
            watchDate: '2026-09-20'
        }));
        expect(MovieModel.saveState).toHaveBeenCalled();
        expect(ModalManager.pop).toHaveBeenCalled();
    });

    test('handleZipImport validates zip extension', async () => {
        const file = { name: 'movies.txt' };
        await LetterboxdController.handleZipImport(file);
        const { showMessage } = require('../../src/view/UIHelpers.js');
        expect(showMessage).toHaveBeenCalledWith('Please drop a valid .zip archive from Letterboxd.', 'error');
    });

    test('handleZipImport invokes parse-letterboxd-zip and shows confirm modal', async () => {
        window.electronAPI.invoke.mockImplementation((channel) => {
            if (channel === 'parse-letterboxd-zip') {
                return Promise.resolve({
                    success: true,
                    totalFound: 10,
                    duplicatesSkipped: 2,
                    newMovies: [
                        { title: 'Zip Movie 1', release_date: '2024-01-01', userRating: 4, watchDate: '2024-01-02' }
                    ]
                });
            }
            return Promise.resolve();
        });

        const file = { name: 'letterboxd-export.zip', path: '/path/to/export.zip' };
        await LetterboxdController.handleZipImport(file);

        expect(window.electronAPI.invoke).toHaveBeenCalledWith('parse-letterboxd-zip', '/path/to/export.zip');
        expect(ModalManager.push).toHaveBeenCalledWith('syncConfirm');
        expect(elements.syncMoviesList.children).toHaveLength(1);
        expect(elements.syncMoviesList.children[0].textContent).toBe('Zip Movie 1 2024-01-02');
    });

    test('confirmSyncBtn handles bulk import via db:bulk-add', async () => {
        window.electronAPI.invoke.mockImplementation((channel) => {
            if (channel === 'parse-letterboxd-zip') {
                return Promise.resolve({
                    success: true,
                    totalFound: 1,
                    duplicatesSkipped: 0,
                    newMovies: [
                        { entryId: 'e1', title: 'Bulk Movie', release_date: '2024-01-01', userRating: 4, watchDate: '2024-01-02' }
                    ]
                });
            }
            if (channel === 'db:bulk-add') {
                return Promise.resolve(1);
            }
            return Promise.resolve();
        });

        const file = { name: 'letterboxd-export.zip', path: '/path/to/export.zip' };
        await LetterboxdController.handleZipImport(file);

        // Click confirm
        elements.confirmSyncBtn.click();
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(window.electronAPI.invoke).toHaveBeenCalledWith('db:bulk-add', expect.any(Array));
        expect(MovieModel.addMovie).toHaveBeenCalledWith(expect.objectContaining({ title: 'Bulk Movie' }));
        expect(ModalManager.pop).toHaveBeenCalled();
    });
});

