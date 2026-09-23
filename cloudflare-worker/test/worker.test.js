import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

describe('Cloudflare Worker: TMDB Edge Proxy', () => {
    const validEnv = {
        TMDB_TOKEN: 'test-tmdb-token-secret-12345',
        CLIENT_KEY: 'MovieTracker-Client-Secure-2026'
    };

    describe('CORS and HTTP Methods', () => {
        test('OPTIONS preflight returns 204 with CORS headers', async () => {
            const req = new Request('https://tmdb-proxy.workers.dev/search/movie', {
                method: 'OPTIONS',
                headers: {
                    'Origin': 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET'
                }
            });

            const res = await worker.fetch(req, validEnv, {});
            assert.equal(res.status, 204);
            assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
            assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
            assert.ok(res.headers.get('Access-Control-Allow-Headers').includes('X-App-Key'));
        });

        test('Non-GET methods (POST, PUT, DELETE) return 405 Method Not Allowed', async () => {
            const req = new Request('https://tmdb-proxy.workers.dev/search/movie', {
                method: 'POST',
                headers: { 'X-App-Key': validEnv.CLIENT_KEY }
            });

            const res = await worker.fetch(req, validEnv, {});
            assert.equal(res.status, 405);
            const data = await res.json();
            assert.equal(data.error, 'Method not allowed');
        });
    });

    describe('Authentication (X-App-Key handshake)', () => {
        test('returns 401 when X-App-Key is missing', async () => {
            const req = new Request('https://tmdb-proxy.workers.dev/3/search/movie?query=Avatar');
            const res = await worker.fetch(req, validEnv, {});
            assert.equal(res.status, 401);
            const data = await res.json();
            assert.ok(data.error.includes('Unauthorized'));
        });

        test('returns 401 when X-App-Key is invalid', async () => {
            const req = new Request('https://tmdb-proxy.workers.dev/3/search/movie?query=Avatar', {
                headers: { 'X-App-Key': 'Wrong-Key' }
            });
            const res = await worker.fetch(req, validEnv, {});
            assert.equal(res.status, 401);
            const data = await res.json();
            assert.ok(data.error.includes('Unauthorized'));
        });
    });

    describe('Origin Validation', () => {
        test('permits localhost, 127.0.0.1, [::1], and Electron null/file origins', async () => {
            const allowedOrigins = [
                'http://localhost',
                'http://localhost:3000',
                'http://127.0.0.1:8080',
                'http://[::1]:5000',
                'null'
            ];

            for (const origin of allowedOrigins) {
                const req = new Request('https://tmdb-proxy.workers.dev/search/movie?query=', {
                    headers: {
                        'X-App-Key': validEnv.CLIENT_KEY,
                        'Origin': origin
                    }
                });
                const res = await worker.fetch(req, validEnv, {});
                assert.notEqual(res.status, 403, `Origin ${origin} should not be forbidden`);
            }
        });

        test('blocks untrusted web origins like fake-localhost.com with 403', async () => {
            const forbiddenOrigins = [
                'https://fake-localhost.com',
                'http://localhost.evil.com',
                'https://malicious-website.com'
            ];

            for (const origin of forbiddenOrigins) {
                const req = new Request('https://tmdb-proxy.workers.dev/search/movie?query=Matrix', {
                    headers: {
                        'X-App-Key': validEnv.CLIENT_KEY,
                        'Origin': origin
                    }
                });
                const res = await worker.fetch(req, validEnv, {});
                assert.equal(res.status, 403);
                const data = await res.json();
                assert.ok(data.error.includes('Forbidden'));
            }
        });
    });

    describe('Empty Search Short-Circuit', () => {
        test('returns empty results immediately with 200 for blank query', async () => {
            const req = new Request('https://tmdb-proxy.workers.dev/3/search/movie?query=', {
                headers: { 'X-App-Key': validEnv.CLIENT_KEY }
            });

            const res = await worker.fetch(req, validEnv, {});
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('Cache-Control'), 'public, max-age=3600');
            const data = await res.json();
            assert.deepEqual(data, {
                page: 1,
                results: [],
                total_pages: 0,
                total_results: 0
            });
        });

        test('returns empty results immediately for whitespace query', async () => {
            const req = new Request('https://tmdb-proxy.workers.dev/3/search/movie?query=%20%20', {
                headers: { 'X-App-Key': validEnv.CLIENT_KEY }
            });

            const res = await worker.fetch(req, validEnv, {});
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.results.length, 0);
        });
    });

    describe('Path Whitelisting', () => {
        test('blocks non-whitelisted paths with 403', async () => {
            const disallowedPaths = [
                '/account',
                '/authentication/token/new',
                '/movie/123/rating',
                '/tv/popular',
                '/3/person/456'
            ];

            for (const path of disallowedPaths) {
                const req = new Request(`https://tmdb-proxy.workers.dev${path}`, {
                    headers: { 'X-App-Key': validEnv.CLIENT_KEY }
                });
                const res = await worker.fetch(req, validEnv, {});
                assert.equal(res.status, 403, `Path ${path} should be rejected with 403`);
                const data = await res.json();
                assert.ok(data.error.includes('not permitted'));
            }
        });
    });

    describe('Upstream Request & Secret Configuration', () => {
        test('returns 500 when TMDB_TOKEN secret is missing in Worker env', async () => {
            const req = new Request('https://tmdb-proxy.workers.dev/3/movie/550', {
                headers: { 'X-App-Key': validEnv.CLIENT_KEY }
            });

            const res = await worker.fetch(req, { CLIENT_KEY: validEnv.CLIENT_KEY }, {});
            assert.equal(res.status, 500);
            const data = await res.json();
            assert.ok(data.error.includes('TMDB_TOKEN secret missing'));
        });

        test('forwards request to upstream TMDB and returns cached response', async () => {
            const originalFetch = globalThis.fetch;
            try {
                let calledUrl = null;
                let calledHeaders = null;

                globalThis.fetch = async (url, options) => {
                    calledUrl = url;
                    calledHeaders = options.headers;
                    return new Response(JSON.stringify({ id: 550, title: 'Fight Club' }), {
                        status: 200,
                        statusText: 'OK',
                        headers: { 'Content-Type': 'application/json' }
                    });
                };

                const req = new Request('https://tmdb-proxy.workers.dev/3/movie/550?append_to_response=videos,credits&unauthorized_param=evil', {
                    headers: { 'X-App-Key': validEnv.CLIENT_KEY }
                });

                const res = await worker.fetch(req, validEnv, {});
                assert.equal(res.status, 200);
                assert.ok(res.headers.get('Cache-Control').includes('max-age=43200'));

                // Verify unauthorized query param was stripped and append_to_response values sorted
                assert.ok(calledUrl.includes('/3/movie/550'));
                assert.ok(calledUrl.includes('append_to_response=credits%2Cvideos') || calledUrl.includes('append_to_response=credits,videos'));
                assert.ok(!calledUrl.includes('unauthorized_param'));

                // Verify short v3 token appended as api_key
                assert.ok(calledUrl.includes('api_key=test-tmdb-token-secret-12345'));

                const body = await res.json();
                assert.equal(body.title, 'Fight Club');
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        test('handles upstream 502 error when network fetch throws', async () => {
            const originalFetch = globalThis.fetch;
            try {
                globalThis.fetch = async () => {
                    throw new Error('Connection refused upstream');
                };

                const req = new Request('https://tmdb-proxy.workers.dev/3/movie/550', {
                    headers: { 'X-App-Key': validEnv.CLIENT_KEY }
                });

                const res = await worker.fetch(req, validEnv, {});
                assert.equal(res.status, 502);
                assert.equal(res.headers.get('Cache-Control'), 'no-store');
                const data = await res.json();
                assert.ok(data.error.includes('Unable to contact movie database'));
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });
});
