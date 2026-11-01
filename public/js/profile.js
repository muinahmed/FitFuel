// Profile page (Accounts – Muin): goal and diet, weekly budget, account details and password.

function fillBudget(account) {
  document.getElementById('weeklyBudget').value = account.weeklyBudget > 0 ? Number(account.weeklyBudget).toFixed(2) : '';
}

function fillDetails(account) {
  document.getElementById('fullName').value = account.fullName;
  document.getElementById('email').value = account.email;
}

// Put the saved values into all forms
function fillForms(account) {
  document.getElementById('goal').value = account.goal || '';
  document.getElementById('dietType').value = account.dietType || 'none';
  fillBudget(account);
  fillDetails(account);
}

// Wire a form to an API endpoint. onSaved runs with the response after a successful save.
function handleForm(formId, messageId, path, successText, onSaved) {
  const form = document.getElementById(formId);
  const message = document.getElementById(messageId);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearMessage(message);
    withBusyButton(form, async () => {
      try {
        const result = await api(path, { method: 'PUT', body: Object.fromEntries(new FormData(form)) });
        showMessage(message, successText, 'success');
        if (onSaved) onSaved(result, form);
      } catch (error) {
        showMessage(message, error.message);
      }
    });
  });
}

async function loadProfile() {
  const pageMessage = document.getElementById('page-message');
  if (new URLSearchParams(window.location.search).has('welcome')) {
    showMessage(pageMessage, 'Welcome to FitFuel! Start by choosing your goal, diet and weekly food budget.', 'info');
  }

  try {
    fillForms(await api('/users/me'));
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

handleForm('goal-form', 'goal-message', '/users/me/profile', 'Goal and diet saved.');
handleForm('budget-form', 'budget-message', '/users/me/budget', 'Weekly budget saved.', fillBudget);
handleForm('details-form', 'details-message', '/users/me/details', 'Account details saved.', fillDetails);
handleForm('password-form', 'password-message', '/users/me/password', 'Password changed.', (result, form) => form.reset());

loadProfile();
