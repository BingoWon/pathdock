function extractVideoId(url) {
    if (url.includes('/watch?v=')) {
        // Case 1 watch?v=-CoIUNSsl04
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
    } else if (url.includes('/shorts/')) {
        // Case 2 shorts/dol2GgVE5Vs
        const match = url.match(/shorts\/([^/?]+)/);
        return match ? match[1] : null;
    } else {
        // Not a valid YouTube video link
        return null;
    }
}

function getVideoID(element) {

    const link = element.querySelector("a[href*='watch?v='], a[href*='shorts']");

    if (link) {
        return link ? extractVideoId(link.getAttribute("href")) : null;
    } else {
        // Special for video page
        return element.getAttribute("video-id") ?? null;
    }
}
