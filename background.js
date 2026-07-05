"use strict";

importScripts("browserAPI.js", "shared.js");

async function loadSites() {
    const result = await browserAPI.storage.sync.get({
        [PathDock.STORAGE_KEYS.SITES]: [],
        [PathDock.LEGACY_STORAGE_KEYS.SITES]: null
    });
    return PathDock.mergeSites(
        PathDock.parseLegacySites(result[PathDock.LEGACY_STORAGE_KEYS.SITES]),
        result[PathDock.STORAGE_KEYS.SITES]
    );
}

async function saveFavicon(url, faviconUrl) {
    if (!PathDock.isUsableFaviconUrl(faviconUrl)) return;

    const key = PathDock.hostKey(url);
    if (!key) return;

    const result = await browserAPI.storage.local.get({
        [PathDock.STORAGE_KEYS.FAVICONS]: {}
    });
    const favicons = result[PathDock.STORAGE_KEYS.FAVICONS] ?? {};

    if (favicons[key] === faviconUrl) return;

    await browserAPI.storage.local.set({
        [PathDock.STORAGE_KEYS.FAVICONS]: {
            ...favicons,
            [key]: faviconUrl
        }
    });
}

async function captureFavicon(tab) {
    const normalizedUrl = PathDock.toStoredUrl(tab.url);
    if (!normalizedUrl || !tab.favIconUrl) return;

    const sites = await loadSites();
    if (sites.some((site) => site.url === normalizedUrl)) {
        await saveFavicon(normalizedUrl, tab.favIconUrl);
    }
}

async function getSelectedText(tabId) {
    const [{ result } = {}] = await browserAPI.scripting.executeScript({
        target: { tabId },
        func: () => window.getSelection()?.toString() ?? ""
    });
    return PathDock.cleanText(result);
}

async function copyText(tabId, text) {
    await browserAPI.scripting.executeScript({
        target: { tabId },
        args: [text],
        func: (value) => {
            try {
                return navigator.clipboard.writeText(value).then(() => true, () => false);
            } catch {
                return false;
            }
        }
    });
}

async function runSearchCommand(command) {
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !PathDock.toStoredUrl(tab.url)) return;

    const text = await getSelectedText(tab.id);
    if (!text) return;

    await copyText(tab.id, text);

    const directUrl = command === "quick_search" ? PathDock.toNavigationUrl(text) : null;
    await browserAPI.tabs.create({
        url: directUrl ?? PathDock.searchUrl(text)
    });
}

browserAPI.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab?.url) {
        captureFavicon(tab).catch(() => {});
    }
});

browserAPI.commands.onCommand.addListener((command) => {
    if (PathDock.SEARCH_COMMANDS.has(command)) {
        runSearchCommand(command).catch(() => {});
    }
});
