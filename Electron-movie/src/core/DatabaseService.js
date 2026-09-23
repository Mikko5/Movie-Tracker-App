const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = null;
        this.userDataPath = null;
        this.isDev = false;
        this.debounceTimer = null;
        this.hasPendingBackup = false;
        this.statusCallback = null;
    }

    /**
     * Initializes the SQLite database, WAL mode, schema, and runs migration if necessary.
     * @param {Object} options
     * @param {boolean} options.isDev - Whether running in development mode
     * @param {string} options.userDataPath - Electron userData path
     * @param {string} options.dataDir - Local data directory (e.g., project/data)
     * @param {string} [options.legacyJsonPath] - Path to legacy JSON data file
     * @param {Function} [options.statusCallback] - Event callback for backup/db status notifications
     */
    init({ isDev, userDataPath, dataDir, legacyJsonPath, statusCallback }) {
        this.isDev = Boolean(isDev);
        this.userDataPath = userDataPath;
        this.statusCallback = statusCallback || null;

        // In dev mode, keep the DB in project data/movies.dev.db
        // In prod mode, keep it strictly in userData to avoid cloud-sync locks
        if (this.isDev) {
            this.dbPath = path.join(dataDir, 'movies.dev.db');
        } else {
            this.dbPath = path.join(userDataPath, 'movies.db');
        }

        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new Database(this.dbPath);

        // Performance & concurrency settings
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');

        // Create media_items table
        this._createSchema();
        try { fs.appendFileSync(logFile, `Schema created\n`); } catch (_) {}

        // Migrate legacy JSON if needed
        this._migrateLegacyJsonIfNeeded(legacyJsonPath, dataDir);
        try { fs.appendFileSync(logFile, `Migration checked\n`); } catch (_) {}

        return this;
    }

    /**
     * Sets up the database schema and indexes.
     */
    _createSchema() {
        this.db.exec(`
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
        `);
    }

    /**
     * Migrates records from a legacy JSON file into SQLite if media_items is empty.
     * @param {string} [customLegacyPath]
     * @param {string} dataDir
     */
    _migrateLegacyJsonIfNeeded(customLegacyPath, dataDir) {
        const countRow = this.db.prepare('SELECT COUNT(*) AS count FROM media_items').get();
        if (countRow && countRow.count > 0) {
            // Already populated, no migration needed
            return;
        }

        // Determine candidate paths for legacy JSON
        const candidatePaths = [];
        if (customLegacyPath && fs.existsSync(customLegacyPath)) {
            candidatePaths.push(customLegacyPath);
        }

        if (this.isDev) {
            const devJson = path.join(dataDir, 'movie-data.dev.json');
            if (fs.existsSync(devJson)) candidatePaths.push(devJson);
        } else {
            const prodJson = path.join(dataDir, 'movie-data.json');
            if (fs.existsSync(prodJson)) candidatePaths.push(prodJson);
        }

        const sourceJsonPath = candidatePaths.find(p => fs.existsSync(p));
        if (!sourceJsonPath) {
            // Clean install: no legacy JSON exists, nothing to migrate
            return;
        }

        try {
            const rawContent = fs.readFileSync(sourceJsonPath, 'utf8');
            const items = JSON.parse(rawContent);

            if (Array.isArray(items) && items.length > 0) {
                console.log(`Migrating ${items.length} items from ${sourceJsonPath} into SQLite...`);
                this.bulkInsertMedia(items, false); // Don't trigger backup during initial migration

                // Non-destructive archival
                const backupJsonPath = `${sourceJsonPath}.migrated.bak`;
                if (!fs.existsSync(backupJsonPath)) {
                    fs.copyFileSync(sourceJsonPath, backupJsonPath);
                }

                if (!this.isDev) {
                    // In production, safely rename after successful migration
                    try {
                        fs.unlinkSync(sourceJsonPath);
                    } catch (_) { }
                }
                console.log('Migration to SQLite completed successfully.');
            }
        } catch (err) {
            console.error('Failed to migrate legacy JSON data to SQLite:', err);
        }
    }

    /**
     * Sanitizes and transforms raw JS item to SQLite row params.
     */
    _sanitizeItem(item) {
        const entryId = item.entryId || (Date.now().toString() + Math.random().toString(36).substring(2));
        const tmdbId = item.id !== undefined && item.id !== null ? Number(item.id) : null;
        const mediaType = item.media_type || 'movie';
        const title = item.title ? String(item.title) : 'Untitled';
        const posterPath = item.poster_path ? String(item.poster_path) : null;
        const customPoster = item.customPoster ? String(item.customPoster) : null;
        const releaseDate = item.release_date ? String(item.release_date) : null;
        const runtime = item.runtime !== undefined && item.runtime !== null ? parseInt(item.runtime, 10) : null;
        const genres = JSON.stringify(Array.isArray(item.genres) ? item.genres : []);
        const imdbId = item.imdb_id ? String(item.imdb_id) : null;
        const director = item.director ? String(item.director) : null;
        const score = item.score !== undefined && item.score !== null ? parseFloat(item.score) : null;
        const userRating = item.userRating !== undefined && item.userRating !== null ? parseFloat(item.userRating) : 0;
        const watchDate = item.watchDate ? String(item.watchDate) : '';
        const format = item.format ? String(item.format) : '';
        const comment = item.comment ? String(item.comment) : '';
        const isRewatch = item.isRewatch ? 1 : 0;
        const letterboxdSyncId = item.letterboxdSyncId ? String(item.letterboxdSyncId) : null;
        const letterboxdUrl = item.letterboxdUrl ? String(item.letterboxdUrl) : null;

        return {
            entryId,
            id: tmdbId,
            media_type: mediaType,
            title,
            poster_path: posterPath,
            customPoster,
            release_date: releaseDate,
            runtime,
            genres,
            imdb_id: imdbId,
            director,
            score,
            userRating,
            watchDate,
            format,
            comment,
            isRewatch,
            letterboxdSyncId,
            letterboxdUrl
        };
    }

    /**
     * Maps a SQLite row back to the application object format expected by the frontend.
     */
    _mapRowToItem(row) {
        if (!row) return null;
        let parsedGenres = [];
        try {
            parsedGenres = JSON.parse(row.genres || '[]');
        } catch (_) {
            parsedGenres = [];
        }

        return {
            entryId: row.entryId,
            id: row.id,
            media_type: row.media_type,
            title: row.title,
            poster_path: row.poster_path,
            customPoster: row.customPoster || '',
            release_date: row.release_date || '',
            runtime: row.runtime || 0,
            genres: parsedGenres,
            imdb_id: row.imdb_id || '',
            director: row.director || '',
            score: row.score || 0,
            userRating: row.userRating !== null && row.userRating !== undefined ? row.userRating : 0,
            watchDate: row.watchDate || '',
            format: row.format || '',
            comment: row.comment || '',
            isRewatch: Boolean(row.isRewatch),
            letterboxdSyncId: row.letterboxdSyncId || null,
            letterboxdUrl: row.letterboxdUrl || null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }

    // --- CRUD Operations ---

    /**
     * Gets all media items, optionally filtered by media_type.
     * @param {string} [mediaType] - 'movie', 'tv', or null for all
     * @returns {Array} List of media items
     */
    getAllMedia(mediaType = null) {
        let rows = [];
        if (mediaType) {
            const stmt = this.db.prepare('SELECT * FROM media_items WHERE media_type = ? ORDER BY watchDate DESC, createdAt DESC');
            rows = stmt.all(mediaType);
        } else {
            const stmt = this.db.prepare('SELECT * FROM media_items ORDER BY watchDate DESC, createdAt DESC');
            rows = stmt.all();
        }
        return rows.map(r => this._mapRowToItem(r));
    }

    /**
     * Gets a single media item by entryId.
     * @param {string} entryId
     * @returns {Object|null}
     */
    getMediaById(entryId) {
        const stmt = this.db.prepare('SELECT * FROM media_items WHERE entryId = ?');
        const row = stmt.get(entryId);
        return this._mapRowToItem(row);
    }

    /**
     * Inserts or replaces a media item.
     * @param {Object} item
     */
    insertMedia(item) {
        const sanitized = this._sanitizeItem(item);
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO media_items (
                entryId, id, media_type, title, poster_path, customPoster,
                release_date, runtime, genres, imdb_id, director,
                score, userRating, watchDate, format, comment,
                isRewatch, letterboxdSyncId, letterboxdUrl, updatedAt
            ) VALUES (
                @entryId, @id, @media_type, @title, @poster_path, @customPoster,
                @release_date, @runtime, @genres, @imdb_id, @director,
                @score, @userRating, @watchDate, @format, @comment,
                @isRewatch, @letterboxdSyncId, @letterboxdUrl, datetime('now')
            )
        `);
        stmt.run(sanitized);
        this.scheduleDebouncedBackup();
        return this.getMediaById(sanitized.entryId);
    }

    /**
     * Updates an existing media item.
     * @param {string} entryId
     * @param {Object} item
     */
    updateMedia(entryId, item) {
        const sanitized = this._sanitizeItem({ ...item, entryId });
        const stmt = this.db.prepare(`
            UPDATE media_items SET
                id = @id,
                media_type = @media_type,
                title = @title,
                poster_path = @poster_path,
                customPoster = @customPoster,
                release_date = @release_date,
                runtime = @runtime,
                genres = @genres,
                imdb_id = @imdb_id,
                director = @director,
                score = @score,
                userRating = @userRating,
                watchDate = @watchDate,
                format = @format,
                comment = @comment,
                isRewatch = @isRewatch,
                letterboxdSyncId = @letterboxdSyncId,
                letterboxdUrl = @letterboxdUrl,
                updatedAt = datetime('now')
            WHERE entryId = @entryId
        `);
        stmt.run(sanitized);
        this.scheduleDebouncedBackup();
        return this.getMediaById(entryId);
    }

    /**
     * Deletes a media item by entryId.
     * @param {string} entryId
     */
    deleteMedia(entryId) {
        const stmt = this.db.prepare('DELETE FROM media_items WHERE entryId = ?');
        const info = stmt.run(entryId);
        this.scheduleDebouncedBackup();
        return info.changes > 0;
    }

    /**
     * Bulk inserts multiple media items within a single transaction.
     * @param {Array} items
     * @param {boolean} [triggerBackup=true]
     */
    bulkInsertMedia(items, triggerBackup = true) {
        if (!Array.isArray(items) || items.length === 0) return 0;

        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO media_items (
                entryId, id, media_type, title, poster_path, customPoster,
                release_date, runtime, genres, imdb_id, director,
                score, userRating, watchDate, format, comment,
                isRewatch, letterboxdSyncId, letterboxdUrl, updatedAt
            ) VALUES (
                @entryId, @id, @media_type, @title, @poster_path, @customPoster,
                @release_date, @runtime, @genres, @imdb_id, @director,
                @score, @userRating, @watchDate, @format, @comment,
                @isRewatch, @letterboxdSyncId, @letterboxdUrl, datetime('now')
            )
        `);

        const insertTransaction = this.db.transaction((mediaList) => {
            let count = 0;
            for (const raw of mediaList) {
                const sanitized = this._sanitizeItem(raw);
                stmt.run(sanitized);
                count++;
            }
            return count;
        });

        const insertedCount = insertTransaction(items);
        if (triggerBackup) {
            this.scheduleDebouncedBackup();
        }
        return insertedCount;
    }

    /**
     * Synchronizes the SQLite database with the full list of media items.
     * Inserts/updates items present in the list, and deletes items no longer present.
     * Runs within an atomic SQLite transaction.
     * @param {Array} items
     * @param {boolean} [triggerBackup=true]
     * @returns {{ insertedOrUpdated: number, deleted: number }}
     */
    syncMediaList(items, triggerBackup = true) {
        if (!Array.isArray(items)) return { insertedOrUpdated: 0, deleted: 0 };

        const syncTransaction = this.db.transaction((mediaList) => {
            if (mediaList.length === 0) {
                const info = this.db.prepare('DELETE FROM media_items').run();
                return { insertedOrUpdated: 0, deleted: info.changes };
            }

            // Ensure all incoming items have an entryId before building the ID set
            for (const item of mediaList) {
                if (!item.entryId) {
                    item.entryId = Date.now().toString() + Math.random().toString(36).substring(2);
                }
            }

            const incomingIds = new Set(mediaList.map(item => item.entryId));
            const existingRows = this.db.prepare('SELECT entryId FROM media_items').all();
            const deleteStmt = this.db.prepare('DELETE FROM media_items WHERE entryId = ?');
            let deletedCount = 0;

            for (const row of existingRows) {
                if (!incomingIds.has(row.entryId)) {
                    const info = deleteStmt.run(row.entryId);
                    deletedCount += info.changes;
                }
            }

            const insertStmt = this.db.prepare(`
                INSERT OR REPLACE INTO media_items (
                    entryId, id, media_type, title, poster_path, customPoster,
                    release_date, runtime, genres, imdb_id, director,
                    score, userRating, watchDate, format, comment,
                    isRewatch, letterboxdSyncId, letterboxdUrl, updatedAt
                ) VALUES (
                    @entryId, @id, @media_type, @title, @poster_path, @customPoster,
                    @release_date, @runtime, @genres, @imdb_id, @director,
                    @score, @userRating, @watchDate, @format, @comment,
                    @isRewatch, @letterboxdSyncId, @letterboxdUrl, datetime('now')
                )
            `);

            let upsertedCount = 0;
            for (const raw of mediaList) {
                const sanitized = this._sanitizeItem(raw);
                insertStmt.run(sanitized);
                upsertedCount++;
            }

            return { insertedOrUpdated: upsertedCount, deleted: deletedCount };
        });

        const result = syncTransaction(items);
        if (triggerBackup) {
            this.scheduleDebouncedBackup();
        }
        return result;
    }

    // --- Backup & Recovery Engine ---

    _getBackupSettingsFilePath() {
        if (!this.userDataPath) return null;
        return path.join(this.userDataPath, 'backupSettings.json');
    }

    getBackupSettings() {
        const filePath = this._getBackupSettingsFilePath();
        if (filePath && fs.existsSync(filePath)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return {
                    backupFolder: parsed.backupFolder || null,
                    autoBackupEnabled: parsed.autoBackupEnabled !== false,
                    lastBackupTime: parsed.lastBackupTime || null
                };
            } catch (_) { }
        }
        return {
            backupFolder: null,
            autoBackupEnabled: true,
            lastBackupTime: null
        };
    }

    saveBackupSettings(settings) {
        const filePath = this._getBackupSettingsFilePath();
        if (filePath) {
            try {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
            } catch (err) {
                console.error('Failed to save backup settings:', err);
            }
        }
    }

    getBackupFolder() {
        return this.getBackupSettings().backupFolder;
    }

    isAutoBackupEnabled() {
        const settings = this.getBackupSettings();
        return Boolean(settings.backupFolder && settings.autoBackupEnabled);
    }

    /**
     * Sets the backup folder and triggers an immediate initial backup.
     * @param {string} folderPath
     */
    async setBackupFolder(folderPath) {
        const settings = this.getBackupSettings();
        settings.backupFolder = folderPath;
        settings.autoBackupEnabled = true;
        this.saveBackupSettings(settings);

        // Immediate initial backup
        if (folderPath && fs.existsSync(folderPath)) {
            return await this.performBackup();
        }
        return { success: true };
    }

    /**
     * Toggles automatic backup on or off.
     * If disabling, optionally deletes the existing backup file from the backup folder.
     * @param {boolean} enabled
     * @param {boolean} [deleteExistingFile=false]
     */
    setAutoBackupEnabled(enabled, deleteExistingFile = false) {
        const settings = this.getBackupSettings();
        const wasEnabled = settings.autoBackupEnabled;
        settings.autoBackupEnabled = Boolean(enabled);

        if (!settings.autoBackupEnabled) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            this.hasPendingBackup = false;

            if (deleteExistingFile && settings.backupFolder) {
                const backupFile = path.join(settings.backupFolder, 'movies-backup.db');
                if (fs.existsSync(backupFile)) {
                    try {
                        fs.unlinkSync(backupFile);
                    } catch (err) {
                        console.error('Failed to delete existing backup file:', err);
                    }
                }
            }
        }

        this.saveBackupSettings(settings);
        return { success: true, settings };
    }

    /**
     * Disconnects / removes the configured backup folder.
     * Optionally removes the existing movies-backup.db file from that folder.
     * @param {boolean} [deleteExistingFile=false]
     */
    removeBackupFolder(deleteExistingFile = false) {
        const settings = this.getBackupSettings();
        const currentFolder = settings.backupFolder;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.hasPendingBackup = false;

        if (deleteExistingFile && currentFolder) {
            const backupFile = path.join(currentFolder, 'movies-backup.db');
            if (fs.existsSync(backupFile)) {
                try {
                    fs.unlinkSync(backupFile);
                } catch (err) {
                    console.error('Failed to delete existing backup file:', err);
                }
            }
        }

        settings.backupFolder = null;
        settings.autoBackupEnabled = false;
        this.saveBackupSettings(settings);

        if (this.statusCallback) {
            this.statusCallback({ status: 'removed', message: 'Backup folder disconnected.' });
        }

        return { success: true, settings };
    }

    /**
     * Exports a one-time isolated database snapshot to any chosen file destination.
     * Does NOT alter the backupFolder setting or register ongoing timers.
     * @param {string} destinationFilePath
     */
    async exportDatabase(destinationFilePath) {
        if (!destinationFilePath) {
            return { error: 'No destination file path provided.' };
        }
        if (!this.db) {
            return { error: 'Database is not initialized.' };
        }

        try {
            const destDir = path.dirname(destinationFilePath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            await this.db.backup(destinationFilePath);
            return {
                success: true,
                destinationFile: destinationFilePath,
                exportedAt: new Date().toISOString()
            };
        } catch (err) {
            console.error('Export database failed:', err);
            return { error: err.message };
        }
    }

    /**
     * Auto-disables backup and notifies listeners when the configured folder is missing or deleted.
     */
    _handleMissingBackupFolder() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.hasPendingBackup = false;

        const settings = this.getBackupSettings();
        settings.backupFolder = null;
        settings.autoBackupEnabled = false;
        this.saveBackupSettings(settings);

        if (this.statusCallback) {
            this.statusCallback({
                status: 'disabled',
                message: 'Backup folder was deleted or missing. Automatic backup has been turned off.'
            });
        }
    }

    /**
     * Schedules a debounced backup with a 30-second cooldown timer.
     */
    scheduleDebouncedBackup() {
        const settings = this.getBackupSettings();
        if (!settings.autoBackupEnabled || !settings.backupFolder) {
            return;
        }

        if (!fs.existsSync(settings.backupFolder)) {
            // Folder was deleted or unmounted - auto-disable immediately so we don't keep polling
            this._handleMissingBackupFolder();
            return;
        }

        this.hasPendingBackup = true;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        if (this.statusCallback) {
            this.statusCallback({ status: 'pending', message: 'Backup scheduled in 30 seconds...' });
        }

        this.debounceTimer = setTimeout(async () => {
            this.debounceTimer = null;
            await this.performBackup();
        }, 30000); // 30 seconds cooldown
    }

    /**
     * Performs a consistent SQLite backup to the configured backup folder.
     */
    async performBackup() {
        const settings = this.getBackupSettings();
        if (!settings.backupFolder) {
            return { error: 'Backup folder is not configured.' };
        }

        if (!fs.existsSync(settings.backupFolder)) {
            this._handleMissingBackupFolder();
            return { error: 'Backup folder was deleted or missing. Automatic backup has been turned off.' };
        }

        if (!this.db) {
            return { error: 'Database is not initialized.' };
        }

        const destinationFile = path.join(settings.backupFolder, 'movies-backup.db');

        try {
            if (this.statusCallback) {
                this.statusCallback({ status: 'in-progress', message: 'Writing backup to target folder...' });
            }

            // SQLite native online backup: consistent, non-corrupted, non-blocking
            await this.db.backup(destinationFile);

            this.hasPendingBackup = false;
            const nowIso = new Date().toISOString();
            settings.lastBackupTime = nowIso;
            this.saveBackupSettings(settings);

            if (this.statusCallback) {
                this.statusCallback({
                    status: 'success',
                    message: 'Backup completed successfully!',
                    lastBackupTime: nowIso,
                    destinationFile
                });
            }

            return {
                success: true,
                destinationFile,
                lastBackupTime: nowIso
            };
        } catch (err) {
            console.error('SQLite backup failed:', err);
            if (this.statusCallback) {
                this.statusCallback({
                    status: 'error',
                    message: `Backup failed: ${err.message}`
                });
            }
            return { error: err.message };
        }
    }

    /**
     * Synchronously/blocking flush of any pending backup on application quit.
     */
    flushPendingBackup() {
        if (!this.hasPendingBackup) return;

        const settings = this.getBackupSettings();
        if (!settings.autoBackupEnabled || !settings.backupFolder || !fs.existsSync(settings.backupFolder)) {
            return;
        }

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        const destinationFile = path.join(settings.backupFolder, 'movies-backup.db');
        try {
            console.log('App quitting: Flushing pending backup to destination...');
            fs.copyFileSync(this.dbPath, destinationFile);
            this.hasPendingBackup = false;

            settings.lastBackupTime = new Date().toISOString();
            this.saveBackupSettings(settings);
            console.log('App quit backup flush completed successfully.');
        } catch (err) {
            console.error('Failed to flush backup on app quit:', err);
        }
    }

    /**
     * Restores the database from a given SQLite backup file.
     * @param {string} sourceBackupFile
     */
    restoreDatabase(sourceBackupFile) {
        if (!fs.existsSync(sourceBackupFile)) {
            return { error: 'Source backup file does not exist.' };
        }

        try {
            // Close current connection
            if (this.db) {
                this.db.close();
                this.db = null;
            }

            // Remove any dangling -wal or -shm files
            const walPath = `${this.dbPath}-wal`;
            const shmPath = `${this.dbPath}-shm`;
            if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
            if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

            // Copy backup file over active DB
            fs.copyFileSync(sourceBackupFile, this.dbPath);

            // Re-open DB
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('foreign_keys = ON');

            return { success: true };
        } catch (err) {
            console.error('Failed to restore database from backup:', err);
            // Re-open if possible
            try {
                if (!this.db && fs.existsSync(this.dbPath)) {
                    this.db = new Database(this.dbPath);
                }
            } catch (_) { }
            return { error: err.message };
        }
    }

    /**
     * Closes the database connection cleanly.
     */
    close() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

module.exports = new DatabaseService();
