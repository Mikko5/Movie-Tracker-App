const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const DatabaseService = require('./DatabaseService');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Add this block for auto-reloading
try {
    require('electron-reloader')(module);
} catch (_) { }

// Set isolated settings paths for development vs production
if (!app.isPackaged) {
    if (process.env.NODE_ENV === 'development') {
        // Use an isolated folder for development
        app.setPath('userData', path.join(app.getPath('appData'), 'electron-movie-json-demo-dev'));
    }
    // For npm run start:prod, we do NOT override the path.
    // It will naturally use 'electron-movie-json-demo' which is what your installed Main App uses.
}

// Get the saved path from user data or use default
const getUserDataPath = () => {
    // In development, always use the local dev JSON file
    if (process.env.NODE_ENV === 'development') {
        return path.join(__dirname, '..', '..', 'data', 'movie-data.dev.json');
    }

    // In production, check for a user-defined path
    const savedPath = path.join(app.getPath('userData'), 'savedPath.txt');
    if (fs.existsSync(savedPath)) {
        return fs.readFileSync(savedPath, 'utf8');
    }

    // Default production path
    return path.join(__dirname, '..', '..', 'data', 'movie-data.json');
};

let jsonPath = getUserDataPath();


function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, '..', 'view', 'templates', 'movielist.html'));

    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    try {
        fs.appendFileSync(path.join(__dirname, '..', '..', 'electron_boot.log'), 'Inside app.whenReady\n');
    } catch (_) { }

    // Initialize SQLite DatabaseService
    DatabaseService.init({
        isDev: process.env.NODE_ENV === 'development',
        userDataPath: app.getPath('userData'),
        dataDir: path.join(__dirname, '..', '..', 'data'),
        legacyJsonPath: getUserDataPath(),
        statusCallback: (data) => {
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('backup-status', data);
            });
        }
    });

    try {
        fs.appendFileSync(path.join(__dirname, '..', '..', 'electron_boot.log'), 'DatabaseService initialized\n');
    } catch (_) { }

    createWindow();

    // Automatically check for updates on startup (only in production)
    if (process.env.NODE_ENV !== 'development') {
        autoUpdater.checkForUpdates().catch(err => {
            console.error('Startup update check failed:', err);
        });
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('before-quit', () => {
    DatabaseService.flushPendingBackup();
    DatabaseService.close();
});

// Close the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    DatabaseService.flushPendingBackup();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- Atomic File Writing & Data Safety Helpers ---

/**
 * Writes data to a JSON file atomically to prevent data corruption.
 * - Writes to a `.tmp` file in the target directory first.
 * - Refreshes a `.bak` backup copy of the target file if it already exists.
 * - Renames `.tmp` to target file atomically (which deletes `.tmp`).
 * - Cleans up `.tmp` on write failure.
 * @param {string} targetPath - Absolute path to destination JSON file
 * @param {any} data - Data to serialize and save
 */
const writeJsonAtomic = (targetPath, data) => {
    const tempPath = `${targetPath}.tmp`;
    const backupPath = `${targetPath}.bak`;
    const jsonString = JSON.stringify(data, null, 2);

    try {
        // Step 1: Write to temporary file
        fs.writeFileSync(tempPath, jsonString, 'utf-8');

        // Step 2: Create backup of current file ONLY if it exists and contains valid JSON
        if (fs.existsSync(targetPath)) {
            try {
                const existingContent = fs.readFileSync(targetPath, 'utf-8');
                JSON.parse(existingContent); // Ensure current file is valid JSON before backing up
                fs.copyFileSync(targetPath, backupPath);
            } catch (validationErr) {
                console.warn('Existing file on disk is invalid/corrupted; preserving previous backup file:', validationErr.message);
            }
        }

        // Step 3: Atomically rename temp file to target path
        fs.renameSync(tempPath, targetPath);
        return { success: true };
    } catch (err) {
        // Clean up temp file on failure
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (_) { }
        }
        throw err;
    }
};

// --- IPC Handlers for File I/O ---

// IPC handler to select save location for movie-data.json
ipcMain.handle('select-save-location', async () => {
    const result = await dialog.showSaveDialog({
        defaultPath: jsonPath,
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['showOverwriteConfirmation']
    });

    if (!result.canceled && result.filePath) {
        const oldPath = jsonPath;

        // Copy existing data to new location if it exists
        if (fs.existsSync(oldPath)) {
            try {
                // Read current data and atomically write to new location
                const currentData = fs.readFileSync(oldPath, 'utf8');
                const parsedData = JSON.parse(currentData);
                writeJsonAtomic(result.filePath, parsedData);

                // Delete the old file (and old backup) after successful write
                try {
                    fs.unlinkSync(oldPath);
                    if (fs.existsSync(`${oldPath}.bak`)) {
                        fs.unlinkSync(`${oldPath}.bak`);
                    }
                } catch (deleteError) {
                    console.error('Error deleting old file:', deleteError);
                    // Continue even if delete fails
                }
            } catch (error) {
                console.error('Error copying data:', error);
                return { error: 'Failed to copy existing data to new location' };
            }
        } else {
            writeJsonAtomic(result.filePath, []);
        }

        // Update the path only after successful copy
        jsonPath = result.filePath;
        // Save the new path to user data
        const savedPath = path.join(app.getPath('userData'), 'savedPath.txt');
        fs.writeFileSync(savedPath, jsonPath, 'utf8');

        return { success: true, path: jsonPath };
    }
    return { canceled: true };
});

// IPC handler to send the API key to the renderer process
ipcMain.handle('get-api-key', async () => {
    const keyPath = path.join(app.getPath('userData'), 'apiKey.txt');
    if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8').trim();
    }
    return process.env.APIKEY || null;
});

// IPC handler to save the API key securely
ipcMain.handle('set-api-key', async (event, key) => {
    try {
        const keyPath = path.join(app.getPath('userData'), 'apiKey.txt');
        fs.writeFileSync(keyPath, key, 'utf8');
        return { success: true };
    } catch (err) {
        console.error('Failed to save API key:', err);
        return { error: err.message };
    }
});

// IPC handler to check if in development mode
ipcMain.handle('is-dev', () => {
    return process.env.NODE_ENV === 'development';
});

// IPC handler to check if app is packaged
ipcMain.handle('is-packaged', () => {
    return app.isPackaged;
});

// Handle request to open an external link
ipcMain.on('open-external-link', (event, url) => {
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
        shell.openExternal(url);
    } else {
        console.error('Attempted to open invalid external link:', url);
    }
});

// --- Database & Backup IPC Handlers ---

ipcMain.handle('db:get-all', async (event, mediaType) => {
    try {
        return DatabaseService.getAllMedia(mediaType);
    } catch (err) {
        console.error('db:get-all failed:', err);
        return { error: err.message };
    }
});

ipcMain.handle('db:get-by-id', async (event, entryId) => {
    try {
        return DatabaseService.getMediaById(entryId);
    } catch (err) {
        console.error('db:get-by-id failed:', err);
        return { error: err.message };
    }
});

ipcMain.handle('db:add-movie', async (event, movie) => {
    try {
        return DatabaseService.insertMedia(movie);
    } catch (err) {
        console.error('db:add-movie failed:', err);
        return { error: err.message };
    }
});

ipcMain.handle('db:update-movie', async (event, entryId, movie) => {
    try {
        return DatabaseService.updateMedia(entryId, movie);
    } catch (err) {
        console.error('db:update-movie failed:', err);
        return { error: err.message };
    }
});

ipcMain.handle('db:delete-movie', async (event, entryId) => {
    try {
        return DatabaseService.deleteMedia(entryId);
    } catch (err) {
        console.error('db:delete-movie failed:', err);
        return { error: err.message };
    }
});

ipcMain.handle('db:bulk-add', async (event, movies) => {
    try {
        return DatabaseService.bulkInsertMedia(movies);
    } catch (err) {
        console.error('db:bulk-add failed:', err);
        return { error: err.message };
    }
});

// Backward-compatibility wrappers for read-json / write-json
ipcMain.handle('read-json', async () => {
    try {
        return DatabaseService.getAllMedia();
    } catch (err) {
        console.error('read-json proxy failed:', err);
        return { error: err.message };
    }
});

ipcMain.handle('write-json', async (event, newData) => {
    try {
        if (Array.isArray(newData)) {
            DatabaseService.bulkInsertMedia(newData);
        }
        return { success: true };
    } catch (err) {
        console.error('write-json proxy failed:', err);
        return { error: err.message };
    }
});

// Backup Location Management
ipcMain.handle('select-backup-location', async () => {
    const currentFolder = DatabaseService.getBackupFolder();
    const result = await dialog.showOpenDialog({
        title: 'Select Backup Folder (e.g. OneDrive)',
        defaultPath: currentFolder || app.getPath('documents'),
        properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const selectedFolder = result.filePaths[0];
        const backupResult = await DatabaseService.setBackupFolder(selectedFolder);
        return {
            success: true,
            folder: selectedFolder,
            backupResult
        };
    }
    return { canceled: true };
});

ipcMain.handle('get-backup-settings', async () => {
    return DatabaseService.getBackupSettings();
});

ipcMain.handle('toggle-auto-backup', async (event, enabled, deleteExistingFile) => {
    return DatabaseService.setAutoBackupEnabled(enabled, deleteExistingFile);
});

ipcMain.handle('remove-backup-folder', async (event, deleteExistingFile) => {
    return DatabaseService.removeBackupFolder(deleteExistingFile);
});

ipcMain.handle('export-database', async () => {
    const today = new Date().toISOString().split('T')[0];
    const defaultFileName = `movies-snapshot-${today}.db`;
    const result = await dialog.showSaveDialog({
        title: 'Export Database Snapshot',
        defaultPath: path.join(app.getPath('documents'), defaultFileName),
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['showOverwriteConfirmation']
    });

    if (!result.canceled && result.filePath) {
        return await DatabaseService.exportDatabase(result.filePath);
    }
    return { canceled: true };
});

ipcMain.handle('trigger-backup-now', async () => {
    return await DatabaseService.performBackup();
});

ipcMain.handle('restore-from-backup', async () => {
    const result = await dialog.showOpenDialog({
        title: 'Select SQLite Backup File to Restore',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        const backupFile = result.filePaths[0];
        const restoreResult = DatabaseService.restoreDatabase(backupFile);
        if (restoreResult.success) {
            // Notify windows to reload data
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('json-updated');
            });
        }
        return restoreResult;
    }
    return { canceled: true };
});

// --- Auto-Updater Configuration ---
const { autoUpdater } = require('electron-updater');
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Helper to send updater events to renderer
function sendUpdaterEvent(event, data) {
    BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send(event, data);
    });
}

autoUpdater.on('checking-for-update', () => {
    sendUpdaterEvent('updater-status', { status: 'checking' });
});
autoUpdater.on('update-available', (info) => {
    sendUpdaterEvent('updater-status', { status: 'available', info });
});
autoUpdater.on('update-not-available', (info) => {
    sendUpdaterEvent('updater-status', { status: 'not-available', info });
});
autoUpdater.on('error', (err) => {
    sendUpdaterEvent('updater-status', { status: 'error', error: err.message });
});
autoUpdater.on('download-progress', (progressObj) => {
    sendUpdaterEvent('updater-status', { status: 'progress', progress: progressObj });
});
autoUpdater.on('update-downloaded', (info) => {
    sendUpdaterEvent('updater-status', { status: 'downloaded', info });
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-for-updates', async () => {
    try {
        if (process.env.NODE_ENV === 'development') {
            sendUpdaterEvent('updater-status', { status: 'error', error: 'Auto-update is disabled in development mode.' });
            return;
        }
        await autoUpdater.checkForUpdates();
    } catch (err) {
        console.error('Error checking for updates:', err);
        sendUpdaterEvent('updater-status', { status: 'error', error: err.message });
    }
});
ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
    } catch (err) {
        console.error('Error downloading update:', err);
        sendUpdaterEvent('updater-status', { status: 'error', error: err.message });
    }
});
ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true); // (isSilent, isForceRunAfter)
});

// --- Letterboxd Integration ---
const { fetchLetterboxdRSS, getNewMovies } = require('./LetterboxdService');

ipcMain.handle('get-letterboxd-settings', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'letterboxdSettings.json');
    if (fs.existsSync(settingsPath)) {
        try {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {
            return { username: '', lastSyncId: '' };
        }
    }
    return { username: '', lastSyncId: '' };
});

ipcMain.handle('set-letterboxd-settings', async (event, settings) => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'letterboxdSettings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        return { success: true };
    } catch (err) {
        console.error('Failed to save Letterboxd settings:', err);
        return { error: err.message };
    }
});

ipcMain.handle('get-app-settings', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'appSettings.json');
    if (fs.existsSync(settingsPath)) {
        try {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {
            return {};
        }
    }
    return {};
});

ipcMain.handle('set-app-settings', async (event, settings) => {
    try {
        const settingsPath = path.join(app.getPath('userData'), 'appSettings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        return { success: true };
    } catch (err) {
        console.error('Failed to save app settings:', err);
        return { error: err.message };
    }
});

ipcMain.handle('fetch-letterboxd-rss', async (event, username, lastSyncId) => {
    try {
        const rssItems = await fetchLetterboxdRSS(username);
        const newMovies = getNewMovies(rssItems, lastSyncId);
        return { success: true, newMovies };
    } catch (err) {
        console.error('Failed to fetch Letterboxd RSS via IPC:', err);
        return { error: err.message };
    }
});
