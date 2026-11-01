// Home page (Accounts – Muin): greeting, weekly reminder, budget with planned spending,
// today's meals, next workout and a prompt to finish the profile.

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
      container.innerHTML = '<p class="placeholder">No meals planned for today.</p><a href="/mealplan.html?week=this">Plan this week\'s meals →</a>';
      return;
    }
    const mealLine = (label, meal) => (meal
      ? `<li><strong>${label}:</strong> ${escapeHtml(meal.recipeName)} <span class="muted">(${formatKr(meal.pricePerPortion)})</span></li>`
      : '');
    container.innerHTML = `<ul class="plain-list">${mealLine('Lunch', today.lunch)}${mealLine('Dinner', today.dinner)}</ul>
      <a href="/mealplan.html?week=this">See the whole week →</a>`;
  } catch (error) {
    container.innerHTML = `<p class="placeholder">${escapeHtml(error.message)}</p>`;
  }
}

// Budget and planned spending for the week the meal plan page opens on (next week on Sunday)
async function loadBudget() {
  const container = document.getElementById('budget-plan');
  try {
    const plan = await api('/mealplans');
    const weekName = plan.week === 'next' ? 'next week' : 'this week';
    document.getElementById('budget-heading').textContent = plan.week === 'next' ? "Next week's budget" : "This week's budget";

    if (!(plan.weeklyBudget > 0)) {
      document.getElementById('budget-figure').textContent = 'Not set';
      container.innerHTML = '<p class="muted">Set a weekly food budget on your <a href="/profile.html">profile</a>.</p>';
      return;
    }
    document.getElementById('budget-figure').textContent = formatKr(plan.weeklyBudget);
    container.innerHTML = plan.hasPlan
      ? `<p class="muted budget-plan__label">Planned spending</p>${budgetMeterHtml(plan.totalCost, plan.weeklyBudget)}`
      : `<p class="muted">No meals planned for ${weekName} yet.</p><a href="/mealplan.html?week=${plan.week}">Plan ${weekName}'s meals →</a>`;
  } catch (error) {
    container.innerHTML = `<p class="placeholder">${escapeHtml(error.message)}</p>`;
  }
}

// The next workout in this week's plan
async function loadNextWorkout() {
  const container = document.getElementById('next-workout');
  try {
    const plan = await api('/workouts/plan');
    if (!plan.nextSession) {
      container.innerHTML = '<p class="placeholder">No workout plan yet.</p><a href="/workouts.html">Choose your training days →</a>';
      return;
    }
    const { day, isToday, workout } = plan.nextSession;
    container.innerHTML = `
      <p><strong>${isToday ? 'Today' : day}:</strong> ${escapeHtml(workout.workoutName)}
         <span class="muted">(${workout.durationMinutes} min, ${escapeHtml(workout.difficulty)})</span></p>
      <a href="/workouts.html">Go to workouts →</a>`;
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

    // Weekly reminder (FF-26): on the chosen day, link straight to next week's plan
    const todayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    document.getElementById('reminder-banner').hidden = account.reminderDay !== todayName;

    if (!account.goal || !(account.weeklyBudget > 0)) {
      pageMessage.className = 'message message--info';
      pageMessage.innerHTML = 'Finish setting up: choose your goal, diet and weekly budget on your <a href="/profile.html">profile</a>.';
    }
  } catch (error) {
    showMessage(pageMessage, error.message);
  }
}

loadHome();
loadBudget();
loadTodaysMeals();
loadNextWorkout();
