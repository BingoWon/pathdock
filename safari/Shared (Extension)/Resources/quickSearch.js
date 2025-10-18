// Browser API compatibility layer for Edge and Firefox
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

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
        
        // 获取选中文本并进行彻底清洗
        const rawText = window.getSelection().toString();
        const cleanedText = cleanText(rawText);
        
        if (cleanedText) {
            // 将清洗后的文本复制到剪贴板
            copyToClipboard(cleanedText);
            
            if (isShortcutTriggered && isValidUrl(cleanedText)) {
                // 如果是普通快捷键且选中的文本是URL，直接打开
                let url = cleanedText;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: url });
            } else {
                // 如果是直接搜索快捷键或者文本不是URL，使用DuckDuckGo搜索
                const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(cleanedText)}`;
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: searchUrl });
            }
        }
    }
});

// 监听来自background.js的消息
browserAPI.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "triggerSearch") {
        // 获取选中文本并进行彻底清洗
        const rawText = window.getSelection().toString();
        const cleanedText = cleanText(rawText);

        if (cleanedText) {
            // 将清洗后的文本复制到剪贴板
            copyToClipboard(cleanedText);

            if (request.command === "quick_search" && isValidUrl(cleanedText)) {
                // 如果是普通搜索命令且选中的文本是URL，直接打开
                let url = cleanedText;
                if (!url.startsWith('http')) {
                    url = 'https://' + url;
                }
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: url });
            } else {
                // 如果是直接搜索命令或者文本不是URL，使用DuckDuckGo搜索
                const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(cleanedText)}`;
                browserAPI.runtime.sendMessage({ action: "openNewTab", url: searchUrl });
            }
        }
    }
});

// 彻底清洗文本，类似Python的strip()但更强大
function cleanText(text) {
    if (!text) return '';
    
    // 1. 去除首尾空白字符（空格、制表符、换行符等）
    let cleaned = text.trim();
    
    // 2. 去除首尾的引号（单引号、双引号、反引号）
    cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '');
    
    // 3. 去除首尾的括号
    cleaned = cleaned.replace(/^\(+|\)+$/g, '');
    cleaned = cleaned.replace(/^\[+|\]+$/g, '');
    cleaned = cleaned.replace(/^\{+|\}+$/g, '');
    
    // 4. 去除首尾的特殊标点
    cleaned = cleaned.replace(/^[.,;:!?]+|[.,;:!?]+$/g, '');
    
    // 5. 替换多个连续空格为单个空格
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    return cleaned;
}

// 复制文本到剪贴板
function copyToClipboard(text) {
    // 使用现代的Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('无法复制到剪贴板:', err);
            // 如果Clipboard API失败，使用传统方法
            fallbackCopyToClipboard(text);
        });
    } else {
        // 浏览器不支持Clipboard API，使用传统方法
        fallbackCopyToClipboard(text);
    }
}

// 传统的复制到剪贴板方法（兼容性更好）
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 使textArea不可见
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
        console.error('复制到剪贴板失败:', err);
    }
    
    document.body.removeChild(textArea);
}

// 检查文本是否是URL - 更严格的检查
function isValidUrl(text) {
    // 如果文本包含空格，很可能不是URL
    if (text.includes(' ')) {
        return false;
    }
    
    // 检查是否已经是完整的URL格式
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        // 不是完整URL，继续检查
    }
    
    // 检查是否可能是不带协议的URL
    // 1. 必须包含至少一个点（域名分隔符）
    if (!text.includes('.')) {
        return false;
    }
    
    // 2. 检查常见的顶级域名
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
        // 检查是否包含IP地址格式
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/;
        if (!ipPattern.test(text)) {
            return false;
        }
    }
    
    // 3. 检查是否包含非法字符
    const invalidChars = ['<', '>', '"', '`', '{', '}', '|', '\\', '^', '[', ']', '`'];
    for (const char of invalidChars) {
        if (text.includes(char)) {
            return false;
        }
    }
    
    // 4. 检查域名部分是否符合规范
    try {
        // 尝试构建一个完整URL来验证
        const testUrl = new URL('https://' + text);
        
        // 检查主机名是否有效
        if (!testUrl.hostname.includes('.')) {
            return false;
        }
        
        return true;
    } catch (e) {
        return false;
    }
} 