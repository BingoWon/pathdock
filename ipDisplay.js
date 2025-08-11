document.addEventListener('DOMContentLoaded', async () => {
    const publicIpElement = document.getElementById('public-ip');
    const copyIpBtn = document.getElementById('copy-ip-btn');
    let currentIp = '';

    // Fetch public IP from api.ipify.org
    const fetchPublicIP = async () => {
        try {
            publicIpElement.textContent = 'Loading...';
            const response = await fetch('https://api.ipify.org?format=json');

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            currentIp = data.ip;
            publicIpElement.textContent = currentIp;
        } catch (error) {
            console.error('Error fetching IP:', error);
            publicIpElement.textContent = 'Error';
            currentIp = '';
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

    // Initial IP fetch
    await fetchPublicIP();
});