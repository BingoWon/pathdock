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

browserAPI.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "openNewTab") {
        browserAPI.tabs.create({ url: request.url });
    }
});

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

browserAPI.commands.onCommand.addListener((command) => {
    if (command === "quick_search" || command === "direct_search") {
        browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                browserAPI.tabs.sendMessage(tabs[0].id, {
                    action: "triggerSearch",
                    command: command
                });
            }
        });
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log('Safari Extension: Background script loaded (simplified version)');
