const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Database operations
    getDraws: (limit) => ipcRenderer.invoke('get-draws', limit),
    getStatistics: () => ipcRenderer.invoke('get-statistics'),
    analyzeNumbers: (options) => ipcRenderer.invoke('analyze-numbers', options),
    
    // Data fetching
    fetchLatestDraws: () => ipcRenderer.invoke('fetch-latest-draws'),
    importCSV: () => ipcRenderer.invoke('import-csv'),
    
    // Number generation
    generateNumbers: (strategy) => ipcRenderer.invoke('generate-numbers', strategy),
    
    // Utility functions
    showNotification: (title, body) => {
        new Notification(title, { body });
    },
    
    // Event listeners for updates
    onDataUpdate: (callback) => {
        ipcRenderer.on('data-updated', callback);
    },
    
    removeDataUpdateListener: () => {
        ipcRenderer.removeAllListeners('data-updated');
    }
});