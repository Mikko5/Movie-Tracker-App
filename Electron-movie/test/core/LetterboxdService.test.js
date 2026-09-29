const {
    parseLetterboxdRSS,
    getNewMovies,
    decodeBoxdId,
    parseCsvBuffer,
    validateLetterboxdZip,
    processLetterboxdData,
    parseLetterboxdZip
} = require('../../src/core/LetterboxdService');

describe('LetterboxdService', () => {
    describe('parseLetterboxdRSS', () => {
        it('should correctly parse a standard movie item', () => {
            const xml = `
                <rss xmlns:letterboxd="https://letterboxd.com/rss/" xmlns:tmdb="https://www.themoviedb.org/rss/">
                    <channel>
                        <item>
                            <title>Spirited Away, 2001 - ★★★★★</title>
                            <link>https://letterboxd.com/test/film/spirited-away/</link>
                            <guid isPermaLink="false">letterboxd-watch-12345</guid>
                            <pubDate>Mon, 2 Oct 2023 14:12:23 +1300</pubDate>
                            <letterboxd:watchedDate>2023-10-01</letterboxd:watchedDate>
                            <letterboxd:rewatch>No</letterboxd:rewatch>
                            <letterboxd:filmTitle>Spirited Away</letterboxd:filmTitle>
                            <letterboxd:filmYear>2001</letterboxd:filmYear>
                            <letterboxd:memberRating>5.0</letterboxd:memberRating>
                            <tmdb:movieId>129</tmdb:movieId>
                        </item>
                    </channel>
                </rss>
            `;

            const result = parseLetterboxdRSS(xml);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                title: 'Spirited Away',
                year: 2001,
                letterboxdId: 'letterboxd-watch-12345',
                pubDate: '2023-10-01',
                link: 'https://letterboxd.com/test/film/spirited-away/',
                rating: 5.0,
                isRewatch: false,
                tmdbId: 129
            });
        });

        it('should filter out non-movie items (like lists) that lack letterboxd:filmTitle', () => {
            const xml = `
                <rss xmlns:letterboxd="https://letterboxd.com/rss/" xmlns:tmdb="https://www.themoviedb.org/rss/">
                    <channel>
                        <item>
                            <title>My October List</title>
                            <link>https://letterboxd.com/test/list/october/</link>
                            <guid isPermaLink="false">letterboxd-list-67890</guid>
                            <pubDate>Mon, 2 Oct 2023 14:12:23 +1300</pubDate>
                        </item>
                    </channel>
                </rss>
            `;

            const result = parseLetterboxdRSS(xml);
            expect(result).toHaveLength(0); // Should be filtered out completely
        });

        it('should correctly parse a rewatch', () => {
            const xml = `
                <rss xmlns:letterboxd="https://letterboxd.com/rss/" xmlns:tmdb="https://www.themoviedb.org/rss/">
                    <channel>
                        <item>
                            <title>Inception</title>
                            <link>https://letterboxd.com/test/film/inception/</link>
                            <guid isPermaLink="false">letterboxd-watch-54321</guid>
                            <pubDate>Mon, 2 Oct 2023 14:12:23 +1300</pubDate>
                            <letterboxd:rewatch>Yes</letterboxd:rewatch>
                            <letterboxd:filmTitle>Inception</letterboxd:filmTitle>
                        </item>
                    </channel>
                </rss>
            `;

            const result = parseLetterboxdRSS(xml);
            expect(result).toHaveLength(1);
            expect(result[0].isRewatch).toBe(true);
        });
    });

    describe('getNewMovies', () => {
        it('should return all movies if lastSyncId is null', () => {
            const items = [{ letterboxdId: '1' }, { letterboxdId: '2' }];
            const result = getNewMovies(items, null);
            expect(result).toHaveLength(2);
        });

        it('should return only new movies up to the lastSyncId', () => {
            const items = [
                { letterboxdId: 'watch-3' },
                { letterboxdId: 'watch-2' },
                { letterboxdId: 'watch-1' }
            ];
            const result = getNewMovies(items, 'watch-1');
            expect(result).toHaveLength(2);
            expect(result[0].letterboxdId).toBe('watch-3');
            expect(result[1].letterboxdId).toBe('watch-2');
        });
    });

    describe('backward compatibility re-exports', () => {
        it('should re-export bulk import functions', () => {
            expect(typeof decodeBoxdId).toBe('function');
            expect(typeof parseCsvBuffer).toBe('function');
            expect(typeof validateLetterboxdZip).toBe('function');
            expect(typeof processLetterboxdData).toBe('function');
            expect(typeof parseLetterboxdZip).toBe('function');
        });
    });
});
