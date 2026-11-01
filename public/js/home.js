// Home page (Accounts – Muin): greeting, weekly budget and a prompt to finish the profile.

// "Good morning" / "Good afternoon" / "Good evening" from the current hour
function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

async function loadHome() {
  const pageMessage = document.getElementById('page-message');
  try {
    const account = await api('/users/me');
    const firstName = account.fullName.split(' ')[0];
    document.getElementById('greeting').textContent = `${greetingForNow()}, ${firstName}!`;

    const budgetSet = account.weeklyBudget > 0;
    document.getElementById('budget-figure').textContent = budgetSet ? formatKr(account.weeklyBudget) : 'Not set';
    document.getElementById('budget-note').textContent = budgetSet
      ? 'Your weekly food budget.'
      : 'Set a weekly food budget on your profile.';

    if (!account.goal || !budgetSet) {
      pageMessage.className = 'message message--info';
      pageMessage.innerHTML = 'Finish setting up: choose your goal, diet and weekly budget on your <a href="/profile.html">profile</a>.';
    }
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

loadHome();
