# Lotto Analyzer 🎲

Aplikacja desktopowa do analizy wyników polskiego Lotto, stworzona w Electron + JavaScript.

## ⚠️ Ważne zastrzeżenie

**Ta aplikacja służy wyłącznie celom edukacyjnym i rozrywkowym!** 

Żadne algorytmy, analizy ani "strategie" nie mogą zwiększyć szans na wygraną w grach losowych. Lotto to gra całkowicie przypadkowa - każda kombinacja liczb ma dokładnie takie same szanse na wylosowanie.

## 🚀 Funkcjonalności

- 📊 **Dashboard** - podsumowanie statistyk i ostatnie wyniki
- 📈 **Statystyki** - analiza częstotliwości wystąpień liczb
- 🎯 **Generator** - różne "strategie" generowania liczb (dla zabawy!)
- 📋 **Historia** - przeglądanie historycznych losowań
- 🔄 **Auto-update** - pobieranie najnowszych wyników z lotto.pl
- 📁 **Import CSV** - import danych historycznych
- 🗄️ **SQLite** - lokalna baza danych

## 🛠️ Instalacja

### Wymagania
- Node.js (wersja 16 lub nowsza)
- npm lub yarn

### Kroki instalacji

1. **Sklonuj lub pobierz pliki:**
```bash
# Utwórz folder projektu
mkdir lotto-analyzer
cd lotto-analyzer
```

2. **Skopiuj wszystkie pliki do odpowiedniej struktury:**
```
lotto-analyzer/
├── package.json
├── README.md
├── src/
│   ├── main.js
│   ├── preload.js
│   ├── database.js
│   ├── scraper.js
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── data/           # Zostanie utworzony automatycznie
└── assets/         # Opcjonalne ikony
```

3. **Zainstaluj dependencies:**
```bash
npm install
```

4. **Uruchom aplikację:**
```bash
npm start
```

### Pierwsze uruchomienie

Przy pierwszym uruchomieniu aplikacja:
1. Utworzy lokalną bazę danych SQLite w folderze `data/`
2. Spróbuje pobrać najnowsze wyniki z lotto.pl
3. Jeśli scraping nie zadziała, użyje danych testowych

## 📖 Instrukcja użytkowania

### Dashboard
- Przegląd podstawowych statystyk
- Ostatnie wylosowane liczby
- "Gorące" i "zimne" liczby
- Wykres częstotliwości

### Statystyki
- Tabela wszystkich liczb z częstotliwością wystąpień
- Filtrowanie po okresach (tydzień, miesiąc, rok)
- Wykresy rozkładu

### Generator liczb
Dostępne "strategie" (pamiętaj - to tylko zabawa!):
- **🎲 Losowe** - całkowicie przypadkowe
- **🔥 Gorące** - najczęściej losowane w historii
- **❄️ Zimne** - najrzadziej losowane w historii
- **⚖️ Zrównoważone** - liczby o średniej częstotliwości

### Historia
- Przeglądanie wszystkich zapisanych losowań
- Możliwość ustawienia liczby wyświetlanych rekordów
- Informacje o jackpotach i liczbie zwycięzców

## 🔧 Zaawansowane użytkowanie

### Import danych CSV
Możesz zaimportować dane historyczne w formacie CSV. Struktura pliku:
```csv
data,numer_losowania,liczba_1,liczba_2,liczba_3,liczba_4,liczba_5,liczba_6,plus,jackpot
2024-01-15,1,5,12,23,34,41,49,7,5000000
```

### Pobieranie danych
Aplikacja automatycznie próbuje pobrać najnowsze dane z oficjalnej strony lotto.pl. W przypadku problemów ze scrapingiem, używa danych testowych.

### Baza danych
Dane są przechowywane lokalnie w SQLite (`data/lotto.db`). Możesz:
- Backupować plik bazy danych
- Analizować dane zewnętrznymi narzędziami
- Resetować bazę przez usunięcie pliku

## 🏗️ Budowanie aplikacji

### Development
```bash
npm run dev  # Uruchom z narzędziami deweloperskimi
```

### Budowanie plików wykonywalnych
```bash
npm run build  # Buduj dla wszystkich platform
npm run pack   # Tylko spakuj (bez instalatora)
```

Pliki wykonywalne znajdziesz w folderze `dist/`.

## 🧪 Rozwój i customizacja

### Struktura projektu
- `src/main.js` - główny proces Electron
- `src/database.js` - obsługa SQLite
- `src/scraper.js` - pobieranie danych z sieci
- `src/preload.js` - bridge security
- `src/renderer/` - interfejs użytkownika

### Dodawanie nowych funkcji
1. **Nowe analizy** - rozszerz `database.js`
2. **Inne źródła danych** - modyfikuj `scraper.js`
3. **UI zmiany** - edytuj pliki w `renderer/`

### Testowanie scrapera
Scraper może wymagać dostosowania do zmian na stronie lotto.pl:
```javascript
// W scraper.js - dostosuj selektory CSS
$('.results-table tbody tr')  // Może wymagać aktualizacji
```

## 🐛 Rozwiązywanie problemów

### Aplikacja nie startuje
```bash
# Sprawdź wersję Node.js
node --version  # Powinno być >= 16

# Przeinstaluj dependencies
rm -rf node_modules package-lock.json
npm install
```

### Błędy bazy danych
```bash
# Usuń i pozwól aplikacji odtworzyć bazę
rm