// Sign up page (Accounts – Muin): create an account, then go to the profile page.
const signupForm = document.getElementById('signup-form');
const signupMessage = document.getElementById('form-message');

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearMessage(signupMessage);

  const body = Object.fromEntries(new FormData(signupForm));
  if (body.password !== body.confirmPassword) {
    showMessage(signupMessage, 'Passwords do not match.');
    return;
  }

  withBusyButton(signupForm, async () => {
    try {
      await api('/auth/signup', { method: 'POST', body });
      window.location.href = '/profile.html?welcome=1';
    } catch (error) {
      showMessage(signupMessage, error.message);
    }
  });
});
