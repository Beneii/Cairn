import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
export async function fetchAndExtract(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'CairnResearchBot/1.0 (+https://cairn.ai)'
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article) {
        throw new Error(`Failed to parse content from ${url}`);
    }
    return {
        title: article.title,
        content: article.content,
        textContent: article.textContent,
        excerpt: article.excerpt,
        byline: article.byline
    };
}
//# sourceMappingURL=fetcher.js.map