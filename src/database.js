const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '../data/lotto.db');
    }

    async initialize() {
        try {
            // Upewniamy się, że folder data istnieje
            const dataDir = path.dirname(this.dbPath);
            await fs.mkdir(dataDir, { recursive: true });

            // Otwieramy bazę danych
            this.db = new sqlite3.Database(this.dbPath);
            
            await this.createTables();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    createTables() {
        return new Promise((resolve, reject) => {
            const sql = `
                CREATE TABLE IF NOT EXISTS draws (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    draw_date DATE NOT NULL,
                    draw_number INTEGER NOT NULL,
                    game_type VARCHAR(20) DEFAULT 'lotto',
                    number_1 INTEGER NOT NULL,
                    number_2 INTEGER NOT NULL,
                    number_3 INTEGER NOT NULL,
                    number_4 INTEGER NOT NULL,
                    number_5 INTEGER NOT NULL,
                    number_6 INTEGER NOT NULL,
                    plus_number INTEGER DEFAULT NULL,
                    jackpot_amount DECIMAL(15,2) DEFAULT NULL,
                    winners_count INTEGER DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(draw_date, draw_number, game_type)
                );

                CREATE TABLE IF NOT EXISTS statistics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    number INTEGER NOT NULL,
                    frequency INTEGER DEFAULT 0,
                    last_drawn DATE,
                    days_since_last INTEGER DEFAULT 0,
                    game_type VARCHAR(20) DEFAULT 'lotto',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(number, game_type)
                );

                CREATE INDEX IF NOT EXISTS idx_draws_date ON draws(draw_date);
                CREATE INDEX IF NOT EXISTS idx_draws_numbers ON draws(number_1, number_2, number_3, number_4, number_5, number_6);
                CREATE INDEX IF NOT EXISTS idx_statistics_frequency ON statistics(frequency DESC);
            `;

            this.db.exec(sql, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async getDraws(limit = 100, gameType = 'lotto') {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM draws 
                WHERE game_type = ? 
                ORDER BY draw_date DESC, draw_number DESC 
                LIMIT ?
            `;
            
            this.db.all(sql, [gameType, limit], (error, rows) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async insertDraw(drawData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO draws 
                (draw_date, draw_number, game_type, number_1, number_2, number_3, 
                 number_4, number_5, number_6, plus_number, jackpot_amount, winners_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                drawData.date,
                drawData.drawNumber,
                drawData.gameType || 'lotto',
                drawData.numbers[0],
                drawData.numbers[1],
                drawData.numbers[2],
                drawData.numbers[3],
                drawData.numbers[4],
                drawData.numbers[5],
                drawData.plusNumber || null,
                drawData.jackpotAmount || null,
                drawData.winnersCount || null
            ];

            this.db.run(sql, params, function(error) {
                if (error) {
                    reject(error);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async insertDraws(draws) {
        for (const draw of draws) {
            await this.insertDraw(draw);
        }
        await this.updateStatistics();
    }

    async updateStatistics() {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO statistics (number, frequency, last_drawn, days_since_last, game_type)
                SELECT 
                    num.number,
                    COUNT(*) as frequency,
                    MAX(d.draw_date) as last_drawn,
                    CAST(julianday('now') - julianday(MAX(d.draw_date)) AS INTEGER) as days_since_last,
                    'lotto' as game_type
                FROM (
                    SELECT number_1 as number FROM draws WHERE game_type = 'lotto'
                    UNION ALL SELECT number_2 FROM draws WHERE game_type = 'lotto'
                    UNION ALL SELECT number_3 FROM draws WHERE game_type = 'lotto'
                    UNION ALL SELECT number_4 FROM draws WHERE game_type = 'lotto'
                    UNION ALL SELECT number_5 FROM draws WHERE game_type = 'lotto'
                    UNION ALL SELECT number_6 FROM draws WHERE game_type = 'lotto'
                ) num
                JOIN draws d ON (d.number_1 = num.number OR d.number_2 = num.number OR 
                               d.number_3 = num.number OR d.number_4 = num.number OR 
                               d.number_5 = num.number OR d.number_6 = num.number)
                AND d.game_type = 'lotto'
                GROUP BY num.number
            `;

            this.db.run(sql, [], (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async getStatistics(gameType = 'lotto') {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    number,
                    frequency,
                    last_drawn,
                    days_since_last,
                    ROUND(frequency * 100.0 / (SELECT COUNT(*) FROM draws WHERE game_type = ?), 2) as percentage
                FROM statistics 
                WHERE game_type = ?
                ORDER BY frequency DESC
            `;
            
            this.db.all(sql, [gameType, gameType], (error, rows) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async analyzeNumbers(options = {}) {
        const { gameType = 'lotto', period = 'all' } = options;
        
        return new Promise((resolve, reject) => {
            let dateFilter = '';
            if (period !== 'all') {
                const days = {
                    'week': 7,
                    'month': 30,
                    'quarter': 90,
                    'year': 365
                }[period] || 365;
                
                dateFilter = `AND draw_date >= date('now', '-${days} days')`;
            }

            const sql = `
                SELECT 
                    COUNT(*) as total_draws,
                    AVG((number_1 + number_2 + number_3 + number_4 + number_5 + number_6)) as avg_sum,
                    MIN(draw_date) as first_draw,
                    MAX(draw_date) as last_draw
                FROM draws 
                WHERE game_type = ? ${dateFilter}
            `;
            
            this.db.get(sql, [gameType], (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async generateNumbers(strategy = 'random') {
        // Różne "strategie" - pamiętaj, że to tylko dla zabawy!
        const strategies = {
            random: () => this.generateRandomNumbers(),
            hot: () => this.generateHotNumbers(),
            cold: () => this.generateColdNumbers(),
            balanced: () => this.generateBalancedNumbers()
        };

        const generator = strategies[strategy] || strategies.random;
        return await generator();
    }

    async generateRandomNumbers() {
        const numbers = new Set();
        while (numbers.size < 6) {
            numbers.add(Math.floor(Math.random() * 49) + 1);
        }
        return {
            numbers: Array.from(numbers).sort((a, b) => a - b),
            strategy: 'random',
            description: 'Całkowicie losowe liczby'
        };
    }

    async generateHotNumbers() {
        const stats = await this.getStatistics();
        const hotNumbers = stats.slice(0, 20).map(s => s.number);
        
        const selected = new Set();
        while (selected.size < 6) {
            const randomIndex = Math.floor(Math.random() * hotNumbers.length);
            selected.add(hotNumbers[randomIndex]);
        }
        
        return {
            numbers: Array.from(selected).sort((a, b) => a - b),
            strategy: 'hot',
            description: 'Liczby z najwyższą częstotliwością występowania'
        };
    }

    async generateColdNumbers() {
        const stats = await this.getStatistics();
        const coldNumbers = stats.slice(-20).map(s => s.number);
        
        const selected = new Set();
        while (selected.size < 6) {
            const randomIndex = Math.floor(Math.random() * coldNumbers.length);
            selected.add(coldNumbers[randomIndex]);
        }
        
        return {
            numbers: Array.from(selected).sort((a, b) => a - b),
            strategy: 'cold',
            description: 'Liczby z najniższą częstotliwością występowania'
        };
    }

    async generateBalancedNumbers() {
        const stats = await this.getStatistics();
        const midRange = stats.slice(10, -10).map(s => s.number);
        
        const selected = new Set();
        while (selected.size < 6) {
            const randomIndex = Math.floor(Math.random() * midRange.length);
            selected.add(midRange[randomIndex]);
        }
        
        return {
            numbers: Array.from(selected).sort((a, b) => a - b),
            strategy: 'balanced',
            description: 'Liczby o średniej częstotliwości występowania'
        };
    }

    async importFromCSV(filePath) {
        try {
            const csvData = await fs.readFile(filePath, 'utf8');
            const lines = csvData.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                return { error: 'Plik CSV jest pusty lub nieprawidłowy' };
            }

            const draws = [];
            const headers = lines[0].split(',').map(h => h.trim());
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length < 7) continue;
                
                try {
                    const draw = {
                        date: values[0],
                        drawNumber: parseInt(values[1]) || 0,
                        gameType: 'lotto',
                        numbers: [
                            parseInt(values[2]) || 0,
                            parseInt(values[3]) || 0,
                            parseInt(values[4]) || 0,
                            parseInt(values[5]) || 0,
                            parseInt(values[6]) || 0,
                            parseInt(values[7]) || 0
                        ].filter(n => n > 0 && n <= 49),
                        plusNumber: parseInt(values[8]) || null,
                        jackpotAmount: parseFloat(values[9]) || null,
                        winnersCount: parseInt(values[10]) || null
                    };
                    
                    if (draw.numbers.length === 6) {
                        draws.push(draw);
                    }
                } catch (error) {
                    console.warn(`Błąd parsowania linii ${i + 1}:`, error);
                }
            }
            
            if (draws.length > 0) {
                await this.insertDraws(draws);
                return { success: true, message: `Zaimportowano ${draws.length} losowań` };
            } else {
                return { error: 'Nie znaleziono prawidłowych danych w pliku CSV' };
            }
        } catch (error) {
            return { error: error.message };
        }
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((error) => {
                    if (error) {
                        console.error('Error closing database:', error);
                    } else {
                        console.log('Database closed successfully');
                    }
                    resolve();
                });
            });
        }
    }
}

module.exports = Database;