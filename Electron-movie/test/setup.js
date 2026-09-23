/**
 * Global test setup - Mocks for DOM and Electron APIs
 */

// Polyfill setImmediate for jsdom environment (Node native in Electron main process)
if (typeof setImmediate === 'undefined') {
    global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
    global.clearImmediate = (id) => clearTimeout(id);
}

// Mock window.electronAPI (IPC bridge)
global.electronAPI = {
    invoke: jest.fn().mockResolvedValue(null),
    send: jest.fn(),
    onJsonUpdated: jest.fn(),
    onUpdaterStatus: jest.fn(),
    onBackupStatus: jest.fn()
};

// Attach to window for views
Object.defineProperty(window, 'electronAPI', {
    value: global.electronAPI,
    writable: true
});

// Mock fetch for API tests
global.fetch = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
});
