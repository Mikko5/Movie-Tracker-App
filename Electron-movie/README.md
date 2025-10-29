# Electron Movie Tracker

## Table of Contents
1. [Overview & Purpose](#overview--purpose)  
2. [How It Works (High-Level)](#how-it-works-high-level)  
3. [Setup & Installation](#setup--installation)  
4. [Usage Examples](#usage-examples)  
5. [Key Modules & Functions](#key-modules--functions)  
6. [Data Flow & Dependencies](#data-flow--dependencies)  
7. [Error Handling & Edge Cases](#error-handling--edge-cases)  
8. [Customization & Extension](#customization--extension)  
9. [Known Limitations & Future Improvements](#known-limitations--future-improvements)

---

## Overview & Purpose  
This Electron-based application helps you build and maintain a personal “watched movies” list:

- Persist movie data locally in a JSON file  
- Search The Movie Database (TMDB) for titles  
- Record details (rating, watch date, format, rewatch status)  
- Filter & sort your collection by year, genre, director, format, rating, or date  
- View full details with external links to IMDb & Letterboxd  

---

## How It Works (High-Level)  

1. **Electron Shell**  
   - **Main Process** (`src/main.js`): Window creation, IPC channels for JSON I/O and API key.  
   - **Preload Script** (`src/preload.js`): Secures IPC exposure via `contextBridge`.  

2. **Renderer**  
   - **HTML** (`src/movielist.html`): UI skeleton (movie grid, modals, filters).  
   - **CSS** (`src/style.css`): Dark “Letterboxd-style” theme and responsive layout.  
   - **JavaScript** (`src/movielist.js`): State loading, rendering, TMDB API integration, modal handling, JSON persistence.  

3. **Data Storage**  
   - `movie-data.json` at project root stores an array of movie entries.  
   - Each entry includes TMDB IDs, title, poster path, release date, runtime, genres, director, user rating & watch info.  

---

## Setup & Installation  

1. **Prerequisites**  
   - Node.js (v14+) & npm  
   - A [TMDB API key](https://developers.themoviedb.org)  

2. **Clone & Install**  
   ```powershell
   git clone https://github.com/your-repo/Electron-movie-json-demo.git
   cd Electron-movie-json-demo
   npm install
   ```

3. **Configure TMDB Key**  
   - Create a file named `.env` in the project root  
   - Add your key:
     ```text
     TMDB_API_KEY=your_token_here
     ```

4. **Run the App**  
   ```powershell
   npm start
   ```

---

## Usage Examples  

- **Add a Movie**  
  1. Click the “Search” button in the header  
  2. Type a title (after 3 characters) and select “Add”  
  3. Fill in rating, date, format, etc., and click **Add to List**  

- **Edit an Entry**  
  1. Click a movie card to open its info modal  
  2. Click **Edit**  
  3. Modify fields and **Save Changes**  

- **Filter & Sort**  
  - Toggle filters panel, choose year/genre/director/format  
  - Use sort dropdown for date or rating ascending/descending  

- **External Links**  
  - Inside the info modal, click **IMDb** or **Letterboxd** to open in your browser  

---

## Key Modules & Functions  

### src/main.js  
- `ipcMain.handle('read-json')` — Reads & parses `movie-data.json`.  
- `ipcMain.handle('write-json', data)` — Writes array back to JSON.  
- `ipcMain.handle('get-api-key')` — Loads `.env` and returns the TMDB key.  

### src/preload.js  
- Exposes:
  - `window.electronAPI.invoke(channel, payload)` for JSON I/O & API key.  
  - `window.electronAPI.send(channel, url)` for external links.  

### src/movielist.js  

#### `loadState()` → `void`  
- Loads `watchedMovies` from JSON and the TMDB key via IPC.  
- Initializes filters and movie grid.  

#### `saveState()` → `Promise<void>`  
- Writes `watchedMovies` back to JSON file.  

#### `renderFilters()` → `void`  
- Builds `<select>` options from watchedMovies sets (genres, directors, years, formats).  

#### `renderMovies()` → `void`  
- Applies filters & sort, then populates the movie grid.  
- Creates each card’s HTML & applies dynamic margin logic for wrapping.  

#### `searchMoviesByTitle(query: string)` → `Promise<array|null>`  
- Calls TMDB’s `/search/movie` with Bearer header.  
- Returns an array of results or null on error.  

#### `getMovieDetails(tmdbId: number)` → `Promise<object|null>`  
- Fetches detail & credits endpoints, extracts director & genres, assigns `entryId`.  

#### `renderStarsHtml(rating: number, isCard: boolean)` → `string`  
- Returns ★/☆ HTML with half-star support.  

---

## Data Flow & Dependencies  

1. **User Action** triggers a renderer-side event.  
2. **Renderer** calls TMDB API or IPC to main.  
3. **Main** handles JSON I/O or loads `.env`.  
4. **Renderer** updates the DOM and `watchedMovies`.  
5. **Persistence** writes JSON to disk.  

**Dependencies**: `electron`, `electron-reloader` (dev), `dotenv`, native `fetch`.  

---

## Error Handling & Edge Cases  

- **Missing TMDB Key**: Disables search & shows error banner.  
- **Empty Search Results**: Displays “No results found.”  
- **JSON Read/Write Failure**: Logs console error & shows toast.  
- **Form Validation**: Requires rating > 0 & watch date.  

---

## Customization & Extension  

- **Theme**: Update CSS variables in `:root`.  
- **New Filters**: Add `<select>` in HTML, extend `renderFilters()` & `renderMovies()`.  
- **New Data Fields**: Extend `getMovieDetails()` and UI forms.  
- **Switch to DB**: Replace JSON IPC with SQLite or IndexedDB.  

---

## Known Limitations & Future Improvements  

- **Performance**: Full grid re-renders; consider virtualization.  
- **Caching**: No offline TMDB result cache.  
- **Validation**: Minimal duplication checks.  
- **Accessibility**: Improve ARIA roles & keyboard focus.  
- **Testing**: No automated tests; add Jest/Mocha.  

Enjoy maintaining your personal movie library with this Electron tracker!
