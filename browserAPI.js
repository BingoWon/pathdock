"use strict";

globalThis.browserAPI = globalThis.browser ?? globalThis.chrome;

if (!globalThis.browserAPI) {
    throw new Error("PathDock requires WebExtension APIs.");
}
