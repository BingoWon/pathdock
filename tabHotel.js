// const variable to store the number of buttons. -1 for plus button to add current tab to preferences.
const numberOfButtons = 5 * 7 - 1;

// Let's imagine this popup window as a hotel with 5 floors and each floor has 5 rooms.
// Every website in the browser history result is like a guest who wants to book a room.
// But there are only 34 rooms in total. What kind of guests can book a room?
// Here comes the rules:
//
// 1. A guest can book a room only if the room is not booked
// 2. Frequent guests get lower-numbered rooms by default.
// 3. Some guests have preferred rooms. Each room can only be preferred by one guest.
// 4. Some guests can be banned from booking a room, so they can't book a room.
// 5. Banned guests can book a room again if the boss is happy.

// This function manages room bookings for guests.
// The hotel is now accepting reservations.
// Each website from the browser history seeks to secure the lowest numbered room available.
// However, they must first provide their details.
function fetchHistory() {
    return new Promise((resolve, reject) => {
        const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365;
        const oneYearAgo = (new Date()).getTime() - millisecondsPerYear;
        chrome.history.search({
            'text': '', // Search string is empty to get all history
            'startTime': oneYearAgo,
            'maxResults': 10000 // Large number to ensure capturing a lot of history
        }, historyItems => resolve(historyItems)); // Directly resolve with historyItems
    });
}

// Banned guests should be filtered out.
// Only the first 34 guests who are not banned can book a room.
function processHistoryItems(historyItems) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('ignoredSites', function (data) {
            let ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];
            ignoredSites = ignoredSites.map(site => site.replace(/\/$/, ''));
            console.log("ignoredSites", ignoredSites);

            // Call the new function to normalize and merge history items
            const mergedHistoryItems = normalizeAndMergeHistoryItems(historyItems);

            const filteredHistoryItems = mergedHistoryItems.filter(item => !ignoredSites.includes(item.url));
            // Sort history items by visitCount in descending order
            filteredHistoryItems.sort((a, b) => b.visitCount - a.visitCount);
            // No need to keep all guests to wait for a room.
            const topSites = filteredHistoryItems.slice(0, numberOfButtons);
            // An array whose items are dict objects.
            const topSitesData = topSites.map(item => ({
                title: item.title,
                url: item.url.replace(/\/$/, ''),
                isPreferred: false,
            }));

            resolve({ topSitesData, ignoredSites });
        });
    });
}

function normalizeAndMergeHistoryItems(historyItems) {
    // Normalize URLs by removing trailing slashes
    const normalizedHistoryItems = historyItems.map(item => ({
        ...item,
        url: item.url.replace(/\/$/, '') // Remove trailing slash if present
    }));

    // Merge items with the same URL
    const mergedHistoryItems = normalizedHistoryItems.reduce((acc, item) => {
        const existingItem = acc.find(accItem => accItem.url === item.url);
        if (existingItem) {
            existingItem.visitCount += item.visitCount; // Merge visit counts
        } else {
            acc.push(item);
        }
        return acc;
    }, []);

    return mergedHistoryItems;
}

// Frequent guests get lower-numbered rooms by default.
// Some guests have preferred rooms. Each room can only be preferred by one guest.
function allocateRooms(topSitesData, ignoredSites) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('preferredRooms', function (data) {
            // `allocatedRooms` used directly as the array of allocated rooms (siteData).
            let preferredRooms = data.preferredRooms ? JSON.parse(data.preferredRooms) : new Array(numberOfButtons).fill(null);

            // Replace ignored sites in preferredRooms with null
            preferredRooms = preferredRooms.map(siteData => siteData && !ignoredSites.includes(siteData.url) ? siteData : null);

            // Ensure preferredRooms array has a length equal to numberOfButtons, filling new slots with null if needed
            preferredRooms.length = numberOfButtons; // This truncates the array if it's longer than numberOfButtons
            preferredRooms.fill(null, preferredRooms.length, numberOfButtons); // This fills new slots with null if the array was shorter
            // console.log("preferredRooms", preferredRooms);

            const allocatedRooms = new Array(numberOfButtons).fill(null);

            let topSitesIndex = 0;

            allocatedRooms.forEach((room, index) => {
                const preferredSiteData = preferredRooms[index];
                // console.log(index, preferredSiteData);

                if (preferredSiteData) {
                    allocatedRooms[index] = preferredSiteData;
                } else {
                    // If the room is not preferred, assign it to the next most frequent guest.
                    while (true) {
                        // raise an error if the index is out of bounds
                        if (topSitesIndex >= topSitesData.length) {
                            throw new Error('Out of bounds when allocating rooms!!!');
                        }
                        // Get the next site data
                        const nextSiteData = topSitesData[topSitesIndex++];
                        // if this url is not in the preferred array, it must be useable.
                        if (!preferredRooms.some(room => room && room.url === nextSiteData.url)) {
                            allocatedRooms[index] = nextSiteData;
                            break;
                        }
                    }
                }
            });
            console.log('Allocated rooms:', allocatedRooms);
            // Resolve the promise after all rooms have been allocated
            resolve(allocatedRooms);
        });
    });
}

async function saveAllocatedRooms(newAllocatedRooms) {
    // Before saving, we need to check if allocatedRooms has any changes.
    // If true, we need to reinitialize the window after saving.
    const oldAllocatedRooms = await getAllocatedRooms();

    return new Promise((resolve, reject) => {
        chrome.storage.sync.set({ 'allocatedRooms': JSON.stringify(newAllocatedRooms) }, function () {
            if (chrome.runtime.lastError) {
                console.error('Error saving allocated rooms:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                console.log('Allocated rooms saved locally.');
                const shouldReinit = !newAllocatedRooms.every((room, index) => {
                    const oldRoom = oldAllocatedRooms[index];
                    return oldRoom && room.url === oldRoom.url && room.title === oldRoom.title && room.isPreferred === oldRoom.isPreferred;
                });
                // console.log('oldAllocatedRooms', oldAllocatedRooms);
                console.log('shouldReinit in `saveAllocatedRooms`', shouldReinit);
                // console.log('newAllocatedRooms', newAllocatedRooms);
                resolve(newAllocatedRooms, shouldReinit);
            }
        });
    });
}

function getAllocatedRooms() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get('allocatedRooms', function (data) {
            if (chrome.runtime.lastError) {
                console.error('Error retrieving allocated rooms:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                if (!data.allocatedRooms) {
                    // Instead of rejecting, return an empty array
                    resolve(new Array(numberOfButtons).fill(null));
                } else {
                    const oldAllocatedRooms = JSON.parse(data.allocatedRooms);
                    console.log('Allocated rooms retrieved successfully.', oldAllocatedRooms);
                    resolve(oldAllocatedRooms);
                }
            }
        });
    });
}

// All 34 guests with a booked room are checking in to the hotel.
function checkIn(allocatedRooms, shouldReinit) {
    console.log("shouldReinit", shouldReinit);
    return new Promise((resolve, reject) => {
        if (!shouldReinit) resolve();
        console.log("Starting check-in...");

        // Now, allocatedRooms array contains the sites allocated to each room, some might still be null if there were less sites than rooms
        // Make sure all rooms are empty.
        const container = document.getElementById('buttons-container');
        container.innerHTML = ''; // This line clears all existing buttons
        // Here you can update the UI accordingly, for example:
        allocatedRooms.forEach((siteData, index) => {
            if (siteData !== null) {
                // Correctly create a button for the site
                const button = createButtonForSite(siteData, index);
                container.appendChild(button); // Append the button to the container
            }
        });
        addPlusButton(container); // Add a plus button to the container
        resolve(); // Resolve the promise when done
    });
}

function addPlusButton(container) {
    const plusButton = document.createElement('button');
    plusButton.textContent = '➕'; // Heavy Plus Sign emoji
    plusButton.classList.add('plus-button'); // Ensure you have CSS for this class to style the button

    plusButton.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const currentTab = tabs[0]; // Assuming the first tab is the one you want
            chrome.storage.sync.get(['preferredRooms', 'ignoredSites'], function (data) {
                let preferredRooms = data.preferredRooms ? JSON.parse(data.preferredRooms) : [];
                // Ensure preferredRooms array has a length equal to numberOfButtons, filling new slots with null if needed
                preferredRooms.length = numberOfButtons; // This truncates the array if it's longer than numberOfButtons
                preferredRooms.fill(null, preferredRooms.length, numberOfButtons); // This fills new slots with null if the array was shorter

                console.log('preferredRooms!!!!!', preferredRooms);
                let ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];

                const currentTabUrl = currentTab.url.replace(/\/$/, '');
                // Remove the current tab's URL from ignoredSites and preferredRooms if it exists
                ignoredSites = ignoredSites.filter(siteUrl => siteUrl !== currentTabUrl);
                preferredRooms = preferredRooms.map(siteData => siteData && siteData.url === currentTabUrl ? null : siteData);

                // Find the last non-preferred item
                const lastNonPreferredIndex = preferredRooms.lastIndexOf(null);
                console.log('Last non-preferred index:', lastNonPreferredIndex);
                if (lastNonPreferredIndex !== -1) {
                    preferredRooms[lastNonPreferredIndex] = {
                        url: currentTabUrl,
                        title: currentTab.title,
                        isPreferred: true // Mark as preferred
                    };

                    // Save the updated preferredRooms and ignoredSites
                    chrome.storage.sync.set({ 'preferredRooms': JSON.stringify(preferredRooms), 'ignoredSites': JSON.stringify(ignoredSites) }, function () {
                        console.log('Current tab added to preferred rooms and removed from ignored sites if it was there.');
                        // Optionally, refresh the UI or perform additional actions
                        checkUpdates();
                    });
                } else {
                    console.log('No non-preferred slots available');
                }
            });
        });
    });
    container.appendChild(plusButton);
}


function createButtonForSite(siteData, index) {
    const button = document.createElement('button');
    button.classList.add('button');

    const pinIcon = document.createElement('span');
    // 新的图钉 SVG 图标设计
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
        // Replace color style with class
        pinIcon.classList.add('pin-icon-preferred');
    }
    
    pinIcon.addEventListener('click', function (e) {
        e.stopPropagation();
        if (siteData.isPreferred) {
            removePreferredRooms(index);
        } else {
            addPreferredRooms(button);
        }
    });
    button.appendChild(pinIcon);

    const closeIcon = document.createElement('span');
    // 新的关闭按钮 SVG 图标设计
    closeIcon.innerHTML = `
        <svg class="close-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6L18 18M6 18L18 6" 
                  stroke-linecap="round"
                  stroke-linejoin="round" />
        </svg>
    `;
    closeIcon.classList.add('close-icon');

    // Attach event listener for removing the site and updating ignoredSites
    closeIcon.addEventListener('click', function (e) {
        e.stopPropagation();
        // Fetch the current list of ignoredSites before updating
        chrome.storage.sync.get('ignoredSites', function (data) {
            const currentIgnoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];
            const updatedIgnoredSites = [...currentIgnoredSites, siteData.url];
            // Remove duplicates
            const uniqueIgnoredSites = updatedIgnoredSites.filter((site, index, self) => self.indexOf(site) === index);
            chrome.storage.sync.set({ 'ignoredSites': JSON.stringify(uniqueIgnoredSites) }, function () {
                console.log('Ignored sites updated.');
                // Optionally, refresh the UI or perform additional actions
                checkUpdates();
            });
        });
    });

    button.appendChild(closeIcon);

    const icon = document.createElement('img');
    chrome.storage.sync.get('favIconUrls', function (data) {
        const favIconUrls = data.favIconUrls ? JSON.parse(data.favIconUrls) : {};
        const hostname = new URL(siteData.url).hostname
        const hostnameWithPort = `${hostname}${new URL(siteData.url).port ? ':' + new URL(siteData.url).port : ''}`;
        // the default favicon for github is white without background color which is not visible.
        icon.src = (hostname !== "github.com") && favIconUrls[hostnameWithPort] || `https://www.google.com/s2/favicons?domain=${new URL(siteData.url).hostname}`;
    });
    icon.classList.add('icon');

    const title = document.createElement('span');
    title.textContent = siteData.title || new URL(siteData.url).hostname;
    title.classList.add('title');

    const url = document.createElement('span');
    url.textContent = new URL(siteData.url).href.replace(/^https?:\/\//, '').replace(/\/$/, '');
    url.classList.add('url');

    button.appendChild(icon);
    button.appendChild(title);
    button.appendChild(url);

    button.draggable = true;
    button.id = `site-${siteData.url}`;
    button.addEventListener('click', function (e) {
        if (e.button === 0 || e.button === 1) { // 0: Left mouse button, 1: Middle mouse button, response quicker now.
            closeAllNewTab();
            chrome.tabs.create({ url: siteData.url });
        }
    });
    button.title = siteData.url;

    addEventListenersToButton(button);

    return button; // Make sure to return the button element
}

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

function addPreferredRooms(draggedItem) {
    // Remember all guests who have preferred rooms and update their new preferred room
    chrome.storage.sync.get('preferredRooms', function (data) {
        const oldPreferredRooms = data.preferredRooms ? JSON.parse(data.preferredRooms) : new Array(numberOfButtons).fill(null);
        let newPreferredRooms = new Array(numberOfButtons).fill(null);

        // Fetch the indices of all button elements by their url
        const buttons = [...document.querySelectorAll('#buttons-container button')];
        const urls = buttons.map(button => button.title);

        // New preferred room.
        const url = draggedItem.title;
        const index = urls.indexOf(url);
        const siteData = {
            title: draggedItem.querySelector('.title').textContent,
            url: url.replace(/\/$/, ''),
            isPreferred: true,
        }

        // Remove any existing entry with the same URL from oldPreferredRooms
        const filteredOldPreferredRooms = oldPreferredRooms.map(room => room && room.url === url ? null : room);

        // Add the new preferred room
        newPreferredRooms[index] = siteData;

        // Re-add the old preferred rooms, ensuring no duplicates for the new URL
        filteredOldPreferredRooms.forEach((siteData) => {
            if (siteData !== null) {
                const index = urls.indexOf(siteData.url);
                if (newPreferredRooms[index] === null) { // Ensure not to overwrite the newly added preferred room
                    newPreferredRooms[index] = siteData;
                }
            }
        });

        chrome.storage.sync.set({ 'preferredRooms': JSON.stringify(newPreferredRooms) }, function () {
            checkUpdates();
            console.log('Preferred rooms updated.');
        });
    });
}

function removePreferredRooms(index) {
    chrome.storage.sync.get('preferredRooms', function (data) {
        // The two arrays below have object elements which contain `url` and `title` properties.
        const preferredRooms = JSON.parse(data.preferredRooms);
        preferredRooms[index] = null;
        // Update the preferred rooms
        chrome.storage.sync.set({ 'preferredRooms': JSON.stringify(preferredRooms) }, function () {
            checkUpdates();
            console.log('Preferred rooms updated.');
        });
    });
}

function checkUpdates() {
    return fetchHistory()
        .then(processHistoryItems)
        .then(data => allocateRooms(data.topSitesData, data.ignoredSites))
        .then(saveAllocatedRooms)
        .then((newAllocatedRooms, shouldReinit) => checkIn(newAllocatedRooms, shouldReinit))
    // .then(displayIgnoredSites)W
}

function initializeHotelBooking() {
    // First ensure we have empty arrays for all storage items
    const initialSetup = {
        allocatedRooms: JSON.stringify(new Array(numberOfButtons).fill(null)),
        preferredRooms: JSON.stringify(new Array(numberOfButtons).fill(null)),
        ignoredSites: JSON.stringify([]),
        favIconUrls: JSON.stringify({})
    };

    chrome.storage.sync.get(Object.keys(initialSetup), function(data) {
        // Set any missing storage items with initial values
        const updates = {};
        Object.keys(initialSetup).forEach(key => {
            if (!data[key]) {
                updates[key] = initialSetup[key];
            }
        });

        if (Object.keys(updates).length > 0) {
            chrome.storage.sync.set(updates, function() {
                console.log('Initial storage setup completed');
                startBookingProcess();
            });
        } else {
            startBookingProcess();
        }
    });
}

function startBookingProcess() {
    getAllocatedRooms()
        .then(checkIn)
        .then(checkUpdates)
        .catch(error => {
            console.error("An error occurred:", error);
            // If there's still an error, force a complete refresh
            return checkUpdates();
        });
}

initializeHotelBooking();

// Function to display ignored sites
function displayIgnoredSites() {
    const ignoredSitesContainer = document.getElementById('ignored-sites-container');
    // Correctly retrieve ignoredSites using a callback function
    chrome.storage.sync.get('ignoredSites', function (data) {
        const ignoredSites = data.ignoredSites ? JSON.parse(data.ignoredSites) : [];

        // Clear existing list
        ignoredSitesContainer.innerHTML = '';

        // Populate with updated list of ignored sites
        ignoredSites.forEach(siteUrl => {
            const siteElement = document.createElement('div');
            siteElement.textContent = siteUrl;
            ignoredSitesContainer.appendChild(siteElement);
        });
    });
}

function resetButtonEvent() {
    chrome.storage.sync.set({ 'ignoredSites': JSON.stringify([]) }, function () {
        const emptyPreferredRooms = new Array(numberOfButtons).fill(null);
        chrome.storage.sync.set({ 'preferredRooms': JSON.stringify(emptyPreferredRooms) }, function () {
            console.log('Ignored sites cleared.');
            // Optionally, refresh the UI or perform additional actions
            checkUpdates();
        });
    });
}

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

function closeAllNewTab() {
    chrome.tabs.query({}, function (tabs) { // Query all tabs without specifying URL to bypass restrictions
        const tabIds = tabs.filter(tab =>
            tab.url.includes("*://*/*newtab*") ||
            tab.url === "chrome-search://local-ntp/local-ntp.html" // the new tab URL in Edge.
        ).map(tab => tab.id);

        if (tabIds.length > 0) {
            chrome.tabs.remove(tabIds, function () {
                if (chrome.runtime.lastError) {
                    console.log("Error closing tabs: ", chrome.runtime.lastError.message);
                } else {
                    console.log("Closed all 'newtab' tabs and 'chrome-search://local-ntp/local-ntp.html'.");
                }
            });
        } else {
            console.log("No 'newtab' or 'chrome-search://local-ntp/local-ntp.html' tabs found to close.");
        }
    });
}
