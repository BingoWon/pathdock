document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('youtube-search-input');
    const searchButton = document.querySelector('#youtube-search button');

    // Function to handle the search
    function handleSearch() {
        const query = searchInput.value.trim();
        if (query) {
            // Construct the YouTube search URL
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            // Open the search URL in a new tab
            window.open(searchUrl, '_blank');
        }
    }

    // Event listener for the search input to listen for the "Enter" key press
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Event listener for the search button click
    searchButton.addEventListener('click', handleSearch);
});
