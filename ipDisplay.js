// ipDisplay.js

// Helper function to hide unused elements
function hideUnusedElements() {
    const elementsToHide = ['location-info', 'city-isp-info'];
    elementsToHide.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

// Helper function to update public IP display
function updatePublicIPDisplay(ip, locationData = null) {
    const publicIpElement = document.getElementById('public-ip');
    if (locationData && locationData.country && locationData.region && locationData.city) {
        publicIpElement.textContent = `Public IP: ${ip} (${locationData.country}, ${locationData.region}, ${locationData.city})`;
    } else {
        publicIpElement.textContent = `Public IP: ${ip}`;
    }
    hideUnusedElements();
}

// Fetch public IP and location information
async function fetchPublicIPInfo() {
    try {
        // Get IP address
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const ip = ipData.ip;

        try {
            // Try to get location information
            const locationResponse = await fetch(`https://ipinfo.io/${ip}/json`);
            const locationData = await locationResponse.json();
            updatePublicIPDisplay(ip, locationData);
        } catch (locationError) {
            console.error('Error fetching location info:', locationError);
            // Display IP without location if location fetch fails
            updatePublicIPDisplay(ip);
        }
    } catch (error) {
        console.error('Error fetching IP info:', error);
    }
}

// Initialize public IP fetching
fetchPublicIPInfo();

// Helper function to extract IP from candidate string
function extractIPFromCandidate(candidate) {
    const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
    return ipMatch ? ipMatch[0] : null;
}

// Helper function to check if IP is private
function isPrivateIP(ip) {
    const privateRanges = [
        '192.168.',
        '10.',
        // 172.16.0.0 to 172.31.255.255
        '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
        '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'
    ];
    return privateRanges.some(range => ip.startsWith(range));
}

// Helper function to find best local IP from candidates
function findBestLocalIP(candidates) {
    const ips = candidates
        .map(extractIPFromCandidate)
        .filter(ip => ip && !ip.startsWith('127.0.')); // Exclude localhost

    // Prefer private IPs
    const privateIP = ips.find(isPrivateIP);
    if (privateIP) return privateIP;

    // Return any valid IP if no private IP found
    return ips[0] || null;
}

// Get local IP address using WebRTC
function getLocalIP() {
    try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        const candidates = [];

        pc.createDataChannel('');
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .catch(error => console.error('Error creating offer:', error));

        pc.onicecandidate = (ice) => {
            if (ice?.candidate?.candidate) {
                candidates.push(ice.candidate.candidate);
            }
        };

        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
                const localIP = findBestLocalIP(candidates);
                if (localIP) {
                    document.getElementById('private-ip').textContent = `Local IP: ${localIP}`;
                }
                pc.close();
            }
        };
    } catch (error) {
        console.error('Error getting local IP:', error);
    }
}

// Execute the function to get local IP
getLocalIP();
