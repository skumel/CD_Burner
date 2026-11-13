const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const scannerService = require('./src/scanner-service');
const burnerService = require('./src/burner-service');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0f172a',
        title: 'SonicBurn - Windows CD Burner & Audio Studio',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false // Allows playing local audio files in audio element
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers ---

// Get Storage & Optical Drives
ipcMain.handle('get-drives', async () => {
    try {
        return await burnerService.getDrives();
    } catch (err) {
        console.error('get-drives error:', err);
        return { StorageDrives: [], OpticalDrives: [], error: err.message };
    }
});

// Select Custom Folder Dialog
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// Scan Directory for Audio Files
ipcMain.handle('start-scan', async (event, targetPath) => {
    try {
        const results = await scannerService.scanDirectory(
            targetPath,
            (progress) => {
                mainWindow.webContents.send('scan-progress', progress);
            },
            (batch) => {
                mainWindow.webContents.send('scan-batch', batch);
            }
        );
        return { success: true, count: results.length, canceled: Boolean(results.canceled) };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Cancel Ongoing Scan
ipcMain.handle('cancel-scan', () => {
    scannerService.cancelScan();
    return { success: true };
});

// Burn Audio CD
ipcMain.handle('burn-audio-disc', async (event, config) => {
    try {
        const result = await burnerService.burnAudioDisc(config, (progress) => {
            mainWindow.webContents.send('burn-progress', progress);
        });
        return result;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Burn Data CD / MP3 CD
ipcMain.handle('burn-data-disc', async (event, config) => {
    try {
        const result = await burnerService.burnDataDisc(config, (progress) => {
            mainWindow.webContents.send('burn-progress', progress);
        });
        return result;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Erase CD-RW
ipcMain.handle('erase-disc', async (event, { recorderIndex, fullErase }) => {
    try {
        const result = await burnerService.eraseDisc(recorderIndex, fullErase, (progress) => {
            mainWindow.webContents.send('erase-progress', progress);
        });
        return result;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Save ISO Dialog & Generation
ipcMain.handle('save-iso-image', async (event, config) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Disc Image as ISO',
        defaultPath: `${config.volumeLabel || 'MP3_DISC'}.iso`,
        filters: [{ name: 'ISO Image (*.iso)', extensions: ['iso'] }]
    });

    if (!filePath) return { canceled: true };

    try {
        const result = await burnerService.createIsoImage(config, filePath, (progress) => {
            mainWindow.webContents.send('burn-progress', progress);
        });
        return { success: true, filePath, result };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Auto-Fit Tracks
ipcMain.handle('auto-fit-tracks', (event, { candidateTracks, maxSeconds, perTrackOverhead }) => {
    return burnerService.autoFitTracks(candidateTracks, maxSeconds, perTrackOverhead);
});

// Real Music / Downloads folder locations from Windows
ipcMain.handle('get-user-folder', (event, name) => {
    try {
        return app.getPath(name === 'downloads' ? 'downloads' : 'music');
    } catch {
        return null;
    }
});
