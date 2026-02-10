import { BrowserOperator } from '../packages/browser/src/index';

async function verify() {
    console.log("Verifying session persistence...");
    // Using headless: false to match the persistent profile settings and avoid detection,
    // though this will briefly open a window.
    const browser = new BrowserOperator({ headless: false });
    await browser.init();

    console.log("Navigating to Gmail...");
    // If logged in, this should load the inbox. If not, it redirects to accounts.google.com
    await browser.navigate('https://mail.google.com/mail/u/0/#inbox');

    // Give it a moment to settle/redirect
    await new Promise(r => setTimeout(r, 5000));

    const screenshot = await browser.screenshot();
    console.log(`Snapshot taken. Check ${screenshot.screenshotPath} to see if you are logged in.`);

    await browser.close();
}

verify().catch(console.error);
