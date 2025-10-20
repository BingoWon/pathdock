// ============================================================================
// SITE MANAGER - Simplified Manual-Only Version
// ============================================================================
// Note: browserAPI is defined in browserAPI.js (loaded before this file)

const CONFIG = {
    MAX_SITES: 48,
    STORAGE_KEYS: {
        SITES: 'sites',
        FAVICONS: 'favIconUrls'
    },
    NEW_TAB_URLS: [
        // Safari new tab URLs
        'favorites://',
        'about:blank',
        'https://www.apple.com/startpage/',

        // Chrome new tab URLs
        'chrome://newtab/',
        'chrome-search://local-ntp/local-ntp.html',

        // Edge new tab URLs
        'edge://newtab/',

        // Firefox new tab URLs
        'about:newtab',
        'about:home',

        // Other possible variants
        'about:privatebrowsing',
        'chrome://new-tab-page/',
        'edge://new-tab-page/'
    ]
};

// ============================================================================
// STORAGE MANAGER - Handle chrome.storage.sync operations
// ============================================================================

class SiteStorage {
    static async loadSites() {
        const result = await browserAPI.storage.sync.get(CONFIG.STORAGE_KEYS.SITES);
        const data = result[CONFIG.STORAGE_KEYS.SITES];
        return data ? JSON.parse(data).sites || [] : [];
    }

    static async saveSites(sites) {
        const data = {
            sites: sites,
            lastModified: Date.now()
        };
        await browserAPI.storage.sync.set({
            [CONFIG.STORAGE_KEYS.SITES]: JSON.stringify(data)
        });
    }

    static async loadFavicons() {
        const result = await browserAPI.storage.sync.get(CONFIG.STORAGE_KEYS.FAVICONS);
        return result[CONFIG.STORAGE_KEYS.FAVICONS] ? JSON.parse(result[CONFIG.STORAGE_KEYS.FAVICONS]) : {};
    }
}

// ============================================================================
// SITE LIST - Business logic for managing sites
// ============================================================================

class SiteList {
    constructor() {
        this.sites = [];
        this.favicons = {};
    }

    async initialize() {
        this.sites = await SiteStorage.loadSites();
        this.favicons = await SiteStorage.loadFavicons();
    }

    async addSite(url, title, favicon = null) {
        // Check if site already exists
        const existingIndex = this.sites.findIndex(s => s.url === url);
        if (existingIndex !== -1) {
            return false; // Already exists
        }

        // Check max sites limit
        if (this.sites.length >= CONFIG.MAX_SITES) {
            alert(`Cannot add more than ${CONFIG.MAX_SITES} sites.`);
            return false;
        }

        // Add new site
        const site = {
            url: url,
            title: title || new URL(url).hostname,
            position: this.sites.length
        };

        this.sites.push(site);
        await SiteStorage.saveSites(this.sites);
        return true;
    }

    async removeSite(url) {
        const index = this.sites.findIndex(s => s.url === url);
        if (index === -1) return false;

        this.sites.splice(index, 1);
        
        // Update positions
        this.sites.forEach((site, idx) => {
            site.position = idx;
        });

        await SiteStorage.saveSites(this.sites);
        return true;
    }

    async moveSite(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || fromIndex >= this.sites.length) return;
        if (toIndex < 0 || toIndex >= this.sites.length) return;

        const [movedSite] = this.sites.splice(fromIndex, 1);
        this.sites.splice(toIndex, 0, movedSite);

        // Update positions
        this.sites.forEach((site, idx) => {
            site.position = idx;
        });

        await SiteStorage.saveSites(this.sites);
    }

    getSites() {
        return [...this.sites];
    }

    getFavicon(url) {
        try {
            const urlObj = new URL(url);
            const hostnameWithPort = `${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
            return this.favicons[hostnameWithPort] || `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
        } catch {
            return `https://www.google.com/s2/favicons?domain=${url}&sz=32`;
        }
    }
}

// ============================================================================
// UI MANAGER - Render UI and handle user interactions
// ============================================================================

class UIManager {
    constructor(siteList) {
        this.siteList = siteList;
        this.container = document.getElementById('buttons-container');
        this.draggedElement = null;
        this.draggedIndex = null;
    }

    render() {
        const sites = this.siteList.getSites();
        
        // Clear container
        this.container.innerHTML = '';

        // Render sites
        sites.forEach((site, index) => {
            const button = this.createSiteButton(site, index);
            this.container.appendChild(button);
        });

        // Height is now fixed at 600px in CSS (popup.css)
        // Dynamic height adjustment is disabled to maintain fixed popup size
        // requestAnimationFrame(() => {
        //     this.updateHeight();
        // });
    }

    // updateHeight() {
    //     const topBar = document.getElementById('top-bar');
    //     const topBarHeight = topBar ? topBar.offsetHeight : 56;
    //     const bottomPadding = 0;  // No extra bottom padding needed
    //     const containerHeight = this.container.offsetHeight || 0;
    //
    //     const height = topBarHeight + containerHeight + bottomPadding;
    //     document.documentElement.style.height = `${Math.max(height, topBarHeight + bottomPadding)}px`;
    // }

    createSiteButton(site, index) {
        const button = document.createElement('div');
        button.className = 'site-button';
        button.draggable = true;
        button.dataset.index = index;
        button.dataset.url = site.url;

        const favicon = this.siteList.getFavicon(site.url);

        button.innerHTML = `
            <span class="close-btn" title="Remove">×</span>
            <img src="${favicon}" alt="" class="favicon" draggable="false" onerror="this.src='https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32'">
            <div class="site-title">${this.escapeHtml(site.title)}</div>
            <div class="site-url">${this.escapeHtml(this.shortenUrl(site.url))}</div>
        `;

        // Event listeners
        button.addEventListener('click', (e) => this.handleClick(e, site.url));
        button.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
        button.addEventListener('dragover', (e) => this.handleDragOver(e));
        button.addEventListener('drop', (e) => this.handleDrop(e, index));
        button.addEventListener('dragend', () => this.handleDragEnd());

        return button;
    }

    handleClick(e, url) {
        if (e.target.classList.contains('close-btn')) {
            e.stopPropagation();
            this.handleRemove(url);
        } else if (!e.target.closest('.close-btn')) {
            this.handleOpen(url);
        }
    }

    async handleRemove(url) {
        await this.siteList.removeSite(url);
        this.render();
    }

    handleOpen(url) {
        closeAllNewTabs();
        browserAPI.tabs.create({ url: url });
    }

    handleDragStart(e, index) {
        this.draggedElement = e.target;
        this.draggedIndex = index;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    async handleDrop(e, toIndex) {
        e.preventDefault();
        if (this.draggedIndex !== null && this.draggedIndex !== toIndex) {
            await this.siteList.moveSite(this.draggedIndex, toIndex);
            this.render();
        }
    }

    handleDragEnd() {
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }
        this.draggedElement = null;
        this.draggedIndex = null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    shortenUrl(url) {
        try {
            const urlObj = new URL(url);
            let display = urlObj.hostname;
            if (urlObj.pathname !== '/') {
                display += urlObj.pathname;
            }
            return display.length > 40 ? display.substring(0, 37) + '...' : display;
        } catch {
            return url.length > 40 ? url.substring(0, 37) + '...' : url;
        }
    }
}

// ============================================================================
// APP - Main controller
// ============================================================================

class App {
    constructor() {
        this.siteList = new SiteList();
        this.uiManager = null;
    }

    async initialize() {
        try {
            await this.siteList.initialize();
            this.uiManager = new UIManager(this.siteList);
            this.uiManager.render();
            this.setupEventListeners();
            this.listenForStorageChanges();
        } catch (error) {
            console.error('Failed to initialize app:', error);
        }
    }

    setupEventListeners() {
        // Add current tab button
        const addBtn = document.getElementById('add-current-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addCurrentTab());
        }
    }

    async addCurrentTab() {
        try {
            const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab?.url || !this.isValidUrl(tab.url)) {
                alert('Cannot add this page.');
                return;
            }

            const url = tab.url.replace(/\/$/, '');
            const title = tab.title || new URL(url).hostname;

            const added = await this.siteList.addSite(url, title);
            if (added) {
                this.uiManager.render();
            } else {
                alert('This site is already in your list.');
            }
        } catch (error) {
            console.error('Failed to add current tab:', error);
            alert('Failed to add site.');
        }
    }

    isValidUrl(url) {
        return url && (url.startsWith('http://') || url.startsWith('https://'));
    }

    listenForStorageChanges() {
        browserAPI.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync' && changes[CONFIG.STORAGE_KEYS.SITES]) {
                this.handleSyncUpdate();
            }
        });
    }

    async handleSyncUpdate() {
        await this.siteList.initialize();
        this.uiManager.render();
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Close all new tab pages before opening a new URL
 * This provides a cleaner user experience by removing empty tabs
 */
function closeAllNewTabs() {
    browserAPI.tabs.query({}, (tabs) => {
        const tabIds = tabs
            .filter(tab => {
                // Check if tab URL matches any known new tab URL
                const matchesKnownUrl = CONFIG.NEW_TAB_URLS.some(url =>
                    tab.url === url || tab.url.includes(url)
                );

                // Also check for common patterns in URL
                const matchesPattern =
                    tab.url.includes('newtab') ||
                    tab.url.includes('startpage') ||
                    tab.url.includes('new-tab-page');

                return matchesKnownUrl || matchesPattern;
            })
            .map(tab => tab.id);

        if (tabIds.length > 0) {
            browserAPI.tabs.remove(tabIds, () => {
                if (browserAPI.runtime.lastError) {
                    console.log('Error closing tabs:', browserAPI.runtime.lastError.message);
                }
            });
        }
    });
}