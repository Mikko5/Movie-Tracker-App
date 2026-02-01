/**
 * Tests for PosterGridView - Poster selection grid modal
 */

import * as PosterGridView from '../../src/view/PosterGridView.js';

describe('PosterGridView', () => {
    let posterModal;
    let posterGrid;
    let posterCloseBtn;

    beforeEach(() => {
        // Create DOM elements
        posterModal = document.createElement('div');
        posterModal.id = 'poster-modal';
        posterModal.style.display = 'none';

        posterGrid = document.createElement('div');
        posterGrid.id = 'poster-grid';

        posterCloseBtn = document.createElement('button');
        posterCloseBtn.id = 'poster-close-btn';

        posterModal.appendChild(posterGrid);
        posterModal.appendChild(posterCloseBtn);
        document.body.appendChild(posterModal);

        PosterGridView.initPosterGridView({
            posterModal,
            posterGrid,
            posterCloseBtn
        });
    });

    describe('initPosterGridView', () => {
        test('stores DOM element references', () => {
            // Verify by testing modal operations work
            PosterGridView.openPosterModal(['/test.jpg'], jest.fn());
            expect(posterModal.style.display).toBe('block');
        });

        test('sets up close button listener', () => {
            PosterGridView.openPosterModal(['/test.jpg'], jest.fn());
            posterCloseBtn.click();

            expect(posterModal.style.display).toBe('none');
        });

        test('sets up click outside to close', () => {
            PosterGridView.openPosterModal(['/test.jpg'], jest.fn());

            // Create and dispatch click event on modal backdrop
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: posterModal });
            posterModal.dispatchEvent(clickEvent);

            expect(posterModal.style.display).toBe('none');
        });
    });

    describe('openPosterModal', () => {
        test('shows the modal', () => {
            PosterGridView.openPosterModal(['/poster1.jpg', '/poster2.jpg'], jest.fn());
            expect(posterModal.style.display).toBe('block');
        });

        test('renders initial batch of posters', () => {
            const posters = Array.from({ length: 30 }, (_, i) => `/poster${i}.jpg`);
            PosterGridView.openPosterModal(posters, jest.fn());

            const posterItems = posterGrid.querySelectorAll('.poster-item');
            expect(posterItems.length).toBe(25); // Initial batch
        });

        test('clears previous content', () => {
            posterGrid.innerHTML = '<div>Old content</div>';

            PosterGridView.openPosterModal(['/new.jpg'], jest.fn());

            expect(posterGrid.innerHTML).not.toContain('Old content');
        });
    });

    describe('closePosterModal', () => {
        test('hides the modal', () => {
            posterModal.style.display = 'block';
            PosterGridView.closePosterModal();

            expect(posterModal.style.display).toBe('none');
        });

        test('clears internal state', () => {
            PosterGridView.openPosterModal(['/test.jpg'], jest.fn());
            PosterGridView.closePosterModal();

            // Re-opening should start fresh
            PosterGridView.openPosterModal(['/new.jpg'], jest.fn());
            const items = posterGrid.querySelectorAll('.poster-item');
            expect(items.length).toBe(1);
        });
    });

    describe('isPosterModalVisible', () => {
        test('returns false when hidden', () => {
            expect(PosterGridView.isPosterModalVisible()).toBe(false);
        });

        test('returns true when visible', () => {
            PosterGridView.openPosterModal(['/test.jpg'], jest.fn());
            expect(PosterGridView.isPosterModalVisible()).toBe(true);
        });
    });

    describe('Poster Selection', () => {
        test('clicking poster calls callback with path', () => {
            const callback = jest.fn();
            PosterGridView.openPosterModal(['/selected.jpg'], callback);

            const posterItem = posterGrid.querySelector('.poster-item');
            posterItem.click();

            expect(callback).toHaveBeenCalledWith('/selected.jpg');
        });

        test('clicking poster closes the modal', () => {
            PosterGridView.openPosterModal(['/test.jpg'], jest.fn());

            const posterItem = posterGrid.querySelector('.poster-item');
            posterItem.click();

            expect(posterModal.style.display).toBe('none');
        });
    });

    describe('Infinite Scroll', () => {
        test('renders more posters on scroll near bottom', () => {
            const posters = Array.from({ length: 50 }, (_, i) => `/poster${i}.jpg`);
            PosterGridView.openPosterModal(posters, jest.fn());

            // Simulate scroll to bottom
            Object.defineProperty(posterGrid, 'scrollTop', { value: 500, configurable: true });
            Object.defineProperty(posterGrid, 'scrollHeight', { value: 600, configurable: true });
            Object.defineProperty(posterGrid, 'clientHeight', { value: 200, configurable: true });

            posterGrid.dispatchEvent(new Event('scroll'));

            const posterItems = posterGrid.querySelectorAll('.poster-item');
            expect(posterItems.length).toBeGreaterThan(25);
        });
    });

    describe('Lazy Loading', () => {
        test('poster images have loading="lazy" attribute', () => {
            PosterGridView.openPosterModal(['/lazy.jpg'], jest.fn());

            const img = posterGrid.querySelector('img');
            expect(img.loading).toBe('lazy');
        });
    });
});
