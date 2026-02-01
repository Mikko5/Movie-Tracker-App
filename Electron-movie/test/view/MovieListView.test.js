/**
 * Tests for MovieListView - Card rendering and filter dropdowns
 */

// Mock UIHelpers - avoid document access in factory by using jest.fn() only
jest.mock('../../src/view/UIHelpers.js', () => ({
    renderStarsHtml: jest.fn().mockReturnValue('<span>★★★★★</span>'),
    // Return a mock function that will be configured in beforeEach
    createPosterImage: jest.fn(),
    formatDateDMY: jest.fn().mockReturnValue('01-01-2023')
}));

jest.mock('../../src/model/MovieModel.js', () => ({
    MOVIE_LIST_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w342',
    SEARCH_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/w92',
    PLACEHOLDER_BASE_URL: 'https://placehold.co'
}));

import * as MovieListView from '../../src/view/MovieListView.js';
import * as UIHelpers from '../../src/view/UIHelpers.js';

describe('MovieListView', () => {
    let movieListContainer;
    let searchResultsContainer;
    let genreSelect;
    let directorSelect;
    let yearSelect;
    let formatSelect;

    beforeEach(() => {
        jest.clearAllMocks();

        // Configure createPosterImage mock to return a real img element
        UIHelpers.createPosterImage.mockImplementation(() => {
            const img = document.createElement('img');
            return img;
        });

        // Create DOM elements
        movieListContainer = document.createElement('ul');
        movieListContainer.id = 'movie-list';

        searchResultsContainer = document.createElement('ul');
        searchResultsContainer.id = 'search-results';

        genreSelect = document.createElement('select');
        genreSelect.id = 'filter-genre-select';

        directorSelect = document.createElement('select');
        directorSelect.id = 'filter-director-select';

        yearSelect = document.createElement('select');
        yearSelect.id = 'filter-year-select';

        formatSelect = document.createElement('select');
        formatSelect.id = 'filter-format-select';

        document.body.appendChild(movieListContainer);
        document.body.appendChild(searchResultsContainer);
        document.body.appendChild(genreSelect);
        document.body.appendChild(directorSelect);
        document.body.appendChild(yearSelect);
        document.body.appendChild(formatSelect);

        MovieListView.initMovieListView({
            movieList: movieListContainer,
            searchResultsContainer,
            filterGenreSelect: genreSelect,
            filterDirectorSelect: directorSelect,
            filterYearSelect: yearSelect,
            filterFormatSelect: formatSelect
        });
    });

    describe('initMovieListView', () => {
        test('stores DOM element references', () => {
            MovieListView.renderMovies([]);
            expect(movieListContainer.innerHTML).not.toBeNull();
        });
    });

    describe('renderMovies', () => {
        test('renders movie cards for each movie', () => {
            const movies = [
                { title: 'Movie A', entryId: 'a1', userRating: 8, watchDate: '2023-01-01', poster_path: '/a.jpg' },
                { title: 'Movie B', entryId: 'b2', userRating: 7, watchDate: '2023-02-01', poster_path: '/b.jpg' }
            ];

            MovieListView.renderMovies(movies);

            expect(movieListContainer.querySelectorAll('.movie-card').length).toBe(2);
        });

        test('displays empty state when no movies', () => {
            MovieListView.renderMovies([]);

            expect(movieListContainer.innerHTML).toContain('No movies');
        });

        test('movie card contains title and entry id', () => {
            const movies = [
                { title: 'Test Movie', entryId: 'test1', userRating: 8, watchDate: '2023-05-15', poster_path: '/test.jpg' }
            ];

            MovieListView.renderMovies(movies);

            const card = movieListContainer.querySelector('.movie-card');
            expect(card.textContent).toContain('Test Movie');
            expect(card.dataset.entryId).toBe('test1');
        });

        test('uses UIHelpers for star rendering', () => {
            const movies = [
                { title: 'Star Test', entryId: 's1', userRating: 9, watchDate: '2023-01-01', poster_path: '/s.jpg' }
            ];

            MovieListView.renderMovies(movies);

            expect(UIHelpers.renderStarsHtml).toHaveBeenCalledWith(9, true);
        });

        test('uses createPosterImage for poster', () => {
            const movies = [
                { title: 'Poster Test', entryId: 'p1', userRating: 8, watchDate: '2023-01-01', poster_path: '/poster.jpg' }
            ];

            MovieListView.renderMovies(movies);

            expect(UIHelpers.createPosterImage).toHaveBeenCalled();
        });
    });

    describe('renderSearchResults', () => {
        test('renders search result items', () => {
            const results = [
                { id: 1, title: 'Search Result 1', release_date: '2023-01-01', poster_path: '/r1.jpg' },
                { id: 2, title: 'Search Result 2', release_date: '2022-06-15', poster_path: '/r2.jpg' }
            ];

            MovieListView.renderSearchResults(results, 'test');

            const items = searchResultsContainer.querySelectorAll('.search-result-item');
            expect(items.length).toBe(2);
        });

        test('shows no results message when empty', () => {
            MovieListView.renderSearchResults([], 'nonexistent');

            expect(searchResultsContainer.innerHTML).toContain('No results');
        });

        test('clears results for empty query', () => {
            MovieListView.renderSearchResults([], '');
            expect(searchResultsContainer.innerHTML).toBe('');
        });

        test('renders add button with movie ID', () => {
            const results = [
                { id: 123, title: 'Movie', release_date: '2023-01-01', poster_path: '/m.jpg' }
            ];

            MovieListView.renderSearchResults(results, 'movie');

            const addBtn = searchResultsContainer.querySelector('.add-btn');
            expect(addBtn).not.toBeNull();
            expect(addBtn.dataset.tmdbId).toBe('123');
        });
    });

    describe('renderFilters', () => {
        const currentFilters = { genre: 'all', director: 'all', year: 'all', format: 'all' };

        test('populates genre dropdown with unique genres', () => {
            const movies = [
                { genres: ['Action', 'Drama'] },
                { genres: ['Comedy', 'Action'] },
                { genres: ['Drama'] }
            ];

            MovieListView.renderFilters(movies, currentFilters);

            const options = genreSelect.querySelectorAll('option');
            expect(options.length).toBeGreaterThanOrEqual(4);
        });

        test('populates director dropdown with unique directors', () => {
            const movies = [
                { director: 'Director A' },
                { director: 'Director B' },
                { director: 'Director A' }
            ];

            MovieListView.renderFilters(movies, currentFilters);

            const options = directorSelect.querySelectorAll('option');
            expect(options.length).toBe(3);
        });

        test('populates year dropdown with unique years', () => {
            const movies = [
                { release_date: '2023-05-01' },
                { release_date: '2022-08-15' },
                { release_date: '2023-11-20' }
            ];

            MovieListView.renderFilters(movies, currentFilters);

            const options = yearSelect.querySelectorAll('option');
            expect(options.length).toBe(3);
        });

        test('populates format dropdown with unique formats', () => {
            const movies = [
                { format: 'Blu-ray' },
                { format: '4K' },
                { format: 'Blu-ray' },
                { format: 'Cinema' }
            ];

            MovieListView.renderFilters(movies, currentFilters);

            const options = formatSelect.querySelectorAll('option');
            expect(options.length).toBe(4);
        });
    });

    describe('clearSearchResults', () => {
        test('clears the search results container', () => {
            searchResultsContainer.innerHTML = '<li>Test</li>';
            MovieListView.clearSearchResults();
            expect(searchResultsContainer.innerHTML).toBe('');
        });
    });
});
