// Admin log in page (Accounts – Muin): check username + password, then go to the dashboard.
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginMessage = document.getElementById('form-message');

adminLoginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearMessage(adminLoginMessage);
  withBusyButton(adminLoginForm, async () => {
    try {
      await api('/admin/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(adminLoginForm)) });
      window.location.href = '/admin/dashboard.html';
    } catch (error) {
      showMessage(adminLoginMessage, error.message);
    }
  });
});
