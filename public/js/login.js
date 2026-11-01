// Log in page (Accounts – Muin): check email + password, then go to the home page.
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('form-message');

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearMessage(loginMessage);

  withBusyButton(loginForm, async () => {
    try {
      await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(loginForm)) });
      window.location.href = '/home.html';
    } catch (error) {
      showMessage(loginMessage, error.message);
    }
  });
});
