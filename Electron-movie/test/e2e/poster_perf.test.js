const { chromium } = require('playwright');
const path = require('path');

async function profilePosterModal() {
    console.log('\n======================================================');
    console.log('INVESTIGATING POSTER MODAL PERFORMANCE WITH PLAYWRIGHT');
    console.log('======================================================\n');

    const browser = await chromium.launch({
        headless: true,
        args: ['--allow-file-access-from-files', '--no-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    const networkRequests = [];
    page.on('request', req => {
        networkRequests.push({
            url: req.url(),
            method: req.method(),
            startTime: Date.now()
        });
    });

    page.on('response', res => {
        const item = networkRequests.find(r => r.url === res.url() && !r.endTime);
        if (item) {
            item.endTime = Date.now();
            item.duration = item.endTime - item.startTime;
            item.status = res.status();
        }
    });

    page.on('requestfailed', req => {
        const item = networkRequests.find(r => r.url === req.url() && !r.endTime);
        if (item) {
            item.endTime = Date.now();
            item.duration = item.endTime - item.startTime;
            item.failed = true;
            item.failure = req.failure() ? req.failure().errorText : 'Unknown failure';
        }
    });

    page.on('console', msg => {
        console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
    });

    // Provide electronAPI mock
    await page.addInitScript(() => {
        window.__mockDbMovies = [
            {
                entryId: 'seed-prestige-2006',
                id: 1124,
                title: 'The Prestige',
                release_date: '2006-10-19',
                poster_path: '/Ag2B2KHKQPukjH7WutmgnnSNurZ.jpg',
                genres: ['Drama', 'Mystery'],
                director: 'Christopher Nolan',
                score: 82,
                userRating: 4.5,
                watchDate: '2024-01-01',
                format: 'Cinema'
            }
        ];

        window.electronAPI = {
            invoke: async (channel, ...args) => {
                if (channel === 'db:get-all' || channel === 'read-json') return window.__mockDbMovies;
                if (channel === 'get-api-key') return null; // Uses Cloudflare Worker proxy
                if (channel === 'is-dev') return true;
                if (channel === 'get-app-settings') return {};
                if (channel === 'get-backup-settings') return {};
                if (channel === 'get-letterboxd-settings') return {};
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
    console.log(`Navigating to: ${htmlPath}`);
    await page.goto(htmlPath);
    await page.waitForTimeout(500);

    // Open Info Modal for The Prestige
    console.log('1. Opening Info Modal for The Prestige...');
    const movieCard = await page.waitForSelector('.movie-card');
    await movieCard.click();

    // Click Edit button to enter Details Modal
    console.log('2. Clicking Edit button to open Details Modal...');
    await page.waitForSelector('#movie-info-modal', { state: 'visible' });
    await page.click('#edit-btn');
    await page.waitForSelector('#movie-details-modal', { state: 'visible' });

    // Now profile clicking "Fetch Poster" (#show-poster-btn)
    console.log('3. Clicking "Fetch Poster" (#show-poster-btn) and measuring latency...');
    const clickStart = Date.now();

    await page.click('#show-poster-btn');

    // Wait for Poster Modal to appear
    await page.waitForSelector('#poster-modal', { state: 'visible', timeout: 15000 });
    const modalVisibleTime = Date.now() - clickStart;
    console.log(`⏱️ Poster Modal became visible in: ${modalVisibleTime}ms`);

    // Count rendered poster items
    const posterItems = await page.$$('.poster-item');
    console.log(`🖼️ Rendered poster items count: ${posterItems.length}`);

    // Wait a moment for images to load
    console.log('4. Waiting 2s for initial w342 poster image requests...');
    await page.waitForTimeout(2000);

    // 5. Test mouse-wheel scrolling
    console.log('5. Simulating fast mouse-wheel scrolling over poster grid...');
    const gridBox = await (await page.$('#poster-grid')).boundingBox();
    if (gridBox) {
        await page.mouse.move(gridBox.x + gridBox.width / 2, gridBox.y + gridBox.height / 2);
        const scrollStart = Date.now();
        for (let i = 0; i < 5; i++) {
            await page.mouse.wheel(0, 400);
            await page.waitForTimeout(100);
        }
        console.log(`🌀 Mouse wheel scrolling completed in: ${Date.now() - scrollStart}ms`);
    }

    await page.waitForTimeout(500);
    const postScrollItems = await page.$$('.poster-item');
    console.log(`🖼️ Poster items count after infinite scroll: ${postScrollItems.length}`);

    // 6. Select a poster from the grid
    console.log('6. Selecting a poster from the grid...');
    await postScrollItems[1].click();

    // Verify modal closed
    const isModalVisible = await page.isVisible('#poster-modal');
    console.log(`✅ Poster Modal closed after selection: ${!isModalVisible}`);

    // Verify custom poster input was populated
    const customPosterValue = await page.$eval('#custom-poster-input', el => el.value);
    console.log(`✅ Custom poster input populated with: ${customPosterValue}`);

    const totalTime = Date.now() - clickStart;
    console.log(`⏱️ Total benchmark time: ${totalTime}ms`);

    console.log('\n--- NETWORK REQUEST SUMMARY ---');
    for (const req of networkRequests) {
        const shortUrl = req.url.length > 80 ? req.url.slice(0, 77) + '...' : req.url;
        console.log(`- [${req.method}] ${shortUrl} -> Status: ${req.status || 'pending'} | Duration: ${req.duration ? req.duration + 'ms' : 'N/A'}${req.failed ? ' FAILED: ' + req.failure : ''}`);
    }

    await browser.close();
    console.log('\n======================================================\n');
}

profilePosterModal().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
