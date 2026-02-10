const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
    console.log("Starting browser debug script...");

    const userDataDir = path.join(__dirname, 'browser_debug_profile');
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }

    console.log("Launching persistent context...");
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-infobars',
        ]
    });

    console.log("Browser launched. Opening page...");
    const page = await context.newPage();
    await page.goto('https://www.google.com');
    console.log("Navigated to Google.");

    console.log("Waiting for manual close or 30 seconds...");

    // Keep process alive
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("Closing context...");
    await context.close();
    console.log("Done.");
}

run().catch(console.error);
