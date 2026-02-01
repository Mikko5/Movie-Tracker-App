/**
 * Tests for FilterController - Sort and filter event handling
 */

// Mock the model before importing
jest.mock('../../src/model/MovieModel.js', () => ({
    setCurrentSort: jest.fn(),
    setCurrentFilterGenre: jest.fn(),
    setCurrentFilterDirector: jest.fn(),
    setCurrentFilterYear: jest.fn(),
    setCurrentFilterFormat: jest.fn(),
    getCurrentSort: jest.fn().mockReturnValue('date-desc'),
    getCurrentFilterGenre: jest.fn().mockReturnValue('all'),
    getCurrentFilterDirector: jest.fn().mockReturnValue('all'),
    getCurrentFilterYear: jest.fn().mockReturnValue('all'),
    getCurrentFilterFormat: jest.fn().mockReturnValue('all'),
    getWatchedMovies: jest.fn().mockReturnValue([]),
    resetFilters: jest.fn()
}));

jest.mock('../../src/view/MovieListView.js', () => ({
    renderFilters: jest.fn()
}));

import * as FilterController from '../../src/controller/FilterController.js';
import * as MovieModel from '../../src/model/MovieModel.js';
import * as MovieListView from '../../src/view/MovieListView.js';

describe('FilterController', () => {
    let sortSelect;
    let genreSelect;
    let directorSelect;
    let yearSelect;
    let formatSelect;
    let resetBtn;
    let mockRefreshCallback;

    // Helper to add options to a select element
    const addOptions = (select, options) => {
        options.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Create DOM elements
        sortSelect = document.createElement('select');
        sortSelect.id = 'sort-select';
        addOptions(sortSelect, ['date-desc', 'date-asc', 'title-asc', 'title-desc', 'rating-desc', 'rating-asc']);

        genreSelect = document.createElement('select');
        genreSelect.id = 'filter-genre-select';
        addOptions(genreSelect, ['all', 'Action', 'Comedy', 'Drama']);

        directorSelect = document.createElement('select');
        directorSelect.id = 'filter-director-select';
        addOptions(directorSelect, ['all', 'Christopher Nolan', 'Steven Spielberg']);

        yearSelect = document.createElement('select');
        yearSelect.id = 'filter-year-select';
        addOptions(yearSelect, ['all', '2023', '2022', '2021']);

        formatSelect = document.createElement('select');
        formatSelect.id = 'filter-format-select';
        addOptions(formatSelect, ['all', 'Blu-ray', '4K', 'Streaming']);

        resetBtn = document.createElement('button');
        resetBtn.id = 'reset-filters-btn';

        document.body.appendChild(sortSelect);
        document.body.appendChild(genreSelect);
        document.body.appendChild(directorSelect);
        document.body.appendChild(yearSelect);
        document.body.appendChild(formatSelect);
        document.body.appendChild(resetBtn);

        mockRefreshCallback = jest.fn();

        // Initialize the controller
        FilterController.initFilterController({
            sortSelect,
            filterGenreSelect: genreSelect,
            filterDirectorSelect: directorSelect,
            filterYearSelect: yearSelect,
            filterFormatSelect: formatSelect,
            resetFiltersBtn: resetBtn
        });
    });

    describe('initFilterController', () => {
        test('stores DOM element references', () => {
            // If init works, setupFilterListeners should work
            FilterController.setupFilterListeners(mockRefreshCallback);

            sortSelect.value = 'rating-desc';
            sortSelect.dispatchEvent(new Event('change'));

            expect(MovieModel.setCurrentSort).toHaveBeenCalledWith('rating-desc');
        });
    });

    describe('setupFilterListeners', () => {
        beforeEach(() => {
            FilterController.setupFilterListeners(mockRefreshCallback);
        });

        test('sort select change updates model and refreshes', () => {
            sortSelect.value = 'title-asc';
            sortSelect.dispatchEvent(new Event('change'));

            expect(MovieModel.setCurrentSort).toHaveBeenCalledWith('title-asc');
            expect(mockRefreshCallback).toHaveBeenCalled();
        });

        test('genre select change updates model and refreshes', () => {
            genreSelect.value = 'Action';
            genreSelect.dispatchEvent(new Event('change'));

            expect(MovieModel.setCurrentFilterGenre).toHaveBeenCalledWith('Action');
            expect(mockRefreshCallback).toHaveBeenCalled();
        });

        test('director select change updates model and refreshes', () => {
            directorSelect.value = 'Christopher Nolan';
            directorSelect.dispatchEvent(new Event('change'));

            expect(MovieModel.setCurrentFilterDirector).toHaveBeenCalledWith('Christopher Nolan');
            expect(mockRefreshCallback).toHaveBeenCalled();
        });

        test('year select change updates model and refreshes', () => {
            yearSelect.value = '2023';
            yearSelect.dispatchEvent(new Event('change'));

            expect(MovieModel.setCurrentFilterYear).toHaveBeenCalledWith('2023');
            expect(mockRefreshCallback).toHaveBeenCalled();
        });

        test('format select change updates model and refreshes', () => {
            formatSelect.value = 'Blu-ray';
            formatSelect.dispatchEvent(new Event('change'));

            expect(MovieModel.setCurrentFilterFormat).toHaveBeenCalledWith('Blu-ray');
            expect(mockRefreshCallback).toHaveBeenCalled();
        });

        test('reset button resets filters and refreshes', () => {
            resetBtn.click();

            expect(MovieModel.resetFilters).toHaveBeenCalled();
            expect(mockRefreshCallback).toHaveBeenCalled();
        });
    });

    describe('filter panel toggle', () => {
        let filterPanel;
        let filterToggleBtn;

        beforeEach(() => {
            filterPanel = document.createElement('div');
            filterPanel.id = 'filter-panel';

            filterToggleBtn = document.createElement('button');
            filterToggleBtn.id = 'filter-toggle-btn';

            document.body.appendChild(filterPanel);
            document.body.appendChild(filterToggleBtn);

            // Re-initialize with toggle elements
            FilterController.initFilterController({
                sortSelect,
                filterGenreSelect: genreSelect,
                filterDirectorSelect: directorSelect,
                filterYearSelect: yearSelect,
                filterFormatSelect: formatSelect,
                resetFiltersBtn: resetBtn,
                filterPanel,
                filterToggleBtn
            });

            FilterController.setupFilterListeners(mockRefreshCallback);
        });

        test('panel is hidden initially', () => {
            expect(filterPanel.style.display).toBe('none');
        });

        test('toggle button text is "Filter" initially', () => {
            expect(filterToggleBtn.textContent).toBe('Filter');
        });

        test('clicking toggle shows panel and changes text', () => {
            filterToggleBtn.click();

            expect(filterPanel.style.display).toBe('block');
            expect(filterToggleBtn.textContent).toBe('Hide Filters');
        });

        test('clicking toggle again hides panel', () => {
            filterToggleBtn.click(); // show
            filterToggleBtn.click(); // hide

            expect(filterPanel.style.display).toBe('none');
            expect(filterToggleBtn.textContent).toBe('Filter');
        });
    });

    describe('refreshFilters', () => {
        test('calls renderFilters with watched movies and current filters', () => {
            const mockMovies = [{ title: 'Test' }];
            MovieModel.getWatchedMovies.mockReturnValue(mockMovies);
            MovieModel.getCurrentFilterGenre.mockReturnValue('Comedy');
            MovieModel.getCurrentFilterDirector.mockReturnValue('Spielberg');
            MovieModel.getCurrentFilterYear.mockReturnValue('2022');
            MovieModel.getCurrentFilterFormat.mockReturnValue('4K');

            FilterController.refreshFilters();

            expect(MovieListView.renderFilters).toHaveBeenCalledWith(
                mockMovies,
                {
                    genre: 'Comedy',
                    director: 'Spielberg',
                    year: '2022',
                    format: '4K'
                }
            );
        });

        test('passes default all values when no filters set', () => {
            MovieModel.getWatchedMovies.mockReturnValue([]);
            MovieModel.getCurrentFilterGenre.mockReturnValue('all');
            MovieModel.getCurrentFilterDirector.mockReturnValue('all');
            MovieModel.getCurrentFilterYear.mockReturnValue('all');
            MovieModel.getCurrentFilterFormat.mockReturnValue('all');

            FilterController.refreshFilters();

            expect(MovieListView.renderFilters).toHaveBeenCalledWith(
                [],
                {
                    genre: 'all',
                    director: 'all',
                    year: 'all',
                    format: 'all'
                }
            );
        });
    });
});
