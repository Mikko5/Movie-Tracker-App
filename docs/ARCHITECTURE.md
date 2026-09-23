# Architecture & Data Flow

This document details the architecture of the Electron Movie Tracker.

## Architecture

The application follows a **Model-View-Controller (MVC)** architecture for clean separation of concerns:

```mermaid
graph TB
    subgraph Core["Core (Electron)"]
        Main["main.js<br/>Window & IPC"]
        Preload["preload.js<br/>Context Bridge"]
    end

    subgraph Model["Model Layer"]
        MovieModel["MovieModel.js<br/>State & CRUD"]
        ApiService["ApiService.js<br/>TMDB API"]
    end

    subgraph View["View Layer"]
        UIHelpers["UIHelpers.js<br/>Stars, Messages"]
        MovieListView["MovieListView.js<br/>Cards & Filters"]
        ModalView["ModalView.js<br/>All Modals"]
        HTML["movielist.html"]
        CSS["style.css"]
    end

    subgraph Controller["Controller Layer"]
        MovieController["MovieController.js<br/>Main Logic"]
        SearchController["SearchController.js<br/>Search Flow"]
        FilterController["FilterController.js<br/>Sort & Filter"]
    end

    App["app.js<br/>Entry Point"]

    Main --> Preload
    Preload --> App
    App --> Model
    App --> View
    App --> Controller

    Controller --> Model
    Controller --> View
    MovieController --> SearchController
    MovieController --> FilterController
```

### How Modules Connect

| Layer | Responsibility | Dependencies |
|-------|---------------|--------------|
| **Core** | Electron main process, IPC, file I/O | Node.js, Electron |
| **Model** | Data state, CRUD operations, API calls | Core (via IPC) |
| **View** | DOM rendering, UI components | Model (for constants) |
| **Controller** | Event handling, business logic | Model, View |
| **Entry Point** | Bootstrap & wire all modules | All layers |

## Project Structure

```text
Movie-Tracker-App/
├── cloudflare-worker/          # Cloudflare Worker reverse proxy package
│   ├── package.json            # Worker npm manifest & test scripts
│   ├── README.md               # Worker deployment & curl testing documentation
│   ├── wrangler.toml           # Cloudflare deployment configuration
│   ├── src/
│   │   └── worker.js           # Production TMDB edge proxy logic
│   └── test/
│       └── worker.test.js      # Automated unit tests for edge proxy
│
├── Electron-movie/
│   ├── package.json            # Node.js project manifest
│   ├── package-lock.json       # Dependency lock file
│   ├── README.md               # Desktop application overview
│   │
│   ├── data/                   # Data files
│   │   ├── movies.dev.db       # Development SQLite database (WAL mode)
│   │   ├── movie-data.dev.json # Legacy dev data (auto-migrated)
│   │   └── movie-data.dev.json.migrated.bak # Safety backup archive
│   │
│   └── src/
│       ├── app.js              # Entry point - initializes all modules
```
    │
    ├── core/                   # Electron main process
    │   ├── main.js             # Window creation, IPC handlers
    │   ├── DatabaseService.js  # SQLite database, WAL mode, CRUD, debounced backup
    │   ├── preload.js          # Context bridge for secure IPC
    │   └── LetterboxdService.js# Letterboxd RSS parsing logic
    │
    ├── model/                  # Data layer
    │   ├── MovieModel.js       # State management, CRUD, filtering
    │   └── ApiService.js       # TMDB API integration
    │
    ├── view/                   # UI layer
    │   ├── templates/
    │   │   └── movielist.html  # Main HTML template
    │   ├── styles/
    │   │   └── style.css       # Dark theme stylesheet
    │   ├── UIHelpers.js        # Messages, stars, poster images
    │   ├── MovieListView.js    # Movie cards, filter dropdowns
    │   └── ModalView.js        # Details, info, delete, settings modals
    │
    └── controller/             # Logic layer
        ├── MovieController.js  # Main app coordination & form handling
        ├── ModalManager.js     # Stack-based modal management
        ├── SearchController.js # Search input, TMDB selection
        └── FilterController.js # Sort & filter event handling
```

## Key Modules & Functions  

### Core Layer

#### `core/DatabaseService.js`
- **SQLite Engine**: `better-sqlite3` with WAL mode (`journal_mode = WAL`) and foreign keys.
- **Table**: `media_items` with primary key `entryId`, future-proof `media_type` ('movie', 'tv'), Letterboxd sync fields, and indexed watch dates and titles.
- **Migration**: Automatic zero-loss migration from legacy JSON on first launch.
- **Automatic Backup Engine**: 30-second debounced inactivity cooldown via `db.backup()` to any user-selected folder (local, external, or cloud-synced).
  - Automatically turns off if the destination folder is deleted or unmounted.
  - Interactive prompt to keep or delete `movies-backup.db` when disabling or disconnecting.
  - Immediate sync on folder selection and blocking flush on application exit.
- **Export Snapshot**: One-time isolated export to any file path (`db.backup()`) without attaching ongoing background timers.
- **Unified Restore**: Restores active SQLite database seamlessly from any `.db` file (automatic backup or exported snapshot).

#### `core/main.js`
| IPC Handler | Description |
|-------------|-------------|
| `db:get-all` | Fetches all media items from SQLite (supports optional `media_type` filtering) |
| `db:add-movie` | Inserts or updates media item in SQLite and schedules debounced backup |
| `db:update-movie` | Updates existing media item by entryId |
| `db:delete-movie` | Deletes media item from SQLite |
| `select-backup-location` | Directory picker for automatic backup folder with immediate initial backup |
| `get-backup-settings` | Retrieves backup folder, autoBackupEnabled, and last backup timestamp |
| `toggle-auto-backup` | Enables or disables automatic backup (with optional existing file deletion) |
| `remove-backup-folder` | Disconnects the backup folder (with optional existing file deletion) |
| `export-database` | Opens save dialog and exports a standalone `.db` snapshot |
| `trigger-backup-now` | Triggers immediate SQLite online backup |
| `restore-from-backup` | Restores database from a selected SQLite backup or snapshot file |
| `read-json` / `write-json` | Backward-compatibility proxies to DatabaseService |
| `get-api-key` | (Legacy) Retrieves optional local TMDB key from `apiKey.txt` or `.env` |
| `set-api-key` | (Legacy) Saves TMDB key to user data directory |
| `is-dev` | Checks development mode |

### Model Layer

#### `model/MovieModel.js`
- **State**: `watchedMovies`, `movieToAdd`, filter/sort settings
- **CRUD**: `addMovie()`, `updateMovie()`, `deleteMovie()`, `findMovieByEntryId()`
- **Data**: `loadState()`, `saveState()`, `getFilteredAndSortedMovies()`

#### `model/ApiService.js`
- `searchMoviesByTitle(query)` → TMDB search results
- `getMovieDetails(tmdbId)` → Full movie data with director & genres
- `listAllPosters(tmdbId)` → Available poster options

### View Layer

#### `view/UIHelpers.js`
- `showMessage()`, `showDetailsModalMessage()` → Toast notifications
- `renderStarsHtml()` → Star rating display with half-star support
- `createPosterImage()` → Image with fallback chain

#### `view/MovieListView.js`
- `renderMovies()` → Movie card grid
- `renderFilters()` → Filter dropdown population
- `renderSearchResults()` → Search result cards

#### `view/ModalView.js`
- `openDetailsModal()`, `closeDetailsModal()` → Add/Edit modal
- `openInfoModal()`, `closeInfoModal()` → View details modal
- Modal state checks: `isDetailsModalVisible()`, etc.

### Controller Layer

#### `controller/MovieController.js`
- `loadApp()` → Bootstrap application
- `setupEventListeners()` → Wire all event handlers
- `refreshView()`, `refreshFiltersAndView()` → Update UI

#### `controller/SearchController.js`
- Debounced search input handling
- Search result selection flow

#### `controller/FilterController.js`
- Sort/filter dropdown change handlers
- Filter reset functionality

#### `controller/ModalManager.js`
- Stack-based modal management with `push()`, `pop()`, `handleEscape()`
- Modal registration system: `register(name, {open, close, isVisible})`
- ESC key automatically closes topmost modal

## Data Flow & Dependencies  

```mermaid
sequenceDiagram
    participant User
    participant Controller
    participant Model
    participant View
    participant Core

    User->>Controller: Click/Input event
    Controller->>Model: Update state or fetch data
    Model->>Core: IPC (read/write JSON)
    Core-->>Model: Data response
    Model-->>Controller: Updated state
    Controller->>View: Render updates
    View-->>User: Updated UI
```

## TMDB Proxy & Cloudflare Edge Architecture

The application routes TMDB API calls through a private Cloudflare Worker reverse proxy (`https://tmdb-proxy.movie-feed.workers.dev/3`):

```mermaid
sequenceDiagram
    participant App as Electron App
    participant Worker as Cloudflare Worker Edge
    participant TMDB as api.themoviedb.org

    App->>Worker: GET /movie/123?append_to_response=credits (Header: X-App-Key)
    alt Unauthorized Origin or Missing X-App-Key
        Worker-->>App: 401/403 Error
    else Valid Request & Cache Hit
        Worker-->>App: 200 OK (Served from Edge Cache in ~15ms)
    else Valid Request & Cache Miss
        Worker->>TMDB: GET /3/movie/123?append_to_response=credits (Auth: Bearer TMDB_TOKEN)
        TMDB-->>Worker: 200 JSON Response
        Worker-->>App: 200 OK (CORS + Cache-Control: max-age=43200)
    end
```

### Key Architectural Highlights:
1. **Zero-Configuration Experience:** Users and clone contributors do not require individual TMDB accounts or local `.env` files.
2. **Primary Proxy with `.env` Fallback:** The Cloudflare Worker proxy is the normal default routing path to maximize speed and caching. If a user provides `APIKEY` in `.env` (or local storage), the app seamlessly falls back to direct `api.themoviedb.org` communication.
3. **Request Halving (`append_to_response=credits`):** Combines movie details and credits into a single HTTP request, cutting sync time and network overhead by 50%.
4. **Defense-in-Depth:**
   - `X-App-Key` header verified with constant-time equality (`timingSafeEqual`).
   - Strict Origin hostname validation (blocks external web domains like `fake-localhost.com`, permits local Electron `null` and `localhost`).
   - Query parameter whitelisting and canonical sorting (`cleanParams.sort()`) for 100% deterministic edge cache hits.
   - Sliding-window burst limiter (40 req / 10s per IP) capped at 2,000 tracked client IPs.
5. **Gentle Pacing:** Letterboxd RSS sync adds a 150ms delay between consecutive items to ensure steady, polite API traffic.

**Dependencies**: `electron`, `better-sqlite3`, `electron-updater`, `electron-reloader` (dev), `dotenv`, `cross-env`, `fast-xml-parser`

