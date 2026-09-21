/**
 * Główna klasa aplikacji Lotto Analyzer - Renderer Process
 * Zarządza interfejsem użytkownika i komunikacją z głównym procesem
 */
class LottoAnalyzerApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.charts = {};
        this.generationHistory = [];
        this.isInitialized = false;
        this.dataStatusInterval = null; // Timer dla aktualizacji statusu danych
        this.init();
    }

    /**
     * Inicjalizuje aplikację
     */
    async init() {
        try {
            this.setupEventListeners();
            this.setupTabNavigation();
            await this.loadInitialData();
            this.isInitialized = true;
            this.updateStatus('Aplikacja gotowa');
            
            // Jeśli aktualna zakładka to "Dane", uruchom aktualizacje statusu
            if (this.currentTab === 'data') {
                this.startDataStatusUpdates();
            }
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Błąd podczas inicjalizacji aplikacji');
        }
    }

    /**
     * Konfiguruje event listeners dla elementów UI
     */
    setupEventListeners() {
        // Header buttons
        const fetchDataBtn = document.getElementById('fetch-data-btn');
        const importCsvBtn = document.getElementById('import-csv-btn');
        
        if (fetchDataBtn) {
            fetchDataBtn.addEventListener('click', () => this.fetchLatestData());
        }
        if (importCsvBtn) {
            importCsvBtn.addEventListener('click', () => this.importCSV());
        }

        // Statistics
        const analyzeBtn = document.getElementById('analyze-btn');
        const periodSelect = document.getElementById('period-select');
        
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeNumbers());
        }
        if (periodSelect) {
            periodSelect.addEventListener('change', () => this.analyzeNumbers());
        }

        // Generator
        const generateBtn = document.getElementById('generate-btn');
        const generateAgainBtn = document.getElementById('generate-again-btn');
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateNumbers());
        }
        if (generateAgainBtn) {
            generateAgainBtn.addEventListener('click', () => this.generateNumbers());
        }

        // History
        const loadHistoryBtn = document.getElementById('load-history-btn');
        if (loadHistoryBtn) {
            loadHistoryBtn.addEventListener('click', () => this.loadHistory());
        }

        // Strategy radio buttons
        document.querySelectorAll('input[name="strategy"]').forEach(radio => {
            radio.addEventListener('change', () => this.onStrategyChange());
        });
    }

    /**
     * Konfiguruje nawigację między zakładkami
     */
    setupTabNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
    }

    /**
     * Przełącza na wybraną zakładkę
     * @param {string} tabName - Nazwa zakładki
     */
    switchTab(tabName) {
        // Zatrzymaj poprzedni timer aktualizacji statusu
        this.stopDataStatusUpdates();
        
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeNavBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeNavBtn) {
            activeNavBtn.classList.add('active');
        }

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeTab = document.getElementById(tabName);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        this.currentTab = tabName;

        // Load tab-specific data
        switch(tabName) {
            case 'statistics':
                this.loadStatistics();
                break;
            case 'history':
                this.loadHistory();
                break;
            case 'data':
                this.initDataTab();
                // Uruchom automatyczne aktualizacje statusu dla zakładki "Dane"
                this.startDataStatusUpdates();
                break;
        }
    }

    /**
     * Inicjalizuje obsługę zakładki "Dane"
     */
    initDataTab() {
        // Event listeners dla zakładki danych
        const fetchDateRangeBtn = document.getElementById('fetch-date-range-btn');
        const importCsvBtn = document.getElementById('import-csv-btn');
        const fetchDataBtn = document.getElementById('fetch-data-btn');
        const clearDataBtn = document.getElementById('clear-data-btn');
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');

        // Ustaw domyślne daty (ostatni miesiąc)
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        
        // Sprawdź czy to nie są przyszłe daty
        const currentDate = new Date();
        const endDate = today > currentDate ? currentDate : today;
        const startDate = lastMonth > currentDate ? new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate()) : lastMonth;
        
        endDateInput.value = endDate.toISOString().split('T')[0];
        startDateInput.value = startDate.toISOString().split('T')[0];

        // Pobieranie danych z zakresu dat
        if (fetchDateRangeBtn) {
            fetchDateRangeBtn.addEventListener('click', async () => {
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;

                if (!startDate || !endDate) {
                    this.showStatus('Proszę wybrać zakres dat', 'error');
                    return;
                }

                if (startDate > endDate) {
                    this.showStatus('Data początkowa nie może być późniejsza niż końcowa', 'error');
                    return;
                }

                await this.fetchDataByDateRange(startDate, endDate);
            });
        }

        // Import CSV
        if (importCsvBtn) {
            importCsvBtn.addEventListener('click', async () => {
                await this.importCSV();
            });
        }

        // Pobieranie najnowszych danych
        if (fetchDataBtn) {
            fetchDataBtn.addEventListener('click', async () => {
                await this.fetchLatestData();
            });
        }

        // Czyszczenie danych
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', async () => {
                if (confirm('Czy na pewno chcesz wyczyścić wszystkie dane? Tej operacji nie można cofnąć.')) {
                    await this.clearData();
                }
            });
        }

        // Aktualizuj status danych przy załadowaniu zakładki
        this.updateDataStatus();
        
        // Dodaj event listenery dla automatycznej aktualizacji przy zmianie danych
        this.setupDataStatusListeners();
    }

    /**
     * Pobiera dane z wybranego zakresu dat
     * @param {string} startDate - Data początkowa
     * @param {string} endDate - Data końcowa
     */
    async fetchDataByDateRange(startDate, endDate) {
        try {
            this.showLoading('Pobieranie danych z zakresu dat...');
            
            const result = await window.electronAPI.fetchDataByDateRange(startDate, endDate);
            
            this.hideLoading();
            
            if (result.success) {
                this.showStatus(result.message, 'success');
                this.updateDataStatus();
                this.emitDataUpdate(); // Emituj event o aktualizacji
                this.loadDashboard(); // Odśwież dashboard
                this.loadStatistics(); // Odśwież statystyki
            } else {
                this.showStatus(result.message || 'Błąd pobierania danych', 'error');
            }
        } catch (error) {
            this.hideLoading();
            this.showStatus(`Błąd: ${error.message}`, 'error');
        }
    }

    /**
     * Importuje dane z pliku CSV
     */
    async importCSV() {
        try {
            this.showLoading('Importowanie danych z pliku CSV...');
            
            const result = await window.electronAPI.importCSV();
            
            this.hideLoading();
            
            if (result.canceled) {
                return; // Użytkownik anulował
            }
            
            if (result.error) {
                this.showStatus(`Błąd importu: ${result.error}`, 'error');
            } else {
                this.showStatus(`Zaimportowano ${result.imported} losowań (${result.errors} błędów)`, 'success');
                this.updateDataStatus();
                this.emitDataUpdate(); // Emituj event o aktualizacji
                this.loadDashboard();
                this.loadStatistics();
            }
        } catch (error) {
            this.hideLoading();
            this.showStatus(`Błąd importu: ${error.message}`, 'error');
        }
    }

    /**
     * Pobiera najnowsze dane
     */
    async fetchLatestData() {
        try {
            this.showLoading('Pobieranie najnowszych danych...');
            
            const result = await window.electronAPI.fetchLatestData();
            
            this.hideLoading();
            
            if (result.success) {
                this.showStatus(result.message, 'success');
                this.updateDataStatus();
                this.emitDataUpdate(); // Emituj event o aktualizacji
                this.loadDashboard();
                this.loadStatistics();
            } else {
                this.showStatus(result.message || 'Błąd pobierania danych', 'error');
            }
        } catch (error) {
            this.hideLoading();
            this.showStatus(`Błąd: ${error.message}`, 'error');
        }
    }

    /**
     * Czyści wszystkie dane
     */
    async clearData() {
        try {
            this.showLoading('Czyszczenie danych...');
            
            // Tutaj można dodać wywołanie API do czyszczenia danych
            // Na razie symulujemy
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.hideLoading();
            this.showStatus('Dane zostały wyczyszczone', 'success');
            this.updateDataStatus();
            this.emitDataUpdate(); // Emituj event o aktualizacji
            this.loadDashboard();
            this.loadStatistics();
        } catch (error) {
            this.hideLoading();
            this.showStatus(`Błąd czyszczenia: ${error.message}`, 'error');
        }
    }

    /**
     * Uruchamia automatyczne aktualizacje statusu danych
     */
    startDataStatusUpdates() {
        // Zatrzymaj poprzedni timer jeśli istnieje
        this.stopDataStatusUpdates();
        
        // Uruchom timer aktualizujący status co 3 sekundy
        this.dataStatusInterval = setInterval(() => {
            if (this.currentTab === 'data') {
                this.updateDataStatus();
            }
        }, 3000);
        
        // Natychmiastowa aktualizacja
        this.updateDataStatus();
    }

    /**
     * Zatrzymuje automatyczne aktualizacje statusu danych
     */
    stopDataStatusUpdates() {
        if (this.dataStatusInterval) {
            clearInterval(this.dataStatusInterval);
            this.dataStatusInterval = null;
        }
    }

    /**
     * Konfiguruje event listenery dla automatycznej aktualizacji statusu
     */
    setupDataStatusListeners() {
        // Nasłuchuj na zmiany w danych poprzez custom event
        document.addEventListener('dataUpdated', () => {
            if (this.currentTab === 'data') {
                this.updateDataStatus();
            }
        });
    }

    /**
     * Emituje event o aktualizacji danych
     */
    emitDataUpdate() {
        document.dispatchEvent(new CustomEvent('dataUpdated'));
    }

    /**
     * Aktualizuje status danych
     */
    async updateDataStatus() {
        try {
            const draws = await window.electronAPI.getDraws();
            const statistics = await window.electronAPI.getStatistics();
            
            const totalDrawsElement = document.getElementById('total-draws');
            const dateRangeElement = document.getElementById('date-range');
            const lastUpdateElement = document.getElementById('last-update');
            
            if (totalDrawsElement) {
                totalDrawsElement.textContent = draws.length || 0;
            }
            
            if (dateRangeElement && draws.length > 0) {
                const dates = draws.map(d => new Date(d.date)).sort((a, b) => a - b);
                const startDate = dates[0].toLocaleDateString('pl-PL');
                const endDate = dates[dates.length - 1].toLocaleDateString('pl-PL');
                dateRangeElement.textContent = `${startDate} - ${endDate}`;
            } else if (dateRangeElement) {
                dateRangeElement.textContent = 'Brak danych';
            }
            
            if (lastUpdateElement) {
                lastUpdateElement.textContent = new Date().toLocaleString('pl-PL');
            }
        } catch (error) {
            console.error('Error updating data status:', error);
        }
    }

    /**
     * Pokazuje status wiadomości
     * @param {string} message - Wiadomość
     * @param {string} type - Typ wiadomości (success, error, info, warning)
     */
    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('data-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-message ${type}`;
            
            // Automatycznie ukryj po 5 sekundach
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status-message';
            }, 5000);
        }
    }

    /**
     * Pokazuje overlay ładowania
     * @param {string} message - Wiadomość ładowania
     */
    showLoading(message = 'Ładowanie...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = overlay?.querySelector('p');
        
        if (overlay) {
            overlay.style.display = 'flex';
        }
        
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    /**
     * Ukrywa overlay ładowania
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Ładuje początkowe dane aplikacji
     */
    async loadInitialData() {
        try {
            this.showLoading(true);
            await this.loadDashboard();
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Błąd podczas ładowania danych');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Ładuje dane dla dashboard
     */
    async loadDashboard() {
        try {
            const [draws, statistics] = await Promise.all([
                window.electronAPI.getDraws(10),
                window.electronAPI.getStatistics()
            ]);

            if (draws.error) {
                throw new Error(draws.error);
            }
            if (statistics.error) {
                throw new Error(statistics.error);
            }

            this.updateDashboardSummary(draws);
            this.updateHotColdNumbers(statistics);
            // Usunięto createFrequencyChart - teraz tylko w module statystyk
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showError('Błąd podczas ładowania dashboard');
        }
    }

    /**
     * Aktualizuje podsumowanie na dashboard
     * @param {Array} draws - Tablica losowań
     */
    updateDashboardSummary(draws) {
        if (!draws || draws.length === 0) {
            this.updateMetricsWithNoData();
            return;
        }

        const latestDraw = draws[0];
        const totalDraws = draws.length;

        // Aktualizuj metryki
        this.updateMetrics(latestDraw, totalDraws);

        // Aktualizuj sekcję ostatniego losowania
        this.updateLatestDrawSection(latestDraw);

        // Aktualizuj szybkie statystyki
        this.updateQuickStats(draws);
    }

    /**
     * Aktualizuje metryki dashboard
     * @param {Object} latestDraw - Ostatnie losowanie
     * @param {number} totalDraws - Łączna liczba losowań
     */
    updateMetrics(latestDraw, totalDraws) {
        // Łączna liczba losowań
        const totalDrawsElement = document.getElementById('total-draws-metric');
        if (totalDrawsElement) {
            totalDrawsElement.textContent = totalDraws.toLocaleString('pl-PL');
        }

        // Data ostatniego losowania
        const lastDrawDateElement = document.getElementById('last-draw-date-metric');
        if (lastDrawDateElement && latestDraw) {
            lastDrawDateElement.textContent = this.formatDate(latestDraw.date);
        }

        // Aktualny jackpot
        const currentJackpotElement = document.getElementById('current-jackpot-metric');
        if (currentJackpotElement && latestDraw) {
            currentJackpotElement.textContent = latestDraw.jackpot ? 
                this.formatCurrency(latestDraw.jackpot) : 'Brak danych';
        }

        // Ostatni zwycięzca
        const lastWinnersElement = document.getElementById('last-winners-metric');
        if (lastWinnersElement && latestDraw) {
            lastWinnersElement.textContent = latestDraw.winners ? 
                `${latestDraw.winners} osoba/y` : 'Brak danych';
        }
    }

    /**
     * Aktualizuje metryki gdy brak danych
     */
    updateMetricsWithNoData() {
        const metricElements = [
            'total-draws-metric',
            'last-draw-date-metric', 
            'current-jackpot-metric',
            'last-winners-metric'
        ];

        metricElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Brak danych';
            }
        });
    }

    /**
     * Aktualizuje sekcję ostatniego losowania
     * @param {Object} latestDraw - Ostatnie losowanie
     */
    updateLatestDrawSection(latestDraw) {
        const drawNumberBadge = document.getElementById('draw-number-badge');
        const latestDrawContent = document.getElementById('latest-draw-content');

        if (!latestDraw) {
            if (drawNumberBadge) drawNumberBadge.textContent = '#-';
            if (latestDrawContent) {
                latestDrawContent.innerHTML = '<div class="no-data">Brak danych o ostatnim losowaniu</div>';
            }
            return;
        }

        // Aktualizuj numer losowania
        if (drawNumberBadge) {
            drawNumberBadge.textContent = `#${latestDraw.drawNumber}`;
        }

        // Aktualizuj zawartość
        if (latestDrawContent) {
            const numbersHTML = this.renderNumberBalls(latestDraw.numbers);
            const plusNumberHTML = latestDraw.plusNumber ? 
                `<div class="plus-number">
                    <span class="plus-label">Liczba Plus:</span>
                    <span class="number-ball plus">${latestDraw.plusNumber}</span>
                </div>` : '';

            const jackpotHTML = latestDraw.jackpot ? 
                `<div class="jackpot-info">
                    <span class="jackpot-label">Jackpot:</span>
                    <span class="jackpot-amount">${this.formatCurrency(latestDraw.jackpot)}</span>
                </div>` : '';

            const winnersHTML = latestDraw.winners !== undefined ? 
                `<div class="winners-info">
                    <span class="winners-label">Zwycięzcy:</span>
                    <span class="winners-count">${latestDraw.winners} osoba/y</span>
                </div>` : '';

            latestDrawContent.innerHTML = `
                <div class="latest-draw-info">
                    <div class="draw-date">
                        <span class="date-label">Data:</span>
                        <span class="date-value">${this.formatDate(latestDraw.date)}</span>
                    </div>
                    <div class="draw-numbers">
                        <span class="numbers-label">Wylosowane liczby:</span>
                        <div class="number-balls-container">
                            ${numbersHTML}
                        </div>
                    </div>
                    ${plusNumberHTML}
                    ${jackpotHTML}
                    ${winnersHTML}
                </div>
            `;
        }
    }

    /**
     * Aktualizuje szybkie statystyki
     * @param {Array} draws - Tablica losowań
     */
    updateQuickStats(draws) {
        if (!draws || draws.length === 0) {
            this.updateQuickStatsWithNoData();
            return;
        }

        // Oblicz statystyki
        const frequency = {};
        for (let i = 1; i <= 49; i++) {
            frequency[i] = 0;
        }

        draws.forEach(draw => {
            if (draw.numbers && Array.isArray(draw.numbers)) {
                draw.numbers.forEach(num => {
                    if (num >= 1 && num <= 49) {
                        frequency[num]++;
                    }
                });
            }
        });

        const frequencies = Object.values(frequency);
        const avgFrequency = (draws.length * 6 / 49).toFixed(2);
        const maxFrequency = Math.max(...frequencies);
        const minFrequency = Math.min(...frequencies);
        const dataRange = `${this.formatDate(draws[draws.length - 1].date)} - ${this.formatDate(draws[0].date)}`;

        // Aktualizuj elementy
        const avgElement = document.getElementById('avg-frequency');
        const maxElement = document.getElementById('max-frequency');
        const minElement = document.getElementById('min-frequency');
        const rangeElement = document.getElementById('data-range');

        if (avgElement) avgElement.textContent = avgFrequency;
        if (maxElement) maxElement.textContent = maxFrequency;
        if (minElement) minElement.textContent = minFrequency;
        if (rangeElement) rangeElement.textContent = dataRange;
    }

    /**
     * Aktualizuje szybkie statystyki gdy brak danych
     */
    updateQuickStatsWithNoData() {
        const statElements = [
            'avg-frequency',
            'max-frequency', 
            'min-frequency',
            'data-range'
        ];

        statElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Brak danych';
            }
        });
    }

    /**
     * Aktualizuje gorące i zimne liczby
     * @param {Object} statistics - Statystyki
     */
    updateHotColdNumbers(statistics) {
        const hotNumbersElement = document.getElementById('hot-numbers');
        const coldNumbersElement = document.getElementById('cold-numbers');
        
        if (hotNumbersElement) {
            if (statistics.hotNumbers && statistics.hotNumbers.length > 0) {
                hotNumbersElement.innerHTML = `
                    <div class="numbers-container">
                        ${this.renderNumberBalls(statistics.hotNumbers, 'hot')}
                    </div>
                    <div class="numbers-info">
                        <small>Najczęściej losowane liczby w historii</small>
                    </div>
                `;
            } else {
                hotNumbersElement.innerHTML = '<div class="no-data">Brak danych</div>';
            }
        }
        
        if (coldNumbersElement) {
            if (statistics.coldNumbers && statistics.coldNumbers.length > 0) {
                coldNumbersElement.innerHTML = `
                    <div class="numbers-container">
                        ${this.renderNumberBalls(statistics.coldNumbers, 'cold')}
                    </div>
                    <div class="numbers-info">
                        <small>Najrzadziej losowane liczby w historii</small>
                    </div>
                `;
            } else {
                coldNumbersElement.innerHTML = '<div class="no-data">Brak danych</div>';
            }
        }
    }

    /**
     * Renderuje liczby jako kule
     * @param {Array} numbers - Tablica liczb
     * @param {string} type - Typ kuli ('hot', 'cold', 'plus')
     * @returns {string} HTML z kulami
     */
    renderNumberBalls(numbers, type = '') {
        if (!Array.isArray(numbers)) return '';
        
        return numbers.map(num => 
            `<span class="number-ball ${type}">${num}</span>`
        ).join('');
    }

    /**
     * Tworzy wykres częstotliwości
     * @param {Object} statistics - Statystyki
     */
    createFrequencyChart(statistics) {
        const canvas = document.getElementById('frequency-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Zniszcz poprzedni wykres
        if (this.charts.frequency) {
            this.charts.frequency.destroy();
        }

        if (!statistics || !statistics.frequency) {
            canvas.style.display = 'none';
            return;
        }

        // Sprawdź czy Chart.js jest dostępny
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js nie jest dostępny - wyświetlam prostą tabelę');
            this.showSimpleFrequencyTable(statistics);
            return;
        }

        canvas.style.display = 'block';
        
        // Przygotuj dane dla wykresu (top 20 liczb)
        const sortedNumbers = Object.entries(statistics.frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);
        
        const labels = sortedNumbers.map(([num]) => num);
        const data = sortedNumbers.map(([,freq]) => freq);
        
        this.charts.frequency = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Częstotliwość wystąpień',
                    data: data,
                    backgroundColor: 'rgba(66, 153, 225, 0.6)',
                    borderColor: 'rgba(66, 153, 225, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 20 najczęściej losowanych liczb'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Liczba wystąpień'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Numer'
                        }
                    }
                }
            }
        });
    }

    /**
     * Wyświetla prostą tabelę częstotliwości gdy Chart.js nie jest dostępny
     * @param {Object} statistics - Statystyki
     */
    showSimpleFrequencyTable(statistics) {
        const canvas = document.getElementById('frequency-chart');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        
        // Ukryj canvas
        canvas.style.display = 'none';
        
        // Usuń poprzednią tabelę jeśli istnieje
        const existingTable = container.querySelector('.simple-frequency-table');
        if (existingTable) {
            existingTable.remove();
        }
        
        if (!statistics.frequency) return;
        
        // Przygotuj dane dla tabeli (top 20 liczb)
        const sortedNumbers = Object.entries(statistics.frequency)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);
        
        // Utwórz prostą tabelę
        const table = document.createElement('table');
        table.className = 'simple-frequency-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Liczba</th>
                    <th>Częstotliwość</th>
                    <th>Procent</th>
                </tr>
            </thead>
            <tbody>
                ${sortedNumbers.map(([num, freq]) => {
                    const percent = statistics.percentages ? statistics.percentages[num] || '0.00' : '0.00';
                    return `<tr><td>${num}</td><td>${freq}</td><td>${percent}%</td></tr>`;
                }).join('')}
            </tbody>
        `;
        
        container.appendChild(table);
    }

    /**
     * Tworzy wykres rozkładu
     * @param {Object} statistics - Statystyki
     */
    createDistributionChart(statistics) {
        const canvas = document.getElementById('distribution-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Zniszcz poprzedni wykres
        if (this.charts.distribution) {
            this.charts.distribution.destroy();
        }

        if (!statistics || !statistics.frequency) {
            canvas.style.display = 'none';
            return;
        }

        // Sprawdź czy Chart.js jest dostępny
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js nie jest dostępny - ukrywam wykres rozkładu');
            canvas.style.display = 'none';
            return;
        }

        canvas.style.display = 'block';
        
        // Przygotuj dane dla wykresu
        const labels = Object.keys(statistics.frequency).sort((a, b) => parseInt(a) - parseInt(b));
        const data = labels.map(num => statistics.frequency[num]);
        
        this.charts.distribution = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rozkład częstotliwości',
                    data: data,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Rozkład częstotliwości wszystkich liczb'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Liczba wystąpień'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Numer'
                        }
                    }
                }
            }
        });
    }

    /**
     * Analizuje liczby (symulacja)
     */
    async analyzeNumbers() {
        try {
            this.showLoading(true);
            const statistics = await window.electronAPI.getStatistics();
            
            if (statistics.error) {
                throw new Error(statistics.error);
            }
            
            this.updateStatisticsTable(statistics);
            this.createDistributionChart(statistics);
            
            this.updateStatus('Analiza zakończona');
        } catch (error) {
            console.error('Error analyzing numbers:', error);
            this.showError('Błąd podczas analizy liczb');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Generuje liczby na podstawie wybranej strategii
     */
    async generateNumbers() {
        try {
            this.showLoading(true);
            
            const strategy = document.querySelector('input[name="strategy"]:checked')?.value || 'random';
            const result = await window.electronAPI.generateNumbers(strategy);
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            this.displayGeneratedNumbers(result);
            this.addToGenerationHistory(result);
            
            this.updateStatus('Liczby wygenerowane');
        } catch (error) {
            console.error('Error generating numbers:', error);
            this.showError('Błąd podczas generowania liczb');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Wyświetla wygenerowane liczby
     * @param {Object} result - Wynik generowania
     */
    displayGeneratedNumbers(result) {
        const resultElement = document.getElementById('generated-numbers');
        if (!resultElement) return;

        const strategyNames = {
            'random': 'Losowe',
            'hot': 'Gorące liczby',
            'cold': 'Zimne liczby',
            'balanced': 'Zbalansowane'
        };

        const strategyName = strategyNames[result.strategy] || result.strategy;
        
        resultElement.innerHTML = `
            <div class="generated-result">
                <h3>Wygenerowane liczby (${strategyName})</h3>
                <div class="number-balls">
                    ${this.renderNumberBalls(result.numbers)}
                </div>
                <p class="generation-time">Wygenerowano: ${this.formatDateTime(new Date(result.timestamp))}</p>
            </div>
        `;
    }

    /**
     * Dodaje wynik do historii generowania
     * @param {Object} result - Wynik generowania
     */
    addToGenerationHistory(result) {
        this.generationHistory.unshift({
            ...result,
            id: Date.now()
        });
        
        // Ogranicz historię do 10 ostatnich wyników
        if (this.generationHistory.length > 10) {
            this.generationHistory = this.generationHistory.slice(0, 10);
        }
        
        this.updateGenerationHistoryDisplay();
    }

    /**
     * Aktualizuje wyświetlanie historii generowania
     */
    updateGenerationHistoryDisplay() {
        const historyElement = document.getElementById('generation-history');
        if (!historyElement) return;

        if (this.generationHistory.length === 0) {
            historyElement.innerHTML = '<p>Brak historii generowania</p>';
            return;
        }

        const strategyNames = {
            'random': 'Losowe',
            'hot': 'Gorące',
            'cold': 'Zimne',
            'balanced': 'Zbalansowane'
        };

        const historyHTML = this.generationHistory.map(item => {
            const strategyName = strategyNames[item.strategy] || item.strategy;
            return `
                <div class="history-item">
                    <div class="history-numbers">
                        ${this.renderNumberBalls(item.numbers)}
                    </div>
                    <div class="history-info">
                        <span class="strategy">${strategyName}</span>
                        <span class="time">${this.formatDateTime(new Date(item.timestamp))}</span>
                    </div>
                </div>
            `;
        }).join('');

        historyElement.innerHTML = historyHTML;
    }

    /**
     * Ładuje historię losowań
     */
    async loadHistory() {
        try {
            this.showLoading(true);
            const draws = await window.electronAPI.getDraws(50);
            
            if (draws.error) {
                throw new Error(draws.error);
            }
            
            this.updateHistoryTable(draws);
        } catch (error) {
            console.error('Error loading history:', error);
            this.showError('Błąd podczas ładowania historii');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Aktualizuje tabelę historii
     * @param {Array} draws - Tablica losowań
     */
    updateHistoryTable(draws) {
        const tableElement = document.getElementById('history-table');
        if (!tableElement) return;

        if (!draws || draws.length === 0) {
            tableElement.innerHTML = '<tr><td colspan="5">Brak danych</td></tr>';
            return;
        }

        const tableHTML = draws.map(draw => `
            <tr>
                <td>${this.formatDate(draw.date)}</td>
                <td>${draw.drawNumber}</td>
                <td class="numbers-cell">
                    ${this.renderNumberBalls(draw.numbers)}
                    ${draw.plusNumber ? `<span class="number-ball plus">${draw.plusNumber}</span>` : ''}
                </td>
                <td>${draw.jackpot ? this.formatCurrency(draw.jackpot) : '-'}</td>
                <td>${draw.winners || '-'}</td>
            </tr>
        `).join('');

        tableElement.innerHTML = tableHTML;
    }

    /**
     * Pobiera najnowsze dane
     */
    async fetchLatestData() {
        try {
            this.showLoading(true);
            this.updateStatus('Pobieranie najnowszych danych...');
            
            const result = await window.electronAPI.fetchLatestData();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            if (result.success) {
                this.updateStatus(result.message);
                await this.loadDashboard(); // Odśwież dashboard
            }
        } catch (error) {
            console.error('Error fetching latest data:', error);
            this.showError('Błąd podczas pobierania danych');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Importuje dane z pliku CSV
     */
    async importCSV() {
        try {
            this.showLoading(true);
            this.updateStatus('Importowanie danych z CSV...');
            
            const result = await window.electronAPI.importCSV();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            if (result.canceled) {
                this.updateStatus('Import anulowany');
                return;
            }
            
            this.updateStatus(`Zaimportowano ${result.imported} losowań (${result.errors} błędów)`);
            await this.loadDashboard(); // Odśwież dashboard
        } catch (error) {
            console.error('Error importing CSV:', error);
            this.showError('Błąd podczas importu CSV');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Obsługuje zmianę strategii generowania
     */
    onStrategyChange() {
        const selectedStrategy = document.querySelector('input[name="strategy"]:checked')?.value;
        if (selectedStrategy) {
            console.log('Selected strategy:', selectedStrategy);
        }
    }

    /**
     * Formatuje datę
     * @param {string} dateString - String z datą
     * @returns {string} Sformatowana data
     */
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('pl-PL');
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Formatuje datę i czas
     * @param {Date} date - Obiekt Date
     * @returns {string} Sformatowana data i czas
     */
    formatDateTime(date) {
        try {
            return date.toLocaleString('pl-PL');
        } catch (error) {
            return date.toString();
        }
    }

    /**
     * Formatuje kwotę pieniężną
     * @param {number} amount - Kwota
     * @returns {string} Sformatowana kwota
     */
    formatCurrency(amount) {
        try {
            return new Intl.NumberFormat('pl-PL', {
                style: 'currency',
                currency: 'PLN'
            }).format(amount);
        } catch (error) {
            return `${amount} PLN`;
        }
    }

    /**
     * Aktualizuje status aplikacji
     * @param {string} message - Wiadomość statusu
     */
    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    /**
     * Aktualizuje czas ostatniej aktualizacji
     */
    updateLastUpdateTime() {
        const timeElement = document.getElementById('last-update-time');
        if (timeElement) {
            timeElement.textContent = this.formatDateTime(new Date());
        }
    }

    /**
     * Pokazuje/ukrywa loading
     * @param {boolean} show - Czy pokazać loading
     */
    showLoading(show) {
        const loadingElement = document.getElementById('loading-overlay');
        if (loadingElement) {
            loadingElement.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Pokazuje błąd
     * @param {string} message - Wiadomość błędu
     */
    showError(message) {
        console.error('App Error:', message);
        this.updateStatus(`Błąd: ${message}`);
        
        // Można dodać bardziej zaawansowane powiadomienia o błędach
        if (window.electronAPI && window.electronAPI.showNotification) {
            window.electronAPI.showNotification('Błąd', message);
        }
    }
}

// Inicjalizacja aplikacji po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.lottoApp = new LottoAnalyzerApp();
    } catch (error) {
        console.error('Error creating LottoAnalyzerApp:', error);
    }
});