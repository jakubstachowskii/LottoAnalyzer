const axios = require('axios');
const cheerio = require('cheerio');
const { format, parseISO } = require('date-fns');

class DataScraper {
    constructor() {
        this.baseURL = 'https://www.lotto.pl';
        this.resultsURL = 'https://www.lotto.pl/wyniki/lotto';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async fetchLatestDraws(count = 10) {
        try {
            console.log('Fetching latest draws from lotto.pl...');
            const response = await axios.get(this.resultsURL, { 
                headers: this.headers,
                timeout: 10000 
            });
            
            if (!response.data) {
                throw new Error('Brak danych w odpowiedzi');
            }
            
            const $ = cheerio.load(response.data);
            const draws = [];
            
            // Szukamy tabelę z wynikami - może wymagać dostosowania do aktualnej struktury strony
            $('.results-table tbody tr, .wyniki-tabela tbody tr, table tbody tr').each((index, element) => {
                if (index >= count) return false; // Limit draws
                
                try {
                    const row = $(element);
                    const cells = row.find('td');
                    
                    if (cells.length < 7) return; // Skip invalid rows
                    
                    // Parsowanie daty - może wymagać dostosowania
                    const dateText = cells.eq(0).text().trim();
                    const drawDate = this.parseDate(dateText);
                    
                    if (!drawDate) return;
                    
                    // Parsowanie numerów
                    const numbers = [];
                    for (let i = 1; i <= 6; i++) {
                        const numText = cells.eq(i).text().trim();
                        const num = parseInt(numText);
                        if (num >= 1 && num <= 49) {
                            numbers.push(num);
                        }
                    }
                    
                    if (numbers.length === 6) {
                        numbers.sort((a, b) => a - b);
                        
                        const draw = {
                            date: drawDate,
                            drawNumber: this.extractDrawNumber(row),
                            gameType: 'lotto',
                            numbers: numbers,
                            plusNumber: this.extractPlusNumber(row),
                            jackpotAmount: this.extractJackpotAmount(row),
                            winnersCount: this.extractWinnersCount(row)
                        };
                        
                        // Walidacja przed dodaniem
                        const validation = this.validateDraw(draw);
                        if (validation.valid) {
                            draws.push(draw);
                        } else {
                            console.warn('Invalid draw data:', validation.error);
                        }
                    }
                } catch (error) {
                    console.warn('Error parsing row:', error.message);
                }
            });
            
            console.log(`Successfully scraped ${draws.length} draws`);
            return draws;
            
        } catch (error) {
            console.error('Error fetching draws:', error.message);
            
            // Fallback: zwróć przykładowe dane dla testów
            return this.getFallbackData();
        }
    }

    parseDate(dateText) {
        try {
            // Różne formaty dat, które mogą wystąpić
            const formats = [
                /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
                /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/  // DD/MM/YYYY
            ];
            
            for (const format of formats) {
                const match = dateText.match(format);
                if (match) {
                    if (format === formats[1]) { // YYYY-MM-DD
                        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
                    } else { // DD.MM.YYYY or DD/MM/YYYY
                        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
                    }
                }
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    extractDrawNumber(row) {
        try {
            // Próbujemy znaleźć numer losowania w różnych miejscach
            const drawText = row.find('.draw-number, .nr-losowania').text().trim();
            const match = drawText.match(/(\d+)/);
            return match ? parseInt(match[1]) : Date.now(); // Fallback to timestamp
        } catch (error) {
            return Date.now();
        }
    }

    extractPlusNumber(row) {
        try {
            const plusText = row.find('.plus-number, .plus').text().trim();
            const num = parseInt(plusText);
            return (num >= 1 && num <= 49) ? num : null;
        } catch (error) {
            return null;
        }
    }

    extractJackpotAmount(row) {
        try {
            const jackpotText = row.find('.jackpot, .kumulacja').text().trim();
            const match = jackpotText.match(/([\d\s,]+)/);
            if (match) {
                return parseFloat(match[1].replace(/[\s,]/g, ''));
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    extractWinnersCount(row) {
        try {
            const winnersText = row.find('.winners, .zwyciezcy').text().trim();
            const match = winnersText.match(/(\d+)/);
            return match ? parseInt(match[1]) : null;
        } catch (error) {
            return null;
        }
    }

    // Dane testowe na wypadek problemów ze scrapingiem
    getFallbackData() {
        const draws = [];
        const today = new Date();
        
        for (let i = 0; i < 10; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (i * 3)); // Co 3 dni
            
            const numbers = new Set();
            while (numbers.size < 6) {
                numbers.add(Math.floor(Math.random() * 49) + 1);
            }
            
            draws.push({
                date: format(date, 'yyyy-MM-dd'),
                drawNumber: 1000 + i,
                gameType: 'lotto',
                numbers: Array.from(numbers).sort((a, b) => a - b),
                plusNumber: Math.floor(Math.random() * 49) + 1,
                jackpotAmount: Math.floor(Math.random() * 10000000) + 1000000,
                winnersCount: Math.floor(Math.random() * 5)
            });
        }
        
        console.log('Using fallback test data');
        return draws;
    }

    // Metoda do pobierania danych historycznych (może wymagać innych źródeł)
    async fetchHistoricalData(fromDate, toDate) {
        try {
            console.log(`Fetching historical data from ${fromDate} to ${toDate}`);
            
            // Tu można zaimplementować pobieranie z różnych źródeł:
            // 1. API Totalizatora Sportowego (jeśli dostępne)
            // 2. Archiwalne strony
            // 3. Zewnętrzne serwisy z danymi historycznymi
            
            // Na razie zwracamy pustą tablicę
            return [];
            
        } catch (error) {
            console.error('Error fetching historical data:', error);
            return [];
        }
    }

    // Metoda do sprawdzania czy są nowe wyniki
    async checkForNewResults(lastKnownDate) {
        try {
            const latestDraws = await this.fetchLatestDraws(3);
            if (latestDraws.length === 0) return [];
            
            const lastKnown = new Date(lastKnownDate);
            const newDraws = latestDraws.filter(draw => {
                const drawDate = new Date(draw.date);
                return drawDate > lastKnown;
            });
            
            return newDraws;
            
        } catch (error) {
            console.error('Error checking for new results:', error);
            return [];
        }
    }

    // Walidacja danych przed zapisem
    validateDraw(draw) {
        const requiredFields = ['date', 'numbers', 'gameType'];
        
        for (const field of requiredFields) {
            if (!draw[field]) {
                return { valid: false, error: `Missing field: ${field}` };
            }
        }
        
        if (!Array.isArray(draw.numbers) || draw.numbers.length !== 6) {
            return { valid: false, error: 'Numbers must be array of 6 elements' };
        }
        
        for (const num of draw.numbers) {
            if (!Number.isInteger(num) || num < 1 || num > 49) {
                return { valid: false, error: `Invalid number: ${num}` };
            }
        }
        
        // Sprawdzenie czy liczby się nie powtarzają
        const uniqueNumbers = new Set(draw.numbers);
        if (uniqueNumbers.size !== 6) {
            return { valid: false, error: 'Numbers must be unique' };
        }
        
        return { valid: true };
    }
}

module.exports = DataScraper;