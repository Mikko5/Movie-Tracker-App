const AdmZip = require('adm-zip');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { decodeBoxdId, parseCsvBuffer, BASE62_CHARS } = require('../../src/core/LetterboxdUtils');
const { validateLetterboxdZip, processLetterboxdData, parseLetterboxdZip } = require('../../src/core/LetterboxdImportService');
const { parseLetterboxdRSS, getNewMovies } = require('../../src/core/LetterboxdService');

const results = [];

function recordResult(group, testName, passed, details = '') {
    results.push({ group, testName, passed, details });
    const statusIcon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${statusIcon}] ${group} > ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runEdgeCaseTests() {
    console.log('\n======================================================');
    console.log('STARTING COMPREHENSIVE LETTERBOXD EDGE CASE TEST SUITE');
    console.log('======================================================\n');

    // -------------------------------------------------------------------------
    // GROUP 1: decodeBoxdId Edge Cases
    // -------------------------------------------------------------------------
    const g1 = 'decodeBoxdId (Base62 Decoding)';
    
    // 1.1 Standard shortlink
    try {
        const id = decodeBoxdId('https://boxd.it/c3eVFV');
        recordResult(g1, 'Standard shortlink (c3eVFV -> 1104148129)', id === '1104148129', `id=${id}`);
    } catch (e) {
        recordResult(g1, 'Standard shortlink', false, e.message);
    }

    // 1.2 Shortlink with trailing slash (e.g. https://boxd.it/c3eVFV/)
    try {
        const id = decodeBoxdId('https://boxd.it/c3eVFV/');
        // If it fails to strip trailing slash, parts[parts.length - 1] is empty string and returns null!
        recordResult(g1, 'Trailing slash handling (https://boxd.it/c3eVFV/)', id === '1104148129', `Returned: ${id}`);
    } catch (e) {
        recordResult(g1, 'Trailing slash handling', false, e.message);
    }

    // 1.3 Shortlink with query parameters (e.g. https://boxd.it/c3eVFV?utm_source=boxd)
    try {
        const id = decodeBoxdId('https://boxd.it/c3eVFV?utm_source=boxd');
        recordResult(g1, 'Query parameters in shortlink (https://boxd.it/c3eVFV?utm_source=boxd)', id === '1104148129', `Returned: ${id}`);
    } catch (e) {
        recordResult(g1, 'Query parameters in shortlink', false, e.message);
    }

    // 1.4 Shortlink with anchor/hash (e.g. https://boxd.it/c3eVFV#comments)
    try {
        const id = decodeBoxdId('https://boxd.it/c3eVFV#comments');
        recordResult(g1, 'URL hash handling (https://boxd.it/c3eVFV#comments)', id === '1104148129', `Returned: ${id}`);
    } catch (e) {
        recordResult(g1, 'URL hash handling', false, e.message);
    }

    // 1.5 Non-shortlink full URL (e.g. https://letterboxd.com/user/film/movie-title/)
    try {
        const id = decodeBoxdId('https://letterboxd.com/ikbenmikko/film/the-odyssey-2026/');
        recordResult(g1, 'Full web URL (non-shortlink) returns null safely', id === null, `Returned: ${id}`);
    } catch (e) {
        recordResult(g1, 'Full web URL returns null', false, e.message);
    }

    // 1.6 Malformed inputs (null, undefined, number, object, whitespace)
    try {
        const nullRes = decodeBoxdId(null);
        const undefRes = decodeBoxdId(undefined);
        const numRes = decodeBoxdId(12345);
        const objRes = decodeBoxdId({});
        const wsRes = decodeBoxdId('   ');
        const pass = nullRes === null && undefRes === null && numRes === null && objRes === null && wsRes === null;
        recordResult(g1, 'Malformed & non-string inputs return null safely', pass);
    } catch (e) {
        recordResult(g1, 'Malformed & non-string inputs', false, e.message);
    }


    // -------------------------------------------------------------------------
    // GROUP 2: validateLetterboxdZip Edge Cases
    // -------------------------------------------------------------------------
    const g2 = 'validateLetterboxdZip (Archive & Schema Validation)';

    // 2.1 Non-existent file path
    try {
        await validateLetterboxdZip('C:\\non_existent_path_letterboxd_123.zip');
        recordResult(g2, 'Non-existent file path throws error', false, 'Expected rejection but resolved');
    } catch (e) {
        recordResult(g2, 'Non-existent file path throws error', e.message.includes('not found') || e.message.includes('ZIP'), e.message);
    }

    // 2.2 Corrupted data / zero bytes
    try {
        await validateLetterboxdZip(Buffer.from([]));
        recordResult(g2, 'Empty zero-byte buffer rejected', false);
    } catch (e) {
        recordResult(g2, 'Empty zero-byte buffer rejected', e.message.includes('Invalid or corrupted ZIP'), e.message);
    }

    // 2.3 Non-zip binary data (fake bytes)
    try {
        await validateLetterboxdZip(Buffer.from('GIF89a\x01\x00\x01\x00'));
        recordResult(g2, 'Non-ZIP buffer rejected by magic byte check', false);
    } catch (e) {
        recordResult(g2, 'Non-ZIP buffer rejected by magic byte check', e.message.includes('Invalid or corrupted ZIP'), e.message);
    }

    // 2.4 Empty ZIP archive (valid zip with 0 entries)
    try {
        const emptyZip = new AdmZip();
        await validateLetterboxdZip(emptyZip.toBuffer());
        recordResult(g2, 'Empty ZIP archive (0 files) rejected for missing diary.csv', false);
    } catch (e) {
        recordResult(g2, 'Empty ZIP archive (0 files) rejected for missing diary.csv', e.message.includes("Missing 'diary.csv'"), e.message);
    }

    // 2.5 Valid ZIP containing other files (lists.csv, watched.csv) but no diary.csv
    try {
        const zipNoDiary = new AdmZip();
        zipNoDiary.addFile('watched.csv', Buffer.from('Date,Name,Year,Letterboxd URI\n2024-01-01,Movie,2020,uri\n'));
        zipNoDiary.addFile('lists.csv', Buffer.from('Name,URL\nFavorites,uri\n'));
        await validateLetterboxdZip(zipNoDiary.toBuffer());
        recordResult(g2, 'ZIP with other CSVs but no diary.csv rejected', false);
    } catch (e) {
        recordResult(g2, 'ZIP with other CSVs but no diary.csv rejected', e.message.includes("Missing 'diary.csv'"), e.message);
    }

    // 2.6 Nested folder export (e.g. export-2024-01-01/diary.csv)
    try {
        const nestedZip = new AdmZip();
        nestedZip.addFile('letterboxd-user-export-2024-01-01/diary.csv', Buffer.from(
            'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
            '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,,2024-01-01\n'
        ));
        const res = await validateLetterboxdZip(nestedZip.toBuffer());
        recordResult(g2, 'Nested folder entry in ZIP (export-folder/diary.csv) supported', res.diaryRows.length === 1);
    } catch (e) {
        recordResult(g2, 'Nested folder entry in ZIP supported', false, e.message);
    }

    // 2.7 Case sensitivity of entryName (DIARY.CSV vs diary.csv)
    try {
        const upperZip = new AdmZip();
        upperZip.addFile('DIARY.CSV', Buffer.from(
            'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
            '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,,2024-01-01\n'
        ));
        const res = await validateLetterboxdZip(upperZip.toBuffer());
        recordResult(g2, 'Case-insensitive filename check (DIARY.CSV) supported', res.diaryRows.length === 1);
    } catch (e) {
        recordResult(g2, 'Case-insensitive filename check (DIARY.CSV)', false, e.message);
    }

    // 2.8 Missing required header in diary.csv (e.g. missing Watched Date)
    try {
        const missingHeaderZip = new AdmZip();
        missingHeaderZip.addFile('diary.csv', Buffer.from(
            'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags\n' +
            '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,\n'
        ));
        await validateLetterboxdZip(missingHeaderZip.toBuffer());
        recordResult(g2, 'diary.csv missing "Watched Date" header rejected', false);
    } catch (e) {
        recordResult(g2, 'diary.csv missing "Watched Date" header rejected', e.message.includes('missing required columns') && e.message.includes('Watched Date'), e.message);
    }

    // 2.9 Invalid reviews.csv headers (missing Review column)
    try {
        const badReviewsZip = new AdmZip();
        badReviewsZip.addFile('diary.csv', Buffer.from(
            'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
            '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,,2024-01-01\n'
        ));
        badReviewsZip.addFile('reviews.csv', Buffer.from(
            'Date,Name,Year,Letterboxd URI,Rating\n' +
            '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5\n'
        ));
        await validateLetterboxdZip(badReviewsZip.toBuffer());
        recordResult(g2, 'reviews.csv missing "Review" column rejected', false);
    } catch (e) {
        recordResult(g2, 'reviews.csv missing "Review" column rejected', e.message.includes("Invalid 'reviews.csv' format") && e.message.includes('Review'), e.message);
    }

    // 2.10 Empty diary.csv (0 bytes)
    try {
        const emptyDiaryZip = new AdmZip();
        emptyDiaryZip.addFile('diary.csv', Buffer.from(''));
        await validateLetterboxdZip(emptyDiaryZip.toBuffer());
        recordResult(g2, 'Zero-byte diary.csv rejected', false);
    } catch (e) {
        recordResult(g2, 'Zero-byte diary.csv rejected', e.message.includes('missing required columns'), e.message);
    }

    // -------------------------------------------------------------------------
    // GROUP 3: processLetterboxdData Edge Cases
    // -------------------------------------------------------------------------
    const g3 = 'processLetterboxdData (Deduplication & Field Mapping)';

    // 3.1 Empty diary rows
    try {
        const res = processLetterboxdData([], [], []);
        recordResult(g3, 'Empty diary rows returns 0 totalFound and empty newMovies', res.totalFound === 0 && res.newMovies.length === 0);
    } catch (e) {
        recordResult(g3, 'Empty diary rows', false, e.message);
    }

    // 3.2 Undefined / null optional parameters
    try {
        const res = processLetterboxdData([
            { Name: 'Test', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/5sRy03' }
        ], undefined, undefined);
        recordResult(g3, 'Undefined reviewRows and existingMovies handled with default values', res.newMovies.length === 1);
    } catch (e) {
        recordResult(g3, 'Undefined reviewRows and existingMovies', false, e.message);
    }

    // 3.3 Multiline review with quotes, newlines, and emojis
    try {
        const diary = [{ Name: 'Movie A', Year: '2024', 'Watched Date': '2024-05-01', 'Letterboxd URI': 'https://boxd.it/5sRy03' }];
        const multilineReview = 'Line 1: "Outstanding!"\nLine 2: ⭐️⭐️⭐️⭐️⭐️\r\nLine 3: Truly unforgettable.';
        const reviews = [{ 'Letterboxd URI': 'https://boxd.it/5sRy03', Review: multilineReview }];
        const res = processLetterboxdData(diary, reviews, []);
        recordResult(g3, 'Multiline review preserved with quotes, newlines and emojis', res.newMovies[0].comment === multilineReview);
    } catch (e) {
        recordResult(g3, 'Multiline review preserved', false, e.message);
    }

    // 3.4 In-batch duplicate rows (same export has 2 identical diary rows)
    try {
        const duplicateBatch = [
            { Name: 'Interstellar', Year: '2014', 'Watched Date': '2024-03-01', 'Letterboxd URI': 'https://boxd.it/5sRy03' },
            { Name: 'Interstellar', Year: '2014', 'Watched Date': '2024-03-01', 'Letterboxd URI': 'https://boxd.it/5sRy03' }
        ];
        const res = processLetterboxdData(duplicateBatch, [], []);
        recordResult(g3, 'In-batch duplicate URI deduplicated (second row skipped)', res.totalFound === 2 && res.duplicatesSkipped === 1 && res.newMovies.length === 1, `duplicatesSkipped=${res.duplicatesSkipped}`);
    } catch (e) {
        recordResult(g3, 'In-batch duplicate URI', false, e.message);
    }

    // 3.5 In-batch duplicate by Title + Watched Date without URI
    try {
        const duplicateNoUri = [
            { Name: 'Oppenheimer', Year: '2023', 'Watched Date': '2024-01-01', 'Letterboxd URI': '' },
            { Name: 'Oppenheimer', Year: '2023', 'Watched Date': '2024-01-01', 'Letterboxd URI': '' }
        ];
        const res = processLetterboxdData(duplicateNoUri, [], []);
        // Note: Check if seenBatch handles manual composites in the same batch
        const passed = res.duplicatesSkipped === 1 && res.newMovies.length === 1;
        recordResult(g3, 'In-batch duplicate composite (no URI) deduplicated within same batch', passed, `duplicatesSkipped=${res.duplicatesSkipped}, newMovies=${res.newMovies.length}`);
    } catch (e) {
        recordResult(g3, 'In-batch duplicate composite (no URI)', false, e.message);
    }

    // 3.6 Existing movie with null/undefined fields in database
    try {
        const existingWithNulls = [
            { title: null, watchDate: null, letterboxdSyncId: null, letterboxdUrl: null },
            { title: 'Valid Movie', release_date: undefined, watchDate: '2024-01-01' }
        ];
        const diary = [{ Name: 'Test Movie', Year: '2024', 'Watched Date': '2024-01-01', 'Letterboxd URI': 'https://boxd.it/c3eVFV' }];
        const res = processLetterboxdData(diary, [], existingWithNulls);
        recordResult(g3, 'Existing movies with null/undefined properties handled safely without crashing', res.newMovies.length === 1);
    } catch (e) {
        recordResult(g3, 'Existing movies with null/undefined properties', false, e.message);
    }

    // 3.7 Multiple rewatches on different dates preserved
    try {
        const rewatches = [
            { Name: 'The Matrix', Year: '1999', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/111111' },
            { Name: 'The Matrix', Year: '1999', 'Watched Date': '2022-06-15', 'Letterboxd URI': 'https://boxd.it/222222' }
        ];
        const existing = [
            { title: 'The Matrix', release_date: '1999-03-31', watchDate: '2015-10-10', letterboxdSyncId: 'letterboxd-watch-999999' }
        ];
        const res = processLetterboxdData(rewatches, [], existing);
        recordResult(g3, 'Legitimate rewatches on different dates preserved without false skipping', res.duplicatesSkipped === 0 && res.newMovies.length === 2, `newMovies=${res.newMovies.length}`);
    } catch (e) {
        recordResult(g3, 'Legitimate rewatches on different dates preserved', false, e.message);
    }

    // 3.8 Rating values: empty, decimal, non-numeric, 0
    try {
        const ratingRows = [
            { Name: 'M1', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/aaa1', Rating: '4.5' },
            { Name: 'M2', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/aaa2', Rating: '' },
            { Name: 'M3', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/aaa3', Rating: 'invalid_num' }
        ];
        const res = processLetterboxdData(ratingRows, [], []);
        const r1 = res.newMovies[0].userRating === 4.5;
        const r2 = res.newMovies[1].userRating === 0;
        const r3 = res.newMovies[2].userRating === 0;
        recordResult(g3, 'Ratings correctly coerced (decimal=4.5, empty=0, invalid=0)', r1 && r2 && r3, `r1=${res.newMovies[0].userRating}, r2=${res.newMovies[1].userRating}, r3=${res.newMovies[2].userRating}`);
    } catch (e) {
        recordResult(g3, 'Ratings correctly coerced', false, e.message);
    }

    // 3.9 Tag capitalization: empty, single word, multi-word
    try {
        const tagRows = [
            { Name: 'T1', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/t1', Tags: 'cinema' },
            { Name: 'T2', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/t2', Tags: 'imax 3d' },
            { Name: 'T3', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/t3', Tags: '' }
        ];
        const res = processLetterboxdData(tagRows, [], []);
        const t1 = res.newMovies[0].format === 'Cinema';
        const t2 = res.newMovies[1].format === 'Imax 3d';
        const t3 = res.newMovies[2].format === '';
        recordResult(g3, 'Tags mapped to capitalized format ("cinema"->"Cinema", "imax 3d"->"Imax 3d")', t1 && t2 && t3, `t1=${res.newMovies[0].format}, t2=${res.newMovies[1].format}`);
    } catch (e) {
        recordResult(g3, 'Tags mapped to capitalized format', false, e.message);
    }

    // 3.10 Rewatch boolean parsing ("Yes", "yes", "YES", "No", "")
    try {
        const rewatchRows = [
            { Name: 'R1', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/r1', Rewatch: 'Yes' },
            { Name: 'R2', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/r2', Rewatch: 'yes' },
            { Name: 'R3', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/r3', Rewatch: 'No' },
            { Name: 'R4', Year: '2020', 'Watched Date': '2020-01-01', 'Letterboxd URI': 'https://boxd.it/r4', Rewatch: '' }
        ];
        const res = processLetterboxdData(rewatchRows, [], []);
        const rw1 = res.newMovies[0].isRewatch === 1;
        const rw2 = res.newMovies[1].isRewatch === 1;
        const rw3 = res.newMovies[2].isRewatch === 0;
        const rw4 = res.newMovies[3].isRewatch === 0;
        recordResult(g3, 'Rewatch flag parsed to integer boolean (1 for Yes/yes, 0 for No/empty)', rw1 && rw2 && rw3 && rw4);
    } catch (e) {
        recordResult(g3, 'Rewatch flag parsed to integer boolean', false, e.message);
    }

    // -------------------------------------------------------------------------
    // GROUP 4: parseLetterboxdRSS & getNewMovies Edge Cases
    // -------------------------------------------------------------------------
    const g4 = 'RSS Feed Parsing & Filtering';

    // 4.1 Empty / whitespace XML
    try {
        const res = parseLetterboxdRSS('   ');
        recordResult(g4, 'Empty/whitespace XML returns empty array safely', Array.isArray(res) && res.length === 0);
    } catch (e) {
        recordResult(g4, 'Empty/whitespace XML', false, e.message);
    }

    // 4.2 Non-movie XML items (e.g. list, user review without filmTitle)
    try {
        const listXml = `
            <rss xmlns:letterboxd="https://letterboxd.com/rss/">
                <channel>
                    <item>
                        <title>My Top 10 Films of 2024</title>
                        <link>https://letterboxd.com/user/list/top-10/</link>
                        <guid>letterboxd-list-999</guid>
                    </item>
                </channel>
            </rss>
        `;
        const res = parseLetterboxdRSS(listXml);
        recordResult(g4, 'Non-movie list items filtered out', res.length === 0);
    } catch (e) {
        recordResult(g4, 'Non-movie list items', false, e.message);
    }

    // 4.3 getNewMovies when lastSyncId is not found (stale sync)
    try {
        const feed = [
            { letterboxdId: 'watch-10' },
            { letterboxdId: 'watch-9' },
            { letterboxdId: 'watch-8' }
        ];
        const res = getNewMovies(feed, 'watch-nonexistent');
        // When not found, it iterates through all items and adds them
        recordResult(g4, 'getNewMovies returns all items when lastSyncId is not in feed', res.length === 3);
    } catch (e) {
        recordResult(g4, 'getNewMovies returns all items when lastSyncId is not in feed', false, e.message);
    }

    // -------------------------------------------------------------------------
    // SUMMARY OF FINDINGS
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log('EDGE CASE TEST SUITE EXECUTION COMPLETE');
    console.log('======================================================');
    const total = results.length;
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;
    console.log(`Total Edge Cases Tested: ${total}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed / Anomalies Found: ${failedCount}`);

    if (failedCount > 0) {
        console.log('\n--- FAILED / ANOMALOUS EDGE CASES ---');
        results.filter(r => !r.passed).forEach(r => {
            console.log(`❌ [${r.group}] ${r.testName}: ${r.details}`);
        });
    }
    console.log('======================================================\n');
}

runEdgeCaseTests().catch(err => {
    console.error('Test suite runner crashed:', err);
    process.exit(1);
});
