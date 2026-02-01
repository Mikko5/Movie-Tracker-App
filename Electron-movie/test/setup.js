/**
 * Global test setup - Mocks for DOM and Electron APIs
 */

// Mock window.electronAPI (IPC bridge)
global.electronAPI = {
    invoke: jest.fn().mockResolvedValue(null),
    send: jest.fn(),
    onJsonUpdated: jest.fn()
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
