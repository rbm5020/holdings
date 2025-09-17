import { chromium } from 'playwright';

async function testAndFixPortfolio() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        console.log('🔍 Testing restored version...');

        // Navigate to the site
        await page.goto('https://www.myholdings.me');
        console.log('✅ Site loaded');

        // Wait for page to load
        await page.waitForTimeout(2000);

        // Take screenshot of current state
        await page.screenshot({ path: 'debug-current-state.png' });
        console.log('📸 Screenshot taken');

        // Check if we're on creator page
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);

        // Look for portfolio creation elements
        const createButton = await page.$('.submit-btn');
        if (createButton) {
            console.log('✅ Found create button');
        } else {
            console.log('❌ No create button found');
        }

        // Try to create a simple portfolio
        console.log('🏗️ Attempting to create portfolio...');

        // Fill in a basic holding - look for ticker input
        const tickerInputs = await page.$$('input[placeholder*="ticker"], input[placeholder*="symbol"]');
        if (tickerInputs.length > 0) {
            console.log(`📝 Found ${tickerInputs.length} ticker inputs`);
            await tickerInputs[0].fill('AAPL');

            // Look for quantity input
            const quantityInputs = await page.$$('input[type="number"], input[placeholder*="quantity"]');
            if (quantityInputs.length > 0) {
                await quantityInputs[0].fill('10');
                console.log('📝 Filled ticker and quantity');
            }
        }

        // Try to submit
        if (createButton) {
            console.log('🚀 Clicking create button...');

            // Listen for network requests
            page.on('response', response => {
                if (response.url().includes('/api/')) {
                    console.log(`📡 API Response: ${response.status()} - ${response.url()}`);
                }
            });

            await createButton.click();
            console.log('✅ Clicked create button');

            // Wait for potential redirect or response
            await page.waitForTimeout(3000);

            // Check current URL
            const currentUrl = page.url();
            console.log(`🌐 Current URL: ${currentUrl}`);

            // Take screenshot after attempt
            await page.screenshot({ path: 'debug-after-create.png' });
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        await page.screenshot({ path: 'debug-error.png' });
    } finally {
        await browser.close();
    }
}

testAndFixPortfolio();