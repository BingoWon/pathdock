// background.js

// Handle tab updates to capture favicons
chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.storage.sync.get(['allocatedRooms', 'favIconUrls'], (data) => {
            if (tab.url === "") return; // Check if the tab is a new tab
            let allocatedRooms = data.allocatedRooms ? JSON.parse(data.allocatedRooms) : [];
            let favIconUrls = data.favIconUrls ? JSON.parse(data.favIconUrls) : {};

            try {
                const url = new URL(tab.url);
                const hostnameWithPort = `${url.hostname}${url.port ? ':' + url.port : ''}`;
                const foundRoomIndex = allocatedRooms.findIndex(room => room && room.url === url.href.replace(/\/$/, ''));

                if (foundRoomIndex !== -1) {
                    const favIconUrl = tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${hostnameWithPort}`;
                    favIconUrls[hostnameWithPort] = favIconUrl;

                    // Save the updated favIconUrls back to storage
                    chrome.storage.sync.set({ 'favIconUrls': JSON.stringify(favIconUrls) }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Error saving updated favIconUrls:', chrome.runtime.lastError);
                        } else {
                            console.log('favIconUrls with updated favicon saved successfully.');
                        }
                    });
                }
            } catch (error) {
                console.log('Error processing tab URL:', error);
            }
        });
    }
});
// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "openNewTab") {
        chrome.tabs.create({ url: request.url });
    }
});

// 监听快捷键命令
chrome.commands.onCommand.addListener(function(command) {
    if (command === "quick_search" || command === "direct_search") {
        // 获取当前活动标签页
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs.length > 0) {
                const activeTab = tabs[0];
                
                // 向活动标签页发送消息，触发相应的搜索功能
                chrome.tabs.sendMessage(activeTab.id, { 
                    action: "triggerSearch",
                    command: command
                });
            }
        });
    }
});
