// ==UserScript==
// @name     DuckDuckGo Multi-search bar Centralizer
// @namespace  http://tampermonkey.net/
// @version  1.0
// @description  Center the SEJ container on DuckDuckGo search results page
// @author   Your Name
// @match    https://duckduckgo.com/*
// @grant    none
// ==/UserScript==

(function () {
    "use strict";

    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
        } else {
            setTimeout(() => waitForElement(selector, callback), 100);
        }
    }

    function adjustSEJContainer() {
        waitForElement("#sej-container", (sejContainer) => {
            waitForElement(".react-results--main", (resultItems) => {
                const resultItemsRect = resultItems.getBoundingClientRect();
                const style = document.createElement("style");
                style.type = "text/css";
                style.innerHTML = `
          #sej-container {
            margin-left: ${resultItemsRect.left}px;
            display: block;
          }
        `;
                document.head.appendChild(style);
                console.log("SEJ container has been aligned with mainline.");
            });
        });
    }

    // Call initially on page load
    adjustSEJContainer();

    // Adjust SEJ container on page load
    window.addEventListener("DOMContentLoaded", adjustSEJContainer);

    // Adjust when the window is resized for dynamic adjustments
    window.addEventListener("resize", adjustSEJContainer);
})();
