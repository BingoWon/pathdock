
(function () {
    // Locate the password input element and the login button
    var passwordInput = document.getElementById('cbi-input-password');
    var loginButton = document.querySelector('input.cbi-button.cbi-button-apply');

    // Check if elements are found and proceed with the login
    if (passwordInput && loginButton) {
        passwordInput.value = 'password'; // Set the password
        loginButton.click(); // Click the login button
    } else {
        console.log('Login elements not found');
    }
})();
