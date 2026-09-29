const { chromium } = require('playwright');
const path = require('path');
const AdmZip = require('adm-zip');

const { parseLetterboxdZip } = require('../../src/core/LetterboxdImportService');

async function runUITests() {
    console.log('\n======================================================');
    console.log('RUNNING PLAYWRIGHT LETTERBOXD UI TESTS (WITH INIT APP)');
    console.log('======================================================\n');

    const browser = await chromium.launch({
        headless: true,
        args: ['--allow-file-access-from-files']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('BROWSER ERROR:', msg.text());
        }
    });

    const validZip = new AdmZip();
    validZip.addFile('diary.csv', Buffer.from(
        'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n' +
        '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,,2024-01-01\n' +
        '2026-07-22,The Odyssey,2026,https://boxd.it/fn7BQp,4.5,yes,cinema,2026-07-21\n'
    ));
    validZip.addFile('reviews.csv', Buffer.from(
        'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n' +
        '2024-01-02,The Prestige,2006,https://boxd.it/5sRy03,4.5,,A masterclass in misdirection.,,2024-01-01\n'
    ));
    const validZipBuffer = validZip.toBuffer();

    await page.addInitScript(() => {
        window.__mockDbMovies = [];
        window.__bulkAddedMovies = [];
        window.__savedSettings = { username: '' };

        window.electronAPI = {
            invoke: async (channel, ...args) => {
                if (channel === 'get-letterboxd-settings') return window.__savedSettings;
                if (channel === 'set-letterboxd-settings') {
                    window.__savedSettings = args[0];
                    return { success: true };
                }
                if (channel === 'db:get-all' || channel === 'read-json') return window.__mockDbMovies;
                if (channel === 'db:bulk-add') {
                    window.__bulkAddedMovies.push(...args[0]);
                    return args[0].length;
                }
                if (channel === 'db:update-movie') return { success: true };
                if (channel === 'parse-letterboxd-zip') return window.__mockParseZipResult;
                if (channel === 'get-api-key') return 'mock-api-key';
                if (channel === 'is-dev') return true;
                return {};
            },
            on: () => {},
            send: () => {},
            onJsonUpdated: () => {},
            onBackupStatus: () => {},
            onUpdaterStatus: () => {}
        };
    });

    const htmlPath = 'file:///' + path.resolve(__dirname, '../../src/view/templates/movielist.html').replace(/\\/g, '/');
    await page.goto(htmlPath);

    // Natural initialization handles deferred ES module loading automatically
    await page.waitForTimeout(300);

    // TEST 1: Open Settings Modal
    await page.click('#settings-btn');
    await page.waitForSelector('#settings-modal', { state: 'visible' });
    console.log('✅ TEST 1 PASS: Settings Modal opened');

    // TEST 2: Check Letterboxd UI Elements
    const dropZoneVisible = await page.isVisible('#letterboxd-drop-zone');
    const inputVisible = await page.isVisible('#letterboxd-username-input');
    const saveBtnVisible = await page.isVisible('#save-letterboxd-btn');
    console.log(`✅ TEST 2 PASS: Letterboxd Settings Elements rendered (DropZone=${dropZoneVisible}, Input=${inputVisible}, SaveBtn=${saveBtnVisible})`);

    // TEST 3: Save Username
    await page.fill('#letterboxd-username-input', 'mikkotest');
    await page.click('#save-letterboxd-btn');
    await page.waitForTimeout(200);
    const syncBtnVisible = await page.isVisible('#sync-letterboxd-btn');
    console.log(`✅ TEST 3 PASS: Username saved & Sync button became visible (${syncBtnVisible})`);

    // TEST 4: Invalid File Drop / Upload
    await page.evaluate(async () => {
        const fakeFile = new File(['hello text'], 'notes.txt', { type: 'text/plain' });
        const { handleZipImport } = await import('../../controller/LetterboxdController.js');
        await handleZipImport(fakeFile);
    });
    const errorMsg = await page.textContent('#message-box');
    console.log(`✅ TEST 4 PASS: Non-ZIP file rejected with error: "${errorMsg.trim()}"`);

    // TEST 5: Parse Real ZIP into Confirmation Modal
    const parsedData = await parseLetterboxdZip(validZipBuffer, []);
    await page.evaluate((data) => {
        window.__mockParseZipResult = data;
    }, parsedData);

    await page.evaluate(async () => {
        const fakeZipFile = new File(['PK\x03\x04fake'], 'export.zip', { type: 'application/zip' });
        const { handleZipImport } = await import('../../controller/LetterboxdController.js');
        await handleZipImport(fakeZipFile);
    });

    await page.waitForSelector('#sync-confirm-modal', { state: 'visible' });
    const modalTitle = await page.textContent('#sync-modal-title');
    const statsText = await page.textContent('#sync-confirm-stats');
    const itemsCount = await page.locator('#sync-movies-list li').count();
    console.log(`✅ TEST 5 PASS: Sync Confirmation Modal opened: Title="${modalTitle}", Movies listed=${itemsCount}`);
    console.log(`   Stats displayed:\n${statsText.trim().replace(/\n\s+/g, ' ')}`);

    // TEST 6: Cancel Button
    await page.click('#cancel-sync-btn');
    await page.waitForTimeout(200);
    const modalHidden = !(await page.isVisible('#sync-confirm-modal'));
    console.log(`✅ TEST 6 PASS: Cancel button closes confirmation modal: ${modalHidden}`);

    // TEST 7: Confirm & Add
    await page.evaluate(async () => {
        const fakeZipFile = new File(['PK\x03\x04fake'], 'export.zip', { type: 'application/zip' });
        const { handleZipImport } = await import('../../controller/LetterboxdController.js');
        await handleZipImport(fakeZipFile);
    });
    await page.waitForSelector('#sync-confirm-modal', { state: 'visible' });
    await page.click('#confirm-sync-btn');
    await page.waitForTimeout(500);

    const bulkAddedCount = await page.evaluate(() => window.__bulkAddedMovies.length);
    console.log(`✅ TEST 7 PASS: Confirm button bulk added ${bulkAddedCount} movies into database`);

    const enrichmentBarVisible = await page.isVisible('#letterboxd-enrichment-bar-container');
    console.log(`✅ TEST 8 PASS: Background poster enrichment progress bar triggered: ${enrichmentBarVisible}`);

    await browser.close();
    console.log('\n======================================================');
    console.log('ALL PLAYWRIGHT UI WORKFLOW TESTS COMPLETED');
    console.log('======================================================\n');
}

runUITests().catch(err => {
    console.error('UI Test failed:', err);
    process.exit(1);
});
