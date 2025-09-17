import { chromium } from 'playwright';

async function debugForm() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        await page.goto('https://www.myholdings.me');
        await page.waitForTimeout(2000);

        console.log('🔍 Analyzing form structure...');

        // Get all form elements
        const allInputs = await page.$$eval('input', inputs =>
            inputs.map(input => ({
                type: input.type,
                placeholder: input.placeholder,
                id: input.id,
                class: input.className
            }))
        );

        console.log('📝 Found inputs:', allInputs);

        // Get all buttons
        const allButtons = await page.$$eval('button', buttons =>
            buttons.map(button => ({
                text: button.textContent,
                id: button.id,
                class: button.className
            }))
        );

        console.log('🔘 Found buttons:', allButtons);

        // Check for spreadsheet structure
        const spreadsheetRows = await page.$$('.spreadsheet-row');
        console.log(`📊 Found ${spreadsheetRows.length} spreadsheet rows`);

        if (spreadsheetRows.length === 0) {
            console.log('⚠️ No spreadsheet rows found - need to add holdings first');

            // Look for "Add Holdings" button
            const addBtn = await page.$('.add-btn');
            if (addBtn) {
                console.log('✅ Found Add Holdings button - clicking it');
                await addBtn.click();
                await page.waitForTimeout(1000);

                // Check again for spreadsheet rows
                const newRows = await page.$$('.spreadsheet-row');
                console.log(`📊 After clicking: ${newRows.length} spreadsheet rows`);

                if (newRows.length > 0) {
                    // Try to fill the first row
                    const tickerInput = await page.$('.spreadsheet-row input[placeholder*="ticker"], .spreadsheet-row input[placeholder*="AAPL"]');
                    const quantityInput = await page.$('.spreadsheet-row input[type="number"]');

                    if (tickerInput && quantityInput) {
                        console.log('📝 Filling out portfolio...');
                        await tickerInput.fill('AAPL');
                        await quantityInput.fill('10');

                        // Now try create
                        const createBtn = await page.$('.submit-btn');
                        if (createBtn) {
                            console.log('🚀 Creating portfolio...');

                            // Monitor API calls
                            page.on('response', response => {
                                if (response.url().includes('/api/')) {
                                    console.log(`📡 API: ${response.status()} ${response.url()}`);
                                }
                            });

                            await createBtn.click();
                            await page.waitForTimeout(3000);

                            console.log(`🌐 Final URL: ${page.url()}`);
                        }
                    }
                }
            }
        }

        await page.screenshot({ path: 'debug-form-analysis.png' });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

debugForm();