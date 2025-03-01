document.addEventListener('DOMContentLoaded', () => {
    const historyIcon = document.getElementById('history-icon');
    const historyDropdown = document.getElementById('history-dropdown');
    const historyList = document.getElementById('history-list');

    historyIcon.addEventListener('click', () => {
        // Toggle the visibility of the dropdown
        historyDropdown.classList.toggle('hidden');
        loadHistory();
    });

    function loadHistory() {
        chrome.storage.sync.get('ignoredSites', (data) => {
            const ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];
            historyList.innerHTML = ''; // Clear the list before populating
            ignoredSites.forEach((url, index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <span>${url}</span>
                    <button class="close-icon" data-index="${index}">❌</button>
                `;
                historyList.appendChild(listItem);
            });

            // Add event listeners for close icons
            const closeIcons = document.querySelectorAll('.close-icon');
            closeIcons.forEach(icon => {
                icon.addEventListener('click', (e) => {
                    const index = e.target.getAttribute('data-index');
                    removeItem(index);
                });
            });
        });
    }

    function removeItem(index) {
        chrome.storage.sync.get('ignoredSites', (data) => {
            let ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];
            ignoredSites.splice(index, 1); // Remove the item at the specified index
            chrome.storage.sync.set({ ignoredSites: JSON.stringify(ignoredSites) }, () => {
                console.log('Updated ignoredSites:', ignoredSites); // Log the updated array
                loadHistory(); // Refresh the list
            });
        });
    }
});
