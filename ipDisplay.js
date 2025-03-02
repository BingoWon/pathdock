// ipDisplay.js

// Use a reliable API to fetch public IP and location information
fetch('https://ipapi.co/json/')
    .then(response => response.json())
    .then(data => {
        // Display public IP information
        const publicIpElement = document.getElementById('public-ip');
        publicIpElement.textContent = `Public IP: ${data.ip}`;
        
        // Update location information element
        const locationInfo = document.getElementById('location-info');
        // Simplified location information for compact display
        locationInfo.textContent = `Location: ${data.country_name}, ${data.region}`;
        
        // Update city and ISP information element
        const cityIspInfo = document.getElementById('city-isp-info');
        cityIspInfo.textContent = `${data.city} (${data.org || 'Unknown'})`;
    })
    .catch(error => {
        console.error('Error fetching IP info from ipapi.co:', error);
        // Backup API
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                const publicIpElement = document.getElementById('public-ip');
                publicIpElement.textContent = `Public IP: ${data.ip}`;
                
                // Use IP to get location information
                return fetch(`https://ipinfo.io/${data.ip}/json`);
            })
            .then(response => response.json())
            .then(data => {
                // Update location information element
                const locationInfo = document.getElementById('location-info');
                locationInfo.textContent = `Location: ${data.country}, ${data.region}`;
                
                // Update city and ISP information element
                const cityIspInfo = document.getElementById('city-isp-info');
                cityIspInfo.textContent = `${data.city} (${data.org || 'Unknown'})`;
            })
            .catch(error => console.error('Error fetching IP info from backup API:', error));
    });

// Get local IP address - improved version
function getLocalIP() {
    // Use RTCPeerConnection to get local IP
    const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(error => console.error('Error creating offer:', error));

    // Collect candidate IPs
    const candidates = [];

    pc.onicecandidate = (ice) => {
        if (ice && ice.candidate && ice.candidate.candidate) {
            candidates.push(ice.candidate.candidate);
        }
    };

    pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
            // First try to find IPs starting with 192.168. (common private IPs)
            let foundIP = false;
            
            // Search for private IPs by priority
            const prefixes = ['192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];
            
            for (const prefix of prefixes) {
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                    if (ipMatch && ipMatch[0].startsWith(prefix)) {
                        document.getElementById('private-ip').textContent = `Local IP: ${ipMatch[0]}`;
                        foundIP = true;
                        break;
                    }
                }
                if (foundIP) break;
            }
            
            // If no private IP is found, display any IP found
            if (!foundIP && candidates.length > 0) {
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                    if (ipMatch && !ipMatch[0].startsWith('127.0.')) { // Exclude localhost
                        document.getElementById('private-ip').textContent = `Local IP: ${ipMatch[0]}`;
                        break;
                    }
                }
            }
            
            // Close connection
            pc.close();
        }
    };
}

// Execute the function to get local IP
getLocalIP();
