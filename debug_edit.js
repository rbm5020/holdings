const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Listen for console logs
  page.on('console', msg => {
    console.log('BROWSER LOG:', msg.text());
  });

  // Listen for page errors
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
  });

  // Navigate to the edit URL
  console.log('Navigating to edit URL...');
  await page.goto('https://holdings-ten.vercel.app/edit/46gpge2/hhil5zdgdwet2faixfk0d');

  // Wait a bit for any async operations
  await page.waitForTimeout(3000);

  // Check if there's an error message visible
  const errorElements = await page.locator('text=Error').count();
  if (errorElements > 0) {
    console.log('Found error elements on page');
  }

  // Check page title to see if edit mode was detected
  const title = await page.title();
  console.log('Page title:', title);

  // Check if the submit button changed to "Update Portfolio"
  const buttonText = await page.locator('button[type="submit"]').textContent();
  console.log('Submit button text:', buttonText);

  // Keep browser open for inspection
  console.log('Check the browser window for any visible errors...');
  await page.waitForTimeout(10000);

  await browser.close();
})();