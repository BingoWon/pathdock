// ============================================================================
// SAFARI EXTENSION BACKGROUND SCRIPT (Simplified)
// ============================================================================

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

const CONFIG = {
    STORAGE_KEYS: {
        SITES: 'sites',
        FAVICONS: 'favIconUrls'
    }
};

// ============================================================================
// FAVICON MANAGER - Capture Real Favicons
// ============================================================================

browserAPI.tabs.onUpdated.addListener(async (_, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    try {
        const { sites, favIconUrls } = await browserAPI.storage.sync.get([
            CONFIG.STORAGE_KEYS.SITES,
            CONFIG.STORAGE_KEYS.FAVICONS
        ]);

        const sitesList = sites ? JSON.parse(sites).sites || [] : [];
        const favicons = favIconUrls ? JSON.parse(favIconUrls) : {};

        const url = new URL(tab.url);
        const normalizedUrl = tab.url.replace(/\/$/, '');
        const hostnameWithPort = `${url.hostname}${url.port ? ':' + url.port : ''}`;

        // Check if this URL is in our sites list
        const foundSite = sitesList.find(site => site && site.url === normalizedUrl);

        if (foundSite && tab.favIconUrl) {
            favicons[hostnameWithPort] = tab.favIconUrl;

            await browserAPI.storage.sync.set({
                [CONFIG.STORAGE_KEYS.FAVICONS]: JSON.stringify(favicons)
            });
        }
    } catch (error) {
        // Silently fail for invalid URLs
    }
});

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "openNewTab") {
        browserAPI.tabs.create({ url: request.url });
    }
});

// ============================================================================
// TEXT PROCESSING UTILITIES
// ============================================================================

function cleanText(text) {
    if (!text) return '';

    let cleaned = text.trim();
    cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');
    cleaned = cleaned.replace(/^\(+|\)+$/g, '');
    cleaned = cleaned.replace(/^\[+|\]+$/g, '');
    cleaned = cleaned.replace(/^\{+|\}+$/g, '');
    cleaned = cleaned.replace(/^[.,;:!?]+|[.,;:!?]+$/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned;
}

function isValidUrl(text) {
    if (text.includes(' ')) return false;

    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        // Not a complete URL, continue checking
    }

    if (!text.includes('.')) return false;

    const commonTLDs = [
        '.com', '.org', '.net', '.edu', '.gov', '.io', '.co',
        '.cn', '.de', '.uk', '.ru', '.jp', '.fr', '.it', '.es',
        '.au', '.ca', '.in', '.nl', '.br', '.tv', '.info', '.biz',
        '.me', '.app', '.dev', '.ai', '.cloud', '.tech', '.online'
    ];

    const hasTLD = commonTLDs.some(tld => text.toLowerCase().endsWith(tld));

    if (!hasTLD) {
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
        if (!ipPattern.test(text)) return false;
    }

    const invalidChars = ['<', '>', '"', '`', '{', '}', '|', '\\', '^', '[', ']'];
    if (invalidChars.some(char => text.includes(char))) return false;

    try {
        const testUrl = new URL('https://' + text);
        return testUrl.hostname.includes('.');
    } catch (e) {
        return false;
    }
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

browserAPI.commands.onCommand.addListener(async (command) => {
    if (command === "quick_search" || command === "direct_search") {
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;

        try {
            const results = await browserAPI.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => window.getSelection().toString()
            });

            const rawText = results[0]?.result || '';
            const cleanedText = cleanText(rawText);

            if (!cleanedText) return;

            let url;
            if (command === "quick_search" && isValidUrl(cleanedText)) {
                url = cleanedText.startsWith('http') ? cleanedText : 'https://' + cleanedText;
            } else {
                url = `https://duckduckgo.com/?q=${encodeURIComponent(cleanedText)}`;
            }

            await browserAPI.tabs.create({ url });
        } catch (error) {
            console.error('Error executing search:', error);
        }
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('Safari Extension: Background script loaded');
