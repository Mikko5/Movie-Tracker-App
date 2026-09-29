const csv = require('csv-parser');
const { Readable } = require('stream');

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Decodes a Letterboxd short URL (e.g. https://boxd.it/c3eVFV) to its underlying numeric ID
 * @param {string} boxdUrl 
 * @returns {string|null} Numeric ID string (e.g. '1104148129') or null
 */
function decodeBoxdId(boxdUrl) {
    if (!boxdUrl || typeof boxdUrl !== 'string') return null;
    const parts = boxdUrl.trim().split('/');
    const slug = parts[parts.length - 1].trim();
    if (!slug) return null;
    
    let num = 0n;
    for (const c of slug) {
        const idx = BASE62_CHARS.indexOf(c);
        if (idx === -1) return null;
        num = num * 62n + BigInt(idx);
    }
    return (num / 10n).toString();
}

/**
 * Parses a CSV buffer or string into an array of row objects and list of headers
 * @param {Buffer|string} bufferOrString 
 * @returns {Promise<{ headers: string[], rows: object[] }>}
 */
function parseCsvBuffer(bufferOrString) {
    return new Promise((resolve, reject) => {
        const rows = [];
        let headers = [];
        const buffer = Buffer.isBuffer(bufferOrString) ? bufferOrString : Buffer.from(bufferOrString);
        const stream = Readable.from([buffer]);
        stream
            .pipe(csv({ trim: true }))
            .on('headers', (h) => {
                headers = h;
            })
            .on('data', (data) => rows.push(data))
            .on('end', () => resolve({ headers, rows }))
            .on('error', reject);
    });
}

module.exports = {
    BASE62_CHARS,
    decodeBoxdId,
    parseCsvBuffer
};
