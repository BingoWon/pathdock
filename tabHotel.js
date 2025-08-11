// const variable to store the number of buttons. -1 for plus button to add current tab to preferences.
const numberOfButtons = 5 * 8 - 1;

// Let's imagine this popup window as a hotel with 8 floors and each floor has 5 rooms.
// Every website in the browser history result is like a guest who wants to book a room.
// But there are only 34 rooms in total. What kind of guests can book a room?
// Here comes the rules:
//
// 1. A guest can book a room only if the room is not booked
// 2. Frequent guests get lower-numbered rooms by default.
// 3. Some guests have preferred rooms. Each room can only be preferred by one guest.
// 4. Some guests can be banned from booking a room, so they can't book a room.
// 5. Banned guests can book a room again if the boss is happy.

// URL validation utility
const isValidUrl = (urlString) => {
    try {
        const url = new URL(urlString);
        return ['http:', 'https:'].includes(url.protocol);
    } catch {
        return false;
    }
};

// Safe URL parsing utility
const safeParseUrl = (urlString) => {
    if (!isValidUrl(urlString)) return null;
    try {
        return new URL(urlString);
    } catch {
        return null;
    }
};

// This function manages room bookings for guests.
// The hotel is now accepting reservations.
// Each website from the browser history seeks to secure the lowest numbered room available.
// However, they must first provide their details.
const fetchHistory = () => {
    const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365;
    const oneYearAgo = Date.now() - millisecondsPerYear;

    return new Promise((resolve) => {
        chrome.history.search({
            text: '', // Search string is empty to get all history
            startTime: oneYearAgo,
            maxResults: 10000 // Large number to ensure capturing a lot of history
        }, resolve);
    });
};

// Banned guests should be filtered out.
// Only the first 34 guests who are not banned can book a room.
const processHistoryItems = (historyItems) => {
    return new Promise((resolve) => {
        chrome.storage.sync.get('ignoredSites', (data) => {
            const ignoredSites = (data.ignoredSites ? JSON.parse(data.ignoredSites) : [])
                .map(site => site.replace(/\/$/, ''));

            console.log("ignoredSites", ignoredSites);

            // Filter and process only valid URLs
            const validHistoryItems = historyItems.filter(item => isValidUrl(item.url));
            const mergedHistoryItems = normalizeAndMergeHistoryItems(validHistoryItems);
            const filteredHistoryItems = mergedHistoryItems.filter(item => !ignoredSites.includes(item.url));

            // Sort by visitCount in descending order and take top sites
            const topSites = filteredHistoryItems
                .sort((a, b) => b.visitCount - a.visitCount)
                .slice(0, numberOfButtons);

            // Create site data objects with validated URLs
            const topSitesData = topSites
                .filter(item => isValidUrl(item.url))
                .map(item => ({
                    title: item.title,
                    url: item.url.replace(/\/$/, ''),
                    isPreferred: false,
                }));

            resolve({ topSitesData, ignoredSites });
        });
    });
};

const normalizeAndMergeHistoryItems = (historyItems) => {
    // Normalize URLs by removing trailing slashes and merge items with same URL
    const urlMap = new Map();

    historyItems.forEach(item => {
        const normalizedUrl = item.url.replace(/\/$/, '');
        if (urlMap.has(normalizedUrl)) {
            urlMap.get(normalizedUrl).visitCount += item.visitCount;
        } else {
            urlMap.set(normalizedUrl, { ...item, url: normalizedUrl });
        }
    });

    return Array.from(urlMap.values());
};

// Frequent guests get lower-numbered rooms by default.
// Some guests have preferred rooms. Each room can only be preferred by one guest.
const allocateRooms = (topSitesData, ignoredSites) => {
    return new Promise((resolve) => {
        chrome.storage.sync.get('preferredRooms', (data) => {
            // Get preferred rooms and filter out ignored sites
            let preferredRooms = data.preferredRooms ? JSON.parse(data.preferredRooms) : [];
            preferredRooms = preferredRooms
                .map(siteData => siteData && !ignoredSites.includes(siteData.url) ? siteData : null)
                .slice(0, numberOfButtons);

            // Ensure array has correct length
            while (preferredRooms.length < numberOfButtons) {
                preferredRooms.push(null);
            }

            const allocatedRooms = new Array(numberOfButtons).fill(null);
            let topSitesIndex = 0;

            // Allocate rooms
            for (let index = 0; index < numberOfButtons; index++) {
                const preferredSiteData = preferredRooms[index];

                if (preferredSiteData && isValidUrl(preferredSiteData.url)) {
                    allocatedRooms[index] = preferredSiteData;
                } else {
                    // Find next available site that's not already preferred
                    while (topSitesIndex < topSitesData.length) {
                        const nextSiteData = topSitesData[topSitesIndex++];
                        if (!preferredRooms.some(room => room?.url === nextSiteData.url)) {
                            allocatedRooms[index] = nextSiteData;
                            break;
                        }
                    }
                }
            }

            console.log('Allocated rooms:', allocatedRooms);
            resolve(allocatedRooms);
        });
    });
};

const saveAllocatedRooms = async (newAllocatedRooms) => {
    const oldAllocatedRooms = await getAllocatedRooms();

    return new Promise((resolve, reject) => {
        chrome.storage.sync.set({ 'allocatedRooms': JSON.stringify(newAllocatedRooms) }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving allocated rooms:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                console.log('Allocated rooms saved locally.');
                const shouldReinit = !newAllocatedRooms.every((room, index) => {
                    const oldRoom = oldAllocatedRooms[index];
                    return oldRoom && room?.url === oldRoom.url &&
                           room?.title === oldRoom.title &&
                           room?.isPreferred === oldRoom.isPreferred;
                });

                console.log('shouldReinit in `saveAllocatedRooms`', shouldReinit);
                resolve([newAllocatedRooms, shouldReinit]); // Return as array for destructuring
            }
        });
    });
};

const getAllocatedRooms = () => {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('allocatedRooms', (data) => {
            if (chrome.runtime.lastError) {
                console.error('Error retrieving allocated rooms:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                const allocatedRooms = data.allocatedRooms ?
                    JSON.parse(data.allocatedRooms) :
                    new Array(numberOfButtons).fill(null);

                console.log('Allocated rooms retrieved successfully.', allocatedRooms);
                resolve(allocatedRooms);
            }
        });
    });
};

// All guests with a booked room are checking in to the hotel.
const checkIn = async (allocatedRooms, shouldReinit) => {
    console.log("shouldReinit", shouldReinit);

    if (!shouldReinit) return;

    console.log("Starting check-in...");

    const container = document.getElementById('buttons-container');
    container.innerHTML = ''; // Clear all existing buttons

    // Favicon manager will handle caching automatically

    // Create buttons for valid sites only
    allocatedRooms.forEach((siteData, index) => {
        if (siteData && isValidUrl(siteData.url)) {
            const button = createButtonForSite(siteData, index);
            if (button) { // Only append if button was successfully created
                container.appendChild(button);
            }
        }
    });

    addPlusButton(container);
};

const addPlusButton = (container) => {
    const plusButton = document.createElement('button');
    plusButton.textContent = '➕';
    plusButton.classList.add('plus-button');

    plusButton.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];

            // Validate current tab URL
            if (!currentTab?.url || !isValidUrl(currentTab.url)) {
                console.warn('Cannot add invalid or missing URL:', currentTab?.url);
                return;
            }

            chrome.storage.sync.get(['preferredRooms', 'ignoredSites'], (data) => {
                let preferredRooms = data.preferredRooms ? JSON.parse(data.preferredRooms) : [];
                let ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];

                // Ensure preferredRooms has correct length
                while (preferredRooms.length < numberOfButtons) {
                    preferredRooms.push(null);
                }
                preferredRooms = preferredRooms.slice(0, numberOfButtons);

                const currentTabUrl = currentTab.url.replace(/\/$/, '');

                // Remove current URL from ignored sites and preferred rooms
                ignoredSites = ignoredSites.filter(siteUrl => siteUrl !== currentTabUrl);
                preferredRooms = preferredRooms.map(siteData =>
                    siteData?.url === currentTabUrl ? null : siteData
                );

                // Find available slot
                const lastNonPreferredIndex = preferredRooms.lastIndexOf(null);
                console.log('Last non-preferred index:', lastNonPreferredIndex);

                if (lastNonPreferredIndex !== -1) {
                    preferredRooms[lastNonPreferredIndex] = {
                        url: currentTabUrl,
                        title: currentTab.title || new URL(currentTabUrl).hostname,
                        isPreferred: true
                    };

                    chrome.storage.sync.set({
                        'preferredRooms': JSON.stringify(preferredRooms),
                        'ignoredSites': JSON.stringify(ignoredSites)
                    }, () => {
                        console.log('Current tab added to preferred rooms.');
                        checkUpdates();
                    });
                } else {
                    console.log('No non-preferred slots available');
                }
            });
        });
    });

    container.appendChild(plusButton);
};


const createButtonForSite = (siteData, index) => {
    // Validate URL before creating button
    if (!isValidUrl(siteData.url)) {
        console.warn('Invalid URL detected, skipping button creation:', siteData.url);
        return null;
    }

    const parsedUrl = safeParseUrl(siteData.url);
    if (!parsedUrl) return null;

    const button = document.createElement('button');
    button.classList.add('button');

    // Create pin icon
    const pinIcon = createPinIcon(siteData, index);
    button.appendChild(pinIcon);

    // Create close icon
    const closeIcon = createCloseIcon(siteData);
    button.appendChild(closeIcon);

    // Create favicon
    const icon = createFavicon(parsedUrl);
    button.appendChild(icon);

    // Create title
    const title = document.createElement('span');
    title.textContent = siteData.title || parsedUrl.hostname;
    title.classList.add('title');
    button.appendChild(title);

    // Create URL display
    const urlSpan = document.createElement('span');
    urlSpan.textContent = parsedUrl.href.replace(/^https?:\/\//, '').replace(/\/$/, '');
    urlSpan.classList.add('url');
    button.appendChild(urlSpan);

    // Set button properties
    button.draggable = true;
    button.id = `site-${siteData.url}`;
    button.title = siteData.url;

    // Add click handler
    button.addEventListener('click', (e) => {
        if (e.button === 0 || e.button === 1) {
            closeAllNewTab();
            chrome.tabs.create({ url: siteData.url });
        }
    });

    addEventListenersToButton(button);
    return button;
};

// Helper function to create pin icon
const createPinIcon = (siteData, index) => {
    const pinIcon = document.createElement('span');
    pinIcon.innerHTML = `
        <svg class="pin-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M 9,4 C 9,4 8,5 8,6 C 8,7 9,8 9,8 L 6,15 L 9,15 L 11,22 L 13,15 L 16,15 L 13,8
                     C 13,8 14,7 14,6 C 14,5 13,4 13,4 Z"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
        </svg>
    `;
    pinIcon.classList.add('pin-icon');

    if (siteData.isPreferred) {
        pinIcon.classList.add('pin-icon-preferred');
    }

    pinIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (siteData.isPreferred) {
            removePreferredRooms(index);
        } else {
            addPreferredRooms(e.target.closest('button'));
        }
    });

    return pinIcon;
};

// Helper function to create close icon
const createCloseIcon = (siteData) => {
    const closeIcon = document.createElement('span');
    closeIcon.innerHTML = `
        <svg class="close-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6L18 18M6 18L18 6"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
        </svg>
    `;
    closeIcon.classList.add('close-icon');

    closeIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.storage.sync.get('ignoredSites', (data) => {
            const currentIgnoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];
            const uniqueIgnoredSites = [...new Set([...currentIgnoredSites, siteData.url])];
            chrome.storage.sync.set({ 'ignoredSites': JSON.stringify(uniqueIgnoredSites) }, () => {
                console.log('Ignored sites updated.');
                checkUpdates();
            });
        });
    });

    return closeIcon;
};

// Helper function to create favicon using original effective method
const createFavicon = (parsedUrl) => {
    const icon = document.createElement('img');
    icon.classList.add('icon');

    // Use original effective approach - directly read from storage
    chrome.storage.sync.get('favIconUrls', (data) => {
        const favIconUrls = data.favIconUrls ? JSON.parse(data.favIconUrls) : {};
        const hostname = parsedUrl.hostname;
        const hostnameWithPort = `${hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`;

        // GitHub special handling: the default favicon for github is white without background color which is not visible
        icon.src = (hostname !== "github.com" && favIconUrls[hostnameWithPort]) || `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
    });

    return icon;
};

// Function to add event listeners to the draggable buttons
// When the some of the guests are not satisfied with their room, they will ask to change the room.
// Boss can drag and drop the buttons to reallocate the guests.
// When the reallocation is done and the guest is happy, his current room will be the preferred room for this guest.
let draggedItem = null;     // `draggedItem` has to be global so it can be shared among buttons.
function addEventListenersToButton(button) {

    button.addEventListener('dragstart', function () {
        draggedItem = button;
        console.log(draggedItem);
        setTimeout(() => button.style.opacity = "0.5", 0); // Make the button semi-transparent while dragging
    });

    button.addEventListener('dragend', function () {
        setTimeout(() => {
            draggedItem.style.opacity = "1"; // Reset the opacity after dragging ends
            draggedItem = null;
        }, 0);
    });

    button.addEventListener('dragover', function (e) {
        e.preventDefault(); // Necessary to allow dropping
    });

    button.addEventListener('drop', function (e) {
        e.preventDefault();
        if (this !== draggedItem) {
            let allButtons = [...document.querySelectorAll('#buttons-container button')];
            let draggedIndex = allButtons.indexOf(draggedItem);
            let droppedIndex = allButtons.indexOf(this);

            if (draggedIndex < droppedIndex) {
                // print both indices
                console.log(this);
                console.log(draggedItem);
                this.parentNode.insertBefore(draggedItem, this.nextSibling);
            } else {
                this.parentNode.insertBefore(draggedItem, this);
            }
            addPreferredRooms(draggedItem); // Save the new order (preferred rooms) after a button is dropped
            checkUpdates();
        }
    });

}

const addPreferredRooms = (draggedItem) => {
    chrome.storage.sync.get('preferredRooms', (data) => {
        const oldPreferredRooms = data.preferredRooms ?
            JSON.parse(data.preferredRooms) :
            new Array(numberOfButtons).fill(null);

        const newPreferredRooms = new Array(numberOfButtons).fill(null);

        // Get all button URLs
        const buttons = [...document.querySelectorAll('#buttons-container button:not(.plus-button)')];
        const urls = buttons.map(button => button.title);

        const url = draggedItem.title;
        const index = urls.indexOf(url);

        if (index === -1 || !isValidUrl(url)) {
            console.warn('Invalid URL or button not found:', url);
            return;
        }

        const siteData = {
            title: draggedItem.querySelector('.title')?.textContent || '',
            url: url.replace(/\/$/, ''),
            isPreferred: true,
        };

        // Remove existing entry with same URL
        const filteredOldPreferredRooms = oldPreferredRooms.map(room =>
            room?.url === url ? null : room
        );

        // Add new preferred room
        newPreferredRooms[index] = siteData;

        // Re-add old preferred rooms without duplicates
        filteredOldPreferredRooms.forEach((roomData) => {
            if (roomData && isValidUrl(roomData.url)) {
                const roomIndex = urls.indexOf(roomData.url);
                if (roomIndex !== -1 && !newPreferredRooms[roomIndex]) {
                    newPreferredRooms[roomIndex] = roomData;
                }
            }
        });

        chrome.storage.sync.set({ 'preferredRooms': JSON.stringify(newPreferredRooms) }, () => {
            console.log('Preferred rooms updated.');
            checkUpdates();
        });
    });
};

const removePreferredRooms = (index) => {
    chrome.storage.sync.get('preferredRooms', (data) => {
        const preferredRooms = data.preferredRooms ? JSON.parse(data.preferredRooms) : [];

        if (index >= 0 && index < preferredRooms.length) {
            preferredRooms[index] = null;

            chrome.storage.sync.set({ 'preferredRooms': JSON.stringify(preferredRooms) }, () => {
                console.log('Preferred rooms updated.');
                checkUpdates();
            });
        }
    });
};

const checkUpdates = async () => {
    try {
        const historyItems = await fetchHistory();
        const data = await processHistoryItems(historyItems);
        const allocatedRooms = await allocateRooms(data.topSitesData, data.ignoredSites);
        const [newAllocatedRooms, shouldReinit] = await saveAllocatedRooms(allocatedRooms);
        await checkIn(newAllocatedRooms, shouldReinit);
    } catch (error) {
        console.error('Error in checkUpdates:', error);
        // Fallback: try to display whatever we can
        const container = document.getElementById('buttons-container');
        if (container && !container.children.length) {
            addPlusButton(container);
        }
    }
};

const initializeHotelBooking = () => {
    const initialSetup = {
        allocatedRooms: JSON.stringify(new Array(numberOfButtons).fill(null)),
        preferredRooms: JSON.stringify(new Array(numberOfButtons).fill(null)),
        ignoredSites: JSON.stringify([])
    };

    chrome.storage.sync.get(Object.keys(initialSetup), (data) => {
        const updates = {};
        Object.keys(initialSetup).forEach(key => {
            if (!data[key]) {
                updates[key] = initialSetup[key];
            }
        });

        if (Object.keys(updates).length > 0) {
            chrome.storage.sync.set(updates, () => {
                console.log('Initial storage setup completed');
                startBookingProcess();
            });
        } else {
            startBookingProcess();
        }
    });
};

const startBookingProcess = async () => {
    try {
        const allocatedRooms = await getAllocatedRooms();
        await checkIn(allocatedRooms, true); // Force initial render
        await checkUpdates();
    } catch (error) {
        console.error("Error in booking process:", error);
        // Fallback: ensure plus button is available
        const container = document.getElementById('buttons-container');
        if (container) {
            container.innerHTML = '';
            addPlusButton(container);
        }
    }
};

initializeHotelBooking();

// Function to display ignored sites
const displayIgnoredSites = () => {
    const ignoredSitesContainer = document.getElementById('ignored-sites-container');
    if (!ignoredSitesContainer) return;

    chrome.storage.sync.get('ignoredSites', (data) => {
        const ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];

        ignoredSitesContainer.innerHTML = '';

        ignoredSites.forEach(siteUrl => {
            if (isValidUrl(siteUrl)) {
                const siteElement = document.createElement('div');
                siteElement.textContent = siteUrl;
                ignoredSitesContainer.appendChild(siteElement);
            }
        });
    });
};

const resetButtonEvent = () => {
    chrome.storage.sync.set({
        'ignoredSites': JSON.stringify([]),
        'preferredRooms': JSON.stringify(new Array(numberOfButtons).fill(null))
    }, () => {
        console.log('Settings reset.');
        checkUpdates();
    });
};

// const resetButton = document.getElementById('reset-layout');
// resetButton.addEventListener('click', resetButtonEvent);

document.addEventListener('DOMContentLoaded', function () {
    const initLayoutButton = document.getElementById('init-layout');
    if (initLayoutButton) {
        initLayoutButton.addEventListener('click', function () {
            checkUpdates();
        });
    }
});

const closeAllNewTab = () => {
    chrome.tabs.query({}, (tabs) => {
        const newTabUrls = [
            "chrome://newtab/",
            "edge://newtab/",
            "chrome-search://local-ntp/local-ntp.html",
            "about:newtab"
        ];

        const tabIds = tabs
            .filter(tab => newTabUrls.some(url => tab.url.includes(url)) ||
                          tab.url.includes("newtab"))
            .map(tab => tab.id);

        if (tabIds.length > 0) {
            chrome.tabs.remove(tabIds, () => {
                if (chrome.runtime.lastError) {
                    console.log("Error closing tabs:", chrome.runtime.lastError.message);
                } else {
                    console.log(`Closed ${tabIds.length} new tab(s).`);
                }
            });
        }
    });
};
