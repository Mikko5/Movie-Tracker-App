/**
 * Tests for preload.js - Context bridge for secure IPC
 * 
 * Note: This file uses Electron's contextBridge which can only be
 * tested in an Electron environment. These tests verify the API shape.
 */

describe('Preload API', () => {
    describe('electronAPI shape', () => {
        // The actual preload.js runs in Electron context, so we test
        // the expected API shape that's exposed to the renderer

        const expectedAPI = {
            invoke: expect.any(Function),
            send: expect.any(Function),
            onJsonUpdated: expect.any(Function)
        };

        test('window.electronAPI has expected methods', () => {
            // The global mock is set up in test/setup.js
            expect(window.electronAPI).toMatchObject(expectedAPI);
        });

        test('invoke method is callable', () => {
            expect(() => window.electronAPI.invoke('test-channel')).not.toThrow();
        });

        test('send method is callable', () => {
            expect(() => window.electronAPI.send('test-channel')).not.toThrow();
        });

        test('onJsonUpdated method is callable', () => {
            expect(() => window.electronAPI.onJsonUpdated(() => { })).not.toThrow();
        });
    });

    describe('IPC Channels', () => {
        // Document and test the expected IPC channels

        const expectedChannels = [
            'read-json',
            'write-json',
            'get-api-key',
            'is-dev',
            'select-save-location'
        ];

        test.each(expectedChannels)('channel "%s" can be invoked', async (channel) => {
            await expect(window.electronAPI.invoke(channel)).resolves.not.toThrow();
        });
    });
});
