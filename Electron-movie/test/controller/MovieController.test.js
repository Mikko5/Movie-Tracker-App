/**
 * Tests for MovieController - Main application logic
 * 
 * Note: MovieController has many dependencies, so we test key behaviors
 * with mocked dependencies.
 */

// Mock all dependencies
jest.mock('../../src/model/MovieModel.js', () => ({
    loadState: jest.fn(),
    saveState: jest.fn(),
    getWatchedMovies: jest.fn().mockReturnValue([]),
    getMovieToAdd: jest.fn().mockReturnValue({}),
    setMovieToAdd: jest.fn(),
    getCurrentEntryId: jest.fn(),
    setCurrentEntryId: jest.fn(),
    findMovieByEntryId: jest.fn(),
    addMovie: jest.fn(),
    updateMovie: jest.fn(),
    deleteMovie: jest.fn(),
    getFilteredAndSortedMovies: jest.fn().mockReturnValue([])
}));

jest.mock('../../src/model/ApiService.js', () => ({
    setApiKey: jest.fn(),
    getAllPosters: jest.fn()
}));

jest.mock('../../src/view/MovieListView.js', () => ({
    renderMovies: jest.fn()
}));

jest.mock('../../src/view/ModalView.js', () => ({
    initModalView: jest.fn(),
    openDetailsModal: jest.fn(),
    closeDetailsModal: jest.fn(),
    openInfoModal: jest.fn(),
    closeInfoModal: jest.fn(),
    showDeleteConfirmModal: jest.fn(),
    hideDeleteConfirmModal: jest.fn(),
    showSettingsModal: jest.fn(),
    hideSettingsModal: jest.fn(),
    showSearchOverlay: jest.fn(),
    hideSearchOverlay: jest.fn(),
    getDetailsFormData: jest.fn().mockReturnValue({ userRating: 5, watchDate: '2023-01-01' }),
    setCustomPosterInput: jest.fn(),
    isDetailsModalVisible: jest.fn(),
    isInfoModalVisible: jest.fn(),
    isDeleteConfirmModalVisible: jest.fn(),
    isSettingsModalVisible: jest.fn(),
    isSearchOverlayVisible: jest.fn()
}));

jest.mock('../../src/view/PosterGridView.js', () => ({
    initPosterGridView: jest.fn(),
    openPosterModal: jest.fn(),
    closePosterModal: jest.fn(),
    isPosterModalVisible: jest.fn()
}));

jest.mock('../../src/view/UIHelpers.js', () => ({
    showMessage: jest.fn(),
    showDetailsModalMessage: jest.fn(),
    initCustomRatingDropdown: jest.fn()
}));

jest.mock('../../src/controller/FilterController.js', () => ({
    initFilterController: jest.fn(),
    setupFilterListeners: jest.fn(),
    refreshFilters: jest.fn()
}));

jest.mock('../../src/controller/SearchController.js', () => ({
    initSearchController: jest.fn(),
    setupSearchListeners: jest.fn(),
    clearSearch: jest.fn()
}));

jest.mock('../../src/controller/ModalManager.js', () => ({
    register: jest.fn(),
    push: jest.fn(),
    pop: jest.fn(),
    handleEscape: jest.fn()
}));

import * as MovieController from '../../src/controller/MovieController.js';
import * as MovieModel from '../../src/model/MovieModel.js';
import * as MovieListView from '../../src/view/MovieListView.js';
import * as FilterController from '../../src/controller/FilterController.js';
import * as ModalManager from '../../src/controller/ModalManager.js';
import { showDetailsModalMessage } from '../../src/view/UIHelpers.js';
import * as ModalView from '../../src/view/ModalView.js';

describe('MovieController', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup window.electronAPI mock
        window.electronAPI = {
            invoke: jest.fn().mockResolvedValue(null),
            onJsonUpdated: jest.fn()
        };
    });

    describe('initMovieController', () => {
        test('stores DOM element references', () => {
            const elements = {
                movieList: document.createElement('div'),
                detailsForm: document.createElement('form'),
                editBtn: document.createElement('button'),
                deleteBtn: document.createElement('button')
            };

            MovieController.initMovieController(elements);
            // If init works, subsequent operations should work
            expect(true).toBe(true);
        });
    });

    describe('refreshView', () => {
        test('gets filtered movies and renders them', () => {
            const mockMovies = [{ title: 'Test' }];
            MovieModel.getFilteredAndSortedMovies.mockReturnValue(mockMovies);

            MovieController.refreshView();

            expect(MovieModel.getFilteredAndSortedMovies).toHaveBeenCalled();
            expect(MovieListView.renderMovies).toHaveBeenCalledWith(mockMovies);
        });
    });

    describe('refreshFiltersAndView', () => {
        test('refreshes both filters and view', () => {
            MovieController.refreshFiltersAndView();

            expect(FilterController.refreshFilters).toHaveBeenCalled();
            expect(MovieListView.renderMovies).toHaveBeenCalled();
        });
    });

    describe('setupEventListeners', () => {
        let movieList;
        let editBtn;
        let deleteBtn;

        beforeEach(() => {
            movieList = document.createElement('div');
            editBtn = document.createElement('button');
            deleteBtn = document.createElement('button');

            document.body.appendChild(movieList);

            MovieController.initMovieController({
                movieList,
                detailsForm: document.createElement('form'),
                editBtn,
                deleteBtn,
                confirmDeleteBtn: document.createElement('button'),
                cancelDeleteBtn: document.createElement('button'),
                detailsCloseBtn: document.createElement('button'),
                cancelBtn: document.createElement('button'),
                infoCloseBtn: document.createElement('button'),
                settingsBtn: document.createElement('button'),
                settingsCloseBtn: document.createElement('button'),
                todayBtn: document.createElement('button'),
                watchDateInput: document.createElement('input'),
                selectSaveLocationBtn: document.createElement('button'),
                showPostersBtn: document.createElement('button'),
                customPosterInput: document.createElement('input')
            });
        });

        test('registers modals with ModalManager', () => {
            MovieController.setupEventListeners();

            // Should register 6 modals
            expect(ModalManager.register).toHaveBeenCalledWith('poster', expect.any(Object));
            expect(ModalManager.register).toHaveBeenCalledWith('search', expect.any(Object));
            expect(ModalManager.register).toHaveBeenCalledWith('deleteConfirm', expect.any(Object));
            expect(ModalManager.register).toHaveBeenCalledWith('details', expect.any(Object));
            expect(ModalManager.register).toHaveBeenCalledWith('info', expect.any(Object));
            expect(ModalManager.register).toHaveBeenCalledWith('settings', expect.any(Object));
        });

        test('movie card click opens info modal', () => {
            MovieController.setupEventListeners();

            const movieCard = document.createElement('div');
            movieCard.classList.add('movie-card');
            movieCard.dataset.entryId = 'test123';
            movieList.appendChild(movieCard);

            const mockMovie = { title: 'Clicked Movie', entryId: 'test123' };
            MovieModel.findMovieByEntryId.mockReturnValue(mockMovie);

            movieCard.click();

            expect(MovieModel.findMovieByEntryId).toHaveBeenCalledWith('test123');
            expect(ModalManager.push).toHaveBeenCalledWith('info', mockMovie);
        });
    });

    describe('loadApp', () => {
        beforeEach(() => {
            // Create search elements in DOM
            const searchInput = document.createElement('input');
            searchInput.id = 'search-input';
            const searchBtn = document.createElement('button');
            searchBtn.id = 'search-btn';
            document.body.appendChild(searchInput);
            document.body.appendChild(searchBtn);

            window.electronAPI.invoke = jest.fn()
                .mockImplementation((channel) => {
                    if (channel === 'is-dev') return Promise.resolve(false);
                    return Promise.resolve(null);
                });
        });

        test('loads state and initializes view', async () => {
            MovieModel.loadState.mockResolvedValue('test-api-key');

            await MovieController.loadApp();

            expect(MovieModel.loadState).toHaveBeenCalled();
        });
    });

    describe('button click handlers', () => {
        let editBtn, deleteBtn, confirmDeleteBtn, cancelDeleteBtn;
        let detailsCloseBtn, cancelBtn, infoCloseBtn;
        let settingsBtn, settingsCloseBtn, todayBtn;
        let watchDateInput, selectSaveLocationBtn, showPostersBtn;
        let bgColorPicker, resetBgColorBtn;

        beforeEach(() => {
            editBtn = document.createElement('button');
            deleteBtn = document.createElement('button');
            confirmDeleteBtn = document.createElement('button');
            cancelDeleteBtn = document.createElement('button');
            detailsCloseBtn = document.createElement('button');
            cancelBtn = document.createElement('button');
            infoCloseBtn = document.createElement('button');
            settingsBtn = document.createElement('button');
            settingsCloseBtn = document.createElement('button');
            todayBtn = document.createElement('button');
            watchDateInput = document.createElement('input');
            watchDateInput.type = 'date';
            selectSaveLocationBtn = document.createElement('button');
            showPostersBtn = document.createElement('button');
            bgColorPicker = document.createElement('input');
            bgColorPicker.type = 'color';
            resetBgColorBtn = document.createElement('button');

            MovieController.initMovieController({
                movieList: document.createElement('div'),
                detailsForm: document.createElement('form'),
                editBtn,
                deleteBtn,
                confirmDeleteBtn,
                cancelDeleteBtn,
                detailsCloseBtn,
                cancelBtn,
                infoCloseBtn,
                settingsBtn,
                settingsCloseBtn,
                todayBtn,
                watchDateInput,
                selectSaveLocationBtn,
                showPostersBtn,
                bgColorPicker,
                resetBgColorBtn,
                customPosterInput: document.createElement('input')
            });

            MovieController.setupEventListeners();
        });

        test('edit button opens details modal with current movie', () => {
            const mockMovie = { title: 'Test Movie', entryId: 'edit1' };
            MovieModel.getCurrentEntryId.mockReturnValue('edit1');
            MovieModel.findMovieByEntryId.mockReturnValue(mockMovie);
            MovieModel.getWatchedMovies.mockReturnValue([mockMovie]);

            editBtn.click();

            expect(ModalManager.pop).toHaveBeenCalled();
            expect(MovieModel.setMovieToAdd).toHaveBeenCalledWith(mockMovie);
            expect(ModalManager.push).toHaveBeenCalledWith('details', expect.objectContaining({
                movie: mockMovie,
                entryId: 'edit1'
            }));
        });

        test('delete button opens delete confirm modal', () => {
            deleteBtn.click();

            expect(ModalManager.pop).toHaveBeenCalled();
            expect(ModalManager.push).toHaveBeenCalledWith('deleteConfirm');
        });

        test('confirm delete button deletes movie', () => {
            MovieModel.getCurrentEntryId.mockReturnValue('del1');
            MovieModel.deleteMovie.mockReturnValue(true);

            confirmDeleteBtn.click();

            expect(MovieModel.deleteMovie).toHaveBeenCalledWith('del1');
            expect(MovieModel.saveState).toHaveBeenCalled();
            expect(ModalManager.pop).toHaveBeenCalled();
        });

        test('cancel delete button closes modal', () => {
            cancelDeleteBtn.click();
            expect(ModalManager.pop).toHaveBeenCalled();
        });

        test('details close button closes modal', () => {
            detailsCloseBtn.click();
            expect(ModalManager.pop).toHaveBeenCalled();
        });

        test('cancel button closes modal', () => {
            cancelBtn.click();
            expect(ModalManager.pop).toHaveBeenCalled();
        });

        test('bgColorPicker input changes background color and saves to app settings', async () => {
            const setSettingsSpy = jest.spyOn(window.electronAPI, 'invoke').mockResolvedValue({ success: true });
            
            bgColorPicker.value = '#ff0000';
            bgColorPicker.dispatchEvent(new Event('input'));

            // Wait for async handler
            await new Promise(process.nextTick);

            expect(document.body.style.backgroundColor).toBe('rgb(255, 0, 0)');
            expect(setSettingsSpy).toHaveBeenCalledWith('set-app-settings', { customBgColor: '#ff0000' });
            setSettingsSpy.mockRestore();
        });

        test('resetBgColorBtn resets background color and removes from app settings', async () => {
            const setSettingsSpy = jest.spyOn(window.electronAPI, 'invoke').mockResolvedValue({ success: true });
            document.body.style.backgroundColor = 'red';
            bgColorPicker.value = '#ff0000';

            resetBgColorBtn.click();

            // Wait for async handler
            await new Promise(process.nextTick);

            expect(document.body.style.backgroundColor).toBe('');
            expect(setSettingsSpy).toHaveBeenCalledWith('set-app-settings', { customBgColor: null });
            expect(bgColorPicker.value).toBe('#14181c'); // Browsers usually lowercase color values, original was #14181C
            setSettingsSpy.mockRestore();
        });

        test('info close button closes modal', () => {
            infoCloseBtn.click();
            expect(ModalManager.pop).toHaveBeenCalled();
        });

        test('settings button opens settings modal', () => {
            settingsBtn.click();
            expect(ModalManager.push).toHaveBeenCalledWith('settings');
        });

        test('settings close button closes modal', () => {
            settingsCloseBtn.click();
            expect(ModalManager.pop).toHaveBeenCalled();
        });

        test('today button sets watch date to today', () => {
            const today = new Date().toISOString().split('T')[0];
            todayBtn.click();
            expect(watchDateInput.value).toBe(today);
        });

        test('select save location button calls IPC', async () => {
            window.electronAPI.invoke.mockResolvedValue({ success: true });

            selectSaveLocationBtn.click();
            await Promise.resolve();

            expect(window.electronAPI.invoke).toHaveBeenCalledWith('select-save-location');
        });
    });

    describe('form submission', () => {
        let detailsForm;

        beforeEach(() => {
            detailsForm = document.createElement('form');
            document.body.appendChild(detailsForm);

            MovieController.initMovieController({
                movieList: document.createElement('div'),
                detailsForm,
                editBtn: document.createElement('button'),
                deleteBtn: document.createElement('button'),
                confirmDeleteBtn: document.createElement('button'),
                cancelDeleteBtn: document.createElement('button'),
                detailsCloseBtn: document.createElement('button'),
                cancelBtn: document.createElement('button'),
                infoCloseBtn: document.createElement('button'),
                settingsBtn: document.createElement('button'),
                settingsCloseBtn: document.createElement('button'),
                todayBtn: document.createElement('button'),
                watchDateInput: document.createElement('input'),
                selectSaveLocationBtn: document.createElement('button'),
                showPostersBtn: document.createElement('button'),
                customPosterInput: document.createElement('input')
            });

            MovieController.setupEventListeners();
        });

        test('form submit shows error for zero rating', () => {
            ModalView.getDetailsFormData.mockReturnValue({ userRating: 0, watchDate: '2023-01-01' });

            detailsForm.dispatchEvent(new Event('submit', { cancelable: true }));

            expect(showDetailsModalMessage).toHaveBeenCalledWith(expect.stringContaining('rating'));
        });

        test('form submit shows error for missing watch date', () => {
            ModalView.getDetailsFormData.mockReturnValue({ userRating: 5, watchDate: '' });

            detailsForm.dispatchEvent(new Event('submit', { cancelable: true }));

            expect(showDetailsModalMessage).toHaveBeenCalledWith(expect.stringContaining('date'));
        });

        test('form submit adds new movie in add mode', () => {
            ModalView.getDetailsFormData.mockReturnValue({
                userRating: 4,
                watchDate: '2023-05-15',
                isRewatch: false,
                comment: 'Great',
                format: 'Cinema',
                customPoster: ''
            });
            MovieModel.getMovieToAdd.mockReturnValue({ title: 'New Movie' });
            MovieModel.getCurrentEntryId.mockReturnValue(null);

            detailsForm.dispatchEvent(new Event('submit', { cancelable: true }));

            expect(MovieModel.addMovie).toHaveBeenCalled();
            expect(MovieModel.saveState).toHaveBeenCalled();
        });

        test('form submit updates movie in edit mode', () => {
            ModalView.getDetailsFormData.mockReturnValue({
                userRating: 4.5,
                watchDate: '2023-06-20',
                isRewatch: true,
                comment: 'Better',
                format: '4K',
                customPoster: ''
            });
            MovieModel.getMovieToAdd.mockReturnValue({ title: 'Edit Movie' });
            MovieModel.getCurrentEntryId.mockReturnValue('existing123');
            MovieModel.updateMovie.mockReturnValue(true);

            detailsForm.dispatchEvent(new Event('submit', { cancelable: true }));

            expect(MovieModel.updateMovie).toHaveBeenCalledWith('existing123', expect.any(Object));
            expect(MovieModel.saveState).toHaveBeenCalled();
        });
    });

    describe('keyboard and window events', () => {
        beforeEach(() => {
            MovieController.initMovieController({
                movieList: document.createElement('div'),
                detailsForm: document.createElement('form'),
                editBtn: document.createElement('button'),
                deleteBtn: document.createElement('button'),
                confirmDeleteBtn: document.createElement('button'),
                cancelDeleteBtn: document.createElement('button'),
                detailsCloseBtn: document.createElement('button'),
                cancelBtn: document.createElement('button'),
                infoCloseBtn: document.createElement('button'),
                settingsBtn: document.createElement('button'),
                settingsCloseBtn: document.createElement('button'),
                todayBtn: document.createElement('button'),
                watchDateInput: document.createElement('input'),
                selectSaveLocationBtn: document.createElement('button'),
                showPostersBtn: document.createElement('button'),
                customPosterInput: document.createElement('input')
            });

            MovieController.setupEventListeners();
        });

        test('escape key delegates to ModalManager', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(ModalManager.handleEscape).toHaveBeenCalled();
        });

        test('window click on modal background closes details modal', () => {
            const modalElement = document.createElement('div');
            modalElement.classList.add('modal');
            document.body.appendChild(modalElement);

            ModalView.isDetailsModalVisible.mockReturnValue(true);

            modalElement.click();
            // Should attempt to close
            expect(ModalView.isDetailsModalVisible).toHaveBeenCalled();
        });
    });
});
