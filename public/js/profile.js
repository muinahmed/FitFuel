// Profile page (Accounts – Muin): header card, goal and diet, weekly budget, reminder,
// account details and password.

const DIET_LABELS = { none: 'No restrictions', vegetarian: 'Vegetarian', vegan: 'Vegan', halal: 'Halal' };
const GOAL_LABELS = { 'lose weight': 'Lose weight', 'build muscle': 'Build muscle', 'stay healthy': 'Stay healthy' };

// Header card: initials, name, email and the goal, diet and budget at a glance
function renderProfileHead(account) {
  const initials = account.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  document.getElementById('avatar').textContent = initials;
  document.getElementById('profile-name').textContent = account.fullName;
  document.getElementById('profile-email').textContent = account.email;
  const fact = (iconName, text) => `<span class="profile-fact">${icon(iconName, 16)}${escapeHtml(text)}</span>`;
  document.getElementById('profile-facts').innerHTML = [
    fact('trophy', account.goal ? GOAL_LABELS[account.goal] : 'No goal yet'),
    fact('leaf', DIET_LABELS[account.dietType || 'none']),
    fact('wallet', account.weeklyBudget > 0 ? `${formatKr(account.weeklyBudget)} a week` : 'No budget yet'),
  ].join('');
}

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
  document.getElementById('reminderDay').value = account.reminderDay || '';
  fillBudget(account);
  fillDetails(account);
  renderProfileHead(account);
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

handleForm('goal-form', 'goal-message', '/users/me/profile', 'Goal and diet saved.', renderProfileHead);
handleForm('budget-form', 'budget-message', '/users/me/budget', 'Weekly budget saved.', (account) => { fillBudget(account); renderProfileHead(account); });
handleForm('reminder-form', 'reminder-message', '/users/me/reminder', 'Reminder saved.');
handleForm('details-form', 'details-message', '/users/me/details', 'Account details saved.', (account) => { fillDetails(account); renderProfileHead(account); });
handleForm('password-form', 'password-message', '/users/me/password', 'Password changed.', (result, form) => form.reset());

loadProfile();
