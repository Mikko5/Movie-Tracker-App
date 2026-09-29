const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { decodeBoxdId, parseCsvBuffer } = require('./LetterboxdUtils');

/**
 * Validates a Letterboxd ZIP archive and extracts parsed diary & reviews rows
 * @param {Buffer|Uint8Array|string} zipBufferOrPath 
 * @returns {Promise<{ diaryRows: object[], reviewRows: object[] }>}
 */
async function validateLetterboxdZip(zipBufferOrPath) {
    let zip;
    let tempFilePath = null;

    try {
        if (typeof zipBufferOrPath === 'string') {
            if (!fs.existsSync(zipBufferOrPath)) {
                throw new Error('ZIP file not found');
            }
            zip = new AdmZip(zipBufferOrPath);
        } else if (zipBufferOrPath && typeof zipBufferOrPath === 'object') {
            const buf = Buffer.from(zipBufferOrPath.buffer || zipBufferOrPath, zipBufferOrPath.byteOffset || 0, zipBufferOrPath.byteLength || zipBufferOrPath.length);
            if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
                throw new Error('Invalid or corrupted ZIP file. Please provide a valid Letterboxd export ZIP.');
            }
            // Write buffer to temporary file to ensure adm-zip reads it natively
            // across different VM and runtime environments
            tempFilePath = path.join(os.tmpdir(), `letterboxd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.zip`);
            fs.writeFileSync(tempFilePath, buf);
            zip = new AdmZip(tempFilePath);
        } else {
            throw new Error('Invalid or corrupted ZIP file. Please provide a valid Letterboxd export ZIP.');
        }
    } catch (err) {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        throw new Error('Invalid or corrupted ZIP file. Please provide a valid Letterboxd export ZIP.');
    }

    try {
        const entries = zip.getEntries();
        const diaryEntry = entries.find(e => !e.isDirectory && (e.entryName.toLowerCase().endsWith('/diary.csv') || e.entryName.toLowerCase() === 'diary.csv'));
        
        if (!diaryEntry) {
            throw new Error("Missing 'diary.csv' in ZIP archive. Please ensure this is an official Letterboxd data export.");
        }

        const diaryBuf = diaryEntry.getData();
        const diaryData = await parseCsvBuffer(diaryBuf);
        const requiredDiaryHeaders = ['Name', 'Year', 'Letterboxd URI', 'Watched Date'];
        const missingDiaryHeaders = requiredDiaryHeaders.filter(h => !diaryData.headers.includes(h));
        
        if (missingDiaryHeaders.length > 0) {
            throw new Error(`Invalid 'diary.csv' format: missing required columns (${missingDiaryHeaders.join(', ')}).`);
        }

        let reviewRows = [];
        const reviewsEntry = entries.find(e => !e.isDirectory && (e.entryName.toLowerCase().endsWith('/reviews.csv') || e.entryName.toLowerCase() === 'reviews.csv'));
        if (reviewsEntry) {
            const reviewsData = await parseCsvBuffer(reviewsEntry.getData());
            const requiredReviewHeaders = ['Letterboxd URI', 'Review'];
            const missingReviewHeaders = requiredReviewHeaders.filter(h => !reviewsData.headers.includes(h));
            if (missingReviewHeaders.length > 0) {
                throw new Error(`Invalid 'reviews.csv' format: missing required columns (${missingReviewHeaders.join(', ')}).`);
            }
            reviewRows = reviewsData.rows;
        }

        return {
            diaryRows: diaryData.rows,
            reviewRows
        };
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
    }
}

/**
 * Merges diary and reviews rows, deduplicating against existing movies in the database
 * @param {Array} diaryRows 
 * @param {Array} reviewRows 
 * @param {Array} existingMovies 
 * @returns {{ totalFound: number, duplicatesSkipped: number, newMovies: Array }}
 */
function processLetterboxdData(diaryRows, reviewRows = [], existingMovies = []) {
    // 1. Build reviews lookup map keyed by Letterboxd URI
    const reviewsMap = new Map();
    for (const r of reviewRows) {
        const uri = (r['Letterboxd URI'] || '').trim();
        if (uri) {
            reviewsMap.set(uri, r.Review || '');
        }
    }

    // 2. Build fast lookup sets for existing movies in DB
    const existingNumericIds = new Set();
    const existingUrls = new Set();
    const existingCompositeKeys = new Set();

    for (const m of existingMovies) {
        if (m.letterboxdSyncId) {
            const digits = String(m.letterboxdSyncId).replace(/\D/g, '');
            if (digits) existingNumericIds.add(digits);
        }
        if (m.letterboxdUrl) {
            const cleanUrl = String(m.letterboxdUrl).trim();
            existingUrls.add(cleanUrl);
            const boxdNum = decodeBoxdId(cleanUrl);
            if (boxdNum) existingNumericIds.add(boxdNum);
        }
        // Manual entry fallback composite: normalizedTitle || year || watchedDate
        if (m.title && m.watchDate) {
            const normTitle = String(m.title).trim().toLowerCase();
            const year = (m.release_date || '').slice(0, 4);
            const date = String(m.watchDate).slice(0, 10);
            existingCompositeKeys.add(`${normTitle}||${year}||${date}`);
        }
    }

    // 3. Process diary rows
    const newMovies = [];
    let duplicatesSkipped = 0;
    const seenBatchIds = new Set();
    const seenBatchUrls = new Set();

    for (const row of diaryRows) {
        const title = (row.Name || '').trim();
        const year = (row.Year || '').trim();
        const watchedDate = (row['Watched Date'] || '').trim();
        const uri = (row['Letterboxd URI'] || '').trim();
        const numericId = decodeBoxdId(uri);
        const rating = parseFloat(row.Rating) || 0;
        const isRewatch = (row.Rewatch || '').trim().toLowerCase() === 'yes';
        const rawTags = (row.Tags || '').trim();

        // Capitalize tag if present for "Watched on" (format)
        let formatStr = '';
        if (rawTags) {
            formatStr = rawTags.charAt(0).toUpperCase() + rawTags.slice(1);
        }

        // Deduplication check
        let isDuplicate = false;
        if (numericId && (existingNumericIds.has(numericId) || seenBatchIds.has(numericId))) {
            isDuplicate = true;
        } else if (uri && (existingUrls.has(uri) || seenBatchUrls.has(uri))) {
            isDuplicate = true;
        } else if (title && watchedDate) {
            const composite = `${title.toLowerCase()}||${year}||${watchedDate}`;
            if (existingCompositeKeys.has(composite)) {
                isDuplicate = true;
            }
        }

        if (isDuplicate) {
            duplicatesSkipped++;
            continue;
        }

        // Record in seen batch sets
        if (numericId) seenBatchIds.add(numericId);
        if (uri) seenBatchUrls.add(uri);

        // Match review comment if available
        const reviewText = reviewsMap.get(uri) || '';

        // Derive letterboxdSyncId
        let syncId = '';
        if (numericId) {
            syncId = reviewText ? `letterboxd-review-${numericId}` : `letterboxd-watch-${numericId}`;
        }

        newMovies.push({
            entryId: Date.now().toString() + Math.random().toString(36).substring(2),
            id: null, // TMDB ID (enriched in background)
            media_type: 'movie',
            title: title,
            poster_path: null,
            customPoster: '',
            release_date: year ? `${year}-01-01` : '',
            runtime: 0,
            genres: [],
            imdb_id: '',
            director: 'N/A',
            score: 0,
            userRating: rating,
            watchDate: watchedDate,
            format: formatStr,
            comment: reviewText,
            isRewatch: isRewatch ? 1 : 0,
            letterboxdSyncId: syncId,
            letterboxdUrl: uri
        });
    }

    return {
        totalFound: diaryRows.length,
        duplicatesSkipped,
        newMovies
    };
}

/**
 * Validates, extracts, and deduplicates a Letterboxd export ZIP file
 * @param {Buffer|string} zipBufferOrPath 
 * @param {Array} existingMovies 
 * @returns {Promise<{ totalFound: number, duplicatesSkipped: number, newMovies: Array }>}
 */
async function parseLetterboxdZip(zipBufferOrPath, existingMovies = []) {
    const { diaryRows, reviewRows } = await validateLetterboxdZip(zipBufferOrPath);
    return processLetterboxdData(diaryRows, reviewRows, existingMovies);
}

module.exports = {
    validateLetterboxdZip,
    processLetterboxdData,
    parseLetterboxdZip
};
