/**
 * Tests for MovieModel - State management and CRUD operations
 */

import * as MovieModel from '../../src/model/MovieModel.js';

describe('MovieModel', () => {
    beforeEach(() => {
        // Reset state before each test
        MovieModel.setWatchedMovies([]);
        MovieModel.setMovieToAdd({});
        MovieModel.setCurrentEntryId(null);
        MovieModel.resetFilters();
    });

    describe('Getters and Setters', () => {
        test('setWatchedMovies and getWatchedMovies work correctly', () => {
            const movies = [{ title: 'Test Movie', entryId: '123' }];
            MovieModel.setWatchedMovies(movies);
            expect(MovieModel.getWatchedMovies()).toEqual(movies);
        });

        test('setMovieToAdd and getMovieToAdd work correctly', () => {
            const movie = { title: 'New Movie' };
            MovieModel.setMovieToAdd(movie);
            expect(MovieModel.getMovieToAdd()).toEqual(movie);
        });

        test('setCurrentEntryId and getCurrentEntryId work correctly', () => {
            MovieModel.setCurrentEntryId('abc123');
            expect(MovieModel.getCurrentEntryId()).toBe('abc123');
        });

        test('setCurrentSort and getCurrentSort work correctly', () => {
            MovieModel.setCurrentSort('rating-desc');
            expect(MovieModel.getCurrentSort()).toBe('rating-desc');
        });

        test('filter setters and getters work correctly', () => {
            MovieModel.setCurrentFilterGenre('Action');
            MovieModel.setCurrentFilterDirector('Nolan');
            MovieModel.setCurrentFilterYear('2020');
            MovieModel.setCurrentFilterFormat('4K');

            expect(MovieModel.getCurrentFilterGenre()).toBe('Action');
            expect(MovieModel.getCurrentFilterDirector()).toBe('Nolan');
            expect(MovieModel.getCurrentFilterYear()).toBe('2020');
            expect(MovieModel.getCurrentFilterFormat()).toBe('4K');
        });
    });

    describe('CRUD Operations', () => {
        test('addMovie adds a movie to the list', () => {
            const movie = { title: 'Added Movie', entryId: 'add1' };
            MovieModel.addMovie(movie);
            expect(MovieModel.getWatchedMovies()).toContainEqual(movie);
        });

        test('updateMovie updates an existing movie', () => {
            const original = { title: 'Original', entryId: 'upd1' };
            MovieModel.setWatchedMovies([original]);

            const updated = { title: 'Updated', entryId: 'upd1' };
            const result = MovieModel.updateMovie('upd1', updated);

            expect(result).toBe(true);
            expect(MovieModel.findMovieByEntryId('upd1').title).toBe('Updated');
        });

        test('updateMovie returns false for non-existent movie', () => {
            const result = MovieModel.updateMovie('nonexistent', { title: 'Test' });
            expect(result).toBe(false);
        });

        test('deleteMovie removes a movie from the list', () => {
            const movie = { title: 'To Delete', entryId: 'del1' };
            MovieModel.setWatchedMovies([movie]);

            const result = MovieModel.deleteMovie('del1');

            expect(result).toBe(true);
            expect(MovieModel.getWatchedMovies()).toHaveLength(0);
        });

        test('deleteMovie returns false for non-existent movie', () => {
            const result = MovieModel.deleteMovie('nonexistent');
            expect(result).toBe(false);
        });

        test('findMovieByEntryId finds the correct movie', () => {
            const movies = [
                { title: 'Movie A', entryId: 'a1' },
                { title: 'Movie B', entryId: 'b2' }
            ];
            MovieModel.setWatchedMovies(movies);

            const found = MovieModel.findMovieByEntryId('b2');
            expect(found.title).toBe('Movie B');
        });

        test('findMovieByEntryId returns undefined for non-existent movie', () => {
            const found = MovieModel.findMovieByEntryId('nonexistent');
            expect(found).toBeUndefined();
        });
    });

    describe('Filtering and Sorting', () => {
        const testMovies = [
            { title: 'A Movie', entryId: '1', userRating: 8, watchDate: '2023-01-15', genres: ['Action'], director: 'Director A', release_date: '2020-05-01', format: 'Blu-ray' },
            { title: 'B Movie', entryId: '2', userRating: 9, watchDate: '2023-03-20', genres: ['Comedy'], director: 'Director B', release_date: '2021-08-15', format: '4K' },
            { title: 'C Movie', entryId: '3', userRating: 7, watchDate: '2022-12-01', genres: ['Action', 'Drama'], director: 'Director A', release_date: '2019-11-10', format: 'Blu-ray' }
        ];

        beforeEach(() => {
            MovieModel.setWatchedMovies([...testMovies]);
        });

        test('getFilteredAndSortedMovies returns all movies when no filters', () => {
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result).toHaveLength(3);
        });

        test('filters by genre correctly', () => {
            MovieModel.setCurrentFilterGenre('Comedy');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('B Movie');
        });

        test('filters by director correctly', () => {
            MovieModel.setCurrentFilterDirector('Director A');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result).toHaveLength(2);
        });

        test('filters by year correctly', () => {
            MovieModel.setCurrentFilterYear('2020');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('A Movie');
        });

        test('filters by format correctly', () => {
            MovieModel.setCurrentFilterFormat('4K');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('B Movie');
        });

        test('sorts by date descending (default)', () => {
            MovieModel.setCurrentSort('date-desc');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result[0].title).toBe('B Movie'); // Most recent
            expect(result[2].title).toBe('C Movie'); // Oldest
        });

        test('sorts by date ascending', () => {
            MovieModel.setCurrentSort('date-asc');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result[0].title).toBe('C Movie');
        });

        test('sorts by rating descending', () => {
            MovieModel.setCurrentSort('rating-desc');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result[0].userRating).toBe(9);
        });

        test('sorts by rating ascending', () => {
            MovieModel.setCurrentSort('rating-asc');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result[0].userRating).toBe(7);
        });

        test('sorts by title ascending', () => {
            MovieModel.setCurrentSort('title-asc');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result[0].title).toBe('A Movie');
        });

        test('sorts by title descending', () => {
            MovieModel.setCurrentSort('title-desc');
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result[0].title).toBe('C Movie');
        });
    });

    describe('resetFilters', () => {
        test('resets all filters to default values', () => {
            MovieModel.setCurrentFilterGenre('Action');
            MovieModel.setCurrentFilterDirector('Nolan');
            MovieModel.setCurrentFilterYear('2020');
            MovieModel.setCurrentFilterFormat('4K');

            MovieModel.resetFilters();

            expect(MovieModel.getCurrentFilterGenre()).toBe('all');
            expect(MovieModel.getCurrentFilterDirector()).toBe('all');
            expect(MovieModel.getCurrentFilterYear()).toBe('all');
            expect(MovieModel.getCurrentFilterFormat()).toBe('all');
        });
    });

    describe('Constants', () => {
        test('exports API_BASE_URL', () => {
            expect(MovieModel.API_BASE_URL).toBe('https://api.themoviedb.org/3');
        });

        test('exports image base URLs', () => {
            expect(MovieModel.SEARCH_IMAGE_BASE_URL).toBeDefined();
            expect(MovieModel.MOVIE_LIST_IMAGE_BASE_URL).toBeDefined();
        });
    });

    describe('loadState', () => {
        let showMessageMock;
        let searchInput;
        let searchBtn;

        beforeEach(() => {
            showMessageMock = jest.fn();
            searchInput = document.createElement('input');
            searchBtn = document.createElement('button');
        });

        test('loads movies from IPC on success', async () => {
            const mockMovies = [{ title: 'Movie 1' }, { title: 'Movie 2' }];
            window.electronAPI.invoke.mockImplementation((channel) => {
                if (channel === 'read-json') return Promise.resolve(mockMovies);
                if (channel === 'get-api-key') return Promise.resolve('test-api-key');
            });

            await MovieModel.loadState(showMessageMock, { searchInput, searchBtn });

            expect(MovieModel.getWatchedMovies()).toEqual(mockMovies);
        });

        test('sets empty array when movies load fails', async () => {
            window.electronAPI.invoke.mockImplementation((channel) => {
                if (channel === 'read-json') return Promise.resolve({ error: 'File not found' });
                if (channel === 'get-api-key') return Promise.resolve('test-api-key');
            });

            await MovieModel.loadState(showMessageMock, { searchInput, searchBtn });

            expect(MovieModel.getWatchedMovies()).toEqual([]);
        });

        test('disables search when API key is missing', async () => {
            window.electronAPI.invoke.mockImplementation((channel) => {
                if (channel === 'read-json') return Promise.resolve([]);
                if (channel === 'get-api-key') return Promise.resolve(null);
            });

            await MovieModel.loadState(showMessageMock, { searchInput, searchBtn });

            expect(searchInput.disabled).toBe(true);
            expect(searchBtn.disabled).toBe(true);
            expect(showMessageMock).toHaveBeenCalledWith(expect.stringContaining('API Key not found'), 'error');
        });

        test('enables search when API key is present', async () => {
            searchInput.disabled = true;
            searchBtn.disabled = true;

            window.electronAPI.invoke.mockImplementation((channel) => {
                if (channel === 'read-json') return Promise.resolve([]);
                if (channel === 'get-api-key') return Promise.resolve('valid-api-key');
            });

            await MovieModel.loadState(showMessageMock, { searchInput, searchBtn });

            expect(searchInput.disabled).toBe(false);
            expect(searchBtn.disabled).toBe(false);
        });

        test('returns the API key', async () => {
            window.electronAPI.invoke.mockImplementation((channel) => {
                if (channel === 'read-json') return Promise.resolve([]);
                if (channel === 'get-api-key') return Promise.resolve('my-api-key');
            });

            const result = await MovieModel.loadState(showMessageMock, { searchInput, searchBtn });

            expect(result).toBe('my-api-key');
        });

        test('resets filters on load', async () => {
            MovieModel.setCurrentFilterGenre('Action');

            window.electronAPI.invoke.mockImplementation(() => Promise.resolve([]));

            await MovieModel.loadState(showMessageMock, { searchInput, searchBtn });

            expect(MovieModel.getCurrentFilterGenre()).toBe('all');
            expect(MovieModel.getCurrentSort()).toBe('date-desc');
        });
    });

    describe('saveState', () => {
        let showMessageMock;

        beforeEach(() => {
            showMessageMock = jest.fn();
        });

        test('saves movies via IPC', async () => {
            const movies = [{ title: 'Test Movie' }];
            MovieModel.setWatchedMovies(movies);

            window.electronAPI.invoke.mockResolvedValue({ success: true });

            await MovieModel.saveState(showMessageMock);

            expect(window.electronAPI.invoke).toHaveBeenCalledWith('write-json', movies);
        });

        test('shows error message on save failure', async () => {
            window.electronAPI.invoke.mockResolvedValue({ error: 'Write failed' });

            await MovieModel.saveState(showMessageMock);

            expect(showMessageMock).toHaveBeenCalledWith('Failed to save movies.', 'error');
        });

        test('does not show error on successful save', async () => {
            window.electronAPI.invoke.mockResolvedValue({ success: true });

            await MovieModel.saveState(showMessageMock);

            expect(showMessageMock).not.toHaveBeenCalled();
        });
    });

    describe('sorting edge cases', () => {
        test('handles unknown sort type gracefully', () => {
            MovieModel.setWatchedMovies([
                { title: 'A', watchDate: '2023-01-01' },
                { title: 'B', watchDate: '2023-02-01' }
            ]);
            MovieModel.setCurrentSort('unknown-sort');

            // Should not throw, returns movies in some order
            const result = MovieModel.getFilteredAndSortedMovies();
            expect(result).toHaveLength(2);
        });
    });
});
