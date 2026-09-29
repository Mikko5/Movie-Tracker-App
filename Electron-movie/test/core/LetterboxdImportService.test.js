if (typeof Uint8Array !== 'undefined') {
    try {
        Object.defineProperty(Uint8Array, Symbol.hasInstance, {
            value: (inst) => inst != null && (
                ArrayBuffer.isView(inst) ||
                inst._isBuffer === true ||
                inst.constructor?.name === 'Uint8Array' ||
                inst.constructor?.name === 'Buffer'
            ),
            configurable: true
        });
    } catch (e) {}
}

const AdmZip = require('adm-zip');
const {
    validateLetterboxdZip,
    processLetterboxdData,
    parseLetterboxdZip
} = require('../../src/core/LetterboxdImportService');

describe('LetterboxdImportService', () => {
    describe('validateLetterboxdZip', () => {
        it('should reject invalid or non-ZIP data', async () => {
            await expect(validateLetterboxdZip(Buffer.from('not a zip file')))
                .rejects.toThrow('Invalid or corrupted ZIP file');
        });

        it('should reject ZIP missing diary.csv', async () => {
            const zip = new AdmZip();
            zip.addFile('other.txt', Buffer.from('hello'));
            await expect(validateLetterboxdZip(zip.toBuffer()))
                .rejects.toThrow("Missing 'diary.csv' in ZIP archive");
        });

        it('should reject diary.csv with missing required headers', async () => {
            const zip = new AdmZip();
            zip.addFile('diary.csv', Buffer.from('Col1,Col2\nVal1,Val2\n'));
            await expect(validateLetterboxdZip(zip.toBuffer()))
                .rejects.toThrow("Invalid 'diary.csv' format: missing required columns");
        });

        it('should accept valid ZIP with diary.csv and reviews.csv', async () => {
            const zip = new AdmZip();
            zip.addFile('diary.csv', Buffer.from(
                'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
                '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,,2024-01-01\n'
            ));
            zip.addFile('reviews.csv', Buffer.from(
                'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n' +
                '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,Great movie!,,2024-01-01\n'
            ));

            const { diaryRows, reviewRows } = await validateLetterboxdZip(zip.toBuffer());
            expect(diaryRows).toHaveLength(1);
            expect(reviewRows).toHaveLength(1);
            expect(diaryRows[0].Name).toBe('The Prestige');
            expect(reviewRows[0].Review).toBe('Great movie!');
        });
    });

    describe('processLetterboxdData', () => {
        const diaryRows = [
            {
                Date: '2024-01-02',
                Name: 'The Prestige',
                Year: '2006',
                'Letterboxd URI': 'https://boxd.it/5sRy03',
                Rating: '4.5',
                Rewatch: '',
                Tags: 'cinema',
                'Watched Date': '2024-01-01'
            },
            {
                Date: '2026-07-22',
                Name: 'The Odyssey',
                Year: '2026',
                'Letterboxd URI': 'https://boxd.it/fn7BQp',
                Rating: '4.5',
                Rewatch: '',
                Tags: 'cinema',
                'Watched Date': '2026-07-21'
            }
        ];

        const reviewRows = [
            {
                'Letterboxd URI': 'https://boxd.it/5sRy03',
                Review: 'A masterclass in misdirection.'
            }
        ];

        it('should merge reviews into comments and map tags to format', () => {
            const result = processLetterboxdData(diaryRows, reviewRows, []);
            expect(result.totalFound).toBe(2);
            expect(result.duplicatesSkipped).toBe(0);
            expect(result.newMovies).toHaveLength(2);

            const prestige = result.newMovies.find(m => m.title === 'The Prestige');
            expect(prestige.comment).toBe('A masterclass in misdirection.');
            expect(prestige.format).toBe('Cinema');
            expect(prestige.watchDate).toBe('2024-01-01');
            expect(prestige.letterboxdSyncId).toBe('letterboxd-review-500716365');
            expect(prestige.letterboxdUrl).toBe('https://boxd.it/5sRy03');
        });

        it('should deduplicate against existing movies using decoded numeric ID', () => {
            const existingMovies = [
                {
                    title: 'The Odyssey',
                    letterboxdSyncId: 'letterboxd-review-1408366198', // Decoded ID of fn7BQp
                    letterboxdUrl: 'https://letterboxd.com/ikbenmikko/film/the-odyssey-2026/'
                }
            ];

            const result = processLetterboxdData(diaryRows, reviewRows, existingMovies);
            expect(result.totalFound).toBe(2);
            expect(result.duplicatesSkipped).toBe(1); // The Odyssey skipped
            expect(result.newMovies).toHaveLength(1);
            expect(result.newMovies[0].title).toBe('The Prestige');
        });

        it('should deduplicate manual entries by Title + Year + Watched Date', () => {
            const existingMovies = [
                {
                    title: 'The Prestige',
                    release_date: '2006-10-19',
                    watchDate: '2024-01-01',
                    letterboxdSyncId: null,
                    letterboxdUrl: null
                }
            ];

            const result = processLetterboxdData(diaryRows, reviewRows, existingMovies);
            expect(result.duplicatesSkipped).toBe(1); // The Prestige skipped
            expect(result.newMovies).toHaveLength(1);
            expect(result.newMovies[0].title).toBe('The Odyssey');
        });

        it('should allow rewatches on different dates without false skipping', () => {
            const existingMovies = [
                {
                    title: 'The Prestige',
                    release_date: '2006-10-19',
                    watchDate: '2020-05-10', // Different watch date!
                    letterboxdSyncId: 'letterboxd-watch-999999',
                    letterboxdUrl: 'https://boxd.it/different'
                }
            ];

            const result = processLetterboxdData(diaryRows, reviewRows, existingMovies);
            expect(result.duplicatesSkipped).toBe(0);
            expect(result.newMovies).toHaveLength(2);
        });
    });

    describe('parseLetterboxdZip', () => {
        it('should parse a complete Letterboxd export ZIP buffer', async () => {
            const zip = new AdmZip();
            zip.addFile('diary.csv', Buffer.from(
                'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
                '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,,2024-01-01\n'
            ));
            const result = await parseLetterboxdZip(zip.toBuffer(), []);
            expect(result.totalFound).toBe(1);
            expect(result.duplicatesSkipped).toBe(0);
            expect(result.newMovies).toHaveLength(1);
            expect(result.newMovies[0].title).toBe('The Prestige');
        });
    });
});
