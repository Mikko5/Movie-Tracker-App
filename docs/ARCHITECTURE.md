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
Electron-movie/
├── .env                        # Environment variables (TMDB API key)
├── package.json                # Node.js project manifest
├── package-lock.json           # Dependency lock file
├── README.md                   # This file
│
├── data/                       # Data files
│   ├── movie-data.dev.json     # Development data
│   └── movie-data.json         # Production data (created on first run)
│
└── src/
    ├── app.js                  # Entry point - initializes all modules
    │
    ├── core/                   # Electron main process
    │   ├── main.js             # Window creation, IPC handlers
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

#### `core/main.js`
| IPC Handler | Description |
|-------------|-------------|
| `read-json` | Reads & parses movie data JSON (with `.bak` backup auto-recovery) |
| `write-json` | Writes movie data atomically via `.tmp` staging and updates `.bak` |
| `get-api-key` | Retrieves TMDB key from `apiKey.txt` (Settings) or `.env` |
| `set-api-key` | Saves the TMDB key securely to the user data directory |
| `is-dev` | Checks development mode |
| `select-save-location` | Opens file dialog for save path |

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

**Dependencies**: `electron`, `electron-updater`, `electron-reloader` (dev), `dotenv`, `cross-env`, `fast-xml-parser`
