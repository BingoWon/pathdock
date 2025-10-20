document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('youtube-search-input');
    const searchButton = document.querySelector('#youtube-search button');

    // Handle YouTube search
    const handleSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            browserAPI.tabs.create({ url: searchUrl });
        }
    };

    // Event listeners
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    searchButton.addEventListener('click', handleSearch);

    // Auto-focus search input for better UX
    searchInput.focus();
});
