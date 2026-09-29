/**
 * Database Seeder Script
 * Resets the development SQLite database and legacy JSON snapshot
 * to a clean test baseline with 4 representative movies.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { createSeedZip } = require('./create-seed-zip');

const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'movies.dev.db');
const jsonPath = path.join(dataDir, 'movie-data.dev.json');

const SEED_MOVIES = [
    {
        entryId: "seed-prestige-2006",
        id: 1124,
        media_type: "movie",
        title: "The Prestige",
        poster_path: "/Ag2B2KHKQPukjH7WutmgnnSNurZ.jpg",
        customPoster: null,
        release_date: "2006-10-19",
        runtime: 130,
        genres: ["Drama", "Mystery", "Sci-Fi"],
        imdb_id: "tt0482571",
        director: "Christopher Nolan",
        score: 82,
        userRating: 4.5,
        watchDate: "2024-01-01",
        format: "Cinema",
        comment: "Hans Klok is er niks bij",
        isRewatch: 0,
        letterboxdSyncId: "letterboxd-review-500716365",
        letterboxdUrl: "https://boxd.it/5sRy03"
    },
    {
        entryId: "seed-inception-2010",
        id: 27205,
        media_type: "movie",
        title: "Inception",
        poster_path: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        customPoster: null,
        release_date: "2010-07-15",
        runtime: 148,
        genres: ["Action", "Science Fiction", "Adventure"],
        imdb_id: "tt1375666",
        director: "Christopher Nolan",
        score: 83,
        userRating: 4,
        watchDate: "2021-01-25",
        format: "Blu-ray",
        comment: "Your mind is the scene of the crime.",
        isRewatch: 0,
        letterboxdSyncId: "letterboxd-diary-1104148130",
        letterboxdUrl: "https://boxd.it/5c0sR1"
    },
    {
        entryId: "seed-the-guilty-2021",
        id: 567748,
        media_type: "movie",
        title: "The Guilty",
        poster_path: "/m8aR1k35oZMOzZ1kYWUyt401mwq.jpg",
        customPoster: null,
        release_date: "2021-09-24",
        runtime: 91,
        genres: ["Drama", "Thriller"],
        imdb_id: "tt9421570",
        director: "Antoine Fuqua",
        score: 64,
        userRating: 3.5,
        watchDate: "2023-01-01",
        format: "Netflix",
        comment: "Film speelt zich af in een kamer; spannend tot het einde",
        isRewatch: 0,
        letterboxdSyncId: null,
        letterboxdUrl: null
    },
    {
        entryId: "seed-godzilla-vs-kong-2021",
        id: 399566,
        media_type: "movie",
        title: "Godzilla vs. Kong",
        poster_path: "/pgqgaUx1cJb5oZQQ5v0tNARCeBp.jpg",
        customPoster: "/mO4OYC3SDN8rXzp0J3PyhaUz7tQ.jpg",
        release_date: "2021-03-24",
        runtime: 114,
        genres: ["Action", "Science Fiction", "Adventure"],
        imdb_id: "tt5034838",
        director: "Adam Wingard",
        score: 66,
        userRating: 3,
        watchDate: "2023-01-07",
        format: "HBO",
        comment: "Goede actie maar verhaal is minder",
        isRewatch: 0,
        letterboxdSyncId: null,
        letterboxdUrl: null
    }
];

function seed() {
    console.log('🌱 Seeding development database...');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Connect to SQLite database
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Ensure schema exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS media_items (
            entryId TEXT PRIMARY KEY,
            id INTEGER,
            media_type TEXT NOT NULL DEFAULT 'movie',
            title TEXT NOT NULL,
            poster_path TEXT,
            customPoster TEXT,
            release_date TEXT,
            runtime INTEGER,
            genres TEXT,
            imdb_id TEXT,
            director TEXT,
            score REAL,
            userRating REAL,
            watchDate TEXT,
            format TEXT,
            comment TEXT,
            isRewatch INTEGER DEFAULT 0,
            letterboxdSyncId TEXT,
            letterboxdUrl TEXT,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
        CREATE INDEX IF NOT EXISTS idx_watch_date ON media_items(watchDate);
        CREATE INDEX IF NOT EXISTS idx_title ON media_items(title);

        DELETE FROM media_items;
    `);

    const insertStmt = db.prepare(`
        INSERT INTO media_items (
            entryId, id, media_type, title, poster_path, customPoster,
            release_date, runtime, genres, imdb_id, director,
            score, userRating, watchDate, format, comment,
            isRewatch, letterboxdSyncId, letterboxdUrl, createdAt, updatedAt
        ) VALUES (
            @entryId, @id, @media_type, @title, @poster_path, @customPoster,
            @release_date, @runtime, @genres, @imdb_id, @director,
            @score, @userRating, @watchDate, @format, @comment,
            @isRewatch, @letterboxdSyncId, @letterboxdUrl, datetime('now'), datetime('now')
        )
    `);

    const insertMany = db.transaction((movies) => {
        for (const movie of movies) {
            insertStmt.run({
                ...movie,
                genres: JSON.stringify(movie.genres)
            });
        }
    });

    insertMany(SEED_MOVIES);
    db.close();

    // Also update dev JSON file snapshot
    fs.writeFileSync(jsonPath, JSON.stringify(SEED_MOVIES, null, 2), 'utf8');

    // Reset lastSyncId in letterboxdSettings.json if present
    const appData = process.env.APPDATA;
    if (appData) {
        const letterboxdSettingsPath = path.join(appData, 'electron-movie-json-demo-dev', 'letterboxdSettings.json');
        if (fs.existsSync(letterboxdSettingsPath)) {
            try {
                const settings = JSON.parse(fs.readFileSync(letterboxdSettingsPath, 'utf8'));
                settings.lastSyncId = '';
                fs.writeFileSync(letterboxdSettingsPath, JSON.stringify(settings, null, 2), 'utf8');
                console.log('🔄 Reset Letterboxd sync cursor (lastSyncId: "") in dev settings.');
            } catch (_) {}
        }
    }

    console.log(`\n✅ Database successfully seeded with ${SEED_MOVIES.length} movies:`);
    SEED_MOVIES.forEach((m, idx) => {
        console.log(`   ${idx + 1}. ${m.title} (${m.release_date.slice(0, 4)}) - Rating: ${m.userRating}★ [${m.format || 'Unspecified'}]`);
    });
    console.log(`\n📁 Seeded DB: ${dbPath}`);

    // Generate seed ZIP for testing Letterboxd bulk import
    createSeedZip();
}

seed();
