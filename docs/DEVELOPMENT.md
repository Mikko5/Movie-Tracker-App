# Setup & Development

This document provides instructions on how to set up, run, and build the Electron Movie Tracker.

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
   There are two ways to configure your TMDB API Key:
   - **(Recommended for Production)**: Open the application, click **Settings**, and paste your API key into the "TMDB API Key" field. It will be securely saved to your user data directory (`apiKey.txt`).
   - **(For Development)**: Create a file named `.env` in the project root and add:
     ```text
     APIKEY=your_token_here
     ```
   
   > **Note on TMDB Keys:** The application automatically supports **both** types of TMDB authentication tokens:
   > 1. The short **API Key (v3)** (~32 characters)
   > 2. The long **Read Access Token (v4)** (~200+ characters)
   > 
   > Simply paste whichever one you have into the Settings UI or `.env` file, and the application will dynamically format the API requests (`?api_key=` vs `Bearer`) based on the length of your key!

## Running the Application

### Development Mode
- **Command**: `npm start`
- **Data File**: `data/movie-data.dev.json`
- **Behavior**: Save location is fixed to prevent accidental overwrites

```powershell
npm start
```

### Production Mode
- **Command**: `npm run start:prod`
- **Data File**: `data/movie-data.json` or custom location
- **Behavior**: Full save location control via Settings

```powershell
npm run start:prod
```

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
