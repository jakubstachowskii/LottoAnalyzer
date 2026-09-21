const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('./database');
const DataScraper = require('./scraper');

class LottoApp {
    constructor() {
        this.mainWindow = null;
        this.database = new Database();
        this.scraper = new DataScraper();
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 900,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
                enableRemoteModule: false
            },
            icon: path.join(__dirname, '../assets/icon.png'),
            title: 'Lotto Analyzer - Analizator wyników Lotto'
        });

        this.mainWindow.loadFile('src/renderer/index.html');

        // Development tools
        if (process.argv.includes('--dev')) {
            this.mainWindow.webContents.openDevTools();
        }

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    setupIPC() {
        // Pobieranie danych z bazy
        ipcMain.handle('get-draws', async (event, limit = 100) => {
            try {
                return await this.database.getDraws(limit);
            } catch (error) {
                console.error('Error getting draws:', error);
                return { error: error.message };
            }
        });

        // Pobieranie statystyk
        ipcMain.handle('get-statistics', async () => {
            try {
                return await this.database.getStatistics();
            } catch (error) {
                console.error('Error getting statistics:', error);
                return { error: error.message };
            }
        });

        // Scrapowanie nowych danych
        ipcMain.handle('fetch-latest-draws', async () => {
            try {
                const draws = await this.scraper.fetchLatestDraws();
                await this.database.insertDraws(draws);
                return { success: true, count: draws.length };
            } catch (error) {
                console.error('Error fetching draws:', error);
                return { error: error.message };
            }
        });

        // Import z pliku CSV
        ipcMain.handle('import-csv', async () => {
            try {
                const result = await dialog.showOpenDialog(this.mainWindow, {
                    properties: ['openFile'],
                    filters: [
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });

                if (!result.canceled && result.filePaths.length > 0) {
                    const filePath = result.filePaths[0];
                    const importResult = await this.database.importFromCSV(filePath);
                    return importResult;
                }
                return { canceled: true };
            } catch (error) {
                console.error('Error importing CSV:', error);
                return { error: error.message };
            }
        });

        // Analiza liczb
        ipcMain.handle('analyze-numbers', async (event, options) => {
            try {
                return await this.database.analyzeNumbers(options);
            } catch (error) {
                console.error('Error analyzing numbers:', error);
                return { error: error.message };
            }
        });

        // Generowanie "rekomendacji"
        ipcMain.handle('generate-numbers', async (event, strategy) => {
            try {
                return await this.database.generateNumbers(strategy);
            } catch (error) {
                console.error('Error generating numbers:', error);
                return { error: error.message };
            }
        });
    }

    async initialize() {
        await this.database.initialize();
        this.setupIPC();
    }
}

// Inicjalizacja aplikacji
const lottoApp = new LottoApp();

app.whenReady().then(async () => {
    await lottoApp.initialize();
    lottoApp.createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            lottoApp.createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Graceful shutdown
app.on('before-quit', async () => {
    if (lottoApp.database) {
        await lottoApp.database.close();
    }
});