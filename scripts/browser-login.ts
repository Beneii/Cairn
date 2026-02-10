import { BrowserOperator } from '../packages/browser/src/index';

async function main() {
    console.log("Launching Cairn Browser for manual login...");
    console.log("1. Browser will open in HEADED mode.");
    console.log("2. Navigate to https://accounts.google.com");
    console.log("3. Log in, complete MFA, and tick 'Trust this device'.");
    console.log("4. CLOSE the browser window manually when done.");

    const browser = new BrowserOperator({ headless: false });
    await browser.init();

    // Navigate to Google to save a step
    await browser.navigate('https://accounts.google.com');

    // Keep script alive until manually killed or browser closed
    console.log("Waiting... Press Ctrl+C to exit script after you close the browser.");

    // In a real script we might watch for browser close event, 
    // but for this simple helper, keeping process alive is enough.
    await new Promise(() => { });
}

main().catch(console.error);
