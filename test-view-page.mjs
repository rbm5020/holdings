import { chromium } from 'playwright';

async function testViewPage() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        console.log('🔍 Testing view page for portfolio 7m37gydrab...');

        // Monitor API calls
        page.on('response', response => {
            if (response.url().includes('/api/')) {
                console.log(`📡 API: ${response.status()} ${response.url()}`);
            }
        });

        // Navigate to the view page
        await page.goto('https://www.myholdings.me/view/7m37gydrab');
        await page.waitForTimeout(3000);

        // Check what's displayed
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);

        // Look for error messages
        const errorMsg = await page.$('text="not found"');
        if (errorMsg) {
            console.log('❌ Found "not found" error on page');
        }

        // Check for loading states
        const loadingText = await page.$('text="Loading"');
        if (loadingText) {
            console.log('⏳ Page showing loading state');
        }

        // Take screenshot
        await page.screenshot({ path: 'view-page-test.png' });

        console.log(`🌐 Final URL: ${page.url()}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

testViewPage();