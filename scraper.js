const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'https://hiring.idenhq.com/challenge'; // Replace with actual application URL
const USERNAME = 'your-username';
const PASSWORD = 'your-password';
const SESSION_STORAGE_FILE = 'session.json';
const OUTPUT_FILE = 'products.json';

(async () => {
    let browser;
    try {
        browser = await chromium.launch({
            executablePath: "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe", // Change this if needed
            headless: false
        });
    } catch (error) {
        console.log("Chrome not found, using Playwright's default Chromium.");
        browser = await chromium.launch({ headless: false });
    }

    const context = await browser.newContext();

    // Load session storage if it exists
    if (fs.existsSync(SESSION_STORAGE_FILE)) {
        const storageState = JSON.parse(fs.readFileSync(SESSION_STORAGE_FILE, 'utf8'));
        await context.addCookies(storageState.cookies);
        console.log("Loaded existing session.");
    }

    const page = await context.newPage();
    await page.goto(BASE_URL);

    // Check if session is valid (e.g., look for logout button or dashboard element)
    if (!(await page.locator('text=Logout').isVisible())) {
        console.log("Session expired. Logging in...");

        // Perform login
        await page.fill('input[name="username"]', USERNAME);
        await page.fill('input[name="password"]', PASSWORD);
        await page.click('button[type="submit"]');

        // Wait for navigation
        await page.waitForSelector('text=Dashboard');

        // Save session storage
        const cookies = await context.cookies();
        fs.writeFileSync(SESSION_STORAGE_FILE, JSON.stringify({ cookies }, null, 2));
    }

    // Navigate to the product data table
    await page.click('text=Tools');
    await page.click('text=Data');
    await page.click('text=Inventory');
    await page.click('text=Products');

    // Wait for table to load
    await page.waitForSelector('table');

    // Extract product data
    let products = [];
    let nextPage = true;

    while (nextPage) {
        const rows = await page.$$('table tbody tr');
        for (let row of rows) {
            const columns = await row.$$('td');
            let productData = await Promise.all(columns.map(col => col.innerText()));
            products.push({
                id: productData[0],
                name: productData[1],
                price: productData[2],
                stock: productData[3],
            });
        }

        // Check for next page button and click if available
        if (await page.locator('button:has-text("Next")').isVisible()) {
            await page.click('button:has-text("Next")');
            await page.waitForTimeout(2000); // Wait for new data to load
        } else {
            nextPage = false;
        }
    }

    // Save data to JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(products, null, 2));
    console.log("Product data saved successfully!");

    await browser.close();
})();
