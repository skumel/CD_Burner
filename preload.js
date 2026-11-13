const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getDrives: () => ipcRenderer.invoke('get-drives'),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getUserFolder: (name) => ipcRenderer.invoke('get-user-folder', name),
    startScan: (targetPath) => ipcRenderer.invoke('start-scan', targetPath),
    cancelScan: () => ipcRenderer.invoke('cancel-scan'),
    burnAudioDisc: (config) => ipcRenderer.invoke('burn-audio-disc', config),
    burnDataDisc: (config) => ipcRenderer.invoke('burn-data-disc', config),
    eraseDisc: (params) => ipcRenderer.invoke('erase-disc', params),
    saveIsoImage: (config) => ipcRenderer.invoke('save-iso-image', config),
    autoFitTracks: (params) => ipcRenderer.invoke('auto-fit-tracks', params),

    onScanProgress: (callback) => {
        const handler = (event, val) => callback(val);
        ipcRenderer.on('scan-progress', handler);
        return () => ipcRenderer.removeListener('scan-progress', handler);
    },
    onScanBatch: (callback) => {
        const handler = (event, val) => callback(val);
        ipcRenderer.on('scan-batch', handler);
        return () => ipcRenderer.removeListener('scan-batch', handler);
    },
    onBurnProgress: (callback) => {
        const handler = (event, val) => callback(val);
        ipcRenderer.on('burn-progress', handler);
        return () => ipcRenderer.removeListener('burn-progress', handler);
    },
    onEraseProgress: (callback) => {
        const handler = (event, val) => callback(val);
        ipcRenderer.on('erase-progress', handler);
        return () => ipcRenderer.removeListener('erase-progress', handler);
    }
});
