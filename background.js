// background.js


// Handle tab updates to capture favicons
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
        chrome.storage.sync.get(['allocatedRooms', 'favIconUrls'], function (data) {
            if (tab.url === "") return; // Check if the tab is a new tab
            let allocatedRooms = data.allocatedRooms ? JSON.parse(data.allocatedRooms) : [];
            let favIconUrls = data.favIconUrls ? JSON.parse(data.favIconUrls) : {}; // Retrieve existing favIconUrls or initialize if none
            try {
                const url = new URL(tab.url);
                const hostnameWithPort = `${url.hostname}${url.port ? ':' + url.port : ''}`; // Combine hostname and port
                const foundRoomIndex = allocatedRooms.findIndex(room => room && room.url === url.href.replace(/\/$/, '')); // normalize the url
                if (foundRoomIndex !== -1) {
                    const favIconUrl = tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${hostnameWithPort}`;
                    favIconUrls[hostnameWithPort] = favIconUrl;

                    // Save the updated favIconUrls back to storage
                    chrome.storage.sync.set({ 'favIconUrls': JSON.stringify(favIconUrls) }, function () {
                        if (chrome.runtime.lastError) {
                            console.error('Error saving updated favIconUrls:', chrome.runtime.lastError);
                        } else {
                            console.log('favIconUrls with updated favicon saved successfully.');
                        }
                    });
                }
            } catch (error) {
                console.log('❌ Error Sending URL ❌', error); // Indicate error
            }
        });
    }
});

// Close current tab if it's a YouTube watch page
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "closeCurrentTabIfYouTube") {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var currentTab = tabs[0];
            if (/^https:\/\/www\.youtube\.com\/watch\?v=/.test(currentTab.url)) {
                chrome.tabs.remove(currentTab.id); // Close the current tab
                sendResponse({ result: "Tab closed" });
            } else {
                sendResponse({ result: "Not a YouTube watch page" });
            }
        });
        return true; // Indicates you wish to send a response asynchronously
    }
});

// Helper function to inject the content script
function injectScript(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["iStoreAutoLogin.js"]
    });
}

// Listen for web navigation events when a navigation is committed
chrome.webNavigation.onCommitted.addListener(function (details) {
    // Check if the URL matches the desired one (for redirection)
    if (details.url === "http://192.168.100.1/cgi-bin/luci/") {
        injectScript(details.tabId);
    }
}, { url: [{ urlMatches: "http://192.168.100.1/cgi-bin/luci/" }] });

// Listen for web navigation events when a page load is completed
chrome.webNavigation.onCompleted.addListener(function (details) {
    // Check if the URL matches the desired one
    if (details.url === "http://192.168.100.1/cgi-bin/luci/admin/quickstart") {
        injectScript(details.tabId);
    }
}, { url: [{ urlMatches: "http://192.168.100.1/cgi-bin/luci/admin/quickstart" }] });

// 处理快捷搜索和链接打开
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "openNewTab") {
        chrome.tabs.create({ url: request.url });
        sendResponse({ success: true });
    }
});
