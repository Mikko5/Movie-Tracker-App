const { XMLParser } = require('fast-xml-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * Parses Letterboxd XML data into movie entries
 * @param {string} xmlData - The raw XML string from the RSS feed
 * @returns {Array} List of parsed movie entries
 */
function parseLetterboxdRSS(xmlData) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_"
    });
    const result = parser.parse(xmlData);
    
    if (!result.rss || !result.rss.channel || !result.rss.channel.item) {
        return [];
    }

    // Ensure it's an array (fast-xml-parser might return a single object if there's only one item)
    const items = Array.isArray(result.rss.channel.item) ? result.rss.channel.item : [result.rss.channel.item];
    
    // Filter out non-movie items (like lists) which don't have a filmTitle
    const movieItems = items.filter(item => item['letterboxd:filmTitle']);
    
    return movieItems.map(item => {
        // Extract the title and year using Letterboxd's specific tags
        let title = item['letterboxd:filmTitle'];
        let year = item['letterboxd:filmYear'] || '';
        let watchedDate = item['letterboxd:watchedDate'] || item.pubDate;
        let memberRating = item['letterboxd:memberRating'] ? parseFloat(item['letterboxd:memberRating']) : 0;
        let isRewatch = item['letterboxd:rewatch'] === 'Yes';
        let tmdbId = item['tmdb:movieId'] ? parseInt(item['tmdb:movieId']) : null;

        // If letterboxd:filmTitle wasn't there, clean up the main title string as a fallback
        if (!item['letterboxd:filmTitle']) {
            if (title.includes(' - ')) {
                const parts = title.split(' - ');
                parts.pop(); // remove rating stars
                title = parts.join(' - ');
            }
            const yearMatch = title.match(/, (\d{4})$/);
            if (yearMatch) {
                year = yearMatch[1];
                title = title.replace(/, \d{4}$/, '');
            }
        }

        // Safely extract guid whether it's an object or string
        let guidStr = typeof item.guid === 'object' ? item.guid['#text'] : item.guid;
        if (!guidStr) {
            guidStr = item.link; // Fallback
        }

        return {
            title: title.trim(),
            year: year,
            letterboxdId: guidStr, // Using GUID for perfect rewatch tracking
            pubDate: watchedDate, // Use actual watched date instead of RSS publish date if available
            link: item.link,
            rating: memberRating,
            isRewatch: isRewatch,
            tmdbId: tmdbId
        };
    });
}

/**
 * Fetch and parse Letterboxd RSS Feed for a specific user
 * @param {string} username - Letterboxd username
 * @returns {Array} List of movie entries
 */
async function fetchLetterboxdRSS(username) {
    try {
        const url = `https://letterboxd.com/${username}/rss/`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch RSS: ${response.statusText}`);
        }
        
        const xmlData = await response.text();
        return parseLetterboxdRSS(xmlData);
    } catch (error) {
        console.error('Error fetching Letterboxd RSS:', error);
        throw error;
    }
}

/**
 * Filter new movies based on last synced ID
 * @param {Array} rssItems - Items fetched from RSS
 * @param {string} lastSyncId - The link/guid of the last synced movie
 * @returns {Array} Array of new movies to sync
 */
function getNewMovies(rssItems, lastSyncId) {
    if (!lastSyncId) {
        return rssItems; // Sync everything if no history
    }

    const newMovies = [];
    for (const item of rssItems) {
        if (item.letterboxdId === lastSyncId) {
            break; // Stop when we reach the last synced item
        }
        newMovies.push(item);
    }
    return newMovies;
}

module.exports = {
    fetchLetterboxdRSS,
    getNewMovies,
    parseLetterboxdRSS
};
