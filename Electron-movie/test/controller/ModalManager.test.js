/**
 * Tests for ModalManager - Stack-based modal management
 */

import * as ModalManager from '../../src/controller/ModalManager.js';

describe('ModalManager', () => {
    let mockOpenFn;
    let mockCloseFn;
    let mockIsVisibleFn;

    beforeEach(() => {
        // Clear the modal stack between tests
        ModalManager.closeAll();

        // Create fresh mocks
        mockOpenFn = jest.fn();
        mockCloseFn = jest.fn();
        mockIsVisibleFn = jest.fn().mockReturnValue(true);
    });

    describe('register', () => {
        test('registers a modal with open and close handlers', () => {
            ModalManager.register('testModal', {
                open: mockOpenFn,
                close: mockCloseFn,
                isVisible: mockIsVisibleFn
            });

            ModalManager.push('testModal');
            expect(mockOpenFn).toHaveBeenCalled();
        });

        test('logs error when registering without required handlers', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            ModalManager.register('badModal', { open: mockOpenFn });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('must have open and close handlers')
            );
            consoleSpy.mockRestore();
        });
    });

    describe('push', () => {
        beforeEach(() => {
            ModalManager.register('modal1', { open: mockOpenFn, close: mockCloseFn });
        });

        test('opens a modal and adds it to the stack', () => {
            ModalManager.push('modal1');

            expect(mockOpenFn).toHaveBeenCalled();
            expect(ModalManager.getActiveModal()).toBe('modal1');
            expect(ModalManager.getStackDepth()).toBe(1);
        });

        test('passes data to the open function', () => {
            const testData = { movie: { title: 'Test' } };
            ModalManager.push('modal1', testData);

            expect(mockOpenFn).toHaveBeenCalledWith(testData);
        });

        test('logs error for unregistered modal', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            ModalManager.push('unregisteredModal');

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('not registered')
            );
            consoleSpy.mockRestore();
        });
    });

    describe('pop', () => {
        beforeEach(() => {
            ModalManager.register('popModal', { open: mockOpenFn, close: mockCloseFn });
        });

        test('closes the top modal and removes from stack', () => {
            ModalManager.push('popModal');
            const result = ModalManager.pop();

            expect(result).toBe(true);
            expect(mockCloseFn).toHaveBeenCalled();
            expect(ModalManager.getStackDepth()).toBe(0);
        });

        test('returns false when stack is empty', () => {
            const result = ModalManager.pop();
            expect(result).toBe(false);
        });
    });

    describe('closeAll', () => {
        test('closes all modals in the stack', () => {
            const closeA = jest.fn();
            const closeB = jest.fn();

            ModalManager.register('modalA', { open: jest.fn(), close: closeA });
            ModalManager.register('modalB', { open: jest.fn(), close: closeB });

            ModalManager.push('modalA');
            ModalManager.push('modalB');
            ModalManager.closeAll();

            expect(closeA).toHaveBeenCalled();
            expect(closeB).toHaveBeenCalled();
            expect(ModalManager.getStackDepth()).toBe(0);
        });
    });

    describe('handleEscape', () => {
        test('pops the top modal', () => {
            ModalManager.register('escModal', { open: mockOpenFn, close: mockCloseFn });
            ModalManager.push('escModal');

            const result = ModalManager.handleEscape();

            expect(result).toBe(true);
            expect(mockCloseFn).toHaveBeenCalled();
        });

        test('returns false when no modals open', () => {
            const result = ModalManager.handleEscape();
            expect(result).toBe(false);
        });
    });

    describe('Stack Queries', () => {
        beforeEach(() => {
            ModalManager.register('queryModal', { open: mockOpenFn, close: mockCloseFn });
        });

        test('getActiveModal returns the top modal', () => {
            ModalManager.push('queryModal');
            expect(ModalManager.getActiveModal()).toBe('queryModal');
        });

        test('getActiveModal returns null when stack is empty', () => {
            expect(ModalManager.getActiveModal()).toBeNull();
        });

        test('isOpen checks if a modal is in the stack', () => {
            ModalManager.push('queryModal');
            expect(ModalManager.isOpen('queryModal')).toBe(true);
            expect(ModalManager.isOpen('otherModal')).toBe(false);
        });

        test('hasOpenModals returns correct state', () => {
            expect(ModalManager.hasOpenModals()).toBe(false);
            ModalManager.push('queryModal');
            expect(ModalManager.hasOpenModals()).toBe(true);
        });

        test('getStackDepth returns correct count', () => {
            expect(ModalManager.getStackDepth()).toBe(0);
            ModalManager.push('queryModal');
            expect(ModalManager.getStackDepth()).toBe(1);
        });
    });

    describe('Modal Stacking', () => {
        test('supports multiple modals in stack order', () => {
            const closeDetails = jest.fn();
            const closePoster = jest.fn();

            ModalManager.register('details', { open: jest.fn(), close: closeDetails });
            ModalManager.register('poster', { open: jest.fn(), close: closePoster });

            ModalManager.push('details');
            ModalManager.push('poster');

            expect(ModalManager.getStackDepth()).toBe(2);
            expect(ModalManager.getActiveModal()).toBe('poster');

            // Pop should close poster first
            ModalManager.pop();
            expect(closePoster).toHaveBeenCalled();
            expect(ModalManager.getActiveModal()).toBe('details');

            // Then details
            ModalManager.pop();
            expect(closeDetails).toHaveBeenCalled();
        });
    });
});
