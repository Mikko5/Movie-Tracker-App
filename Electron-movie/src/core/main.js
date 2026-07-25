const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('fs').watch;  // Node.js built-in file watcher
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Add this block for auto-reloading
try {
    require('electron-reloader')(module);
} catch (_) { }

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

    // Watch for changes in the JSON file
    let watcher = null;
    function setupWatcher() {
        if (watcher) {
            watcher.close();
        }
        watcher = chokidar(jsonPath, (eventType, filename) => {
            if (eventType === 'change') {
                win.webContents.send('json-updated');
            }
        });
    }
    setupWatcher();

    // Update watcher when JSON path changes
    ipcMain.on('json-path-changed', () => {
        setupWatcher();
    });

    win.loadFile(path.join(__dirname, '..', 'view', 'templates', 'movielist.html'));

    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
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

// Close the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
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

// Handle request to open an external link
ipcMain.on('open-external-link', (event, url) => {
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
        shell.openExternal(url);
    } else {
        console.error('Attempted to open invalid external link:', url);
    }
});

// Reads the content of movie-data.json (with backup fallback) and returns it
ipcMain.handle('read-json', async () => {
    const backupPath = `${jsonPath}.bak`;

    try {
        // Check if the primary file exists; if not, check backup or create new empty file
        if (!fs.existsSync(jsonPath)) {
            if (fs.existsSync(backupPath)) {
                console.warn('Primary file missing, attempting restore from backup...');
                const backupData = fs.readFileSync(backupPath, 'utf-8');
                const parsedBackup = JSON.parse(backupData);
                writeJsonAtomic(jsonPath, parsedBackup);
                return parsedBackup;
            }
            writeJsonAtomic(jsonPath, []);
            return [];
        }

        const data = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Failed to read primary JSON file:', err);

        // Attempt recovery from backup if primary JSON fails to read/parse
        if (fs.existsSync(backupPath)) {
            try {
                console.warn('Attempting data recovery from backup file...');
                const backupData = fs.readFileSync(backupPath, 'utf-8');
                const restoredData = JSON.parse(backupData);
                // Re-establish primary file from valid backup
                writeJsonAtomic(jsonPath, restoredData);
                return restoredData;
            } catch (backupErr) {
                console.error('Failed to read backup file:', backupErr);
            }
        }

        return { error: err.message };
    }
});

// Writes the given data to movie-data.json atomically
ipcMain.handle('write-json', async (event, newData) => {
    try {
        writeJsonAtomic(jsonPath, newData);
        return { success: true };
    } catch (err) {
        console.error('Failed to write JSON file:', err);
        return { error: err.message };
    }
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


