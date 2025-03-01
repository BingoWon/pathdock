// This script determine when context menu is opened and add block buttons depends on content type

(function () {
    console.log(window.location.href)
    const contentTags = ["ytd-rich-item-renderer", // video
        "ytd-video-renderer", // video
        "ytd-grid-video-renderer", // video on channel page
        "ytd-rich-grid-slim-media", // shorts
        "ytd-reel-item-renderer",  // shorts
        "ytd-compact-video-renderer", // video
        "ytd-comment-thread-renderer", // comment wrapper with replies
        "ytd-comment-renderer",  // comment
        "ytd-playlist-panel-video-renderer",  // Playlist on video page
        "ytd-playlist-video-renderer",  // Playlist on playlist page
        "ytd-backstage-post-thread-renderer", // post
        "ytd-reel-video-renderer",  // videos from shorts page
        "ytd-watch-metadata", // video page
        "ytd-channel-renderer", // Channel Blocks (Search / Channel)
        "ytd-radio-renderer",
        "ytd-universal-watch-card-renderer"];

    async function sendUrl(videoID) {
        const yt_url = "https://www.youtube.com/watch?v=" + videoID;
        console.log(yt_url)

        console.log('⏳ Sending URL...');
        try {
            const response = await fetch('http://localhost:8001', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: yt_url }),
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const result = await response.json(); // Assuming the server responds with JSON
            console.log('Success:', result);
            // Assuming 'result' contains a 'status' field to indicate success
            if (result.status === "success") {
                console.log('✅✅✅URL Sent Successfully✅✅✅'); // Update to reflect success
                // Close the tab if the current URL matches a YT video watching URL: https://www.youtube.com/watch?v=...
                // Since this content script can't use chrome.tabs, we have to send a message to background script
                chrome.runtime.sendMessage({ action: "closeCurrentTabIfYouTube" }, function (response) {
                    console.log(response.result);
                });
            } else {
                console.log('❌ Failed to Send URL ❌'); // Indicate failure
            }
        } catch (error) {
            console.error('Error:', error);
            console.log('❌ Error Sending URL ❌'); // Indicate error
        }
    }

    function createContextButton(type, rules, action) {

        const items = document.querySelector("ytd-menu-popup-renderer #items");
        const buttonAppended = items.querySelector("[type='" + type + "']");

        const container = document.querySelector("ytd-menu-popup-renderer");
        container.classList.add("ytb-dropdown-container");

        // Add button if not exist yet
        if (!buttonAppended) {

            // Create Button Wrapper
            var menuServiceItemRenderer = document.createElement('div');
            menuServiceItemRenderer.setAttribute('class', 'untrapContextMenuButtonWrapper');
            menuServiceItemRenderer.setAttribute('type', type);

            if (rules.id != null) {
                menuServiceItemRenderer.setAttribute('ruleID', rules.id);
            }

            // if (rules.name != null) {
            //     menuServiceItemRenderer.setAttribute('ruleName', rules.name);
            // }

            // Create Button Text
            var formattedString = document.createElement('div');
            formattedString.setAttribute('class', 'formattedString');
            // formattedString.textContent = BUTTON_TITLES[type];
            formattedString.textContent = "Send URL to localhost";

            // Create SVG element. This is a Star shape icon.
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" style="pointer-events: none; display: block;" class="formattedIcon"><path d="M12 .587l3.668 7.431 8.332 1.209-6.001 5.847 1.416 8.251L12 18.896l-7.415 3.929 1.416-8.251-6.001-5.847 8.332-1.209L12 .587z"/></svg>';

            menuServiceItemRenderer.innerHTML = svg;

            menuServiceItemRenderer.onclick = function () {
                console.log('Clicked');
                sendUrl(rules.id);
                // Remove focus
                document.activeElement.blur();

                // Click somewhere else to Hide Context Menu
                document.getElementById("untrap_settings").click();
            }

            // Append text to wrapper
            menuServiceItemRenderer.appendChild(formattedString);

            items.insertAdjacentElement("afterbegin", menuServiceItemRenderer);
        }
    }

    function blockChannelButton(element) {

        const channelID = getChannelID(element);
        const channelName = getChannelName(element);

        if ((channelID != null) || (channelName != null)) {

            const rules = {
                id: channelID,
                name: channelName
            }

            createContextButton("channel", rules);
        }
    }

    function blockVideoButton(element) {
        const videoID = getVideoID(element);

        if (videoID != null) {

            const rules = {
                id: videoID
            }

            // createContextButton("video", rules);
            createContextButton("BinCustom", rules);
        }
    }

    function blockCommentButton(element) {
        const commentID = getCommentID(element);

        if (commentID != null) {

            const rules = {
                id: commentID
            }

            createContextButton("comment", rules);
        }
    }

    function blockPostButton(element) {
        const postID = getPostID(element);

        if (postID != null) {

            const rules = {
                id: postID
            }

            createContextButton("post", rules);
        }
    }

    function addButtonsToContextMenu(contextMenu) {

        const element = selectedElement;

        if (element) {

            // const id = element.getAttribute("id");

            // if (element.querySelector("#comment-content")) {
            //     blockCommentButton(element);
            //     blockChannelButton(element);
            // } else if (element.querySelector("#post")) {
            //     blockPostButton(element);
            //     blockChannelButton(element);
            // } else {
            blockVideoButton(element);
            //     blockChannelButton(element);
            // }
        }
    }

    function contextMenuIsClosed(contextMenu) {
        // Add attribute
        contextMenu.setAttribute("contextMenuIsHidden", "");

        // Remove Buttons
        const buttons = contextMenu.querySelectorAll(".untrapContextMenuButtonWrapper");

        if (!buttons) return;

        for (const button of buttons) {
            button.remove();
        }

        selectedElement = null;
    }

    function contextMenuIsOpened(contextMenu) {

        // Remove attribute
        contextMenu.removeAttribute("contextMenuIsHidden");

        const items = contextMenu.querySelector("#items");

        if (!items) return;

        // Mutation to wait until popup is fully loaded and stable

        new MutationObserver(() => {

            // Check if context menu is not hidden

            if (contextMenu.hasAttribute("contextMenuIsHidden")) return;

            // Add buttons

            addButtonsToContextMenu(contextMenu);

        }).observe(items, { subtree: true, childList: true });

        // Add Buttons

        addButtonsToContextMenu(contextMenu);
    }

    function reactOnChanges() {
        const contextMenu = document.querySelector("tp-yt-iron-dropdown:has(#items)");

        if (!contextMenu) return;

        const isHidden = contextMenu.style.display == 'none';

        if (isHidden) {
            contextMenuIsClosed(contextMenu);
        } else if (!isHidden) {
            contextMenuIsOpened(contextMenu);
        }
    }

    function contextMenuChangedState() {

        // browser.storage.local.get([getConst.blocklistContextMenuButtonsData,
        // getConstNotSyncing.extensionIsEnabledData], function (obj) {

        //     const showContextButtons = obj[getConst.blocklistContextMenuButtonsData] ?? false;
        //     const extensionIsEnabled = obj[getConstNotSyncing.extensionIsEnabledData] ?? true;

        //     if ((showContextButtons) && (extensionIsEnabled)) {
        reactOnChanges();
        //     }
        // });
    }

    var selectedElement;

    function initialize() {

        // Context Menu show / hide observer

        var dropdownObserver = new MutationSummary({
            callback: contextMenuChangedState,
            queries: [
                // Context Menu on Desktop
                {
                    element: 'tp-yt-iron-dropdown',
                    elementAttributes: 'style'
                },

                // Context Menu on Mobile
            ]
        });

        // MARK: - Add Actions to More Buttons
        // Main task is to catch selected element so can show needed buttons in context menu

        document.addEventListener('click', function (event) {

            const element = event.target.closest(contentTags.join(', '));

            if (element) {
                selectedElement = element;
            }

        });
    }

    initialize();

})();
