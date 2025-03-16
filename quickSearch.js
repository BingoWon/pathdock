// 监听选中文本的快捷键操作
document.addEventListener('keydown', function(e) {
    // Windows/Linux: Alt + S
    // Mac: Control + S (MacCtrl+S)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    let isShortcutTriggered = false;
    let isDirectSearchTriggered = false;
    
    if (isMac) {
        // 在Mac上，使用Control+S
        isShortcutTriggered = e.ctrlKey && !e.shiftKey && (e.key === 's' || e.key === 'S');
        // 在Mac上，使用Control+Shift+S直接搜索
        isDirectSearchTriggered = e.ctrlKey && e.shiftKey && (e.key === 's' || e.key === 'S');
    } else {
        // 在Windows/Linux上，正常检测Alt+S
        isShortcutTriggered = e.altKey && !e.shiftKey && (e.key === 's' || e.key === 'S');
        // 在Windows/Linux上，使用Alt+Shift+S直接搜索
        isDirectSearchTriggered = e.altKey && e.shiftKey && (e.key === 's' || e.key === 'S');
    }
    
    if (isShortcutTriggered || isDirectSearchTriggered) {
        e.preventDefault(); // 阻止默认行为，防止保存页面等浏览器默认操作
        e.stopPropagation(); // 阻止事件冒泡
        
        const selectedText = window.getSelection().toString().trim();
        
        if (selectedText) {
            if (isShortcutTriggered && isValidUrl(selectedText)) {
                // 如果是普通快捷键且选中的文本是URL，直接打开
                let url = selectedText;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                chrome.runtime.sendMessage({ action: "openNewTab", url: url });
            } else {
                // 如果是直接搜索快捷键或者文本不是URL，使用DuckDuckGo搜索
                const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(selectedText)}`;
                chrome.runtime.sendMessage({ action: "openNewTab", url: searchUrl });
            }
        }
    }
});

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "triggerSearch") {
        const selectedText = window.getSelection().toString().trim();
        
        if (selectedText) {
            if (request.command === "quick_search" && isValidUrl(selectedText)) {
                // 如果是普通搜索命令且选中的文本是URL，直接打开
                let url = selectedText;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                chrome.runtime.sendMessage({ action: "openNewTab", url: url });
            } else {
                // 如果是直接搜索命令或者文本不是URL，使用DuckDuckGo搜索
                const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(selectedText)}`;
                chrome.runtime.sendMessage({ action: "openNewTab", url: searchUrl });
            }
        }
    }
});

// 检查文本是否是URL
function isValidUrl(text) {
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;
    return urlPattern.test(text);
} 