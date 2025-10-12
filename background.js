// ============================================================================
// BACKGROUND SERVICE WORKER - Performance Optimized
// ============================================================================

const CONFIG = {
    HISTORY_DAYS: 30,           // Reduced from 365 to 30 days
    MAX_HISTORY_ITEMS: 1000,    // Reduced from 10000 to 1000
    UPDATE_INTERVAL: 5 * 60 * 1000, // Update every 5 minutes
    MAX_SITES: 40,
    STORAGE_KEYS: {
        SITES: 'sites',
        IGNORED: 'ignoredUrls',
        FAVICONS: 'favIconUrls',
        CACHE: 'historyCache',
        CACHE_TIME: 'historyCacheTime'
    }
};

// ============================================================================
// HISTORY MANAGER - Background Updates
// ============================================================================

class HistoryManager {
    constructor() {
        this.isUpdating = false;
        this.lastUpdateTime = 0;
    }

    async updateCache() {
        if (this.isUpdating) return;

        this.isUpdating = true;
        try {
            const historyItems = await this._fetchHistory();
            const processedData = await this._processHistory(historyItems);

            await chrome.storage.local.set({
                [CONFIG.STORAGE_KEYS.CACHE]: JSON.stringify(processedData),
                [CONFIG.STORAGE_KEYS.CACHE_TIME]: Date.now()
            });

            this.lastUpdateTime = Date.now();
            console.log('History cache updated successfully');
        } catch (error) {
            console.error('Failed to update history cache:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    async _fetchHistory() {
        const startTime = Date.now() - (CONFIG.HISTORY_DAYS * 24 * 60 * 60 * 1000);
        return new Promise((resolve) => {
            chrome.history.search({
                text: '',
                startTime,
                maxResults: CONFIG.MAX_HISTORY_ITEMS
            }, resolve);
        });
    }

    async _processHistory(historyItems) {
        const { ignoredUrls } = await chrome.storage.sync.get(CONFIG.STORAGE_KEYS.IGNORED);
        const ignored = ignoredUrls ? new Set(JSON.parse(ignoredUrls)) : new Set();

        const historyMap = new Map();

        historyItems.forEach(item => {
            try {
                const url = new URL(item.url);
                if (!['http:', 'https:'].includes(url.protocol)) return;

                const normalizedUrl = item.url.replace(/\/$/, '');
                if (ignored.has(normalizedUrl)) return;

                if (historyMap.has(normalizedUrl)) {
                    historyMap.get(normalizedUrl).visitCount += item.visitCount;
                } else {
                    historyMap.set(normalizedUrl, {
                        url: normalizedUrl,
                        title: item.title || url.hostname,
                        visitCount: item.visitCount
                    });
                }
            } catch (error) {
                // Skip invalid URLs
            }
        });

        return Array.from(historyMap.values())
            .sort((a, b) => b.visitCount - a.visitCount)
            .slice(0, CONFIG.MAX_SITES);
    }

    startPeriodicUpdates() {
        // Initial update
        this.updateCache();

        // Periodic updates
        setInterval(() => {
            this.updateCache();
        }, CONFIG.UPDATE_INTERVAL);
    }
}

// ============================================================================
// FAVICON MANAGER - Capture Real Favicons
// ============================================================================

chrome.tabs.onUpdated.addListener(async (_, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    try {
        const { sites, favIconUrls } = await chrome.storage.sync.get([
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

            await chrome.storage.sync.set({
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

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "openNewTab") {
        chrome.tabs.create({ url: request.url });
    } else if (request.action === "updateHistoryCache") {
        historyManager.updateCache().then(() => {
            sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
    }
});

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

chrome.commands.onCommand.addListener((command) => {
    if (command === "quick_search" || command === "direct_search") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
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

const historyManager = new HistoryManager();
historyManager.startPeriodicUpdates();
