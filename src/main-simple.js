const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const http = require('http');

// Wyłącz GPU acceleration aby uniknąć błędów
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

/**
 * Główna klasa aplikacji Lotto Analyzer
 * Zarządza oknem aplikacji, komunikacją IPC i operacjami na danych
 */
class LottoApp {
    constructor() {
        this.mainWindow = null;
        this.dataPath = path.join(__dirname, '../data/lotto-data.json');
        this.isInitialized = false;
    }

    /**
     * Tworzy główne okno aplikacji
     */
    createWindow() {
        // Sprawdź czy okno już istnieje
        if (this.mainWindow) {
            this.mainWindow.focus();
            return;
        }

        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minWidth: 900,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload-simple.js'),
                hardwareAcceleration: false
            },
            icon: path.join(__dirname, '../assets/icon.png'),
            title: 'Lotto Analyzer - Analizator wyników Lotto',
            show: false, // Pokaż okno dopiero po załadowaniu
        });

        this.mainWindow.loadFile('src/renderer/index.html');

        // Pokaż okno po załadowaniu
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
        });

        // Development tools
        if (process.argv.includes('--dev')) {
            this.mainWindow.webContents.openDevTools();
        }

        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Obsługa błędów ładowania
        this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load:', errorDescription);
        });
    }

    /**
     * Konfiguruje komunikację IPC między procesami
     */
    setupIPC() {
        // Pobieranie danych losowań
        ipcMain.handle('get-draws', async (event, limit = 100) => {
            try {
                return await this.getDraws(limit);
            } catch (error) {
                console.error('Error getting draws:', error);
                return { error: error.message };
            }
        });

        // Pobieranie statystyk
        ipcMain.handle('get-statistics', async () => {
            try {
                return await this.getStatistics();
            } catch (error) {
                console.error('Error getting statistics:', error);
                return { error: error.message };
            }
        });

        // Generowanie liczb
        ipcMain.handle('generate-numbers', async (event, strategy) => {
            try {
                return await this.generateNumbers(strategy);
            } catch (error) {
                console.error('Error generating numbers:', error);
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
                    const importResult = await this.importFromCSV(filePath);
                    return importResult;
                }
                return { canceled: true };
            } catch (error) {
                console.error('Error importing CSV:', error);
                return { error: error.message };
            }
        });

        // Pobieranie najnowszych danych
        ipcMain.handle('fetch-latest-data', async () => {
            try {
                return await this.fetchLatestData();
            } catch (error) {
                console.error('Error fetching latest data:', error);
                return { error: error.message };
            }
        });

        // Pobieranie danych z zakresu dat
        ipcMain.handle('fetch-data-by-date-range', async (event, startDate, endDate) => {
            try {
                return await this.fetchDataByDateRange(startDate, endDate);
            } catch (error) {
                console.error('Error fetching data by date range:', error);
                return { error: error.message };
            }
        });
    }

    /**
     * Pobiera dane losowań z ograniczeniem liczby rekordów
     * @param {number} limit - Maksymalna liczba rekordów do pobrania
     * @returns {Array} Tablica losowań
     */
    async getDraws(limit = 100) {
        try {
            const data = await this.loadData();
            return data.draws.slice(0, limit);
        } catch (error) {
            console.error('Error getting draws:', error);
            return [];
        }
    }

    /**
     * Pobiera statystyki na podstawie dostępnych danych
     * @returns {Object} Obiekt ze statystykami
     */
    async getStatistics() {
        try {
            const data = await this.loadData();
            return this.calculateStatistics(data.draws);
        } catch (error) {
            console.error('Error getting statistics:', error);
            return this.getEmptyStatistics();
        }
    }

    /**
     * Oblicza statystyki na podstawie danych losowań
     * @param {Array} draws - Tablica losowań
     * @returns {Object} Obiekt ze statystykami
     */
    calculateStatistics(draws) {
        if (!draws || draws.length === 0) {
            return this.getEmptyStatistics();
        }

        const frequency = {};
        const totalDraws = draws.length;

        // Inicjalizacja liczników dla wszystkich liczb (1-49)
        for (let i = 1; i <= 49; i++) {
            frequency[i] = 0;
        }

        // Zliczanie wystąpień każdej liczby
        draws.forEach(draw => {
            if (draw.numbers && Array.isArray(draw.numbers)) {
                draw.numbers.forEach(num => {
                    if (num >= 1 && num <= 49) {
                        frequency[num]++;
                    }
                });
            }
        });

        // Obliczanie procentów
        const percentages = {};
        for (let i = 1; i <= 49; i++) {
            percentages[i] = (frequency[i] / totalDraws * 100).toFixed(2);
        }

        // Znalezienie najgorętszych i najzimniejszych liczb
        const sortedNumbers = Object.entries(frequency)
            .sort(([,a], [,b]) => b - a)
            .map(([num]) => parseInt(num));

        const hotNumbers = sortedNumbers.slice(0, 10);
        const coldNumbers = sortedNumbers.slice(-10).reverse();

        return {
            totalDraws,
            frequency,
            percentages,
            hotNumbers,
            coldNumbers,
            averageFrequency: (totalDraws * 6 / 49).toFixed(2)
        };
    }

    /**
     * Zwraca puste statystyki
     * @returns {Object} Puste statystyki
     */
    getEmptyStatistics() {
        return {
            totalDraws: 0,
            frequency: {},
            percentages: {},
            hotNumbers: [],
            coldNumbers: [],
            averageFrequency: '0.00'
        };
    }

    /**
     * Generuje liczby na podstawie wybranej strategii
     * @param {string} strategy - Strategia generowania ('random', 'hot', 'cold', 'balanced')
     * @returns {Object} Wygenerowane liczby
     */
    async generateNumbers(strategy = 'random') {
        try {
            const data = await this.loadData();
            const statistics = this.calculateStatistics(data.draws);

            let numbers = [];
            switch (strategy) {
                case 'hot':
                    numbers = this.generateHotNumbers(statistics);
                    break;
                case 'cold':
                    numbers = this.generateColdNumbers(statistics);
                    break;
                case 'balanced':
                    numbers = this.generateBalancedNumbers(statistics);
                    break;
                default:
                    numbers = this.generateRandomNumbers();
            }

            return {
                numbers,
                strategy,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error generating numbers:', error);
            return { error: error.message };
        }
    }

    /**
     * Generuje losowe liczby
     * @returns {Array} Tablica 6 losowych liczb
     */
    generateRandomNumbers() {
        const numbers = [];
        while (numbers.length < 6) {
            const num = Math.floor(Math.random() * 49) + 1;
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        return numbers.sort((a, b) => a - b);
    }

    /**
     * Generuje liczby na podstawie najgorętszych liczb
     * @param {Object} statistics - Statystyki
     * @returns {Array} Tablica 6 liczb
     */
    generateHotNumbers(statistics) {
        const hotNumbers = statistics.hotNumbers || [];
        const numbers = [];
        
        // Dodaj gorące liczby
        for (let i = 0; i < Math.min(4, hotNumbers.length); i++) {
            numbers.push(hotNumbers[i]);
        }
        
        // Uzupełnij losowymi
        while (numbers.length < 6) {
            const num = Math.floor(Math.random() * 49) + 1;
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        
        return numbers.sort((a, b) => a - b);
    }

    /**
     * Generuje liczby na podstawie najzimniejszych liczb
     * @param {Object} statistics - Statystyki
     * @returns {Array} Tablica 6 liczb
     */
    generateColdNumbers(statistics) {
        const coldNumbers = statistics.coldNumbers || [];
        const numbers = [];
        
        // Dodaj zimne liczby
        for (let i = 0; i < Math.min(4, coldNumbers.length); i++) {
            numbers.push(coldNumbers[i]);
        }
        
        // Uzupełnij losowymi
        while (numbers.length < 6) {
            const num = Math.floor(Math.random() * 49) + 1;
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        
        return numbers.sort((a, b) => a - b);
    }

    /**
     * Generuje zbalansowane liczby
     * @param {Object} statistics - Statystyki
     * @returns {Array} Tablica 6 liczb
     */
    generateBalancedNumbers(statistics) {
        const hotNumbers = statistics.hotNumbers || [];
        const coldNumbers = statistics.coldNumbers || [];
        const numbers = [];
        
        // Dodaj 2 gorące liczby
        for (let i = 0; i < Math.min(2, hotNumbers.length); i++) {
            numbers.push(hotNumbers[i]);
        }
        
        // Dodaj 2 zimne liczby
        for (let i = 0; i < Math.min(2, coldNumbers.length); i++) {
            numbers.push(coldNumbers[i]);
        }
        
        // Uzupełnij losowymi
        while (numbers.length < 6) {
            const num = Math.floor(Math.random() * 49) + 1;
            if (!numbers.includes(num)) {
                numbers.push(num);
            }
        }
        
        return numbers.sort((a, b) => a - b);
    }

    /**
     * Importuje dane z pliku CSV
     * @param {string} filePath - Ścieżka do pliku CSV
     * @returns {Object} Wynik importu
     */
    async importFromCSV(filePath) {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                return { error: 'Plik CSV jest pusty' };
            }

            const draws = [];
            let importedCount = 0;
            let errorCount = 0;

            for (let i = 1; i < lines.length; i++) { // Pomijamy nagłówek
                try {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const values = line.split(',').map(v => v.trim());
                    
                    if (values.length < 6) {
                        errorCount++;
                        continue;
                    }

                    const [dateStr, drawNumberStr, ...numberStrs] = values;
                    
                    // Parsowanie liczb
                    const numbers = [];
                    for (let j = 0; j < 6; j++) {
                        const num = parseInt(numberStrs[j]);
                        if (isNaN(num) || num < 1 || num > 49) {
                            throw new Error(`Nieprawidłowa liczba: ${numberStrs[j]}`);
                        }
                        numbers.push(num);
                    }

                    // Sprawdzenie duplikatów
                    if (new Set(numbers).size !== 6) {
                        errorCount++;
                        continue;
                    }

                    const draw = {
                        date: dateStr,
                        drawNumber: parseInt(drawNumberStr) || 0,
                        numbers: numbers.sort((a, b) => a - b),
                        plusNumber: parseInt(numberStrs[6]) || 0,
                        jackpot: parseFloat(numberStrs[7]) || 0,
                        winners: parseInt(numberStrs[8]) || 0
                    };

                    draws.push(draw);
                    importedCount++;
                } catch (error) {
                    errorCount++;
                    console.error(`Error parsing line ${i + 1}:`, error);
                }
            }

            if (importedCount > 0) {
                await this.saveDraws(draws);
            }

            return {
                imported: importedCount,
                errors: errorCount,
                total: lines.length - 1
            };
        } catch (error) {
            console.error('Error importing CSV:', error);
            return { error: error.message };
        }
    }

    /**
     * Pobiera najnowsze dane z oficjalnych źródeł
     * @returns {Object} Wynik pobierania
     */
    async fetchLatestData() {
        try {
            console.log('Pobieranie najnowszych danych...');
            
            // Próba pobrania rzeczywistych danych
            const result = await this.fetchRealHistoricalData();
            
            if (result.success) {
                return {
                    success: true,
                    message: result.message,
                    count: result.count,
                    source: result.source
                };
            } else {
                // Fallback do przykładowych danych
                const newDraws = this.getSampleData().draws.slice(0, 5);
                await this.saveDraws(newDraws);
                
                return {
                    success: true,
                    message: `Pobrano ${newDraws.length} przykładowych losowań (brak dostępu do rzeczywistych)`,
                    count: newDraws.length,
                    source: 'sample'
                };
            }
        } catch (error) {
            console.error('Error fetching latest data:', error);
            return { error: error.message };
        }
    }

    /**
     * Pobiera rzeczywiste dane historyczne z oficjalnych źródeł
     * @returns {Promise<Object>} Wynik pobierania
     */
    async fetchRealHistoricalData() {
        try {
            console.log('Pobieranie rzeczywistych danych historycznych...');
            
            // Pobieranie z różnych źródeł
            const sources = [
                'https://www.lotto.pl/wyniki-i-wygrane/lotto',
                'https://www.lotto.pl/api/lotto/draws',
                'https://www.lotto.pl/api/lotto/results'
            ];

            let allDraws = [];
            
            for (const source of sources) {
                try {
                    const data = await this.fetchFromURL(source);
                    if (data && data.length > 0) {
                        allDraws = allDraws.concat(data);
                        console.log(`Pobrano ${data.length} losowań z ${source}`);
                    }
                } catch (error) {
                    console.warn(`Błąd pobierania z ${source}:`, error.message);
                }
            }

            // Jeśli nie udało się pobrać z API, użyj danych z pliku CSV
            if (allDraws.length === 0) {
                console.log('Próba pobrania danych z pliku CSV...');
                const csvData = await this.loadHistoricalCSV();
                if (csvData && csvData.length > 0) {
                    allDraws = csvData;
                    console.log(`Załadowano ${csvData.length} losowań z CSV`);
                }
            }

            // Usuń duplikaty i posortuj
            const uniqueDraws = this.removeDuplicates(allDraws);
            const sortedDraws = uniqueDraws.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (sortedDraws.length > 0) {
                await this.saveDraws(sortedDraws);
                return {
                    success: true,
                    message: `Pobrano ${sortedDraws.length} rzeczywistych losowań`,
                    count: sortedDraws.length,
                    source: 'official'
                };
            } else {
                // Fallback do przykładowych danych
                console.log('Używanie przykładowych danych...');
                const sampleData = this.getSampleData();
                await this.saveDraws(sampleData.draws);
                return {
                    success: true,
                    message: 'Użyto przykładowych danych (brak dostępu do rzeczywistych)',
                    count: sampleData.draws.length,
                    source: 'sample'
                };
            }
        } catch (error) {
            console.error('Error fetching real data:', error);
            return { error: error.message };
        }
    }

    /**
     * Pobiera dane z URL
     * @param {string} url - URL do pobrania
     * @returns {Promise<Array>} Dane z URL
     */
    async fetchFromURL(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;
            
            const req = protocol.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        const draws = this.parseOfficialData(jsonData);
                        resolve(draws);
                    } catch (error) {
                        console.warn('Błąd parsowania JSON:', error.message);
                        resolve([]);
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    /**
     * Parsuje oficjalne dane z różnych formatów
     * @param {Object} data - Surowe dane
     * @returns {Array} Sparsowane losowania
     */
    parseOfficialData(data) {
        const draws = [];
        
        try {
            // Różne formaty danych
            let items = [];
            
            if (Array.isArray(data)) {
                items = data;
            } else if (data.draws && Array.isArray(data.draws)) {
                items = data.draws;
            } else if (data.results && Array.isArray(data.results)) {
                items = data.results;
            } else if (data.data && Array.isArray(data.data)) {
                items = data.data;
            }
            
            for (const item of items) {
                try {
                    const draw = this.parseDrawItem(item);
                    if (draw) {
                        draws.push(draw);
                    }
                } catch (error) {
                    console.warn('Błąd parsowania elementu:', error.message);
                }
            }
        } catch (error) {
            console.warn('Błąd parsowania danych:', error.message);
        }
        
        return draws;
    }

    /**
     * Parsuje pojedynczy element losowania
     * @param {Object} item - Element do sparsowania
     * @returns {Object|null} Sparsowane losowanie
     */
    parseDrawItem(item) {
        try {
            // Różne formaty pól
            const date = item.date || item.drawDate || item.dateTime || item.createdAt;
            const drawNumber = item.drawNumber || item.number || item.id || item.drawId;
            const numbers = item.numbers || item.results || item.drawnNumbers || [];
            const plusNumber = item.plusNumber || item.plus || item.extraNumber || 0;
            const jackpot = item.jackpot || item.prize || item.totalPrize || 0;
            const winners = item.winners || item.winnerCount || 0;
            
            if (!date || !numbers || numbers.length < 6) {
                return null;
            }
            
            // Konwersja liczb
            const parsedNumbers = numbers.map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1 && n <= 49);
            
            if (parsedNumbers.length !== 6) {
                return null;
            }
            
            return {
                date: this.formatDate(date),
                drawNumber: parseInt(drawNumber) || 0,
                numbers: parsedNumbers.sort((a, b) => a - b),
                plusNumber: parseInt(plusNumber) || 0,
                jackpot: parseFloat(jackpot) || 0,
                winners: parseInt(winners) || 0
            };
        } catch (error) {
            console.warn('Błąd parsowania elementu:', error.message);
            return null;
        }
    }

    /**
     * Formatuje datę do standardowego formatu
     * @param {string} dateStr - Data do sformatowania
     * @returns {string} Sformatowana data
     */
    formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            return date.toISOString().split('T')[0]; // YYYY-MM-DD
        } catch (error) {
            return dateStr;
        }
    }

    /**
     * Usuwa duplikaty z tablicy losowań
     * @param {Array} draws - Tablica losowań
     * @returns {Array} Tablica bez duplikatów
     */
    removeDuplicates(draws) {
        const seen = new Set();
        return draws.filter(draw => {
            const key = `${draw.date}-${draw.drawNumber}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Ładuje dane historyczne z pliku CSV
     * @returns {Promise<Array>} Dane z CSV
     */
    async loadHistoricalCSV() {
        try {
            const csvPath = path.join(__dirname, '../data/historical-data.csv');
            const fileContent = await fs.readFile(csvPath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            const draws = [];
            
            for (let i = 1; i < lines.length; i++) {
                try {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    const values = line.split(',').map(v => v.trim());
                    
                    if (values.length < 6) continue;
                    
                    const [dateStr, drawNumberStr, ...numberStrs] = values;
                    
                    const numbers = [];
                    for (let j = 0; j < 6; j++) {
                        const num = parseInt(numberStrs[j]);
                        if (isNaN(num) || num < 1 || num > 49) continue;
                        numbers.push(num);
                    }
                    
                    if (numbers.length !== 6 || new Set(numbers).size !== 6) continue;
                    
                    const draw = {
                        date: dateStr,
                        drawNumber: parseInt(drawNumberStr) || 0,
                        numbers: numbers.sort((a, b) => a - b),
                        plusNumber: parseInt(numberStrs[6]) || 0,
                        jackpot: parseFloat(numberStrs[7]) || 0,
                        winners: parseInt(numberStrs[8]) || 0
                    };
                    
                    draws.push(draw);
                } catch (error) {
                    console.warn(`Błąd parsowania linii CSV ${i}:`, error.message);
                }
            }
            
            return draws;
        } catch (error) {
            console.warn('Błąd ładowania CSV:', error.message);
            return [];
        }
    }

    /**
     * Ładuje dane z pliku JSON
     * @returns {Object} Dane aplikacji
     */
    async loadData() {
        try {
            const data = await fs.readFile(this.dataPath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.log('Creating new data file...');
            const sampleData = this.getSampleData();
            await this.saveData(sampleData);
            return sampleData;
        }
    }

    /**
     * Zapisuje nowe losowania
     * @param {Array} newDraws - Nowe losowania do zapisania
     */
    async saveDraws(newDraws) {
        try {
            const data = await this.loadData();
            data.draws = [...newDraws, ...data.draws];
            await this.saveData(data);
        } catch (error) {
            console.error('Error saving draws:', error);
            throw error;
        }
    }

    /**
     * Zapisuje dane do pliku JSON
     * @param {Object} data - Dane do zapisania
     */
    async saveData(data) {
        try {
            const dir = path.dirname(this.dataPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    /**
     * Zwraca przykładowe dane
     * @returns {Object} Przykładowe dane
     */
    getSampleData() {
        return {
            draws: [
                {
                    date: '2024-01-15',
                    drawNumber: 12345,
                    numbers: [3, 12, 23, 34, 41, 48],
                    plusNumber: 7,
                    jackpot: 2000000,
                    winners: 0
                },
                {
                    date: '2024-01-12',
                    drawNumber: 12344,
                    numbers: [5, 11, 19, 28, 35, 42],
                    plusNumber: 13,
                    jackpot: 1500000,
                    winners: 1
                },
                {
                    date: '2024-01-10',
                    drawNumber: 12343,
                    numbers: [2, 8, 15, 27, 39, 45],
                    plusNumber: 9,
                    jackpot: 3000000,
                    winners: 0
                }
            ]
        };
    }

    /**
     * Inicjalizuje aplikację
     */
    async initialize() {
        try {
            this.setupIPC();
            this.createWindow();
            
            // Pobierz rzeczywiste dane przy starcie
            console.log('Inicjalizacja - pobieranie rzeczywistych danych...');
            const dataResult = await this.fetchRealHistoricalData();
            if (dataResult.success) {
                console.log(`✅ ${dataResult.message}`);
            } else {
                console.log('⚠️ Użyto przykładowych danych');
            }
            
            this.isInitialized = true;
            console.log('Lotto Analyzer initialized successfully');
        } catch (error) {
            console.error('Error initializing app:', error);
            app.quit();
        }
    }

    /**
     * Pobiera dane z wybranego zakresu dat przez użytkownika
     * @param {string} startDate - Data początkowa (YYYY-MM-DD)
     * @param {string} endDate - Data końcowa (YYYY-MM-DD)
     * @returns {Promise<Object>} Wynik pobierania
     */
    async fetchDataByDateRange(startDate, endDate) {
        try {
            console.log(`Pobieranie danych z zakresu: ${startDate} - ${endDate}`);
            
            // Walidacja dat - nie pozwól na przyszłe daty
            const today = new Date();
            const startDateObj = new Date(startDate);
            const endDateObj = new Date(endDate);
            
            if (startDateObj > today || endDateObj > today) {
                return {
                    success: false,
                    message: 'Nie można pobierać danych z przyszłych dat. Wybierz zakres z przeszłości.',
                    error: 'Przyszłe daty'
                };
            }
            
            if (startDateObj > endDateObj) {
                return {
                    success: false,
                    message: 'Data początkowa nie może być późniejsza niż końcowa.',
                    error: 'Nieprawidłowy zakres dat'
                };
            }
            
            // Różne źródła danych do sprawdzenia
            const sources = [
                {
                    name: 'Lotto.pl API',
                    url: `https://www.lotto.pl/api/lotto/draws?startDate=${startDate}&endDate=${endDate}`,
                    parser: 'json'
                },
                {
                    name: 'Lotto.pl Wyniki',
                    url: `https://www.lotto.pl/wyniki-i-wygrane/lotto?dateFrom=${startDate}&dateTo=${endDate}`,
                    parser: 'html'
                },
                {
                    name: 'Totalizator Sportowy',
                    url: `https://www.totalizator.pl/api/lotto/results?from=${startDate}&to=${endDate}`,
                    parser: 'json'
                }
            ];

            let allDraws = [];
            let successfulSources = 0;

            for (const source of sources) {
                try {
                    console.log(`Próba pobrania z: ${source.name}`);
                    const data = await this.fetchFromSource(source, startDate, endDate);
                    
                    if (data && data.length > 0) {
                        allDraws = allDraws.concat(data);
                        successfulSources++;
                        console.log(`✅ Pobrano ${data.length} losowań z ${source.name}`);
                    }
                } catch (error) {
                    console.warn(`❌ Błąd pobierania z ${source.name}:`, error.message);
                }
            }

            // Usuń duplikaty i posortuj
            const uniqueDraws = this.removeDuplicates(allDraws);
            const sortedDraws = uniqueDraws.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (sortedDraws.length > 0) {
                await this.saveDraws(sortedDraws);
                return {
                    success: true,
                    message: `Pobrano ${sortedDraws.length} losowań z ${successfulSources} źródeł`,
                    count: sortedDraws.length,
                    sources: successfulSources,
                    dateRange: { startDate, endDate }
                };
            } else {
                return {
                    success: false,
                    message: 'Nie udało się pobrać żadnych danych z wybranego zakresu',
                    error: 'Brak danych'
                };
            }
        } catch (error) {
            console.error('Error fetching data by date range:', error);
            return { error: error.message };
        }
    }

    /**
     * Pobiera dane z konkretnego źródła
     * @param {Object} source - Konfiguracja źródła
     * @param {string} startDate - Data początkowa
     * @param {string} endDate - Data końcowa
     * @returns {Promise<Array>} Dane z źródła
     */
    async fetchFromSource(source, startDate, endDate) {
        return new Promise((resolve, reject) => {
            const protocol = source.url.startsWith('https:') ? https : http;
            
            const req = protocol.get(source.url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        if (source.parser === 'json') {
                            const jsonData = JSON.parse(data);
                            const draws = this.parseOfficialData(jsonData);
                            resolve(draws);
                        } else if (source.parser === 'html') {
                            const draws = this.parseHTMLData(data, startDate, endDate);
                            resolve(draws);
                        } else {
                            resolve([]);
                        }
                    } catch (error) {
                        console.warn(`Błąd parsowania danych z ${source.name}:`, error.message);
                        resolve([]);
                    }
                });
            });
            
            req.on('error', (error) => {
                console.warn(`❌ Błąd pobierania z ${source.name}:`, error.message);
                resolve([]);
            });
            
            req.setTimeout(10000, () => {
                console.warn(`❌ Timeout dla ${source.name}`);
                req.destroy();
                resolve([]);
            });
        });
    }

    /**
     * Parsuje dane HTML z wyników Lotto
     * @param {string} htmlData - Dane HTML
     * @param {string} startDate - Data początkowa
     * @param {string} endDate - Data końcowa
     * @returns {Array} Sparsowane losowania
     */
    parseHTMLData(htmlData, startDate, endDate) {
        const draws = [];
        
        try {
            // Proste parsowanie HTML (w rzeczywistej aplikacji można użyć cheerio)
            const drawPattern = /<tr[^>]*>.*?<td[^>]*>(\d{4}-\d{2}-\d{2})<\/td>.*?<td[^>]*>(\d+)<\/td>.*?<td[^>]*>([\d\s,]+)<\/td>/g;
            let match;
            
            while ((match = drawPattern.exec(htmlData)) !== null) {
                try {
                    const date = match[1];
                    const drawNumber = parseInt(match[2]);
                    const numbersStr = match[3];
                    
                    // Sprawdź czy data jest w zakresie
                    if (date >= startDate && date <= endDate) {
                        const numbers = numbersStr.split(/[\s,]+/).map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1 && n <= 49);
                        
                        if (numbers.length === 6) {
                            const draw = {
                                date: date,
                                drawNumber: drawNumber,
                                numbers: numbers.sort((a, b) => a - b),
                                plusNumber: 0, // Nie zawsze dostępne w HTML
                                jackpot: 0,
                                winners: 0
                            };
                            draws.push(draw);
                        }
                    }
                } catch (error) {
                    console.warn('Błąd parsowania wiersza HTML:', error.message);
                }
            }
        } catch (error) {
            console.warn('Błąd parsowania HTML:', error.message);
        }
        
        return draws;
    }
}

// Tworzenie instancji aplikacji
const lottoApp = new LottoApp();

// Event listeners
app.whenReady().then(() => {
    if (!lottoApp.isInitialized) {
        lottoApp.initialize();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // Sprawdź czy aplikacja jest zainicjalizowana i czy nie ma już okien
    if (lottoApp.isInitialized && BrowserWindow.getAllWindows().length === 0) {
        lottoApp.createWindow();
    }
});

// Obsługa błędów nieprzechwyconych
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 