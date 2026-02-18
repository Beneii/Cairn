import { chromium } from 'playwright';
import { newId, getDataPath } from '@cairn/shared';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
export class BrowserOperator {
    context = null;
    options;
    sessionDir;
    constructor(options = {}) {
        this.options = {
            headless: false, // Default to headed (hidden) as per user request for evasion
            profileId: 'default',
            ...options
        };
        const baseDir = getDataPath('browser/profiles');
        this.sessionDir = this.options.userDataDir || join(baseDir, this.options.profileId);
        if (!existsSync(this.sessionDir)) {
            mkdirSync(this.sessionDir, { recursive: true });
        }
    }
    async init() {
        if (this.context) {
            console.log("[BrowserOperator] Context already initialized");
            return;
        }
        console.log("[BrowserOperator] Launching persistent context...");
        const launchOptions = {
            headless: this.options.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-infobars',
                // Additional hardening can go here
            ]
        };
        // Use launchPersistentContext instead of launch + newContext
        // Disable signal handling so the browser doesn't close if the parent process receives a signal (we handle it manually if needed)
        this.context = await chromium.launchPersistentContext(this.sessionDir, {
            ...launchOptions,
            viewport: { width: 1280, height: 800 },
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false,
        });
        console.log("[BrowserOperator] Context launched. Pages:", this.context.pages().length);
        // Prevent auto-closing if possible (though persistent contexts shouldn't auto-close)
        this.context.on("close", () => {
            console.log("[BrowserOperator] WARNING: Context closed unexpectedly!");
            this.context = null;
        });
    }
    async close() {
        if (this.context) {
            console.log("[BrowserOperator] Closing context...");
            await this.context.close();
            this.context = null;
            console.log("[BrowserOperator] Context closed");
        }
    }
    async getPage() {
        if (!this.context)
            throw new Error('Browser not initialized');
        const pages = this.context.pages();
        return pages.length > 0 ? pages[0] : await this.context.newPage();
    }
    isDomainAllowed(url) {
        if (!this.options.domainAllowlist)
            return true;
        try {
            const parsed = new URL(url);
            return this.options.domainAllowlist.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain));
        }
        catch {
            return false;
        }
    }
    async navigate(url) {
        if (!this.isDomainAllowed(url)) {
            return { success: false, message: `Domain ${url} is not in allowlist` };
        }
        const page = await this.getPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            return { success: true, message: `Navigated to ${url}` };
        }
        catch (err) {
            return { success: false, message: `Navigation failed: ${err}` };
        }
    }
    async click(selector) {
        const page = await this.getPage();
        try {
            await page.click(selector);
            return { success: true, message: `Clicked ${selector}` };
        }
        catch (err) {
            return { success: false, message: `Click failed: ${err}` };
        }
    }
    async fill(selector, value) {
        const page = await this.getPage();
        try {
            await page.fill(selector, value);
            return { success: true, message: `Filled ${selector}` };
        }
        catch (err) {
            return { success: false, message: `Fill failed: ${err}` };
        }
    }
    async extract(selector) {
        const page = await this.getPage();
        try {
            const data = await page.innerText(selector);
            return { success: true, data, message: `Extracted from ${selector}` };
        }
        catch (err) {
            return { success: false, message: `Extraction failed: ${err}` };
        }
    }
    async type(selector, text, delay = 50) {
        const page = await this.getPage();
        try {
            const locator = page.locator(selector).first();
            await locator.waitFor({ state: 'visible', timeout: 15000 });
            await locator.click();
            await locator.fill(''); // Clear existing text
            await locator.pressSequentially(text, { delay });
            return { success: true, message: `Typed "${text}" into ${selector}` };
        }
        catch (err) {
            return { success: false, message: `Type failed: ${err}` };
        }
    }
    async press(key) {
        const page = await this.getPage();
        try {
            await page.keyboard.press(key);
            return { success: true, message: `Pressed ${key}` };
        }
        catch (err) {
            return { success: false, message: `Press failed: ${err}` };
        }
    }
    async screenshot() {
        const page = await this.getPage();
        const path = join(this.sessionDir, `screenshot-${newId()}.png`);
        try {
            await page.screenshot({ path });
            return { success: true, message: 'Screenshot captured', screenshotPath: path };
        }
        catch (err) {
            return { success: false, message: `Screenshot failed: ${err}` };
        }
    }
    /**
     * Observe the current page and return a structured summary of interactive elements.
     * This acts as a "screen reader" for the LLM.
     */
    async observe() {
        const page = await this.getPage();
        try {
            const url = page.url();
            const title = await page.title();
            // Extract interactive elements using a client-side script
            const elements = await page.evaluate(() => {
                const results = [];
                const interactives = document.querySelectorAll('button, input, a, select, textarea, [role="button"], [role="link"]');
                interactives.forEach((el, index) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    // Skip hidden or tiny elements
                    if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
                        return;
                    }
                    results.push({
                        id: `el-${index}`,
                        tag: el.tagName.toLowerCase(),
                        text: el.textContent?.trim().substring(0, 100) || el.placeholder || el.value || '',
                        type: el.type || '',
                        role: el.getAttribute('role') || '',
                        aria: el.getAttribute('aria-label') || '',
                        name: el.getAttribute('name') || '',
                        href: el.href || '',
                        // CSS selector for internal use by the agent
                        selector: (() => {
                            if (el.id)
                                return `#${el.id}`;
                            if (el.getAttribute('name'))
                                return `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
                            // Fallback to a fragile but usable path if needed, or just encourage better selectors in prompt
                            return '';
                        })()
                    });
                });
                return results;
            });
            return { success: true, url, title, elements: elements.slice(0, 50) }; // Cap to 50 elements
        }
        catch (err) {
            return { success: false, url: '', title: '', elements: [] };
        }
    }
}
//# sourceMappingURL=index.js.map