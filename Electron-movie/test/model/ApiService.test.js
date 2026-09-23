/**
 * Tests for ApiService - TMDB API calls via Cloudflare Proxy
 */

import * as ApiService from '../../src/model/ApiService.js';

describe('ApiService', () => {
    let mockShowMessage;

    beforeEach(() => {
        mockShowMessage = jest.fn();
        ApiService.setApiKey(null);
        global.fetch = jest.fn();
    });

    describe('API Key Management & Proxy-First with .env Fallback', () => {
        test('setApiKey and getApiKey work correctly', () => {
            ApiService.setApiKey('test-api-key');
            expect(ApiService.getApiKey()).toBe('test-api-key');
        });

        test('getApiKey returns null when not set', () => {
            expect(ApiService.getApiKey()).toBeNull();
        });

        test('uses Cloudflare proxy by default even when .env key is configured if proxy is healthy', async () => {
            ApiService.setApiKey('my-env-api-key');
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ results: [{ id: 10, title: 'Proxy Movie' }] })
            });

            const result = await ApiService.searchMoviesByTitle('Avatar', mockShowMessage);
            expect(result).toEqual([{ id: 10, title: 'Proxy Movie' }]);

            // Must use Cloudflare proxy with X-App-Key, NOT api.themoviedb.org
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://tmdb-proxy.movie-feed.workers.dev/3/search/movie?query=Avatar',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-App-Key': 'MovieTracker-Client-Secure-2026'
                    })
                })
            );
        });

        test('automatically falls back to direct TMDB with v3 api_key if proxy has a network error', async () => {
            const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            ApiService.setApiKey('my-v3-fallback-key');

            // 1st call (proxy) fails with network error
            global.fetch.mockRejectedValueOnce(new Error('Proxy connection timeout'));
            // 2nd call (direct TMDB fallback) succeeds
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ results: [{ id: 11, title: 'Fallback Movie' }] })
            });

            const result = await ApiService.searchMoviesByTitle('Inception', mockShowMessage);
            expect(result).toEqual([{ id: 11, title: 'Fallback Movie' }]);

            expect(global.fetch).toHaveBeenCalledTimes(2);
            // First attempt: Cloudflare Proxy
            expect(global.fetch).toHaveBeenNthCalledWith(
                1,
                'https://tmdb-proxy.movie-feed.workers.dev/3/search/movie?query=Inception',
                expect.any(Object)
            );
            // Second attempt: Direct TMDB with v3 key
            expect(global.fetch).toHaveBeenNthCalledWith(
                2,
                'https://api.themoviedb.org/3/search/movie?query=Inception&api_key=my-v3-fallback-key',
                expect.objectContaining({
                    headers: { 'Accept': 'application/json' }
                })
            );
            spyWarn.mockRestore();
        });

        test('automatically falls back to direct TMDB with v4 Bearer token if proxy returns 502 Bad Gateway', async () => {
            const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const longJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'x'.repeat(100);
            ApiService.setApiKey(longJwtToken);

            // 1st call (proxy) returns 502
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 502,
                json: () => Promise.resolve({ error: 'Bad Gateway' })
            });
            // 2nd call (direct TMDB fallback) succeeds
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ results: [{ id: 20, title: 'Bearer Fallback Movie' }] })
            });

            const result = await ApiService.searchMoviesByTitle('Matrix', mockShowMessage);
            expect(result).toEqual([{ id: 20, title: 'Bearer Fallback Movie' }]);

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(global.fetch).toHaveBeenNthCalledWith(
                2,
                'https://api.themoviedb.org/3/search/movie?query=Matrix',
                expect.objectContaining({
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${longJwtToken}`
                    }
                })
            );
            spyWarn.mockRestore();
        });

        test('does NOT trigger fallback on 404 client error from proxy', async () => {
            ApiService.setApiKey('my-env-api-key');

            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: () => Promise.resolve({ status_message: 'Movie not found' })
            });

            const result = await ApiService.getMovieDetails(9999999, mockShowMessage);
            expect(result).toBeNull();
            // Should NOT make a second call
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('searchMoviesByTitle', () => {
        test('returns null for empty or whitespace query without network call', async () => {
            const result1 = await ApiService.searchMoviesByTitle('', mockShowMessage);
            const result2 = await ApiService.searchMoviesByTitle('   ', mockShowMessage);
            expect(result1).toBeNull();
            expect(result2).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        test('returns search results on success and includes X-App-Key header', async () => {
            const mockResults = [{ id: 1, title: 'Test Movie' }];

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ results: mockResults })
            });

            const result = await ApiService.searchMoviesByTitle('Test', mockShowMessage);

            expect(result).toEqual(mockResults);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/search/movie?query=Test'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-App-Key': 'MovieTracker-Client-Secure-2026'
                    })
                })
            );
        });

        test('handles API error response', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ status_message: 'Proxy Error' })
            });

            const result = await ApiService.searchMoviesByTitle('Test', mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                expect.stringContaining('API Error'),
                'error'
            );
        });

        test('handles network error', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await ApiService.searchMoviesByTitle('Test', mockShowMessage);

            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch search results'),
                'error'
            );
        });
    });

    describe('getMovieDetails (append_to_response=credits)', () => {
        test('returns null when tmdbId is missing', async () => {
            const result = await ApiService.getMovieDetails(null, mockShowMessage);
            expect(result).toBeNull();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        test('returns movie details with director in single combined request', async () => {
            const mockCombinedData = {
                id: 123,
                title: 'Test Movie',
                poster_path: '/poster.jpg',
                release_date: '2023-01-01',
                runtime: 120,
                genres: [{ name: 'Action' }, { name: 'Drama' }],
                imdb_id: 'tt1234567',
                credits: {
                    crew: [{ job: 'Director', name: 'Test Director' }]
                }
            };

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockCombinedData)
            });

            const result = await ApiService.getMovieDetails(123, mockShowMessage);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/movie/123?append_to_response=credits'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-App-Key': 'MovieTracker-Client-Secure-2026'
                    })
                })
            );

            expect(result).toMatchObject({
                id: 123,
                title: 'Test Movie',
                director: 'Test Director',
                genres: ['Action', 'Drama']
            });
            expect(result.entryId).toBeDefined();
        });

        test('sets director to N/A when director credit is not found', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 1,
                    title: 'Test',
                    genres: [],
                    credits: { crew: [] }
                })
            });

            const result = await ApiService.getMovieDetails(1, mockShowMessage);
            expect(result.director).toBe('N/A');
        });

        test('handles API 404 error without spamming showMessage', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: () => Promise.resolve({ status_message: 'Movie not found' })
            });

            const result = await ApiService.getMovieDetails(9999999, mockShowMessage);
            expect(result).toBeNull();
            expect(mockShowMessage).not.toHaveBeenCalled();
        });

        test('handles API non-404 error and displays error message', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Internal Server Error' })
            });

            const result = await ApiService.getMovieDetails(123, mockShowMessage);
            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith('API Error: Internal Server Error', 'error');
        });

        test('handles fetch network error in getMovieDetails and returns null', async () => {
            const spyConsole = jest.spyOn(console, 'error').mockImplementation(() => {});
            global.fetch.mockRejectedValueOnce(new Error('Network failure'));

            const result = await ApiService.getMovieDetails(123, mockShowMessage);
            expect(result).toBeNull();
            expect(spyConsole).toHaveBeenCalled();
            spyConsole.mockRestore();
        });
    });

    describe('getAllPosters', () => {
        test('returns null for invalid or decimal IDs', async () => {
            const result = await ApiService.getAllPosters('123.45', mockShowMessage);
            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                expect.stringContaining('not available'),
                'error'
            );
        });

        test('returns poster paths on success with X-App-Key header', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    posters: [{ file_path: '/poster1.jpg' }, { file_path: '/poster2.jpg' }]
                })
            });

            const result = await ApiService.getAllPosters(123, mockShowMessage);
            expect(result).toEqual(['/poster1.jpg', '/poster2.jpg']);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/movie/123/images'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-App-Key': 'MovieTracker-Client-Secure-2026'
                    })
                })
            );
        });

        test('returns null and shows message when no posters found', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ posters: [] })
            });

            const result = await ApiService.getAllPosters(123, mockShowMessage);
            expect(result).toBeNull();
            expect(mockShowMessage).toHaveBeenCalledWith(
                'No posters found.',
                'error'
            );
        });

        test('returns null when poster response is not ok', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            });

            const result = await ApiService.getAllPosters(123, mockShowMessage);
            expect(result).toBeNull();
        });

        test('handles fetch network error in getAllPosters and returns null', async () => {
            const spyConsole = jest.spyOn(console, 'error').mockImplementation(() => {});
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await ApiService.getAllPosters(123, mockShowMessage);
            expect(result).toBeNull();
            expect(spyConsole).toHaveBeenCalled();
            spyConsole.mockRestore();
        });
    });

    describe('listAllPosters (legacy)', () => {
        test('returns a random poster from the list', async () => {
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
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ posters: [] })
            });

            const result = await ApiService.listAllPosters(123, mockShowMessage);
            expect(result).toBeNull();
        });
    });
});
