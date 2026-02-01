/**
 * Tests for UIHelpers - Stars, messages, and DOM utilities
 */

import * as UIHelpers from '../../src/view/UIHelpers.js';

describe('UIHelpers', () => {
    describe('renderStarsHtml', () => {
        test('renders 5 filled stars for rating 5', () => {
            const html = UIHelpers.renderStarsHtml(5);
            expect(html).toContain('filled');
            expect((html.match(/filled/g) || []).length).toBe(5);
        });

        test('renders correct number of filled stars for rating 3', () => {
            const html = UIHelpers.renderStarsHtml(3);
            // 3 = 3 filled stars
            expect((html.match(/filled/g) || []).length).toBe(3);
        });

        test('renders half star for .5 ratings', () => {
            const html = UIHelpers.renderStarsHtml(2.5);
            // 2.5 = 2 filled + 1 half
            expect(html).toContain('half');
            expect((html.match(/filled/g) || []).length).toBe(2);
        });

        test('renders empty stars for remaining', () => {
            const html = UIHelpers.renderStarsHtml(2);
            // 2 = 2 filled, 3 empty
            expect((html.match(/empty/g) || []).length).toBe(3);
        });

        test('handles zero rating', () => {
            const html = UIHelpers.renderStarsHtml(0);
            expect((html.match(/empty/g) || []).length).toBe(5);
        });

        test('uses card class when isCard is true', () => {
            const html = UIHelpers.renderStarsHtml(3, true);
            expect(html).toContain('rating-star-card');
        });

        test('uses standard class when isCard is false', () => {
            const html = UIHelpers.renderStarsHtml(3, false);
            expect(html).toContain('rating-star');
            expect(html).not.toContain('rating-star-card');
        });
    });

    describe('showMessage', () => {
        let messageElement;

        beforeEach(() => {
            messageElement = document.createElement('div');
            messageElement.id = 'message';
            document.body.appendChild(messageElement);

            // Initialize UIHelpers with the message box
            UIHelpers.initUIHelpers({
                messageBox: messageElement,
                detailsModalMessageBox: null
            });
        });

        test('displays message text', () => {
            UIHelpers.showMessage('Test message', 'success');
            expect(messageElement.textContent).toBe('Test message');
        });

        test('applies success class', () => {
            UIHelpers.showMessage('Success!', 'success');
            expect(messageElement.classList.contains('success')).toBe(true);
        });

        test('applies error class', () => {
            UIHelpers.showMessage('Error!', 'error');
            expect(messageElement.classList.contains('error')).toBe(true);
        });

        test('does nothing when not initialized', () => {
            UIHelpers.initUIHelpers({ messageBox: null });
            expect(() => UIHelpers.showMessage('Test', 'error')).not.toThrow();
        });
    });

    describe('showDetailsModalMessage', () => {
        let modalMessageElement;

        beforeEach(() => {
            modalMessageElement = document.createElement('div');
            modalMessageElement.id = 'details-modal-message';
            document.body.appendChild(modalMessageElement);

            UIHelpers.initUIHelpers({
                messageBox: null,
                detailsModalMessageBox: modalMessageElement
            });
        });

        test('displays message in modal', () => {
            UIHelpers.showDetailsModalMessage('Modal message');
            expect(modalMessageElement.textContent).toBe('Modal message');
        });
    });

    describe('debounce', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('delays function execution', () => {
            const fn = jest.fn();
            const debounced = UIHelpers.debounce(fn, 100);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('resets delay on subsequent calls', () => {
            const fn = jest.fn();
            const debounced = UIHelpers.debounce(fn, 100);

            debounced();
            jest.advanceTimersByTime(50);
            debounced();
            jest.advanceTimersByTime(50);

            expect(fn).not.toHaveBeenCalled();

            jest.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        test('passes arguments to debounced function', () => {
            const fn = jest.fn();
            const debounced = UIHelpers.debounce(fn, 100);

            debounced('arg1', 'arg2');
            jest.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });
    });

    describe('createPosterImage', () => {
        test('creates img element with first URL', () => {
            const img = UIHelpers.createPosterImage(
                ['https://example.com/poster1.jpg', 'https://example.com/poster2.jpg'],
                'Test Movie'
            );

            expect(img.tagName).toBe('IMG');
            expect(img.alt).toBe('Test Movie');
            expect(img.src).toBe('https://example.com/poster1.jpg');
        });

        test('has onerror handler for fallback', () => {
            const img = UIHelpers.createPosterImage(
                ['https://example.com/poster1.jpg', 'https://example.com/poster2.jpg'],
                'Test Movie'
            );

            expect(img.onerror).toBeDefined();
        });
    });

    describe('formatDateDMY', () => {
        test('formats date string to DD-MM-YYYY', () => {
            const result = UIHelpers.formatDateDMY('2023-05-15');
            expect(result).toBe('15-05-2023');
        });

        test('handles ISO date format', () => {
            const result = UIHelpers.formatDateDMY('2023-05-15T12:00:00Z');
            expect(result).toBe('15-05-2023');
        });

        test('returns N/A for null input', () => {
            const result = UIHelpers.formatDateDMY(null);
            expect(result).toBe('N/A');
        });

        test('returns N/A for empty string', () => {
            const result = UIHelpers.formatDateDMY('');
            expect(result).toBe('N/A');
        });
    });

    describe('selectRating', () => {
        let ratingValue;
        let ratingText;
        let ratingContainer;
        let ratingOptions;

        beforeEach(() => {
            ratingValue = document.createElement('input');
            ratingValue.id = 'rating-value';

            ratingText = document.createElement('span');
            ratingText.id = 'rating-text';

            ratingContainer = document.createElement('div');
            ratingContainer.id = 'rating-container';
            ratingContainer.classList.add('open');

            ratingOptions = document.createElement('div');
            ratingOptions.id = 'rating-options';

            // Add some options
            const opt1 = document.createElement('div');
            opt1.classList.add('custom-option');
            opt1.dataset.value = '0';
            ratingOptions.appendChild(opt1);

            const opt2 = document.createElement('div');
            opt2.classList.add('custom-option');
            opt2.dataset.value = '3';
            ratingOptions.appendChild(opt2);

            document.body.appendChild(ratingValue);
            document.body.appendChild(ratingText);
            document.body.appendChild(ratingContainer);
            document.body.appendChild(ratingOptions);

            UIHelpers.initUIHelpers({
                ratingValue,
                ratingText,
                ratingContainer,
                ratingOptions
            });
        });

        test('sets rating value', () => {
            UIHelpers.selectRating('3', '<span>★★★</span>');
            expect(ratingValue.value).toBe('3');
        });

        test('sets text content for zero rating', () => {
            UIHelpers.selectRating('0', 'Select a rating...');
            expect(ratingText.textContent).toBe('Select a rating...');
        });

        test('sets innerHTML for non-zero rating', () => {
            UIHelpers.selectRating('3', '<span>★★★</span>');
            expect(ratingText.innerHTML).toBe('<span>★★★</span>');
        });

        test('removes open class from container', () => {
            UIHelpers.selectRating('3', '<span>★★★</span>');
            expect(ratingContainer.classList.contains('open')).toBe(false);
        });

        test('adds selected class to matching option', () => {
            UIHelpers.selectRating('3', '<span>★★★</span>');
            const options = ratingOptions.querySelectorAll('.custom-option');
            expect(options[1].classList.contains('selected')).toBe(true);
        });

        test('removes selected class from non-matching options', () => {
            ratingOptions.querySelector('[data-value="0"]').classList.add('selected');
            UIHelpers.selectRating('3', '<span>★★★</span>');
            expect(ratingOptions.querySelector('[data-value="0"]').classList.contains('selected')).toBe(false);
        });

        test('does nothing when ratingValue not initialized', () => {
            UIHelpers.initUIHelpers({ ratingValue: null });
            expect(() => UIHelpers.selectRating('3', '<span>★★★</span>')).not.toThrow();
        });
    });

    describe('initCustomRatingDropdown', () => {
        let ratingValue;
        let ratingText;
        let ratingContainer;
        let ratingOptions;
        let ratingTrigger;

        beforeEach(() => {
            ratingValue = document.createElement('input');
            ratingText = document.createElement('span');
            ratingContainer = document.createElement('div');
            ratingOptions = document.createElement('div');
            ratingTrigger = document.createElement('button');

            document.body.appendChild(ratingValue);
            document.body.appendChild(ratingText);
            document.body.appendChild(ratingContainer);
            document.body.appendChild(ratingOptions);
            document.body.appendChild(ratingTrigger);

            UIHelpers.initUIHelpers({
                ratingValue,
                ratingText,
                ratingContainer,
                ratingOptions,
                ratingTrigger
            });
        });

        test('creates rating options', () => {
            UIHelpers.initCustomRatingDropdown();
            // Should have 11 options: 0 + (0.5 to 5.0 in 0.5 increments)
            const options = ratingOptions.querySelectorAll('.custom-option');
            expect(options.length).toBe(11);
        });

        test('first option is "Select a rating..."', () => {
            UIHelpers.initCustomRatingDropdown();
            const firstOption = ratingOptions.querySelector('.custom-option');
            expect(firstOption.textContent).toBe('Select a rating...');
            expect(firstOption.dataset.value).toBe('0');
        });

        test('clicking trigger toggles open class', () => {
            UIHelpers.initCustomRatingDropdown();

            ratingTrigger.click();
            expect(ratingContainer.classList.contains('open')).toBe(true);

            ratingTrigger.click();
            expect(ratingContainer.classList.contains('open')).toBe(false);
        });

        test('clicking outside closes dropdown', () => {
            UIHelpers.initCustomRatingDropdown();
            ratingContainer.classList.add('open');

            // Click outside
            document.body.click();
            expect(ratingContainer.classList.contains('open')).toBe(false);
        });

        test('does nothing when ratingOptions not initialized', () => {
            UIHelpers.initUIHelpers({ ratingOptions: null });
            expect(() => UIHelpers.initCustomRatingDropdown()).not.toThrow();
        });
    });
});
