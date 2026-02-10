import { chromium } from 'playwright';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function run() {
    console.log("Starting debug script...");
    const userDataDir = join(process.cwd(), 'debug_profile');
    if (!existsSync(userDataDir)) {
        mkdirSync(userDataDir, { recursive: true });
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

    console.log("Launched. Page count:", context.pages().length);
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    console.log("Navigating...");
    await page.goto("https://www.google.com");
    console.log("Navigated. Title:", await page.title());

    console.log("Leaving open for 10s...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log("Closing...");
    await context.close();
    console.log("Done.");
}

run().catch(console.error);
