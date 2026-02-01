/**
 * Tests for SearchController - Search input and TMDB selection
 */

// Mock dependencies before importing
jest.mock('../../src/model/ApiService.js', () => ({
    searchMoviesByTitle: jest.fn(),
    getMovieDetails: jest.fn()
}));

jest.mock('../../src/model/MovieModel.js', () => ({
    setMovieToAdd: jest.fn()
}));

jest.mock('../../src/view/MovieListView.js', () => ({
    renderSearchResults: jest.fn()
}));

jest.mock('../../src/view/ModalView.js', () => ({
    showSearchOverlay: jest.fn(),
    hideSearchOverlay: jest.fn()
}));

jest.mock('../../src/controller/ModalManager.js', () => ({
    push: jest.fn(),
    pop: jest.fn()
}));

jest.mock('../../src/view/UIHelpers.js', () => ({
    showMessage: jest.fn(),
    debounce: (fn) => fn  // Return function directly for testing
}));

import * as SearchController from '../../src/controller/SearchController.js';
import * as ApiService from '../../src/model/ApiService.js';
import * as MovieListView from '../../src/view/MovieListView.js';
import * as ModalManager from '../../src/controller/ModalManager.js';

describe('SearchController', () => {
    let searchInput;
    let searchBtn;
    let searchResultsContainer;
    let openSearchBtn;
    let closeSearchBtn;
    let mockOnMovieSelected;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Create DOM elements
        searchInput = document.createElement('input');
        searchInput.id = 'search-input';

        searchBtn = document.createElement('button');
        searchBtn.id = 'search-btn';

        searchResultsContainer = document.createElement('div');
        searchResultsContainer.id = 'search-results';

        openSearchBtn = document.createElement('button');
        openSearchBtn.id = 'open-search-btn';

        closeSearchBtn = document.createElement('button');
        closeSearchBtn.id = 'close-search-btn';

        document.body.appendChild(searchInput);
        document.body.appendChild(searchBtn);
        document.body.appendChild(searchResultsContainer);
        document.body.appendChild(openSearchBtn);
        document.body.appendChild(closeSearchBtn);

        mockOnMovieSelected = jest.fn();

        SearchController.initSearchController({
            searchInput,
            searchBtn,
            searchResultsContainer,
            searchOverlay: document.createElement('div'),
            openSearchBtn,
            closeSearchBtn
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('initSearchController', () => {
        test('stores DOM element references', () => {
            SearchController.setupSearchListeners(mockOnMovieSelected);

            // Open search button should work
            openSearchBtn.click();
            expect(ModalManager.push).toHaveBeenCalledWith('search');
        });
    });

    describe('setupSearchListeners', () => {
        beforeEach(() => {
            SearchController.setupSearchListeners(mockOnMovieSelected);
        });

        test('open search button opens overlay via ModalManager', () => {
            openSearchBtn.click();
            expect(ModalManager.push).toHaveBeenCalledWith('search');
        });

        test('close search button closes overlay and clears search', () => {
            closeSearchBtn.click();

            expect(ModalManager.pop).toHaveBeenCalled();
            expect(searchInput.value).toBe('');
            expect(MovieListView.renderSearchResults).toHaveBeenCalledWith([], '');
        });

        test('clear button clears input and results', () => {
            searchInput.value = 'test query';
            searchBtn.click();

            expect(searchInput.value).toBe('');
            expect(MovieListView.renderSearchResults).toHaveBeenCalledWith([], '');
        });

        test('search input triggers API search for queries > 2 chars', async () => {
            const mockResults = [{ id: 1, title: 'Test Movie' }];
            ApiService.searchMoviesByTitle.mockResolvedValue(mockResults);

            searchInput.value = 'test';
            searchInput.dispatchEvent(new Event('input'));

            // Wait for debounce and async
            await Promise.resolve();

            expect(ApiService.searchMoviesByTitle).toHaveBeenCalledWith('test', expect.any(Function));
        });

        test('search input clears results for queries <= 2 chars', () => {
            searchInput.value = 'ab';
            searchInput.dispatchEvent(new Event('input'));

            expect(MovieListView.renderSearchResults).toHaveBeenCalledWith([], '');
        });
    });

    describe('Search result selection', () => {
        beforeEach(() => {
            SearchController.setupSearchListeners(mockOnMovieSelected);
        });

        test('clicking add button fetches movie details and calls callback', async () => {
            const mockMovieDetails = { id: 123, title: 'Selected Movie' };
            ApiService.getMovieDetails.mockResolvedValue(mockMovieDetails);

            // Create add button in results container
            const addBtn = document.createElement('button');
            addBtn.classList.add('add-btn');
            addBtn.dataset.tmdbId = '123';
            addBtn.textContent = 'Add';
            searchResultsContainer.appendChild(addBtn);

            addBtn.click();

            // Wait for async operations
            await Promise.resolve();

            expect(ApiService.getMovieDetails).toHaveBeenCalledWith(123, expect.any(Function));
        });

        test('re-enables add button when getMovieDetails fails', async () => {
            ApiService.getMovieDetails.mockResolvedValue(null);

            const addBtn = document.createElement('button');
            addBtn.classList.add('add-btn');
            addBtn.dataset.tmdbId = '123';
            addBtn.textContent = 'Add';
            searchResultsContainer.appendChild(addBtn);

            addBtn.click();

            // Wait for async operations
            await Promise.resolve();
            await Promise.resolve(); // Extra tick for the else branch

            expect(addBtn.disabled).toBe(false);
            expect(addBtn.textContent).toBe('Add');
        });
    });

    describe('clearSearch', () => {
        test('clears input and resets results', () => {
            SearchController.initSearchController({
                searchInput,
                searchBtn,
                searchResultsContainer,
                searchOverlay: document.createElement('div'),
                openSearchBtn,
                closeSearchBtn
            });

            searchInput.value = 'some query';
            SearchController.clearSearch();

            expect(searchInput.value).toBe('');
            expect(MovieListView.renderSearchResults).toHaveBeenCalledWith([], '');
        });
    });
});
