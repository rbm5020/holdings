import { chromium } from 'playwright';

async function testPortfolioCreation() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        console.log('🚀 Testing portfolio creation...');

        // Navigate to the site
        await page.goto('https://www.myholdings.me');
        await page.waitForTimeout(2000);

        // Fill out the first ticker input
        const tickerInputs = await page.$$('.ticker-input');
        const quantityInputs = await page.$$('input[type="number"]');

        if (tickerInputs.length > 0 && quantityInputs.length > 0) {
            console.log('📝 Filling out portfolio form...');

            // Fill first holding
            await tickerInputs[0].fill('AAPL');
            await quantityInputs[0].fill('10');

            // Fill second holding
            if (tickerInputs.length > 1) {
                await tickerInputs[1].fill('TSLA');
                await quantityInputs[1].fill('5');
            }

            console.log('✅ Form filled out');
        }

        // Set up API monitoring
        let apiCalls = [];
        page.on('response', response => {
            if (response.url().includes('/api/')) {
                apiCalls.push({
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText()
                });
                console.log(`📡 API Call: ${response.status()} ${response.url()}`);
            }
        });

        // Monitor console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`🔴 Console Error: ${msg.text()}`);
            }
        });

        // Click Create Portfolio
        const createBtn = await page.$('.submit-btn');
        if (createBtn) {
            console.log('🎯 Clicking Create Portfolio button...');
            await createBtn.click();

            // Wait for response
            await page.waitForTimeout(5000);

            console.log(`🌐 Current URL after creation: ${page.url()}`);
            console.log('📡 API Calls made:', apiCalls);

            // Check if we got redirected to success page
            if (page.url().includes('success')) {
                console.log('✅ Successfully redirected to success page!');
            } else {
                console.log('⚠️ Did not redirect to success page');
            }

            // Take final screenshot
            await page.screenshot({ path: 'test-final-result.png' });
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        await page.screenshot({ path: 'test-error.png' });
    } finally {
        await browser.close();
    }
}

testPortfolioCreation();