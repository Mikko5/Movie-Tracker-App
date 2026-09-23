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

- **Out-of-the-Box TMDB Proxy**: Zero-config search via dedicated Cloudflare Worker proxy (`X-App-Key` authenticated, 24h edge caching, 50% request reduction via `append_to_response=credits`)
- **Empty Search Results**: Displays "No results found"  
- **SQLite Database with WAL Mode**: Embedded high-performance `better-sqlite3` storage with Write-Ahead Logging (WAL) and indexed lookups  
- **Automatic Folder Backup**: Configurable background sync with 30-second debounced inactivity cooldown to any chosen folder (local or cloud-synced), with auto-disable if the folder is deleted from disk, and option to keep or delete `movies-backup.db` on disable.
- **Export Snapshot**: Standalone one-time `.db` snapshot exports to any destination (USB drives, external HDDs, or desktop) without setting up ongoing background writes.
- **Dedicated Backup & Storage Manager**: Accessible from Settings via a dedicated sub-modal to keep the main settings interface uncluttered.
- **Instant Flush on Exit & Universal Restore**: Pending backups flush automatically before app shutdown, with instant manual backup and complete database restore from any `.db` file.
- **Auto-Updater in Development**: Update checks are disabled in development mode to prevent configuration errors.  
- **Form Validation**: Requires rating > 0 & watch date  

## Customization & Extension  

- **Theme**: Update CSS variables in `:root`  
- **New Filters**: Add options to `FilterController.js` and `MovieListView.js`  
- **New Data Fields**: Extend `media_items` table in `DatabaseService.js` and modal views  
- **TV Shows**: Database schema is already equipped with `media_type` ('movie', 'tv') ready for TV show support  

## Known Limitations & Future Improvements  

- **Performance**: Consider virtualization for large collections  
- **Caching**: No offline TMDB result cache  
- **Validation**: Minimal duplication checks  
- **Accessibility**: Improve ARIA roles & keyboard focus  
- **Testing**: Comprehensive Jest test suite in place (300+ tests covering core, models, controllers, and views)  
