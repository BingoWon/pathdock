"use strict";

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
            return { ok: false, reason: "This site is already saved." };
        }
        if (this.sites.length >= PathDock.MAX_SITES) {
            return { ok: false, reason: `PathDock holds up to ${PathDock.MAX_SITES} sites.` };
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
        this.dragIndex = null;
        this.ip = "";
        this.statusTimer = null;
        this.elements = {
            addCurrent: document.getElementById("add-current-btn"),
            copyIp: document.getElementById("copy-ip-btn"),
            ip: document.getElementById("public-ip"),
            sites: document.getElementById("sites"),
            status: document.getElementById("status"),
            youtubeForm: document.getElementById("youtube-search"),
            youtubeInput: document.getElementById("youtube-search-input")
        };
    }

    async start() {
        this.bindEvents();
        await this.store.load();
        this.render();
        this.loadPublicIp();
        this.elements.youtubeInput.focus();
    }

    bindEvents() {
        this.elements.addCurrent.addEventListener("click", () => this.addCurrentTab());
        this.elements.copyIp.addEventListener("click", () => this.copyIp());
        this.elements.youtubeForm.addEventListener("submit", (event) => {
            event.preventDefault();
            this.searchYouTube();
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
    }

    createSiteButton(site, index) {
        const button = document.createElement("button");
        button.className = "site-button";
        button.type = "button";
        button.draggable = true;
        button.title = site.url;
        button.dataset.index = String(index);
        button.addEventListener("click", () => this.openSite(site.url));
        button.addEventListener("dragstart", (event) => this.onDragStart(event, index));
        button.addEventListener("dragover", (event) => event.preventDefault());
        button.addEventListener("drop", (event) => this.onDrop(event, index));
        button.addEventListener("dragend", () => {
            this.dragIndex = null;
            button.classList.remove("dragging");
        });

        const remove = document.createElement("span");
        remove.className = "remove-site";
        remove.textContent = "x";
        remove.title = "Remove";
        remove.setAttribute("role", "button");
        remove.addEventListener("click", (event) => {
            event.stopPropagation();
            this.removeSite(site.url);
        });

        const favicon = document.createElement("img");
        favicon.className = "favicon";
        favicon.alt = "";
        favicon.draggable = false;
        favicon.src = this.store.faviconFor(site.url);
        favicon.addEventListener("error", () => {
            favicon.src = PathDock.fallbackFaviconUrl(site.url);
        }, { once: true });

        const title = document.createElement("span");
        title.className = "site-title";
        title.textContent = site.title;

        const url = document.createElement("span");
        url.className = "site-url";
        url.textContent = PathDock.displayUrl(site.url);

        button.append(remove, favicon, title, url);
        return button;
    }

    async addCurrentTab() {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        const result = await this.store.add(tab ?? {});

        if (!result.ok) {
            this.setStatus(result.reason);
            return;
        }

        this.render();
        this.setStatus("Site saved.");
    }

    async removeSite(url) {
        await this.store.remove(url);
        this.render();
        this.setStatus("Site removed.");
    }

    async openSite(url) {
        const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && PathDock.isNewTabUrl(tab.url)) {
            await browserAPI.tabs.update(tab.id, { url });
        } else {
            await browserAPI.tabs.create({ url });
        }
        window.close();
    }

    onDragStart(event, index) {
        this.dragIndex = index;
        event.currentTarget.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
    }

    async onDrop(event, index) {
        event.preventDefault();
        await this.store.move(this.dragIndex, index);
        this.dragIndex = null;
        this.render();
    }

    searchYouTube() {
        const query = PathDock.cleanText(this.elements.youtubeInput.value);
        if (!query) return;

        browserAPI.tabs.create({ url: PathDock.youtubeSearchUrl(query) });
        this.elements.youtubeInput.value = "";
    }

    async loadPublicIp() {
        const cached = await browserAPI.storage.local.get({
            [PathDock.STORAGE_KEYS.IP_CACHE]: null
        });
        const cache = cached[PathDock.STORAGE_KEYS.IP_CACHE];

        if (cache?.ip && Date.now() - cache.time < PathDock.IP_CACHE_TTL_MS) {
            this.setIp(cache.ip);
        } else {
            this.elements.ip.textContent = "...";
        }

        try {
            const response = await fetch("https://api.ipify.org?format=json");
            if (!response.ok) throw new Error(`IP lookup failed: ${response.status}`);

            const data = await response.json();
            if (!data.ip) throw new Error("IP lookup returned no address.");

            await browserAPI.storage.local.set({
                [PathDock.STORAGE_KEYS.IP_CACHE]: {
                    ip: data.ip,
                    time: Date.now()
                }
            });
            this.setIp(data.ip);
        } catch {
            if (!this.ip) {
                this.elements.ip.textContent = "IP unavailable";
            }
        }
    }

    setIp(ip) {
        this.ip = ip;
        this.elements.ip.textContent = ip;
        this.elements.copyIp.disabled = false;
    }

    async copyIp() {
        if (!this.ip) return;

        const copied = await this.copyText(this.ip);
        this.setStatus(copied ? "IP copied." : "Copy failed.");
    }

    async copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }

    setStatus(message) {
        clearTimeout(this.statusTimer);
        this.elements.status.textContent = message;
        this.statusTimer = setTimeout(() => {
            this.elements.status.textContent = "";
        }, 1600);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new PopupApp().start().catch((error) => {
        console.error("PathDock failed to start:", error);
    });
});
