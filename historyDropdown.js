document.addEventListener('DOMContentLoaded', () => {
    const historyIcon = document.getElementById('history-icon');
    const historyDropdown = document.getElementById('history-dropdown');
    const historyList = document.getElementById('history-list');

    if (!historyIcon) return;

    historyIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        historyDropdown.classList.toggle('hidden');
        loadHistory();
    });

    async function loadHistory() {
        try {
            const data = await chrome.storage.sync.get('ignoredUrls');
            const ignoredUrls = data.ignoredUrls ? JSON.parse(data.ignoredUrls) : [];

            historyList.innerHTML = '';

            if (ignoredUrls.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.innerHTML = '<span style="color: #999; font-style: italic;">No ignored sites</span>';
                historyList.appendChild(emptyItem);
                return;
            }

            ignoredUrls.forEach((url) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <span>${url}</span>
                    <button class="close-icon" data-url="${url}">❌</button>
                `;
                historyList.appendChild(listItem);
            });

            // Add event listeners for close icons
            const closeIcons = document.querySelectorAll('#history-list .close-icon');
            closeIcons.forEach(icon => {
                icon.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = e.target.getAttribute('data-url');
                    await removeItem(url);
                });
            });
        } catch (error) {
            console.error('Failed to load ignored sites:', error);
        }
    }

    async function removeItem(url) {
        try {
            // Use the app's siteManager if available
            if (window.app?.siteManager) {
                await window.app.siteManager.unignoreSite(url);
                await window.app.update();
            } else {
                // Fallback to direct storage manipulation
                const data = await chrome.storage.sync.get('ignoredUrls');
                let ignoredUrls = data.ignoredUrls ? JSON.parse(data.ignoredUrls) : [];
                ignoredUrls = ignoredUrls.filter(u => u !== url);
                await chrome.storage.sync.set({ ignoredUrls: JSON.stringify(ignoredUrls) });
            }
            loadHistory();
        } catch (error) {
            console.error('Failed to remove ignored site:', error);
        }
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!historyIcon.contains(e.target) && !historyDropdown.contains(e.target)) {
            historyDropdown.classList.add('hidden');
        }
    });

    // Prevent dropdown from closing when clicking inside it
    historyDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});
