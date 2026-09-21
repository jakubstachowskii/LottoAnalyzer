const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script dla aplikacji Lotto Analyzer
 * Bezpiecznie udostępnia API komunikacji z głównym procesem
 */

// Sprawdzenie czy jesteśmy w bezpiecznym kontekście
if (!contextBridge) {
    throw new Error('contextBridge is not available');
}

/**
 * API udostępniane dla renderer process
 * Wszystkie metody komunikują się z głównym procesem przez IPC
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Pobiera dane losowań
     * @param {number} limit - Maksymalna liczba rekordów
     * @returns {Promise<Array>} Tablica losowań
     */
    getDraws: (limit = 100) => ipcRenderer.invoke('get-draws', limit),

    /**
     * Pobiera statystyki
     * @returns {Promise<Object>} Obiekt ze statystykami
     */
    getStatistics: () => ipcRenderer.invoke('get-statistics'),

    /**
     * Generuje liczby na podstawie strategii
     * @param {string} strategy - Strategia generowania ('random', 'hot', 'cold', 'balanced')
     * @returns {Promise<Object>} Wygenerowane liczby
     */
    generateNumbers: (strategy = 'random') => ipcRenderer.invoke('generate-numbers', strategy),

    /**
     * Importuje dane z pliku CSV
     * @returns {Promise<Object>} Wynik importu
     */
    importCSV: () => ipcRenderer.invoke('import-csv'),

                    /**
                 * Pobiera najnowsze dane
                 * @returns {Promise<Object>} Wynik pobierania
                 */
                fetchLatestData: () => ipcRenderer.invoke('fetch-latest-data'),

                /**
                 * Pobiera dane z wybranego zakresu dat
                 * @param {string} startDate - Data początkowa (YYYY-MM-DD)
                 * @param {string} endDate - Data końcowa (YYYY-MM-DD)
                 * @returns {Promise<Object>} Wynik pobierania
                 */
                fetchDataByDateRange: (startDate, endDate) => ipcRenderer.invoke('fetch-data-by-date-range', startDate, endDate),

    /**
     * Wyświetla powiadomienie
     * @param {string} title - Tytuł powiadomienia
     * @param {string} message - Treść powiadomienia
     */
    showNotification: (title, message) => {
        // Symulacja powiadomienia (w rzeczywistej aplikacji można użyć electron-notifications)
        console.log(`Notification: ${title} - ${message}`);
    },

    /**
     * Rejestruje listener dla aktualizacji danych
     * @param {Function} callback - Funkcja wywoływana przy aktualizacji
     */
    onDataUpdate: (callback) => {
        // W tej uproszczonej wersji nie implementujemy real-time updates
        console.log('Data update listener registered');
    },

    /**
     * Usuwa listener dla aktualizacji danych
     */
    removeDataUpdateListener: () => {
        console.log('Data update listener removed');
    }
});

// Logowanie informacji o załadowaniu preload script
console.log('Preload script loaded successfully'); 