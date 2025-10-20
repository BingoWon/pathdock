// Browser API compatibility layer for Edge and Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Listen for keyboard shortcuts on selected text
document.addEventListener('keydown', function(e) {
    // Windows/Linux: Alt + S
    // Mac: Control + S (MacCtrl+S)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    let isShortcutTriggered = false;
    let isDirectSearchTriggered = false;

    if (isMac) {
        // On Mac, use Control+S
        isShortcutTriggered = e.ctrlKey && !e.shiftKey && (e.key === 's' || e.key === 'S');
        // On Mac, use Control+Shift+S for direct search
        isDirectSearchTriggered = e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S');
    } else {
        // On Windows/Linux, use Alt+S
        isShortcutTriggered = e.altKey && !e.shiftKey && (e.key === 's' || e.key === 'S');
        // On Windows/Linux, use Alt+Shift+S for direct search
        isDirectSearchTriggered = e.altKey && e.shiftKey && (e.key === 's' || e.key === 'S');
    }

    if (isShortcutTriggered || isDirectSearchTriggered) {
        e.preventDefault(); // Prevent default behavior (e.g., save page)
        e.stopPropagation(); // Stop event bubbling

        // Get selected text and clean it thoroughly
        const rawText = window.getSelection().toString();
        const cleanedText = cleanText(rawText);

        if (cleanedText) {
            // Copy cleaned text to clipboard
            copyToClipboard(cleanedText);

            if (isShortcutTriggered && isValidUrl(cleanedText)) {
                // If normal shortcut and text is URL, open directly
                let url = cleanedText;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: url });
            } else {
                // If direct search shortcut or text is not URL, search with DuckDuckGo
                const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(cleanedText)}`;
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: searchUrl });
            }
        }
    }
});

// Listen for messages from background.js
browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "triggerSearch") {
        // Get selected text and clean it thoroughly
        const rawText = window.getSelection().toString();
        const cleanedText = cleanText(rawText);

        if (cleanedText) {
            // Copy cleaned text to clipboard
            copyToClipboard(cleanedText);

            if (request.command === "quick_search" && isValidUrl(cleanedText)) {
                // If normal search command and text is URL, open directly
                let url = cleanedText;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: url });
            } else {
                // If direct search command or text is not URL, search with DuckDuckGo
                const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(cleanedText)}`;
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: searchUrl });
            }
        }
    }
});

// Clean text thoroughly (similar to Python's strip() but more powerful)
function cleanText(text) {
    if (!text) return '';

    // 1. Remove leading/trailing whitespace (spaces, tabs, newlines, etc.)
    let cleaned = text.trim();

    // 2. Remove leading/trailing quotes (single, double, backtick)
    cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');

    // 3. Remove leading/trailing parentheses
    cleaned = cleaned.replace(/^\(+|\)+$/g, '');
    cleaned = cleaned.replace(/^\[+|\]+$/g, '');
    cleaned = cleaned.replace(/^\{+|\}+$/g, '');

    // 4. Remove leading/trailing special punctuation
    cleaned = cleaned.replace(/^[.,;:!?]+|[.,;:!?]+$/g, '');

    // 5. Replace multiple consecutive spaces with single space
    cleaned = cleaned.replace(/\s+/g, ' ');

    return cleaned;
}

// Copy text to clipboard
function copyToClipboard(text) {
    // Use modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            // If Clipboard API fails, use fallback method
            fallbackCopyToClipboard(text);
        });
    } else {
        // Browser doesn't support Clipboard API, use fallback method
        fallbackCopyToClipboard(text);
    }
}

// Fallback method for copying to clipboard (better compatibility)
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make textArea invisible
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
    }

    document.body.removeChild(textArea);
}

// Check if text is a valid URL (strict validation)
function isValidUrl(text) {
    // If text contains spaces, it's likely not a URL
    if (text.includes(' ')) {
        return false;
    }

    // Check if it's already a complete URL format
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        // Not a complete URL, continue checking
    }

    // Check if it might be a URL without protocol
    // 1. Must contain at least one dot (domain separator)
    if (!text.includes('.')) {
        return false;
    }

    // 2. Check for common top-level domains
    const commonTLDs = [
        '.com', '.org', '.net', '.edu', '.gov', '.io', '.co',
        '.cn', '.de', '.uk', '.ru', '.jp', '.fr', '.it', '.es',
        '.au', '.ca', '.in', '.nl', '.br', '.tv', '.info', '.biz',
        '.me', '.app', '.dev', '.ai', '.cloud', '.tech', '.online'
    ];

    let hasTLD = false;
    for (const tld of commonTLDs) {
        if (text.toLowerCase().endsWith(tld)) {
            hasTLD = true;
            break;
        }
    }

    if (!hasTLD) {
        // Check if it contains IP address format
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
        if (!ipPattern.test(text)) {
            return false;
        }
    }

    // 3. Check for invalid characters
    const invalidChars = ['<', '>', '"', '`', '{', '}', '|', '\\', '^', '[', ']', '`'];
    for (const char of invalidChars) {
        if (text.includes(char)) {
            return false;
        }
    }

    // 4. Check if domain part is valid
    try {
        // Try to construct a complete URL to validate
        const testUrl = new URL('https://' + text);

        // Check if hostname is valid
        if (!testUrl.hostname.includes('.')) {
            return false;
        }

        return true;
    } catch (e) {
        return false;
    }
}