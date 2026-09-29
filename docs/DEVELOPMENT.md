# Setup & Development

This document provides instructions on how to set up, run, and build the Electron Movie Tracker.

## Setup & Installation

1. **Prerequisites**
   - Node.js (v18+) & npm

2. **Clone & Install**
   ```powershell
   git clone https://github.com/Mikko5/Movie-Tracker-App.git
   cd Movie-Tracker-App/Electron-movie
   npm install
   ```

   > [!TIP]
   > A proxy `package.json` is provided in the repository root. Once dependencies are installed in `Electron-movie`, all npm scripts (`npm start`, `npm run seeds`, `npm test`, `npm run build`) can be run directly from either the repository root or inside `Electron-movie`.

3. **TMDB Setup (Cloudflare Proxy Default with `.env` Fallback)**
   - **Default Mode (Cloudflare Edge Proxy)**:
     - Normally, the application routes all TMDB search and metadata queries through a dedicated **Cloudflare Worker proxy** (`https://tmdb-proxy.movie-feed.workers.dev/3`).
     - **Why this is the standard**: It provides multi-tier edge caching (24h edge, 12h local RAM), 1ms empty search short-circuiting, origin validation, and 50% request reduction (`append_to_response=credits`).
     - **No TMDB account, API key, or `.env` file is required** to run the app or contribute!
   - **Fallback / Override Mode (Via `.env`)**:
     - **`.env` is supported as an optional fallback / override**. If you wish to bypass the proxy and use your own personal TMDB credentials directly, create an `Electron-movie/.env` file containing:
       ```env
       APIKEY=your_tmdb_token_or_v3_key
       ```
     - When detected, the application routes requests **directly to `https://api.themoviedb.org/3`** using your personal key (supports both TMDB v4 JWT Bearer tokens and v3 API keys).
   - If desired, the Cloudflare Worker proxy package can be customized or deployed independently using the files in [`cloudflare-worker/`](../cloudflare-worker/).

## Running the Application

All commands below can be executed from the repository root or from `Electron-movie/`.

### Development Mode
- **Command**: `npm start`
- **Database File**: `data/movies.dev.db` (auto-migrated from `data/movie-data.dev.json` on first run)
- **Behavior**: Local development sandbox. Backup settings and modifications can be tested freely without touching production data.

```powershell
npm start
```

### Seeding the Database (Development Snapshot)
To reset the development database to a clean, known state with 4 sample movies (*The Prestige*, *Inception*, *The Guilty*, *Godzilla vs. Kong*):

- **Command**: `npm run seeds` (or `npm run seed`)
- **Target Files**: Resets both `data/movies.dev.db` (SQLite) and `data/movie-data.dev.json` (fallback).
- **Safe Execution**: Uses transactional `DELETE FROM media_items` to avoid Windows SQLite WAL file locks (`EBUSY`), so it can be executed even while the Electron application is actively running!

```powershell
npm run seeds
```

### Testing Letterboxd Bulk Import
A pre-packaged Letterboxd export ZIP file is provided: [`seed-letterboxd-export.zip`](../seed-letterboxd-export.zip) (available at the repository root and inside `Electron-movie/`).

It contains:
- `diary.csv`: Exactly 5 logged entries (1 already present in the seed database for duplicate/conflict testing: *The Prestige*, plus 4 new titles: *Interstellar*, *Society of the Snow*, *Rush*, and *Dune: Part Two*).
- `reviews.csv`: Exactly 3 movie reviews (*The Prestige*, *Interstellar*, and *Society of the Snow*), making it simple to test review merging and conflict handling without clutter.

**Quick Testing Workflow**:
1. Reset the database to the 4-movie baseline:
   ```powershell
   npm run seeds
   ```
2. Start the application:
   ```powershell
   npm start
   ```
3. In the UI top navigation bar, click the **"Bulk Import"** button.
4. Select `seed-letterboxd-export.zip`.
5. Preview parsed movies, inspect conflict resolution / deduplication against existing seed movies, and execute the batch sync.
6. *(Optional)* To regenerate the sample ZIP file at any time:
   ```powershell
   node scripts/create-seed-zip.js
   ```

### Production Mode
- **Command**: `npm run start:prod`
- **Database File**: `%APPDATA%/electron-movie-json-demo/movies.db` (auto-migrated from legacy JSON)
- **Behavior**: Safe local AppData storage immune to cloud sync locks, with user-configured automatic folder backup (30s cooldown) and manual snapshot export support.

```powershell
npm run start:prod
```

### Windows Sandbox & Display Troubleshooting
If running on Windows where user profile directories lack `ALL APPLICATION PACKAGES` access permissions, Electron 29's Chromium sandbox can crash with `exit_code=-1073741515` (`0xC0000135` / `STATUS_DLL_NOT_FOUND`).

The project handles this automatically:
- CLI command in `package.json` runs Electron with `--no-sandbox`.
- `main.js` sets `sandbox: false` in `BrowserWindow.webPreferences`.
- `main.js` calls `app.disableHardwareAcceleration()` to eliminate GPU process crash loops while preserving Chromium's DWM compositing (preventing blank white screen presentation errors).

## Building the Application

Create distributable packages using `electron-builder`:

### Windows Installer
```powershell
npm run build
```
**Output**: `dist/Movie Tracker Setup x.x.x.exe` (NSIS installer)

### Unpacked Build (for testing)
```powershell
npm run pack
```
**Output**: `dist/win-unpacked/` folder with standalone executable

### Build Configuration
Build settings are in `package.json`:
```json
{
  "build": {
    "appId": "com.movie.tracker",
    "productName": "Movie Tracker",
    "win": {
      "target": "nsis",
      "icon": "build/icon.ico"
    },
    "directories": {
      "output": "dist"
    }
  }
}
```

> [!NOTE]
> For custom icons, place `icon.ico` (256x256 recommended) in a `build/` folder.

## Automated Updates & CI/CD

This application features an end-to-end automated update pipeline using **GitHub Actions** and **electron-updater**.

### CI/CD Pipeline (GitHub Actions)
1. **Trigger**: Whenever you push code directly to the `main` branch, the `.github/workflows/release.yml` workflow takes over.
2. **Auto-Tagging (No Code Commits!)**: The workflow finds your latest Git tag, increases the patch version (e.g., `v1.0.0` -> `v1.0.1`), updates the build files in memory, and pushes **only the new tag** back to GitHub. The GitHub token must have `contents: write` permissions to push this tag.
3. **Publishing**: It then builds the Windows executable (`electron-builder -- -p always`) and publishes it as a GitHub Release attached to that new tag. For `electron-updater` to discover the release, `package.json` must have `"releaseType": "release"` to prevent it from being hidden as a Draft.

### How the Auto-Updater Works Functionally
When a user launches the compiled application (Production mode), the auto-updater kicks in silently:
1. **Background Check**: `electron-updater` reads the application's internal version and requests `releases.atom` from the GitHub repository. **Important:** The GitHub repository *must be Public* for `electron-updater` to access the releases without an authentication token!
2. **IPC Communication**: The Electron Main Process (`main.js`) catches events from `electron-updater` (like `checking-for-update`, `update-available`, `download-progress`) and securely broadcasts them to the UI Window via IPC channels defined in `preload.js`.
3. **Settings UI**: The user can open the **Settings** modal to interact with the updater:
   - **Current Version**: Displays the currently installed version.
   - **Check for Updates**: Users can manually trigger a check.
   - **Download Update**: If an update is available, a blue button appears allowing the user to begin the download in the background. Progress percentages are streamed to the UI in real-time.
   - **Restart & Install**: Once the download completes, a green button appears. Clicking it safely quits the application, executes the downloaded installer, and automatically relaunches the updated app.

> **Note on Development Mode**: The auto-updater is intentionally disabled when running via `npm start`. If you click "Check for Updates" in dev mode, the app will explicitly warn you that auto-updating is disabled to prevent configuration errors.

## Cloudflare Worker Management via Commands

The repository contains the edge reverse proxy in the [`cloudflare-worker/`](../cloudflare-worker/) directory. You can test, configure secrets, deploy, and inspect the worker entirely via CLI commands:

### 1. Navigate to the Worker Directory
```powershell
cd cloudflare-worker
```

### 2. Run Automated Worker Tests
Run the standalone unit test suite natively via Node.js test runner:
```powershell
npm test
```

### 3. Log into Cloudflare
Authorize the Wrangler CLI with your Cloudflare account:
```powershell
npx wrangler login
```

### 4. Configure or Update Secrets
Set or update your TMDB API token securely in Cloudflare's encrypted storage (never committed to git):
```powershell
# Set your TMDB v4 Read Access Token (or v3 Key)
npx wrangler secret put TMDB_TOKEN

# (Optional) Customize the client handshake key (default: MovieTracker-Client-Secure-2026)
npx wrangler secret put CLIENT_KEY
```

### 5. Deploy Worker Updates to Cloudflare Edge
Publish changes globally across Cloudflare's edge network:
```powershell
npx wrangler deploy
# or
npm run deploy
```

### 6. View Live Traffic and Logs
Stream real-time console logs and HTTP requests from the live worker:
```powershell
npx wrangler tail
```

### 7. Test the Live Endpoint via CLI
Verify that the deployed worker is active and responding:
```powershell
# Unauthorized request (Expected: 401)
curl.exe -i "https://tmdb-proxy.movie-feed.workers.dev/3/search/movie?query=Inception"

# Authorized request (Expected: 200)
curl.exe -i -H "X-App-Key: MovieTracker-Client-Secure-2026" "https://tmdb-proxy.movie-feed.workers.dev/3/search/movie?query=Inception"
```

## Testing

The project uses **Jest** for unit testing with a test structure that mirrors the `src/` folder.

### Running Tests

```powershell
npm test              # Run all tests once
npm run test:watch    # Watch mode - auto-reruns on file changes (press q to quit)
npm run test:coverage # Generates coverage report in coverage/ folder

# Run a specific test file
npm test -- test/model/MovieModel.test.js

# Run all tests in a folder
npm test -- test/controller/

# Run tests matching a pattern
npm test -- --testPathPattern="Controller"
```

> **Watch mode** keeps Jest running and re-runs tests automatically when you save changes - great for development.
> **Coverage** shows which lines of code are tested vs untested, with an HTML report you can view in a browser.

### Test Structure

```
test/
├── setup.js                    # Global mocks (electronAPI, fetch)
├── core/
│   ├── main.test.js           # Main process documentation tests
│   └── preload.test.js        # IPC API shape tests
├── model/
│   ├── MovieModel.test.js     # CRUD, filtering, sorting tests
│   └── ApiService.test.js     # API calls with mocked fetch
├── controller/
│   ├── ModalManager.test.js   # Stack push/pop tests
│   ├── MovieController.test.js
│   ├── SearchController.test.js
│   └── FilterController.test.js
└── view/
    ├── UIHelpers.test.js      # Stars, messages, debounce
    ├── MovieListView.test.js  # Card rendering, filters
    ├── ModalView.test.js      # Modal show/hide
    └── PosterGridView.test.js # Poster grid, infinite scroll
```

### Writing Tests

Tests use `jest.mock()` to mock dependencies. Example:

```javascript
jest.mock('../../src/model/ApiService.js', () => ({
    searchMoviesByTitle: jest.fn()
}));

test('search returns results', async () => {
    ApiService.searchMoviesByTitle.mockResolvedValue([{ title: 'Test' }]);
    // ... test code
});
```
