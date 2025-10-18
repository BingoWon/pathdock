// ============================================================================
// BROWSER API COMPATIBILITY LAYER
// ============================================================================
// This file provides a unified API for both Chrome/Edge and Firefox
// Must be loaded before any other extension scripts

const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

