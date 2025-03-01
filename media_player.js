document.addEventListener('DOMContentLoaded', async function () {
    const sendUrlButton = document.getElementById('send-url');
    if (sendUrlButton) {
        sendUrlButton.addEventListener('click', async function () {
            chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
                const currentTab = tabs[0];
                if (currentTab && currentTab.url) {
                    // Indicate that the request is being made// Indicate that the request is being made
                    sendUrlButton.textContent = '⏳ Sending URL...';
                    sendUrlButton.style.backgroundColor = '#f0ad4e'; // Change to a color that corresponds with the waiting message, e.g., a yellow or orange shade
                    sendUrlButton.disabled = true; // Optionally disable the button to prevent multiple clicks
                    try {
                        const response = await fetch('http://localhost:8001', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ url: currentTab.url }),
                        });
                        const result = await response.json(); // Assuming the server responds with JSON
                        console.log('Success:', result);
                        if (result.status === "success") {
                            sendUrlButton.textContent = '✅✅✅URL Sent Successfully✅✅✅'; // Update button text
                            // Close the current active tab
                            chrome.tabs.remove(currentTab.id);
                        } else {
                            // Handle non-success status
                            sendUrlButton.textContent = '❌ Failed to Send URL ❌'; // Indicate failure
                            sendUrlButton.style.backgroundColor = '#ffcccc'; // Optional: change button color to indicate error
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        sendUrlButton.textContent = '❌ Error Sending URL ❌'; // Indicate error
                        sendUrlButton.style.backgroundColor = '#ffcccc'; // Optional: change button color to indicate error
                    } finally {
                        // Re-enable the button after the request is completed or failed
                        sendUrlButton.disabled = false;
                    }
                }
            });
        });
    }
});
