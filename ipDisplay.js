// ipDisplay.js

// Fetch public IP address
fetch('https://api.ipify.org?format=json')
    .then(response => response.json())
    .then(data => {
        document.getElementById('public-ip').textContent = `Public IP: ${data.ip}`;
    })
    .catch(error => console.error('Error fetching public IP:', error));

// Fetch local IP address
function getLocalIP() {
    const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(error => console.error('Error creating offer:', error));

        // iterate `pc.onicecandidate` in reverse order.
        const candidates = [];

        pc.onicecandidate = (ice) => {
            if (ice && ice.candidate && ice.candidate.candidate) {
                candidates.push(ice.candidate.candidate);
            }
        };

        pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
                for (let i = candidates.length - 1; i >= 0; i--) {
                    const candidate = candidates[i];
                    const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                    // There will be a lot start with 192.168. We have to ensure it starts with 192.168.10.
                    if (ipMatch && ipMatch[0].startsWith('192.168.')) {
                        document.getElementById('private-ip').textContent = `Local IP: ${ipMatch[0]}`;
                        break; // Exit once the first matching IP is found
                    }
                }
            }
        };

}
getLocalIP();
