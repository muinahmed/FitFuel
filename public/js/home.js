// Home page (Accounts – Muin): greeting, weekly budget and a prompt to finish the profile.

// "Good morning" / "Good afternoon" / "Good evening" from the current hour
function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Today's lunch and dinner from this week's meal plan
async function loadTodaysMeals() {
  const container = document.getElementById('todays-meals');
  try {
    const plan = await api('/mealplans?week=this');
    const today = plan.days.find((day) => day.date === todayString());
    if (!today || (!today.lunch && !today.dinner)) {
      container.innerHTML = '<p class="placeholder">No meals planned for today.</p><a href="/mealplan.html">Plan this week\'s meals →</a>';
      return;
    }
    const mealLine = (label, meal) => (meal
      ? `<li><strong>${label}:</strong> ${escapeHtml(meal.recipeName)} <span class="muted">(${formatKr(meal.pricePerPortion)})</span></li>`
      : '');
    container.innerHTML = `<ul class="plain-list">${mealLine('Lunch', today.lunch)}${mealLine('Dinner', today.dinner)}</ul>
      <a href="/mealplan.html">See the whole week →</a>`;
  } catch (error) {
    container.innerHTML = `<p class="placeholder">${escapeHtml(error.message)}</p>`;
  }
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
loadTodaysMeals();
