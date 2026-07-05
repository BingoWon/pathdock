"use strict";

const EXPORT_FORMAT = "pathdock-sites";
const EXPORT_VERSION = 1;
const BACKUP_EXTENSION = ".pathdock";

function logInfo(message, details = {}) {
    console.info(`[PathDock] ${message}`, details);
}

function logWarn(message, details = {}) {
    console.warn(`[PathDock] ${message}`, details);
}

class SiteStore {
    constructor() {
        this.sites = [];
        this.favicons = {};
    }

    async load() {
        const [siteResult, faviconResult] = await Promise.all([
            browserAPI.storage.sync.get({ [PathDock.STORAGE_KEYS.SITES]: [] }),
            browserAPI.storage.local.get({ [PathDock.STORAGE_KEYS.FAVICONS]: {} })
        ]);

        this.sites = PathDock.normalizeSites(siteResult[PathDock.STORAGE_KEYS.SITES]);
        this.favicons = faviconResult[PathDock.STORAGE_KEYS.FAVICONS] ?? {};
    }

    async saveSites() {
        await browserAPI.storage.sync.set({
            [PathDock.STORAGE_KEYS.SITES]: this.sites
        });
    }

    exportData() {
        return {
            format: EXPORT_FORMAT,
            version: EXPORT_VERSION,
            exportedAt: new Date().toISOString(),
            sites: this.sites.map((site) => ({
                url: site.url,
                title: site.title,
                createdAt: site.createdAt
            }))
        };
    }

    planImport(sites) {
        const imported = PathDock.normalizeSites(sites);
        const existingUrls = new Set(this.sites.map((site) => site.url));
        const remainingSlots = Math.max(PathDock.MAX_SITES - this.sites.length, 0);
        const additions = [];

        for (const site of imported) {
            if (existingUrls.has(site.url)) continue;
            if (additions.length === remainingSlots) break;

            existingUrls.add(site.url);
            additions.push(site);
        }

        return {
            additions,
            skipped: imported.length - additions.length
        };
    }

    async appendSites(sites) {
        this.sites = [...this.sites, ...sites];
        await this.saveSites();
    }

    async saveFavicon(url, faviconUrl) {
        if (!PathDock.isUsableFaviconUrl(faviconUrl)) return;

        const key = PathDock.hostKey(url);
        if (!key) return;

        this.favicons = {
            ...this.favicons,
            [key]: faviconUrl
        };

        await browserAPI.storage.local.set({
            [PathDock.STORAGE_KEYS.FAVICONS]: this.favicons
        });
    }

    faviconFor(url) {
        return this.favicons[PathDock.hostKey(url)] || PathDock.fallbackFaviconUrl(url);
    }

    async add(tab) {
        const url = PathDock.toStoredUrl(tab.url);
        if (!url) return { ok: false, reason: "Cannot add this page." };
        if (this.sites.some((site) => site.url === url)) {
            return { ok: false, reason: "This site is already in your list." };
        }
        if (this.sites.length >= PathDock.MAX_SITES) {
            return { ok: false, reason: `Cannot add more than ${PathDock.MAX_SITES} sites.` };
        }

        this.sites.push({
            id: PathDock.siteId(url),
            url,
            title: PathDock.cleanText(tab.title) || PathDock.titleFromUrl(url),
            createdAt: Date.now()
        });

        await Promise.all([
            this.saveSites(),
            this.saveFavicon(url, tab.favIconUrl)
        ]);

        return { ok: true };
    }

    async remove(url) {
        this.sites = this.sites.filter((site) => site.url !== url);
        await this.saveSites();
    }

    async move(fromIndex, toIndex) {
        if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
        if (fromIndex === toIndex) return;
        if (fromIndex < 0 || toIndex < 0) return;
        if (fromIndex >= this.sites.length || toIndex >= this.sites.length) return;

        const [site] = this.sites.splice(fromIndex, 1);
        this.sites.splice(toIndex, 0, site);
        await this.saveSites();
    }
}

class PopupApp {
    constructor() {
        this.store = new SiteStore();
        this.draggedElement = null;
        this.draggedIndex = null;
        this.ip = "";
        this.elements = {
            addCurrent: document.getElementById("add-current-btn"),
            copyIp: document.getElementById("copy-ip-btn"),
            exportSites: document.getElementById("export-sites-btn"),
            importSites: document.getElementById("import-sites-btn"),
            importSitesInput: document.getElementById("import-sites-input"),
            ip: document.getElementById("public-ip"),
            sites: document.getElementById("buttons-container"),
            youtubeButton: document.querySelector("#youtube-search button"),
            youtubeInput: document.getElementById("youtube-search-input")
        };
    }

    async start() {
        this.bindEvents();
        await this.store.load();
        this.render();
        this.loadPublicIp();
        this.elements.youtubeInput.focus();
        logInfo("Popup initialized", {
            sites: this.store.sites.length
        });
    }

    bindEvents() {
        this.elements.addCurrent.addEventListener("click", () => this.addCurrentTab());
        this.elements.copyIp.addEventListener("click", (event) => this.copyIp(event));
        this.elements.youtubeInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                this.searchYouTube();
            }
        });
        this.elements.youtubeButton.addEventListener("click", () => this.searchYouTube());
        this.elements.exportSites.addEventListener("click", () => {
            logInfo("Export button clicked");
            this.exportSites();
        });
        this.elements.importSites.addEventListener("click", () => {
            logInfo("Import file picker opened");
            this.elements.importSitesInput.click();
        });
        this.elements.importSitesInput.addEventListener("change", (event) => {
            logInfo("Import file selected", {
                count: event.target.files?.length ?? 0,
                name: event.target.files?.[0]?.name ?? ""
            });
            this.importSites(event.target.files?.[0]).catch((error) => {
                console.error("Failed to import sites:", error);
                alert("Invalid import file.");
            }).finally(() => {
                event.target.value = "";
            });
        });

        browserAPI.storage.onChanged.addListener((changes, areaName) => {
            if ((areaName === "sync" && changes[PathDock.STORAGE_KEYS.SITES]) ||
                (areaName === "local" && changes[PathDock.STORAGE_KEYS.FAVICONS])) {
                this.reloadSites();
            }
        });
    }

    async reloadSites() {
        await this.store.load();
        this.render();
    }

    render() {
        this.elements.sites.replaceChildren(
            ...this.store.sites.map((site, index) => this.createSiteButton(site, index))
        );

        requestAnimationFrame(() => this.updateHeight());
    }

    updateHeight() {
        const topBar = document.getElementById("top-bar");
        const topBarHeight = topBar ? topBar.offsetHeight : 56;
        const containerHeight = this.elements.sites.offsetHeight || 0;
        const height = topBarHeight + containerHeight;

        document.documentElement.style.height = `${Math.max(height, topBarHeight)}px`;
    }

    createSiteButton(site, index) {
        const button = document.createElement("div");
        button.className = "site-button";
        button.draggable = true;
        button.dataset.index = String(index);
        button.dataset.url = site.url;

        const remove = document.createElement("span");
        remove.className = "close-btn";
        remove.title = "Remove";
        remove.textContent = "×";

        const favicon = document.createElement("img");
        favicon.className = "favicon";
        favicon.alt = "";
        favicon.draggable = false;
        favicon.src = this.store.faviconFor(site.url);
        favicon.addEventListener("error", () => {
            favicon.src = PathDock.fallbackFaviconUrl(site.url);
        }, { once: true });

        const title = document.createElement("div");
        title.className = "site-title";
        title.textContent = site.title;

        const url = document.createElement("div");
        url.className = "site-url";
        url.textContent = this.shortenUrl(site.url);

        button.append(remove, favicon, title, url);
        button.addEventListener("click", (event) => this.handleSiteClick(event, site.url));
        button.addEventListener("dragstart", (event) => this.handleDragStart(event, index));
        button.addEventListener("dragover", (event) => this.handleDragOver(event));
        button.addEventListener("drop", (event) => this.handleDrop(event, index));
        button.addEventListener("dragend", () => this.handleDragEnd());

        return button;
    }

    handleSiteClick(event, url) {
        if (event.target.classList.contains("close-btn")) {
            event.stopPropagation();
            this.removeSite(url);
        } else if (!event.target.closest(".close-btn")) {
            this.openSite(url);
        }
    }

    async addCurrentTab() {
        try {
            const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
            const result = await this.store.add(tab ?? {});

            if (!result.ok) {
                alert(result.reason);
                return;
            }

            this.render();
        } catch (error) {
            console.error("Failed to add current tab:", error);
            alert("Failed to add site.");
        }
    }

    async removeSite(url) {
        await this.store.remove(url);
        this.render();
    }

    openSite(url) {
        closeAllNewTabs();
        browserAPI.tabs.create({ url });
    }

    handleDragStart(event, index) {
        this.draggedElement = event.target;
        this.draggedIndex = index;
        event.target.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }

    async handleDrop(event, index) {
        event.preventDefault();
        if (this.draggedIndex !== null && this.draggedIndex !== index) {
            await this.store.move(this.draggedIndex, index);
            this.render();
        }
    }

    handleDragEnd() {
        if (this.draggedElement) {
            this.draggedElement.classList.remove("dragging");
        }
        this.draggedElement = null;
        this.draggedIndex = null;
    }

    searchYouTube() {
        const query = this.elements.youtubeInput.value.trim();
        if (query) {
            browserAPI.tabs.create({ url: PathDock.youtubeSearchUrl(query) });
        }
    }

    async loadPublicIp() {
        try {
            this.elements.ip.textContent = "...";

            const cached = await browserAPI.storage.local.get({
                [PathDock.STORAGE_KEYS.IP_CACHE]: null
            });
            const cache = cached[PathDock.STORAGE_KEYS.IP_CACHE];

            if (cache?.ip && Date.now() - cache.time < PathDock.IP_CACHE_TTL_MS) {
                this.ip = cache.ip;
                this.elements.ip.textContent = this.ip;
            }

            const response = await fetch("https://api.ipify.org?format=json");
            if (!response.ok) throw new Error("Network error");

            const data = await response.json();
            this.ip = data.ip;
            this.elements.ip.textContent = this.ip;

            await browserAPI.storage.local.set({
                [PathDock.STORAGE_KEYS.IP_CACHE]: {
                    ip: this.ip,
                    time: Date.now()
                }
            });
        } catch (error) {
            console.error("Error fetching IP:", error);
            if (!this.ip) {
                this.elements.ip.textContent = "N/A";
            }
        }
    }

    async copyIp(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!this.ip) return;

        try {
            await navigator.clipboard.writeText(this.ip);

            const originalText = this.elements.copyIp.textContent;
            this.elements.copyIp.textContent = "✓";
            this.elements.copyIp.style.color = "#28a745";

            setTimeout(() => {
                this.elements.copyIp.textContent = originalText;
                this.elements.copyIp.style.color = "";
            }, 1000);
        } catch {
        }
    }

    exportSites() {
        const date = new Date().toISOString().slice(0, 10);
        const filename = `pathdock-sites-${date}${BACKUP_EXTENSION}`;
        const blob = new Blob([`${JSON.stringify(this.store.exportData(), null, 2)}\n`], {
            type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        link.rel = "noopener";
        document.body.append(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
        logInfo("Sites exported", {
            filename,
            count: this.store.sites.length
        });
    }

    async importSites(file) {
        if (!file) {
            logWarn("Import cancelled before file selection");
            return;
        }
        if (!file.name.toLowerCase().endsWith(BACKUP_EXTENSION)) {
            throw new Error(`Import file must use the ${BACKUP_EXTENSION} extension.`);
        }

        const data = JSON.parse(await file.text());
        if (data?.format !== EXPORT_FORMAT ||
            data.version !== EXPORT_VERSION ||
            !Array.isArray(data.sites)) {
            throw new Error("Unsupported import file.");
        }

        const { additions, skipped } = this.store.planImport(data.sites);
        logInfo("Import file parsed", {
            filename: file.name,
            imported: data.sites.length,
            additions: additions.length,
            skipped
        });

        if (additions.length === 0) {
            logWarn("Import skipped because there are no new sites", {
                filename: file.name,
                skipped
            });
            alert("No new sites to import.");
            return;
        }

        const message = `Import ${additions.length} new site${additions.length === 1 ? "" : "s"}? Existing sites will remain.`;
        if (!confirm(message)) return;

        await this.store.appendSites(additions);
        this.render();
        logInfo("Sites imported", {
            added: additions.length,
            total: this.store.sites.length,
            skipped
        });

        if (skipped > 0) {
            alert(`${skipped} duplicate or overflow site${skipped === 1 ? " was" : "s were"} skipped.`);
        }
    }

    shortenUrl(url) {
        try {
            const urlObj = new URL(url);
            let display = urlObj.hostname;
            if (urlObj.pathname !== "/") {
                display += urlObj.pathname;
            }
            return display.length > 40 ? `${display.substring(0, 37)}...` : display;
        } catch {
            return url.length > 40 ? `${url.substring(0, 37)}...` : url;
        }
    }
}

function closeAllNewTabs() {
    browserAPI.tabs.query({}).then((tabs) => {
        const tabIds = tabs
            .filter((tab) => {
                const url = tab.url || "";
                const matchesKnownUrl = PathDock.isNewTabUrl(url);
                const matchesPattern =
                    url.includes("newtab") ||
                    url.includes("startpage") ||
                    url.includes("new-tab-page");

                return matchesKnownUrl || matchesPattern;
            })
            .map((tab) => tab.id);

        if (tabIds.length > 0) {
            browserAPI.tabs.remove(tabIds);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    new PopupApp().start().catch((error) => {
        console.error("Failed to initialize app:", error);
    });
});
