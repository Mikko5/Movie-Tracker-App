// Version: 1.0.0 - Production Edge Proxy for Movie Tracker
/**
 * Cloudflare Worker: Production-Grade TMDB Edge Proxy
 * Features:
 *  - X-App-Key Authentication with timingSafeEqual
 *  - URL-Parsed Origin Validation (strict hostname matching for localhost, 127.0.0.1, [::1], null)
 *  - Memory-bounded burst smoothing (40 req / 10s per IP)
 *  - Empty search short-circuiting (0ms / 0 TMDB calls)
 *  - Full whitelist: /search/movie, /movie/{id}, credits, images, videos, trending, popular, upcoming, genre list
 *  - Canonical parameter and sub-value sorting (100% cache hit consistency)
 *  - Multi-tier edge (24h) and browser (12h) caching with no-store on errors
 */

const ipRequestCounts = new Map();
const MAX_TRACKED_IPS = 2000;
const DEFAULT_CLIENT_KEY = 'MovieTracker-Client-Secure-2026';

const ALLOWED_QUERY_PARAMS = new Set([
    'query',
    'page',
    'append_to_response',
    'language',
    'include_image_language',
    'include_adult'
]);

function timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
}

export default {
    async fetch(request, env, ctx) {
        // 1. Handle CORS Preflight (OPTIONS)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Key',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        if (request.method !== 'GET') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // 2. Secret Handshake Authentication
        const expectedKey = env.CLIENT_KEY || DEFAULT_CLIENT_KEY;
        const clientKey = request.headers.get('X-App-Key');

        if (!clientKey || !timingSafeEqual(clientKey, expectedKey)) {
            return new Response(JSON.stringify({
                error: 'Unauthorized: Access restricted to Movie Tracker app'
            }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // 3. Strict Origin Validation (Blocks external domains like fake-localhost.com)
        const origin = request.headers.get('origin');
        let isAllowedOrigin = !origin || origin === 'null' || origin.startsWith('file://');

        if (origin && !isAllowedOrigin) {
            try {
                const { hostname } = new URL(origin);
                isAllowedOrigin = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
            } catch {
                isAllowedOrigin = false;
            }
        }

        if (!isAllowedOrigin) {
            return new Response(JSON.stringify({
                error: 'Forbidden: External websites are not permitted to use this proxy'
            }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // 4. Memory-Bounded Burst Protection (Max 40 req / 10s per IP)
        if (ipRequestCounts.size > MAX_TRACKED_IPS) {
            ipRequestCounts.clear();
        }

        const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
        const now = Date.now();
        const clientHistory = ipRequestCounts.get(clientIp) || [];
        const recentRequests = clientHistory.filter(ts => now - ts < 10000);

        if (recentRequests.length >= 40) {
            return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Retry-After': '2'
                }
            });
        }
        recentRequests.push(now);
        ipRequestCounts.set(clientIp, recentRequests);

        const url = new URL(request.url);

        // 5. Normalize Path (handles both /3/... and /...)
        let normalizedPath = url.pathname;
        if (normalizedPath.startsWith('/3/')) {
            normalizedPath = normalizedPath.slice(2);
        } else if (normalizedPath === '/3') {
            normalizedPath = '/';
        }

        // 6. Short-Circuit Empty Searches
        if (normalizedPath === '/search/movie') {
            const query = url.searchParams.get('query');
            if (!query || query.trim() === '') {
                return new Response(JSON.stringify({ page: 1, results: [], total_pages: 0, total_results: 0 }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=3600'
                    }
                });
            }
        }

        // 7. Strict Path Whitelisting (Includes trailers, credits, images, discovery & genre list)
        const isAllowed =
            normalizedPath === '/search/movie' ||
            normalizedPath === '/genre/movie/list' ||
            /^\/movie\/[0-9]{1,10}$/.test(normalizedPath) ||
            /^\/movie\/[0-9]{1,10}\/(credits|images|videos)$/.test(normalizedPath) ||
            /^\/trending\/movie\/(day|week)$/.test(normalizedPath) ||
            /^\/movie\/(popular|top_rated|now_playing|upcoming)$/.test(normalizedPath);

        if (!isAllowed) {
            return new Response(JSON.stringify({
                error: 'Endpoint not permitted by proxy',
                path: url.pathname
            }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // 8. Sanitize, Sort Params and Sub-values (Guarantees Canonical Cache Keys)
        const cleanParams = new URLSearchParams();
        for (const [key, value] of url.searchParams.entries()) {
            if (ALLOWED_QUERY_PARAMS.has(key)) {
                if (key === 'append_to_response') {
                    const safeValues = value.split(',').map(v => v.trim()).filter(v => ['credits', 'images', 'videos'].includes(v));
                    if (safeValues.length > 0) {
                        safeValues.sort();
                        cleanParams.set(key, safeValues.join(','));
                    }
                } else {
                    cleanParams.set(key, value);
                }
            }
        }
        cleanParams.sort();

        // 9. Upstream Request & Secrets
        const queryString = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
        const upstreamUrl = new URL(`https://api.themoviedb.org/3${normalizedPath}${queryString}`);
        const headers = new Headers();
        headers.set('Accept', 'application/json');

        const token = env.TMDB_TOKEN;
        if (!token) {
            return new Response(JSON.stringify({ error: 'TMDB_TOKEN secret missing in Worker' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        if (token.length > 100) {
            headers.set('Authorization', `Bearer ${token}`);
        } else {
            upstreamUrl.searchParams.set('api_key', token);
        }

        // 10. Caching Strategy
        const isSearch = normalizedPath.includes('/search/');
        const edgeTtl = isSearch ? 1800 : 86400;       // Edge: 30m searches, 24h details
        const browserTtl = isSearch ? 300 : 43200;     // Browser: 5m searches, 12h details

        try {
            const upstreamResponse = await fetch(upstreamUrl.toString(), {
                method: 'GET',
                headers: headers,
                cf: {
                    cacheTtl: edgeTtl,
                    cacheEverything: true
                }
            });

            // 11. Clean Headers for Client
            const responseHeaders = new Headers();
            responseHeaders.set('Content-Type', 'application/json');
            responseHeaders.set('Access-Control-Allow-Origin', '*');
            responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

            if (upstreamResponse.status === 200) {
                responseHeaders.set('Cache-Control', `public, max-age=${browserTtl}, stale-while-revalidate=3600`);
            } else {
                responseHeaders.set('Cache-Control', 'no-store');
            }

            return new Response(upstreamResponse.body, {
                status: upstreamResponse.status,
                statusText: upstreamResponse.statusText,
                headers: responseHeaders
            });
        } catch (err) {
            console.error('Upstream fetch error:', err);
            return new Response(JSON.stringify({
                error: 'Unable to contact movie database. Please try again later.'
            }), {
                status: 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-store'
                }
            });
        }
    }
};
