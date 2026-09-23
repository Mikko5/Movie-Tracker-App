const path = require('path');
const fs = require('fs');

// We use an isolated temporary test directory
const TEST_DIR = path.join(__dirname, '..', '..', 'scratch_test_db');
const TEST_DATA_DIR = path.join(TEST_DIR, 'data');
const TEST_USER_DIR = path.join(TEST_DIR, 'userData');
const TEST_BACKUP_DIR = path.join(TEST_DIR, 'backups');

describe('DatabaseService', () => {
    let DatabaseService;

    beforeAll(() => {
        // Clean up any previous test directory
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
        fs.mkdirSync(TEST_USER_DIR, { recursive: true });
        fs.mkdirSync(TEST_BACKUP_DIR, { recursive: true });

        DatabaseService = require('../../src/core/DatabaseService');
    });

    afterAll(() => {
        if (DatabaseService) {
            DatabaseService.close();
        }
        if (fs.existsSync(TEST_DIR)) {
            try {
                fs.rmSync(TEST_DIR, { recursive: true, force: true });
            } catch (_) { }
        }
    });

    test('clean install initializes empty database with zero errors', () => {
        DatabaseService.init({
            isDev: true,
            userDataPath: TEST_USER_DIR,
            dataDir: TEST_DATA_DIR,
            legacyJsonPath: path.join(TEST_DATA_DIR, 'non-existent.json')
        });

        const items = DatabaseService.getAllMedia();
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
    });

    test('CRUD operations work properly and return mapped fields', () => {
        const movie1 = {
            entryId: 'test-entry-1',
            id: 101,
            title: 'Inception',
            director: 'Christopher Nolan',
            genres: ['Action', 'Sci-Fi'],
            userRating: 4.5,
            score: 88,
            watchDate: '2026-01-15',
            format: '4K Blu-ray',
            comment: 'Mind-bending masterpiece',
            isRewatch: true
        };

        const inserted = DatabaseService.insertMedia(movie1);
        expect(inserted.entryId).toBe('test-entry-1');
        expect(inserted.title).toBe('Inception');
        expect(inserted.media_type).toBe('movie');
        expect(inserted.genres).toEqual(['Action', 'Sci-Fi']);
        expect(inserted.isRewatch).toBe(true);
        expect(inserted.userRating).toBe(4.5);

        // Fetch all
        const all = DatabaseService.getAllMedia();
        expect(all.length).toBe(1);
        expect(all[0].title).toBe('Inception');

        // Update
        const updated = DatabaseService.updateMedia('test-entry-1', {
            ...movie1,
            userRating: 5.0,
            comment: 'Updated review'
        });
        expect(updated.userRating).toBe(5.0);
        expect(updated.comment).toBe('Updated review');

        // Delete
        const deleted = DatabaseService.deleteMedia('test-entry-1');
        expect(deleted).toBe(true);
        expect(DatabaseService.getAllMedia().length).toBe(0);
    });

    test('supports future-proof media_type (movies and tv shows)', () => {
        DatabaseService.insertMedia({
            entryId: 'movie-1',
            title: 'Interstellar',
            media_type: 'movie',
            genres: ['Sci-Fi']
        });

        DatabaseService.insertMedia({
            entryId: 'tv-1',
            title: 'Breaking Bad',
            media_type: 'tv',
            genres: ['Drama', 'Crime']
        });

        const all = DatabaseService.getAllMedia();
        expect(all.length).toBe(2);

        const onlyMovies = DatabaseService.getAllMedia('movie');
        expect(onlyMovies.length).toBe(1);
        expect(onlyMovies[0].title).toBe('Interstellar');

        const onlyTv = DatabaseService.getAllMedia('tv');
        expect(onlyTv.length).toBe(1);
        expect(onlyTv[0].title).toBe('Breaking Bad');

        // Cleanup
        DatabaseService.deleteMedia('movie-1');
        DatabaseService.deleteMedia('tv-1');
    });

    test('migrates legacy JSON data, preserves Letterboxd fields, and archives JSON', () => {
        DatabaseService.close();

        // Prepare fresh subfolder for migration test
        const migDataDir = path.join(TEST_DIR, 'migration_data');
        fs.mkdirSync(migDataDir, { recursive: true });

        const legacyJsonPath = path.join(migDataDir, 'movie-data.dev.json');
        const seedMovies = [
            {
                id: 1368337,
                entryId: 'odyssey-1',
                title: 'The Odyssey',
                genres: ['Adventure', 'Action', 'Fantasy'],
                director: 'Christopher Nolan',
                userRating: 4.5,
                watchDate: '2026-07-21',
                isRewatch: false,
                letterboxdSyncId: 'letterboxd-review-1408366198',
                letterboxdUrl: 'https://letterboxd.com/ikbenmikko/film/the-odyssey-2026/'
            }
        ];
        fs.writeFileSync(legacyJsonPath, JSON.stringify(seedMovies, null, 2), 'utf8');

        DatabaseService.init({
            isDev: true,
            userDataPath: TEST_USER_DIR,
            dataDir: migDataDir,
            legacyJsonPath: legacyJsonPath
        });

        const items = DatabaseService.getAllMedia();
        expect(items.length).toBe(1);
        expect(items[0].title).toBe('The Odyssey');
        expect(items[0].letterboxdSyncId).toBe('letterboxd-review-1408366198');
        expect(items[0].letterboxdUrl).toBe('https://letterboxd.com/ikbenmikko/film/the-odyssey-2026/');
        expect(items[0].genres).toEqual(['Adventure', 'Action', 'Fantasy']);

        // Check safety backup archive was created
        const backupFile = `${legacyJsonPath}.migrated.bak`;
        expect(fs.existsSync(backupFile)).toBe(true);
    });

    test('SQLite online backup and restore work correctly', async () => {
        // Set backup folder
        const setRes = await DatabaseService.setBackupFolder(TEST_BACKUP_DIR);
        expect(setRes.success).toBe(true);

        const backupFile = path.join(TEST_BACKUP_DIR, 'movies-backup.db');
        expect(fs.existsSync(backupFile)).toBe(true);

        // Insert new movie
        DatabaseService.insertMedia({
            entryId: 'backup-test-1',
            title: 'Dunkirk',
            genres: ['War', 'Action']
        });

        // Trigger manual backup
        const manualBackup = await DatabaseService.performBackup();
        expect(manualBackup.success).toBe(true);

        // Now delete the movie to test restore
        DatabaseService.deleteMedia('backup-test-1');
        expect(DatabaseService.getMediaById('backup-test-1')).toBeNull();

        // Restore from backup
        const restoreRes = DatabaseService.restoreDatabase(backupFile);
        expect(restoreRes.success).toBe(true);

        // Verify the movie is restored
        const restoredItem = DatabaseService.getMediaById('backup-test-1');
        expect(restoredItem).not.toBeNull();
        expect(restoredItem.title).toBe('Dunkirk');
    });

    test('debounced backup timer resets on repeated calls and executes', () => {
        jest.useFakeTimers();
        const backupSpy = jest.spyOn(DatabaseService, 'performBackup').mockResolvedValue({ success: true });

        DatabaseService.scheduleDebouncedBackup();
        expect(DatabaseService.hasPendingBackup).toBe(true);

        // Fast-forward 10 seconds and call again
        jest.advanceTimersByTime(10000);
        DatabaseService.scheduleDebouncedBackup();

        // Advance 25 seconds (total 35s, but only 25s since last call)
        jest.advanceTimersByTime(25000);
        expect(backupSpy).not.toHaveBeenCalled();

        // Advance remaining 5 seconds (30s since last call)
        jest.advanceTimersByTime(5000);
        expect(backupSpy).toHaveBeenCalledTimes(1);

        backupSpy.mockRestore();
        jest.useRealTimers();
    });

    test('flushPendingBackup immediately copies DB if pending backup exists', () => {
        const destFile = path.join(TEST_BACKUP_DIR, 'movies-backup.db');
        if (fs.existsSync(destFile)) fs.unlinkSync(destFile);

        DatabaseService.hasPendingBackup = true;
        DatabaseService.flushPendingBackup();

        expect(fs.existsSync(destFile)).toBe(true);
        expect(DatabaseService.hasPendingBackup).toBe(false);
    });

    test('sanitizes edge-case and malformed fields gracefully', () => {
        const malformed = {
            title: null,
            runtime: '120 min',
            score: '95.5',
            genres: 'not-an-array',
            userRating: '4',
            isRewatch: 'yes'
        };

        const inserted = DatabaseService.insertMedia(malformed);
        expect(inserted.title).toBe('Untitled');
        expect(inserted.runtime).toBe(120);
        expect(inserted.score).toBe(95.5);
        expect(inserted.userRating).toBe(4);
        expect(inserted.genres).toEqual([]);
        expect(inserted.isRewatch).toBe(true);

        DatabaseService.deleteMedia(inserted.entryId);
    });

    test('performBackup returns error when backup folder is not configured', async () => {
        const originalFolder = DatabaseService.getBackupFolder();
        DatabaseService.saveBackupSettings({ backupFolder: null });

        const result = await DatabaseService.performBackup();
        expect(result.error).toMatch(/not configured/i);

        // Restore
        DatabaseService.saveBackupSettings({ backupFolder: originalFolder });
    });

    test('exportDatabase creates an isolated snapshot without altering auto-backup settings', async () => {
        const snapshotDir = path.join(TEST_DIR, 'snapshots');
        const snapshotFile = path.join(snapshotDir, 'manual-snapshot.db');

        // Set an active auto-backup folder first
        await DatabaseService.setBackupFolder(TEST_BACKUP_DIR);
        const settingsBefore = DatabaseService.getBackupSettings();
        expect(settingsBefore.backupFolder).toBe(TEST_BACKUP_DIR);

        // Export snapshot to a completely separate path
        const exportRes = await DatabaseService.exportDatabase(snapshotFile);
        expect(exportRes.success).toBe(true);
        expect(fs.existsSync(snapshotFile)).toBe(true);

        // Verify settings were NOT overwritten by export path
        const settingsAfter = DatabaseService.getBackupSettings();
        expect(settingsAfter.backupFolder).toBe(TEST_BACKUP_DIR);
        expect(settingsAfter.autoBackupEnabled).toBe(true);
    });

    test('snapshot exported while auto-backup is live remains frozen when new movies are added', async () => {
        const snapshotFile = path.join(TEST_DIR, 'snapshots', 'point-in-time.db');

        // Insert initial baseline movie
        DatabaseService.insertMedia({
            entryId: 'baseline-movie',
            title: 'The Dark Knight',
            genres: ['Action', 'Crime']
        });

        // Sync to auto-backup
        await DatabaseService.performBackup();

        // Export snapshot now
        const exportRes = await DatabaseService.exportDatabase(snapshotFile);
        expect(exportRes.success).toBe(true);

        // Now add a brand new movie that should ONLY go into the active DB and subsequent auto-backups
        DatabaseService.insertMedia({
            entryId: 'after-snapshot-movie',
            title: 'Oppenheimer',
            genres: ['Biography', 'Drama']
        });
        await DatabaseService.performBackup();

        // Auto-backup destination has Oppenheimer
        const autoBackupPath = path.join(TEST_BACKUP_DIR, 'movies-backup.db');
        DatabaseService.restoreDatabase(autoBackupPath);
        expect(DatabaseService.getMediaById('baseline-movie')).not.toBeNull();
        expect(DatabaseService.getMediaById('after-snapshot-movie')).not.toBeNull();

        // Restore from snapshot: Oppenheimer MUST NOT exist, verifying the snapshot was frozen and untouched
        DatabaseService.restoreDatabase(snapshotFile);
        expect(DatabaseService.getMediaById('baseline-movie')).not.toBeNull();
        expect(DatabaseService.getMediaById('after-snapshot-movie')).toBeNull();
    });

    test('auto-disables and clears folder when backup folder is deleted on disk', async () => {
        const missingTestDir = path.join(TEST_DIR, 'doomed_folder');
        fs.mkdirSync(missingTestDir, { recursive: true });

        let statusNotification = null;
        DatabaseService.statusCallback = (data) => {
            statusNotification = data;
        };

        await DatabaseService.setBackupFolder(missingTestDir);
        expect(DatabaseService.getBackupFolder()).toBe(missingTestDir);

        // Delete folder from disk simulating user deleting it in Explorer
        fs.rmSync(missingTestDir, { recursive: true, force: true });
        expect(fs.existsSync(missingTestDir)).toBe(false);

        // Trigger debounced backup check
        DatabaseService.scheduleDebouncedBackup();

        // Verify it auto-disabled immediately
        const settings = DatabaseService.getBackupSettings();
        expect(settings.backupFolder).toBeNull();
        expect(settings.autoBackupEnabled).toBe(false);
        expect(statusNotification).not.toBeNull();
        expect(statusNotification.status).toBe('disabled');
        expect(statusNotification.message).toMatch(/deleted or missing/i);
    });

    test('setAutoBackupEnabled and removeBackupFolder handle keep vs delete file options', async () => {
        const testFolder = path.join(TEST_DIR, 'keep_delete_test');
        fs.mkdirSync(testFolder, { recursive: true });

        // 1. Setup backup in this folder
        await DatabaseService.setBackupFolder(testFolder);
        const backupFile = path.join(testFolder, 'movies-backup.db');
        expect(fs.existsSync(backupFile)).toBe(true);

        // 2. Disable with deleteExistingFile = false (keep archive)
        DatabaseService.setAutoBackupEnabled(false, false);
        expect(DatabaseService.getBackupSettings().autoBackupEnabled).toBe(false);
        expect(fs.existsSync(backupFile)).toBe(true); // Preserved!

        // 3. Re-enable, then disable with deleteExistingFile = true (delete file)
        DatabaseService.setAutoBackupEnabled(true, false);
        DatabaseService.setAutoBackupEnabled(false, true);
        expect(fs.existsSync(backupFile)).toBe(false); // Deleted!

        // 4. Test removeBackupFolder
        await DatabaseService.setBackupFolder(testFolder);
        expect(fs.existsSync(backupFile)).toBe(true);

        // Remove folder and delete file
        DatabaseService.removeBackupFolder(true);
        expect(DatabaseService.getBackupFolder()).toBeNull();
        expect(fs.existsSync(backupFile)).toBe(false);
    });
});
