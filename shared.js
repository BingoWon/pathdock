"use strict";

globalThis.PathDock = (() => {
    const STORAGE_KEYS = Object.freeze({
        SITES: "pathdock.sites",
        FAVICONS: "pathdock.favicons",
        IP_CACHE: "pathdock.ipCache"
    });

    const SEARCH_COMMANDS = new Set(["quick_search", "direct_search"]);
    const MAX_SITES = 48;
    const IP_CACHE_TTL_MS = 5 * 60 * 1000;

    const NEW_TAB_URLS = new Set([
        "about:blank",
        "about:home",
        "about:newtab",
        "about:privatebrowsing",
        "chrome://newtab/",
        "chrome://new-tab-page/",
        "chrome-search://local-ntp/local-ntp.html",
        "edge://newtab/",
        "edge://new-tab-page/",
        "favorites://",
        "https://www.apple.com/startpage/"
    ]);

    function cleanText(value) {
        return String(value ?? "")
            .trim()
            .replace(/\s+/g, " ");
    }

    function hasScheme(value) {
        return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
    }

    function isHttpProtocol(protocol) {
        return protocol === "http:" || protocol === "https:";
    }

    function parseHttpUrl(value, { allowBare = true } = {}) {
        let text = cleanText(value);
        if (!text) return null;

        const explicitScheme = hasScheme(text);
        if (!explicitScheme) {
            if (!allowBare) return null;
            text = `https://${text}`;
        }

        try {
            const url = new URL(text);
            if (!isHttpProtocol(url.protocol)) return null;

            if (url.protocol === "http:" && url.port === "80") url.port = "";
            if (url.protocol === "https:" && url.port === "443") url.port = "";
            url.hash = "";

            return url;
        } catch {
            return null;
        }
    }

    function isIPv4(hostname) {
        const parts = hostname.split(".");
        return parts.length === 4 && parts.every((part) => {
            if (!/^\d{1,3}$/.test(part)) return false;
            const value = Number(part);
            return value >= 0 && value <= 255;
        });
    }

    function isLikelyBareHost(hostname) {
        return hostname === "localhost" || hostname.includes(".") || isIPv4(hostname);
    }

    function toNavigationUrl(value) {
        const text = cleanText(value);
        if (!text || /\s/.test(text)) return null;

        const explicitScheme = hasScheme(text);
        const url = parseHttpUrl(text, { allowBare: true });
        if (!url) return null;
        if (!explicitScheme && !isLikelyBareHost(url.hostname)) return null;

        return url.href;
    }

    function toStoredUrl(value) {
        const url = parseHttpUrl(value, { allowBare: false });
        if (!url) return null;

        const href = url.href;
        if (url.pathname === "/" && !url.search) return url.origin;
        return href.endsWith("/") ? href.slice(0, -1) : href;
    }

    function siteId(url) {
        return encodeURIComponent(url)
            .replace(/%/g, "")
            .slice(0, 80);
    }

    function hostKey(value) {
        const url = parseHttpUrl(value, { allowBare: false });
        if (!url) return "";
        return `${url.hostname}${url.port ? `:${url.port}` : ""}`;
    }

    function displayUrl(value) {
        const url = parseHttpUrl(value, { allowBare: false });
        if (!url) return cleanText(value);

        const path = url.pathname === "/" ? "" : url.pathname;
        const text = `${url.hostname}${path}${url.search}`;
        return text.length > 44 ? `${text.slice(0, 41)}...` : text;
    }

    function titleFromUrl(value) {
        const url = parseHttpUrl(value, { allowBare: false });
        return url?.hostname ?? "Untitled";
    }

    function normalizeSites(value) {
        if (!Array.isArray(value)) return [];

        const seen = new Set();
        const sites = [];

        for (const item of value) {
            const url = toStoredUrl(item?.url);
            if (!url || seen.has(url)) continue;

            seen.add(url);
            sites.push({
                id: item.id || siteId(url),
                url,
                title: cleanText(item.title) || titleFromUrl(url),
                createdAt: Number(item.createdAt) || Date.now()
            });

            if (sites.length === MAX_SITES) break;
        }

        return sites;
    }

    function searchUrl(query) {
        return `https://duckduckgo.com/?q=${encodeURIComponent(cleanText(query))}`;
    }

    function youtubeSearchUrl(query) {
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanText(query))}`;
    }

    function fallbackFaviconUrl(value) {
        const key = hostKey(value);
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(key)}&sz=32`;
    }

    function isUsableFaviconUrl(value) {
        if (typeof value !== "string" || !value) return false;
        if (value.startsWith("http://") || value.startsWith("https://")) return true;
        return value.startsWith("data:image/") && value.length < 32768;
    }

    function isNewTabUrl(value) {
        const text = String(value ?? "").toLowerCase();
        return NEW_TAB_URLS.has(text);
    }

    return Object.freeze({
        IP_CACHE_TTL_MS,
        MAX_SITES,
        SEARCH_COMMANDS,
        STORAGE_KEYS,
        cleanText,
        displayUrl,
        fallbackFaviconUrl,
        hostKey,
        isNewTabUrl,
        isUsableFaviconUrl,
        normalizeSites,
        searchUrl,
        siteId,
        titleFromUrl,
        toNavigationUrl,
        toStoredUrl,
        youtubeSearchUrl
    });
})();
