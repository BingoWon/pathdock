document.addEventListener('DOMContentLoaded', () => {
    const publicIpElement = document.getElementById('public-ip');
    const copyIpBtn = document.getElementById('copy-ip-btn');
    let currentIp = '';

    // Fetch public IP asynchronously (non-blocking)
    const fetchPublicIP = async () => {
        try {
            publicIpElement.textContent = '...';

            // Use cached IP if available
            const cached = localStorage.getItem('cachedIP');
            const cacheTime = localStorage.getItem('cachedIPTime');
            const cacheAge = Date.now() - (parseInt(cacheTime) || 0);

            // Show cached IP immediately if fresh (< 5 minutes)
            if (cached && cacheAge < 5 * 60 * 1000) {
                currentIp = cached;
                publicIpElement.textContent = currentIp;
            }

            // Fetch fresh IP in background
            const response = await fetch('https://api.ipify.org?format=json');
            if (!response.ok) throw new Error('Network error');

            const data = await response.json();
            currentIp = data.ip;
            publicIpElement.textContent = currentIp;

            // Cache the result
            localStorage.setItem('cachedIP', currentIp);
            localStorage.setItem('cachedIPTime', Date.now().toString());
        } catch (error) {
            console.error('Error fetching IP:', error);
            if (!currentIp) {
                publicIpElement.textContent = 'N/A';
            }
        }
    };

    // Copy IP to clipboard
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    };

    // Handle copy button click
    copyIpBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!currentIp) return;

        const success = await copyToClipboard(currentIp);

        if (success) {
            // Visual feedback
            const originalText = copyIpBtn.textContent;
            copyIpBtn.textContent = '✓';
            copyIpBtn.style.color = '#28a745';

            setTimeout(() => {
                copyIpBtn.textContent = originalText;
                copyIpBtn.style.color = '';
            }, 1000);
        }
    });

    // Initial IP fetch (non-blocking)
    fetchPublicIP();
});