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

    function loadHistory() {
        chrome.storage.sync.get('ignoredSites', (data) => {
            const ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];

            historyList.innerHTML = '';

            if (ignoredSites.length === 0) {
                const emptyItem = document.createElement('li');
                emptyItem.innerHTML = '<span style="color: #999; font-style: italic;">No ignored sites</span>';
                historyList.appendChild(emptyItem);
                return;
            }

            ignoredSites.forEach((url, index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <span>${url}</span>
                    <button class="close-icon" data-index="${index}">❌</button>
                `;
                historyList.appendChild(listItem);
            });

            // Add event listeners for close icons
            const closeIcons = document.querySelectorAll('#history-list .close-icon');
            closeIcons.forEach(icon => {
                icon.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const index = e.target.getAttribute('data-index');
                    removeItem(index);
                });
            });
        });
    }

    function removeItem(index) {
        chrome.storage.sync.get('ignoredSites', (data) => {
            let ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];
            ignoredSites.splice(parseInt(index), 1);
            chrome.storage.sync.set({ ignoredSites: JSON.stringify(ignoredSites) }, () => {
                loadHistory();
                if (typeof checkUpdates === 'function') {
                    checkUpdates();
                }
            });
        });
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
