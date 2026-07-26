# Features & Usage

This document details the usage examples, error handling, and customization options for the Electron Movie Tracker.

## Usage Examples  

- **Add a Movie**  
  1. Click **Search** → Type a title → Click "Add"  
  2. Fill in rating, date, format → Click **Add to List**  

- **Edit/Delete**  
  1. Click a movie card → Click **Edit** or **Delete**  

- **Filter & Sort**  
  - Toggle filters panel, choose genre/director/year/format  
  - Use sort dropdown for date or rating  

- **External Links**  
  - In info modal, click **IMDb** or **Letterboxd**  

## Error Handling & Edge Cases  

- **Missing TMDB Key**: Disables search & shows error banner  
- **Empty Search Results**: Displays "No results found"  
- **Atomic File Writing & Data Safety**: Writes data to a temporary file (`.tmp`) before performing an atomic rename, preventing file corruption on crashes  
- **Automatic Backup & Recovery**: Maintains a persistent `.bak` backup copy of your previous save state. Before backing up, the app validates `movie-data.json` to prevent overwriting `.bak` if the disk file was corrupted externally. Automatically restores from `.bak` if the primary JSON file fails to parse or is missing  
- **Auto-Updater in Development**: Update checks are disabled in development mode to prevent configuration errors.
- **Form Validation**: Requires rating > 0 & watch date  

## Customization & Extension  

- **Theme**: Update CSS variables in `:root`  
- **New Filters**: Add options to `FilterController.js` and `MovieListView.js`  
- **New Data Fields**: Extend `MovieModel.js` and modal views  
- **Database**: Replace JSON IPC in `MovieModel.js` with SQLite/IndexedDB  

## Known Limitations & Future Improvements  

- **Performance**: Consider virtualization for large collections  
- **Caching**: No offline TMDB result cache  
- **Validation**: Minimal duplication checks  
- **Accessibility**: Improve ARIA roles & keyboard focus  
- **Testing**: Add Jest/Mocha tests for modules  
