// 监听选中文本的快捷键操作
document.addEventListener('keydown', function(e) {
    // Windows/Linux: Alt + S
    // Mac: Control + S (MacCtrl+S)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    let isShortcutTriggered = false;
    
    if (isMac) {
        // 在Mac上，使用Control+S
        isShortcutTriggered = e.ctrlKey && (e.key === 's' || e.key === 'S');
    } else {
        // 在Windows/Linux上，正常检测Alt+S
        isShortcutTriggered = e.altKey && (e.key === 's' || e.key === 'S');
    }
    
    if (isShortcutTriggered) {
        e.preventDefault(); // 阻止默认行为，防止保存页面等浏览器默认操作
        e.stopPropagation(); // 阻止事件冒泡
        
        const selectedText = window.getSelection().toString().trim();
        
        if (isValidUrl(selectedText)) {
            // 如果选中的文本是URL，直接打开
            let url = selectedText;
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            chrome.runtime.sendMessage({ action: "openNewTab", url: url });
        } else if (selectedText) {
            // 如果是普通文本，使用DuckDuckGo搜索
            const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(selectedText)}`;
            chrome.runtime.sendMessage({ action: "openNewTab", url: searchUrl });
        }
    }
});

// 检查文本是否是URL
function isValidUrl(text) {
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;
    return urlPattern.test(text);
} 