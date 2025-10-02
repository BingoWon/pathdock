// ============================================================================
// MODERN SITE MANAGER - Elegant & Efficient
// ============================================================================

const CONFIG = {
    GRID_COLS: 5,
    GRID_ROWS: 8,
    MAX_SITES: 5 * 8 - 1, // -1 for plus button
    HISTORY_DAYS: 365,
    MAX_HISTORY_ITEMS: 10000,
    DEBOUNCE_MS: 300,
    STORAGE_KEYS: {
        SITES: 'sites',
        IGNORED: 'ignoredUrls',
        FAVICONS: 'favIconUrls'
    }
};

// ============================================================================
// UTILITIES
// ============================================================================

const Utils = {
    isValidUrl(urlString) {
        try {
            const url = new URL(urlString);
            return ['http:', 'https:'].includes(url.protocol);
        } catch {
            return false;
        }
    },

    parseUrl(urlString) {
        if (!this.isValidUrl(urlString)) return null;
        try {
            return new URL(urlString);
        } catch {
            return null;
        }
    },

    normalizeUrl(url) {
        return url.replace(/\/$/, '');
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
};

// ============================================================================
// STORAGE MANAGER
// ============================================================================

class StorageManager {
    static _localChangeFlag = false;
    static _localChangeTimer = null;

    static async get(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(key, (data) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(data[key]);
                }
            });
        });
    }

    static async set(key, value) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    static async remove(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.remove(key, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    static async getSitesData() {
        const data = await this.get(CONFIG.STORAGE_KEYS.SITES);
        if (!data) {
            return { sites: [], lastModified: 0, deviceId: null };
        }
        return JSON.parse(data);
    }

    static async setSites(sites, isLocalChange = true) {
        const payload = {
            sites,
            lastModified: Date.now(),
            deviceId: this._getDeviceId()
        };

        if (isLocalChange) {
            this._markLocalChange();
        }

        await this.set(CONFIG.STORAGE_KEYS.SITES, JSON.stringify(payload));
    }

    static async getIgnoredUrls() {
        const data = await this.get(CONFIG.STORAGE_KEYS.IGNORED);
        return data ? new Set(JSON.parse(data)) : new Set();
    }

    static async setIgnoredUrls(ignoredUrls, isLocalChange = true) {
        if (isLocalChange) {
            this._markLocalChange();
        }
        await this.set(CONFIG.STORAGE_KEYS.IGNORED, JSON.stringify([...ignoredUrls]));
    }

    static async getFavicons() {
        const data = await this.get(CONFIG.STORAGE_KEYS.FAVICONS);
        return data ? JSON.parse(data) : {};
    }

    static async setFavicons(favicons) {
        await this.set(CONFIG.STORAGE_KEYS.FAVICONS, JSON.stringify(favicons));
    }

    static async getVersion() {
        return await this.get('version') || 0;
    }

    static async setVersion(version) {
        await this.set('version', version);
    }

    static _getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    static _markLocalChange() {
        this._localChangeFlag = true;
        clearTimeout(this._localChangeTimer);
        this._localChangeTimer = setTimeout(() => {
            this._localChangeFlag = false;
        }, 200);
    }

    static isLocalChange() {
        return this._localChangeFlag;
    }
}

// ============================================================================
// MIGRATION MANAGER - Data Migration System
// ============================================================================

class MigrationManager {
    static CURRENT_VERSION = 1;

    static async migrate() {
        const currentVersion = await StorageManager.getVersion();

        console.log(`📦 Current data version: ${currentVersion}`);

        if (currentVersion < this.CURRENT_VERSION) {
            console.log(`🔄 Starting migration from v${currentVersion} to v${this.CURRENT_VERSION}...`);

            try {
                if (currentVersion === 0) {
                    await this._migrateV0ToV1();
                }

                await StorageManager.setVersion(this.CURRENT_VERSION);
                console.log(`✅ Migration completed successfully!`);
            } catch (error) {
                console.error('❌ Migration failed:', error);
                throw error;
            }
        } else {
            console.log('✅ Data is up to date, no migration needed');
        }
    }

    static async _migrateV0ToV1() {
        console.log('🔄 Migrating v0 → v1: Converting old data format...');

        // 1. Read old data
        const oldPreferredRooms = await this._getOldData('preferredRooms');
        const oldAllocatedRooms = await this._getOldData('allocatedRooms');
        const oldIgnoredSites = await this._getOldData('ignoredSites');

        console.log('📊 Old data found:', {
            preferredRooms: oldPreferredRooms?.length || 0,
            allocatedRooms: oldAllocatedRooms?.length || 0,
            ignoredSites: oldIgnoredSites?.length || 0
        });

        // 2. Convert to new format
        const sites = [];
        const seenUrls = new Set();

        // Priority 1: Migrate preferred rooms (pinned sites)
        if (oldPreferredRooms && Array.isArray(oldPreferredRooms)) {
            oldPreferredRooms.forEach((room, index) => {
                if (room && room.url && Utils.isValidUrl(room.url)) {
                    const url = Utils.normalizeUrl(room.url);
                    if (!seenUrls.has(url)) {
                        sites.push({
                            url,
                            title: room.title || new URL(url).hostname,
                            position: index,
                            isPinned: true,
                            visitCount: 0
                        });
                        seenUrls.add(url);
                    }
                }
            });
        }

        // Priority 2: Migrate allocated rooms (non-pinned sites)
        if (oldAllocatedRooms && Array.isArray(oldAllocatedRooms)) {
            oldAllocatedRooms.forEach((room, index) => {
                if (room && room.url && Utils.isValidUrl(room.url)) {
                    const url = Utils.normalizeUrl(room.url);
                    if (!seenUrls.has(url)) {
                        sites.push({
                            url,
                            title: room.title || new URL(url).hostname,
                            position: index,
                            isPinned: false,
                            visitCount: 0
                        });
                        seenUrls.add(url);
                    }
                }
            });
        }

        // 3. Migrate ignored sites
        const ignoredUrls = new Set();
        if (oldIgnoredSites && Array.isArray(oldIgnoredSites)) {
            oldIgnoredSites.forEach(url => {
                if (url && Utils.isValidUrl(url)) {
                    ignoredUrls.add(Utils.normalizeUrl(url));
                }
            });
        }

        // 4. Save new data (with metadata)
        await StorageManager.setSites(sites, true);
        await StorageManager.setIgnoredUrls(ignoredUrls, true);

        console.log('✅ Migration v0 → v1 completed:', {
            migratedSites: sites.length,
            pinnedSites: sites.filter(s => s.isPinned).length,
            ignoredUrls: ignoredUrls.size
        });

        // 5. Backup old data (optional, for safety)
        await this._backupOldData(oldPreferredRooms, oldAllocatedRooms, oldIgnoredSites);

        // 6. Clean up old data (optional, uncomment if you want to remove old keys)
        // await this._cleanupOldData();
    }

    static async _getOldData(key) {
        try {
            const data = await StorageManager.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn(`Failed to read old data for key "${key}":`, error);
            return null;
        }
    }

    static async _backupOldData(preferredRooms, allocatedRooms, ignoredSites) {
        try {
            const backup = {
                timestamp: Date.now(),
                preferredRooms,
                allocatedRooms,
                ignoredSites
            };
            await StorageManager.set('backup_v0', JSON.stringify(backup));
            console.log('💾 Old data backed up successfully');
        } catch (error) {
            console.warn('Failed to backup old data:', error);
        }
    }

    static async _cleanupOldData() {
        try {
            await StorageManager.remove('preferredRooms');
            await StorageManager.remove('allocatedRooms');
            await StorageManager.remove('ignoredSites');
            console.log('🧹 Old data cleaned up');
        } catch (error) {
            console.warn('Failed to cleanup old data:', error);
        }
    }
}

// ============================================================================
// SYNC MANAGER - Cross-Device Synchronization
// ============================================================================

class SyncManager {
    constructor(app) {
        this.app = app;
        this.isListening = false;
    }

    startListening() {
        if (this.isListening) return;

        chrome.storage.onChanged.addListener((changes, areaName) => {
            this._handleStorageChange(changes, areaName);
        });

        this.isListening = true;
        console.log('🔄 Sync manager started listening for remote changes');
    }

    async _handleStorageChange(changes, areaName) {
        // Only handle sync storage
        if (areaName !== 'sync') return;

        // Ignore local changes (changes we made ourselves)
        if (StorageManager.isLocalChange()) {
            console.log('📝 Local change detected, skipping sync');
            return;
        }

        // Check if sites or ignoredUrls changed
        const sitesChanged = changes[CONFIG.STORAGE_KEYS.SITES];
        const ignoredChanged = changes[CONFIG.STORAGE_KEYS.IGNORED];

        if (!sitesChanged && !ignoredChanged) return;

        console.log('🌐 Remote change detected from another device');

        // Handle sites change
        if (sitesChanged) {
            await this._handleSitesChange(sitesChanged);
        }

        // Handle ignored URLs change
        if (ignoredChanged) {
            await this._handleIgnoredChange(ignoredChanged);
        }

        // Update UI
        await this.app.uiRenderer.render();

        // Show notification
        this._showSyncNotification();
    }

    async _handleSitesChange(change) {
        if (!change.newValue) return;

        const newData = JSON.parse(change.newValue);
        const currentData = await StorageManager.getSitesData();

        // Compare timestamps to determine which data is newer
        if (newData.lastModified > currentData.lastModified) {
            console.log('✅ Applying remote sites data (newer)');
            this.app.siteManager.sites = newData.sites || [];
            this.app.siteManager.lastModified = newData.lastModified;
            this.app.siteManager.deviceId = newData.deviceId;
            this.app.siteManager._rebuildIndex();
        } else {
            console.log('⏭️ Skipping remote sites data (older or same)');
        }
    }

    async _handleIgnoredChange(change) {
        const newValue = change.newValue ? JSON.parse(change.newValue) : [];
        console.log('✅ Applying remote ignored URLs');
        this.app.siteManager.ignoredUrls = new Set(newValue);
    }

    _showSyncNotification() {
        console.log('✨ Data synced from another device');

        // Optional: Show visual notification
        // Could be enhanced with a toast notification in the UI
    }
}

// ============================================================================
// SITE MANAGER - Core Business Logic
// ============================================================================

class SiteManager {
    constructor() {
        this.sites = [];
        this.ignoredUrls = new Set();
        this.sitesByUrl = new Map();
        this.lastModified = 0;
        this.deviceId = null;
    }

    async initialize() {
        try {
            const data = await StorageManager.getSitesData();
            this.sites = data.sites || [];
            this.lastModified = data.lastModified || 0;
            this.deviceId = data.deviceId || null;

            this.ignoredUrls = await StorageManager.getIgnoredUrls();
            this._rebuildIndex();

            await this.updateFromHistory();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.sites = [];
            this.ignoredUrls = new Set();
            this.lastModified = 0;
            this.deviceId = null;
        }
    }

    async reload() {
        const data = await StorageManager.getSitesData();
        this.sites = data.sites || [];
        this.lastModified = data.lastModified || 0;
        this.deviceId = data.deviceId || null;
        this.ignoredUrls = await StorageManager.getIgnoredUrls();
        this._rebuildIndex();
    }

    async updateFromHistory() {
        const historyItems = await this._fetchHistory();
        const mergedSites = this._mergeHistoryWithSites(historyItems);
        this.sites = mergedSites;
        this._rebuildIndex();
        await this.save();
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

    _mergeHistoryWithSites(historyItems) {
        // Build map of history items
        const historyMap = new Map();
        historyItems.forEach(item => {
            if (!Utils.isValidUrl(item.url)) return;
            const url = Utils.normalizeUrl(item.url);
            if (this.ignoredUrls.has(url)) return;

            if (historyMap.has(url)) {
                historyMap.get(url).visitCount += item.visitCount;
            } else {
                historyMap.set(url, {
                    url,
                    title: item.title || new URL(url).hostname,
                    visitCount: item.visitCount
                });
            }
        });

        // Merge with existing pinned sites
        const pinnedSites = this.sites.filter(s => s.isPinned);
        const pinnedUrls = new Set(pinnedSites.map(s => s.url));

        // Get top unpinned sites from history
        const unpinnedHistory = Array.from(historyMap.values())
            .filter(item => !pinnedUrls.has(item.url))
            .sort((a, b) => b.visitCount - a.visitCount);

        // Allocate positions
        const result = new Array(CONFIG.MAX_SITES).fill(null);

        // Place pinned sites first
        pinnedSites.forEach(site => {
            if (site.position >= 0 && site.position < CONFIG.MAX_SITES) {
                result[site.position] = { ...site };
            }
        });

        // Fill empty positions with top history items
        let historyIndex = 0;
        for (let i = 0; i < CONFIG.MAX_SITES; i++) {
            if (!result[i] && historyIndex < unpinnedHistory.length) {
                const item = unpinnedHistory[historyIndex++];
                result[i] = {
                    url: item.url,
                    title: item.title,
                    position: i,
                    isPinned: false,
                    visitCount: item.visitCount
                };
            }
        }

        return result.filter(Boolean);
    }

    _rebuildIndex() {
        this.sitesByUrl.clear();
        this.sites.forEach(site => {
            this.sitesByUrl.set(site.url, site);
        });
    }

    async save() {
        await StorageManager.setSites(this.sites);
        await StorageManager.setIgnoredUrls(this.ignoredUrls);
    }

    getSiteByUrl(url) {
        return this.sitesByUrl.get(Utils.normalizeUrl(url));
    }

    getSiteAtPosition(position) {
        return this.sites.find(s => s.position === position);
    }

    async togglePin(url) {
        const site = this.getSiteByUrl(url);
        if (!site) return;

        site.isPinned = !site.isPinned;
        await this.save();
    }

    async moveSite(fromPosition, toPosition) {
        const site = this.getSiteAtPosition(fromPosition);
        if (!site) return;

        // Update positions
        if (fromPosition < toPosition) {
            // Moving down
            this.sites.forEach(s => {
                if (s.position > fromPosition && s.position <= toPosition) {
                    s.position--;
                }
            });
        } else {
            // Moving up
            this.sites.forEach(s => {
                if (s.position >= toPosition && s.position < fromPosition) {
                    s.position++;
                }
            });
        }

        site.position = toPosition;
        site.isPinned = true; // Auto-pin when manually positioned

        this.sites.sort((a, b) => a.position - b.position);
        await this.save();
    }

    async addCurrentTab() {
        const tabs = await new Promise(resolve => {
            chrome.tabs.query({ active: true, currentWindow: true }, resolve);
        });

        const tab = tabs[0];
        if (!tab?.url || !Utils.isValidUrl(tab.url)) return;

        const url = Utils.normalizeUrl(tab.url);

        // Remove from ignored
        this.ignoredUrls.delete(url);

        // Find or create site
        let site = this.getSiteByUrl(url);
        if (!site) {
            // Find first available position
            const usedPositions = new Set(this.sites.map(s => s.position));
            let position = 0;
            while (usedPositions.has(position) && position < CONFIG.MAX_SITES) {
                position++;
            }

            if (position >= CONFIG.MAX_SITES) return; // No space

            site = {
                url,
                title: tab.title || new URL(url).hostname,
                position,
                isPinned: true,
                visitCount: 0
            };
            this.sites.push(site);
            this.sitesByUrl.set(url, site);
        } else {
            site.isPinned = true;
        }

        await this.save();
    }

    async ignoreSite(url) {
        url = Utils.normalizeUrl(url);
        this.ignoredUrls.add(url);
        this.sites = this.sites.filter(s => s.url !== url);
        this._rebuildIndex();
        await this.save();
    }

    async unignoreSite(url) {
        url = Utils.normalizeUrl(url);
        this.ignoredUrls.delete(url);
        await this.save();
        await this.updateFromHistory();
    }
}

// ============================================================================
// UI RENDERER - Efficient DOM Management
// ============================================================================

class UIRenderer {
    constructor(siteManager) {
        this.siteManager = siteManager;
        this.container = document.getElementById('buttons-container');
        this.buttonElements = new Map(); // url -> button element
        this.draggedElement = null;
        this.draggedUrl = null;

        this._setupEventDelegation();
    }

    _setupEventDelegation() {
        // Event delegation for all button interactions
        this.container.addEventListener('click', (e) => this._handleClick(e));
        this.container.addEventListener('dragstart', (e) => this._handleDragStart(e));
        this.container.addEventListener('dragend', (e) => this._handleDragEnd(e));
        this.container.addEventListener('dragover', (e) => this._handleDragOver(e));
        this.container.addEventListener('drop', (e) => this._handleDrop(e));
    }

    async render() {
        const sites = this.siteManager.sites;
        const existingUrls = new Set(this.buttonElements.keys());
        const currentUrls = new Set(sites.map(s => s.url));

        // Remove buttons for sites that no longer exist
        for (const url of existingUrls) {
            if (!currentUrls.has(url)) {
                this._removeButton(url);
            }
        }

        // Update or create buttons
        sites.forEach(site => {
            if (this.buttonElements.has(site.url)) {
                this._updateButton(site);
            } else {
                this._createButton(site);
            }
        });

        // Reorder DOM to match positions
        this._reorderButtons(sites);

        // Ensure plus button is last
        this._ensurePlusButton();
    }

    _createButton(site) {
        const button = document.createElement('button');
        button.className = 'button';
        button.draggable = true;
        button.dataset.url = site.url;
        button.title = site.url;

        button.innerHTML = `
            <span class="pin-icon ${site.isPinned ? 'pin-icon-preferred' : ''}" data-action="pin">
                <svg class="pin-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M 9,4 C 9,4 8,5 8,6 C 8,7 9,8 9,8 L 6,15 L 9,15 L 11,22 L 13,15 L 16,15 L 13,8
                             C 13,8 14,7 14,6 C 14,5 13,4 13,4 Z"
                          stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </span>
            <span class="close-icon" data-action="close">
                <svg class="close-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 6L18 18M6 18L18 6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </span>
            <img class="icon" src="${this._getFaviconUrl(site.url)}" alt="">
            <span class="title">${site.title}</span>
            <span class="url">${this._formatUrl(site.url)}</span>
        `;

        this.buttonElements.set(site.url, button);
        this.container.appendChild(button);
    }

    _updateButton(site) {
        const button = this.buttonElements.get(site.url);
        if (!button) return;

        const pinIcon = button.querySelector('.pin-icon');
        pinIcon.className = `pin-icon ${site.isPinned ? 'pin-icon-preferred' : ''}`;

        button.querySelector('.title').textContent = site.title;
        button.querySelector('.url').textContent = this._formatUrl(site.url);
        button.querySelector('.icon').src = this._getFaviconUrl(site.url);
    }

    _removeButton(url) {
        const button = this.buttonElements.get(url);
        if (button) {
            button.remove();
            this.buttonElements.delete(url);
        }
    }

    _reorderButtons(sites) {
        const fragment = document.createDocumentFragment();
        sites.forEach(site => {
            const button = this.buttonElements.get(site.url);
            if (button) fragment.appendChild(button);
        });

        // Clear and re-append in correct order
        const plusButton = this.container.querySelector('.plus-button');
        this.container.innerHTML = '';
        this.container.appendChild(fragment);
        if (plusButton) this.container.appendChild(plusButton);
    }

    _ensurePlusButton() {
        let plusButton = this.container.querySelector('.plus-button');
        if (!plusButton) {
            plusButton = document.createElement('button');
            plusButton.className = 'plus-button';
            plusButton.textContent = '➕';
            plusButton.dataset.action = 'add-current';
            this.container.appendChild(plusButton);
        }
    }

    _getFaviconUrl(url) {
        const parsedUrl = Utils.parseUrl(url);
        if (!parsedUrl) return '';

        const hostname = parsedUrl.hostname;
        // GitHub special case
        if (hostname === 'github.com') {
            return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
        }

        // Try to get cached favicon
        return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
    }

    _formatUrl(url) {
        return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }

    async _handleClick(e) {
        // Check if clicked on an action element (pin, close, etc.)
        const actionElement = e.target.closest('[data-action]');

        if (actionElement) {
            // Prevent event bubbling and default behavior immediately
            e.stopPropagation();
            e.preventDefault();

            const action = actionElement.dataset.action;
            switch (action) {
                case 'pin':
                    await this._handlePinClick(e);
                    break;
                case 'close':
                    await this._handleCloseClick(e);
                    break;
                case 'add-current':
                    await this._handleAddCurrent();
                    break;
            }
            return;
        }

        // No action element clicked - open URL
        const button = e.target.closest('.button:not(.plus-button)');
        if (button) {
            closeAllNewTabs();
            chrome.tabs.create({ url: button.dataset.url });
        }
    }

    async _handlePinClick(e) {
        const button = e.target.closest('.button');
        const url = button.dataset.url;
        await this.siteManager.togglePin(url);
        await this.render();
    }

    async _handleCloseClick(e) {
        const button = e.target.closest('.button');
        const url = button.dataset.url;
        await this.siteManager.ignoreSite(url);
        await this.siteManager.updateFromHistory();
        await this.render();
    }

    async _handleAddCurrent() {
        await this.siteManager.addCurrentTab();
        await this.siteManager.updateFromHistory();
        await this.render();
    }

    _handleDragStart(e) {
        const button = e.target.closest('.button:not(.plus-button)');
        if (!button) return;

        this.draggedElement = button;
        this.draggedUrl = button.dataset.url;
        button.style.opacity = '0.5';
    }

    _handleDragEnd(e) {
        if (this.draggedElement) {
            this.draggedElement.style.opacity = '1';
            this.draggedElement = null;
            this.draggedUrl = null;
        }
    }

    _handleDragOver(e) {
        e.preventDefault();
    }

    async _handleDrop(e) {
        e.preventDefault();

        const dropTarget = e.target.closest('.button:not(.plus-button)');
        if (!dropTarget || !this.draggedElement || dropTarget === this.draggedElement) {
            return;
        }

        const buttons = [...this.container.querySelectorAll('.button:not(.plus-button)')];
        const fromIndex = buttons.indexOf(this.draggedElement);
        const toIndex = buttons.indexOf(dropTarget);

        if (fromIndex !== -1 && toIndex !== -1) {
            await this.siteManager.moveSite(fromIndex, toIndex);
            await this.render();
        }
    }
}

// ============================================================================
// APPLICATION CONTROLLER
// ============================================================================

class App {
    constructor() {
        this.siteManager = new SiteManager();
        this.syncManager = new SyncManager(this);
        this.uiRenderer = null;
        this.updateDebounced = Utils.debounce(() => this.update(), CONFIG.DEBOUNCE_MS);
    }

    async initialize() {
        try {
            // Step 1: Run data migration first
            console.log('🚀 Starting application initialization...');
            await MigrationManager.migrate();

            // Step 2: Initialize site manager
            await this.siteManager.initialize();

            // Step 3: Initialize UI renderer
            this.uiRenderer = new UIRenderer(this.siteManager);
            await this.uiRenderer.render();

            // Step 4: Start sync manager
            this.syncManager.startListening();

            console.log('✅ App initialized successfully');

            // Show migration success message if applicable
            const version = await StorageManager.getVersion();
            if (version === 1) {
                this._showMigrationSuccess();
            }
        } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            this._showError('Failed to load sites. Please refresh.');
        }
    }

    async update() {
        try {
            await this.siteManager.updateFromHistory();
            await this.uiRenderer.render();
        } catch (error) {
            console.error('❌ Failed to update:', error);
        }
    }

    async reload() {
        // Reload from storage (triggered by remote sync)
        try {
            await this.siteManager.reload();
            await this.uiRenderer.render();
        } catch (error) {
            console.error('❌ Failed to reload:', error);
        }
    }

    _showMigrationSuccess() {
        // Only show once after first migration
        const migrationShown = localStorage.getItem('migration_v1_shown');
        if (!migrationShown) {
            console.log('✨ Extension updated! Your pinned sites have been preserved.');
            localStorage.setItem('migration_v1_shown', 'true');
        }
    }

    _showError(message) {
        // Simple error display - could be enhanced with a toast notification
        console.error(message);
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function closeAllNewTabs() {
    chrome.tabs.query({}, (tabs) => {
        const newTabUrls = [
            'chrome://newtab/',
            'edge://newtab/',
            'chrome-search://local-ntp/local-ntp.html',
            'about:newtab'
        ];

        const tabIds = tabs
            .filter(tab => newTabUrls.some(url => tab.url.includes(url)) || tab.url.includes('newtab'))
            .map(tab => tab.id);

        if (tabIds.length > 0) {
            chrome.tabs.remove(tabIds, () => {
                if (chrome.runtime.lastError) {
                    console.log('Error closing tabs:', chrome.runtime.lastError.message);
                }
            });
        }
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

window.app = null;

document.addEventListener('DOMContentLoaded', async () => {
    window.app = new App();
    await window.app.initialize();
});
