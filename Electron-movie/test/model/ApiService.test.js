/**
 * Tests for ApiService - TMDB API calls
 */

import * as ApiService from '../../src/model/ApiService.js';

describe('ApiService', () => {
    let mockShowMessage;

    beforeEach(() => {
        mockShowMessage = jest.fn();
        ApiService.setApiKey(null);
        global.fetch = jest.fn();
    });

    describe('API Key Management', () => {
        test('setApiKey and getApiKey work correctly', () => {
            ApiService.setApiKey('test-api-key');
            expect(ApiService.getApiKey()).toBe('test-api-key');
        });

        test('getApiKey returns null when not set', () => {
            expect(ApiService.getApiKey()).toBeNull();
        });
    });

    describe('searchMoviesByTitle', () => {
        test('returns null and shows message when API key is not set', async () => {
            const result = await ApiService.searchMoviesByTitle('test', mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                'TMDB API Key not loaded. Cannot search.',
                'error'
            );
        });

        test('returns null for empty query', async () => {
            ApiService.setApiKey('test-key');
            const result = await ApiService.searchMoviesByTitle('', mockShowMessage);
            expect(result).toBeNull();
        });

        test('returns search results on success', async () => {
            ApiService.setApiKey('test-key');
            const mockResults = [{ id: 1, title: 'Test Movie' }];

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ results: mockResults })
            });

            const result = await ApiService.searchMoviesByTitle('Test', mockShowMessage);

            expect(result).toEqual(mockResults);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/search/movie?query=Test'),
                expect.objectContaining({ headers: expect.any(Object) })
            );
        });

        test('handles API error response', async () => {
            ApiService.setApiKey('test-key');

            global.fetch.mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ status_message: 'Invalid API key' })
            });

            const result = await ApiService.searchMoviesByTitle('Test', mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                expect.stringContaining('API Error'),
                'error'
            );
        });

        test('handles network error', async () => {
            ApiService.setApiKey('test-key');
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await ApiService.searchMoviesByTitle('Test', mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch'),
                'error'
            );
        });
    });

    describe('getMovieDetails', () => {
        test('returns null when API key is not set', async () => {
            const result = await ApiService.getMovieDetails(123, mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                'TMDB API Key not loaded. Cannot fetch movie details.',
                'error'
            );
        });

        test('returns movie details with director on success', async () => {
            ApiService.setApiKey('test-key');

            const mockMovieData = {
                id: 123,
                title: 'Test Movie',
                poster_path: '/poster.jpg',
                release_date: '2023-01-01',
                runtime: 120,
                genres: [{ name: 'Action' }, { name: 'Drama' }],
                imdb_id: 'tt1234567'
            };

            const mockCreditsData = {
                crew: [{ job: 'Director', name: 'Test Director' }]
            };

            global.fetch
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockMovieData) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCreditsData) });

            const result = await ApiService.getMovieDetails(123, mockShowMessage);

            expect(result).toMatchObject({
                id: 123,
                title: 'Test Movie',
                director: 'Test Director',
                genres: ['Action', 'Drama']
            });
            expect(result.entryId).toBeDefined();
        });

        test('sets director to N/A when not found', async () => {
            ApiService.setApiKey('test-key');

            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ id: 1, title: 'Test', genres: [], imdb_id: null })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ crew: [] })
                });

            const result = await ApiService.getMovieDetails(1, mockShowMessage);
            expect(result.director).toBe('N/A');
        });
    });

    describe('getAllPosters', () => {
        test('returns null when API key is not set', async () => {
            const result = await ApiService.getAllPosters(123, mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                'TMDB API Key not loaded. Cannot fetch posters.',
                'error'
            );
        });

        test('returns poster paths on success', async () => {
            ApiService.setApiKey('test-key');

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    posters: [{ file_path: '/poster1.jpg' }, { file_path: '/poster2.jpg' }]
                })
            });

            const result = await ApiService.getAllPosters(123, mockShowMessage);
            expect(result).toEqual(['/poster1.jpg', '/poster2.jpg']);
        });

        test('returns null and shows message when no posters found', async () => {
            ApiService.setApiKey('test-key');

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ posters: [] })
            });

            const result = await ApiService.getAllPosters(123, mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                'No posters found for this movie.',
                'error'
            );
        });
    });

    describe('listAllPosters (legacy)', () => {
        test('returns a random poster from the list', async () => {
            ApiService.setApiKey('test-key');

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    posters: [{ file_path: '/poster1.jpg' }]
                })
            });

            const result = await ApiService.listAllPosters(123, mockShowMessage);
            expect(result).toBe('/poster1.jpg');
        });

        test('returns null when no posters available', async () => {
            ApiService.setApiKey('test-key');

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ posters: [] })
            });

            const result = await ApiService.listAllPosters(123, mockShowMessage);
            expect(result).toBeNull();
        });
    });
});
