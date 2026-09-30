/**
 * Tests for ModalView - All modal rendering and state
 */

// Mock dependencies
jest.mock('../../src/view/UIHelpers.js', () => ({
    renderStarsHtml: jest.fn().mockReturnValue('<span>★★★★★</span>'),
    selectRating: jest.fn()
}));

import * as ModalView from '../../src/view/ModalView.js';

describe('ModalView', () => {
    let detailsModal;
    let infoModal;
    let deleteConfirmModal;
    let settingsModal;
    let backupModal;
    let searchOverlay;
    let detailsModalMessageBox;
    let saveBtn;
    let detailsModalTitle;
    let watchDateInput;
    let rewatchCheckbox;
    let commentInput;
    let formatInput;
    let customPosterInput;
    let infoTitle;
    let infoDirector;
    let infoGenres;
    let infoRuntime;
    let infoDate;
    let infoRewatch;
    let infoFormat;
    let infoFormatP;
    let infocomment;
    let infocommentP;
    let imdbBtn;
    let letterboxdBtn;
    let letterboxdReviewBtn;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create modal DOM elements
        detailsModal = document.createElement('div');
        detailsModal.id = 'details-modal';
        detailsModal.style.display = 'none';

        infoModal = document.createElement('div');
        infoModal.id = 'info-modal';
        infoModal.style.display = 'none';

        deleteConfirmModal = document.createElement('div');
        deleteConfirmModal.id = 'delete-confirm-modal';
        deleteConfirmModal.style.display = 'none';

        settingsModal = document.createElement('div');
        settingsModal.id = 'settings-modal';
        settingsModal.style.display = 'none';

        backupModal = document.createElement('div');
        backupModal.id = 'backup-modal';
        backupModal.style.display = 'none';

        searchOverlay = document.createElement('div');
        searchOverlay.id = 'search-overlay';
        searchOverlay.classList.add('search-overlay-hidden');

        // Form elements for details modal
        detailsModalTitle = document.createElement('span');
        detailsModalTitle.id = 'details-modal-title';

        saveBtn = document.createElement('button');
        saveBtn.id = 'save-btn';

        detailsModalMessageBox = document.createElement('div');
        detailsModalMessageBox.id = 'details-modal-message';

        watchDateInput = document.createElement('input');
        watchDateInput.id = 'watch-date';

        rewatchCheckbox = document.createElement('input');
        rewatchCheckbox.type = 'checkbox';
        rewatchCheckbox.id = 'rewatch';

        commentInput = document.createElement('textarea');
        commentInput.id = 'comment';

        formatInput = document.createElement('input');
        formatInput.id = 'format';

        customPosterInput = document.createElement('input');
        customPosterInput.id = 'custom-poster';

        // Info modal elements
        infoTitle = document.createElement('span');
        infoDirector = document.createElement('span');
        infoGenres = document.createElement('span');
        infoRuntime = document.createElement('span');
        infoDate = document.createElement('span');
        infoRewatch = document.createElement('span');
        infoFormat = document.createElement('span');
        infoFormatP = document.createElement('p');
        infocomment = document.createElement('span');
        infocommentP = document.createElement('p');
        imdbBtn = document.createElement('button');
        letterboxdBtn = document.createElement('button');
        letterboxdReviewBtn = document.createElement('button');

        document.body.appendChild(detailsModal);
        document.body.appendChild(infoModal);
        document.body.appendChild(deleteConfirmModal);
        document.body.appendChild(settingsModal);
        document.body.appendChild(searchOverlay);

        window.electronAPI = { send: jest.fn() };

        // Initialize with all required elements
        ModalView.initModalView({
            detailsModal,
            detailsModalTitle,
            saveBtn,
            watchDateInput,
            rewatchCheckbox,
            commentInput,
            formatInput,
            customPosterInput,
            detailsModalMessageBox,
            infoModal,
            infoTitle,
            infoDirector,
            infoGenres,
            infoRuntime,
            infoDate,
            infoRewatch,
            infoFormat,
            infoFormatP,
            infocomment,
            infocommentP,
            imdbBtn,
            letterboxdBtn,
            letterboxdReviewBtn,
            deleteConfirmModal,
            settingsModal,
            backupModal,
            searchOverlay
        });
    });

    describe('Details Modal', () => {
        test('openDetailsModal shows the modal', () => {
            const movie = { title: 'Test Movie', id: 123 };
            ModalView.openDetailsModal(movie, null, []);

            expect(detailsModal.style.display).toBe('block');
        });

        test('closeDetailsModal hides the modal', () => {
            detailsModal.style.display = 'block';
            ModalView.closeDetailsModal();

            expect(detailsModal.style.display).toBe('none');
        });

        test('isDetailsModalVisible returns correct state', () => {
            expect(ModalView.isDetailsModalVisible()).toBe(false);

            detailsModal.style.display = 'block';
            expect(ModalView.isDetailsModalVisible()).toBe(true);
        });

        test('openDetailsModal sets Add to List for new movie', () => {
            const movie = { title: 'New Movie' };
            ModalView.openDetailsModal(movie, null, []);

            expect(saveBtn.textContent).toContain('Add to List');
        });

        test('openDetailsModal sets Save Changes for editing', () => {
            const movie = { title: 'Edit Movie', entryId: 'edit1', userRating: 4 };
            ModalView.openDetailsModal(movie, 'edit1', [movie]);

            expect(saveBtn.textContent).toContain('Save Changes');
        });
    });

    describe('Info Modal', () => {
        test('openInfoModal shows the modal', () => {
            const movie = {
                title: 'Info Movie',
                release_date: '2023-01-01',
                runtime: 120,
                genres: ['Action'],
                director: 'Test Director',
                userRating: 8,
                watchDate: '2023-06-15'
            };
            ModalView.openInfoModal(movie);

            expect(infoModal.style.display).toBe('block');
        });

        test('closeInfoModal hides the modal', () => {
            infoModal.style.display = 'block';
            ModalView.closeInfoModal();

            expect(infoModal.style.display).toBe('none');
        });

        test('isInfoModalVisible returns correct state', () => {
            expect(ModalView.isInfoModalVisible()).toBe(false);

            infoModal.style.display = 'block';
            expect(ModalView.isInfoModalVisible()).toBe(true);
        });
        
        test('Letterboxd button redirects to TMDB endpoint if id is present', () => {
            const movie = { title: 'Interstellar', id: 157336 };
            ModalView.openInfoModal(movie);
            
            letterboxdBtn.click();
            expect(window.electronAPI.send).toHaveBeenCalledWith('open-external-link', 'https://letterboxd.com/tmdb/157336/');
        });

        test('Letterboxd button redirects to IMDb endpoint if only imdb_id is present', () => {
            const movie = { title: 'Interstellar', imdb_id: 'tt0816692' };
            ModalView.openInfoModal(movie);
            
            letterboxdBtn.click();
            expect(window.electronAPI.send).toHaveBeenCalledWith('open-external-link', 'https://letterboxd.com/imdb/tt0816692/');
        });

        test('Letterboxd button extracts canonical film slug from diary URL when no IDs present', () => {
            const movie = { title: 'The Odyssey', letterboxdUrl: 'https://letterboxd.com/user/film/the-odyssey-2026/' };
            ModalView.openInfoModal(movie);
            
            letterboxdBtn.click();
            expect(window.electronAPI.send).toHaveBeenCalledWith('open-external-link', 'https://letterboxd.com/film/the-odyssey-2026/');
        });

        test('Letterboxd button falls back to search URL if no IDs or film slug', () => {
            const movie = { title: 'Test Movie' };
            ModalView.openInfoModal(movie);
            
            letterboxdBtn.click();
            expect(window.electronAPI.send).toHaveBeenCalledWith('open-external-link', 'https://letterboxd.com/search/films/Test%20Movie/');
        });

        test('shows and wires "My Review" button when letterboxdUrl exists', () => {
            const movie = { title: 'Test Movie', id: 123, letterboxdUrl: 'https://boxd.it/5sRy03' };
            ModalView.openInfoModal(movie);

            expect(letterboxdReviewBtn.style.display).toBe('inline-block');
            letterboxdReviewBtn.click();
            expect(window.electronAPI.send).toHaveBeenCalledWith('open-external-link', 'https://boxd.it/5sRy03');
        });

        test('hides "My Review" button when letterboxdUrl is not present', () => {
            const movie = { title: 'Test Movie', id: 123 };
            ModalView.openInfoModal(movie);

            expect(letterboxdReviewBtn.style.display).toBe('none');
        });
    });

    describe('getLetterboxdMovieUrl helper', () => {
        test('returns TMDB endpoint when id exists', () => {
            expect(ModalView.getLetterboxdMovieUrl({ id: 999 })).toBe('https://letterboxd.com/tmdb/999/');
        });

        test('returns TMDB endpoint when tmdbId exists', () => {
            expect(ModalView.getLetterboxdMovieUrl({ tmdbId: 888 })).toBe('https://letterboxd.com/tmdb/888/');
        });

        test('returns IMDb endpoint when only imdb_id exists', () => {
            expect(ModalView.getLetterboxdMovieUrl({ imdb_id: 'tt1234567' })).toBe('https://letterboxd.com/imdb/tt1234567/');
        });

        test('extracts canonical film slug from diary/review URL', () => {
            expect(ModalView.getLetterboxdMovieUrl({ letterboxdUrl: 'https://letterboxd.com/ikbenmikko/film/resident-evil-2026/1/' }))
                .toBe('https://letterboxd.com/film/resident-evil-2026/');
        });

        test('falls back to search query', () => {
            expect(ModalView.getLetterboxdMovieUrl({ title: 'Alien Romulus' }))
                .toBe('https://letterboxd.com/search/films/Alien%20Romulus/');
        });

        test('handles null/undefined movie safely', () => {
            expect(ModalView.getLetterboxdMovieUrl(null)).toBe('https://letterboxd.com');
        });
    });

    describe('Delete Confirm Modal', () => {
        test('showDeleteConfirmModal shows the modal', () => {
            ModalView.showDeleteConfirmModal();
            expect(deleteConfirmModal.style.display).toBe('block');
        });

        test('hideDeleteConfirmModal hides the modal', () => {
            deleteConfirmModal.style.display = 'block';
            ModalView.hideDeleteConfirmModal();

            expect(deleteConfirmModal.style.display).toBe('none');
        });

        test('isDeleteConfirmModalVisible returns correct state', () => {
            expect(ModalView.isDeleteConfirmModalVisible()).toBe(false);

            deleteConfirmModal.style.display = 'block';
            expect(ModalView.isDeleteConfirmModalVisible()).toBe(true);
        });
    });

    describe('Settings Modal', () => {
        test('showSettingsModal shows the modal', () => {
            ModalView.showSettingsModal();
            expect(settingsModal.style.display).toBe('block');
        });

        test('hideSettingsModal hides the modal', () => {
            settingsModal.style.display = 'block';
            ModalView.hideSettingsModal();

            expect(settingsModal.style.display).toBe('none');
        });

        test('isSettingsModalVisible returns correct state', () => {
            expect(ModalView.isSettingsModalVisible()).toBe(false);

            settingsModal.style.display = 'block';
            expect(ModalView.isSettingsModalVisible()).toBe(true);
        });
    });

    describe('Backup Modal', () => {
        test('showBackupModal shows the modal', () => {
            ModalView.showBackupModal();
            expect(backupModal.style.display).toBe('block');
        });

        test('hideBackupModal hides the modal', () => {
            backupModal.style.display = 'block';
            ModalView.hideBackupModal();

            expect(backupModal.style.display).toBe('none');
        });

        test('isBackupModalVisible returns correct state', () => {
            expect(ModalView.isBackupModalVisible()).toBe(false);

            backupModal.style.display = 'block';
            expect(ModalView.isBackupModalVisible()).toBe(true);
        });
    });

    describe('Search Overlay', () => {
        test('showSearchOverlay adds visible class', () => {
            ModalView.showSearchOverlay();
            expect(searchOverlay.classList.contains('search-overlay-visible')).toBe(true);
            expect(searchOverlay.classList.contains('search-overlay-hidden')).toBe(false);
        });

        test('hideSearchOverlay adds hidden class', () => {
            searchOverlay.classList.add('search-overlay-visible');
            ModalView.hideSearchOverlay();

            expect(searchOverlay.classList.contains('search-overlay-hidden')).toBe(true);
            expect(searchOverlay.classList.contains('search-overlay-visible')).toBe(false);
        });

        test('isSearchOverlayVisible returns correct state', () => {
            expect(ModalView.isSearchOverlayVisible()).toBe(false);

            searchOverlay.classList.add('search-overlay-visible');
            expect(ModalView.isSearchOverlayVisible()).toBe(true);
        });
    });

    describe('setCustomPosterInput', () => {
        test('sets the custom poster input value', () => {
            ModalView.setCustomPosterInput('/new-poster.jpg');
            expect(customPosterInput.value).toBe('/new-poster.jpg');
        });
    });
});
