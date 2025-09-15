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
  await page.goto('http://localhost:3000/edit/ripbxt1/fx3d03mt7up65b4m33mjhi');

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
  try {
    const buttonText = await page.locator('button[type="submit"]').textContent({ timeout: 5000 });
    console.log('Submit button text:', buttonText);
  } catch (error) {
    console.log('Submit button not found, checking all buttons...');
    const allButtons = await page.locator('button').allTextContents();
    console.log('All button texts:', allButtons);
  }

  // Keep browser open for inspection
  console.log('Check the browser window for any visible errors...');
  await page.waitForTimeout(10000);

  await browser.close();
})();