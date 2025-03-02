// ipDisplay.js

// 使用更可靠的API获取公网IP和归属地信息
fetch('https://ipapi.co/json/')
    .then(response => response.json())
    .then(data => {
        // 创建IP信息容器
        const ipInfoContainer = document.createElement('div');
        ipInfoContainer.id = 'ip-info-container';
        
        // 显示公网IP和归属地信息
        const publicIpElement = document.getElementById('public-ip');
        publicIpElement.textContent = `公网IP: ${data.ip}`;
        
        // 创建归属地信息元素
        const locationInfo = document.createElement('span');
        locationInfo.id = 'location-info';
        // 简化归属地信息，使其更紧凑
        locationInfo.textContent = `归属: ${data.country_name} ${data.region} ${data.city}`;
        
        // 创建ISP信息元素
        const ispInfo = document.createElement('span');
        ispInfo.id = 'isp-info';
        ispInfo.textContent = `ISP: ${data.org || '未知'}`;
        
        // 将归属地信息添加到send-url按钮中
        const sendUrlButton = document.getElementById('send-url');
        sendUrlButton.appendChild(ipInfoContainer);
        ipInfoContainer.appendChild(publicIpElement);
        ipInfoContainer.appendChild(locationInfo);
        ipInfoContainer.appendChild(ispInfo);
    })
    .catch(error => {
        console.error('Error fetching IP info from ipapi.co:', error);
        // 备用API
        fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => {
                const publicIpElement = document.getElementById('public-ip');
                publicIpElement.textContent = `公网IP: ${data.ip}`;
                
                // 使用IP获取归属地信息
                return fetch(`https://ipinfo.io/${data.ip}/json`);
            })
            .then(response => response.json())
            .then(data => {
                // 创建IP信息容器
                const ipInfoContainer = document.createElement('div');
                ipInfoContainer.id = 'ip-info-container';
                
                // 创建归属地信息元素
                const locationInfo = document.createElement('span');
                locationInfo.id = 'location-info';
                locationInfo.textContent = `归属: ${data.country} ${data.region} ${data.city}`;
                
                // 创建ISP信息元素
                const ispInfo = document.createElement('span');
                ispInfo.id = 'isp-info';
                ispInfo.textContent = `ISP: ${data.org || '未知'}`;
                
                // 将信息添加到send-url按钮中
                const sendUrlButton = document.getElementById('send-url');
                const publicIpElement = document.getElementById('public-ip');
                
                sendUrlButton.appendChild(ipInfoContainer);
                ipInfoContainer.appendChild(publicIpElement);
                ipInfoContainer.appendChild(locationInfo);
                ipInfoContainer.appendChild(ispInfo);
            })
            .catch(error => console.error('Error fetching IP info from backup API:', error));
    });

// 获取本地IP地址 - 改进版
function getLocalIP() {
    // 使用RTCPeerConnection获取本地IP
    const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(error => console.error('Error creating offer:', error));

    // 收集候选IP
    const candidates = [];

    pc.onicecandidate = (ice) => {
        if (ice && ice.candidate && ice.candidate.candidate) {
            candidates.push(ice.candidate.candidate);
        }
    };

    pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
            // 首先尝试找到192.168.开头的IP（常见内网IP）
            let foundIP = false;
            
            // 按优先级查找内网IP
            const prefixes = ['192.168.', '10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];
            
            for (const prefix of prefixes) {
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                    if (ipMatch && ipMatch[0].startsWith(prefix)) {
                        document.getElementById('private-ip').textContent = `内网IP: ${ipMatch[0]}`;
                        foundIP = true;
                        break;
                    }
                }
                if (foundIP) break;
            }
            
            // 如果没有找到内网IP，显示任何找到的IP
            if (!foundIP && candidates.length > 0) {
                for (let i = 0; i < candidates.length; i++) {
                    const candidate = candidates[i];
                    const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                    if (ipMatch && !ipMatch[0].startsWith('127.0.')) { // 排除localhost
                        document.getElementById('private-ip').textContent = `本地IP: ${ipMatch[0]}`;
                        break;
                    }
                }
            }
            
            // 关闭连接
            pc.close();
        }
    };
}

// 执行获取本地IP的函数
getLocalIP();
