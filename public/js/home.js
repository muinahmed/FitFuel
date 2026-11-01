// Home page (Accounts – Muin): greeting, weekly reminder, budget ring with planned spending,
// today's meals, next workout, a progress summary and a prompt to finish the profile.

// "Good morning" / "Good afternoon" / "Good evening" from the current hour
function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// The hero: budget for the week the meal plan page opens on (next week on Sunday), with a ring
// showing how much of it the planned meals use
async function loadBudget() {
  const figure = document.getElementById('budget-figure');
  const details = document.getElementById('budget-plan');
  const ring = document.getElementById('budget-ring');
  try {
    const plan = await api('/mealplans');
    const weekName = plan.week === 'next' ? 'next week' : 'this week';
    document.getElementById('budget-heading').textContent = plan.week === 'next' ? "Next week's budget" : "This week's budget";

    if (!(plan.weeklyBudget > 0)) {
      figure.textContent = 'Not set';
      details.innerHTML = '<p>Set a weekly food budget to start planning meals.</p><a class="btn" href="/profile.html">Set your budget</a>';
      ring.innerHTML = '';
      return;
    }

    const planLink = `<a class="btn" href="/mealplan.html?week=${plan.week}">${plan.hasPlan ? 'Open meal plan' : `Plan ${weekName}'s meals`}</a>`;
    if (!plan.hasPlan) {
      figure.textContent = formatKr(plan.weeklyBudget);
      details.innerHTML = `<p>No meals planned for ${weekName} yet.</p>${planLink}`;
      ring.innerHTML = progressRingHtml(0, '<span class="ring__number">0%</span><span class="ring__label">planned</span>');
      return;
    }

    const left = plan.weeklyBudget - plan.totalCost;
    figure.textContent = plan.overBudget ? `${formatKr(-left)} over` : `${formatKr(left)} left`;
    details.innerHTML = `<p>${formatKr(plan.totalCost)} planned of ${formatKr(plan.weeklyBudget)} for ${weekName}.</p>${planLink}`;
    const used = plan.totalCost / plan.weeklyBudget;
    ring.innerHTML = progressRingHtml(used,
      `<span class="ring__number">${Math.round(used * 100)}%</span><span class="ring__label">of budget</span>`,
      { over: plan.overBudget });
  } catch (error) {
    details.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

// Today's lunch and dinner from this week's meal plan
async function loadTodaysMeals() {
  const container = document.getElementById('todays-meals');
  try {
    const plan = await api('/mealplans?week=this');
    const today = plan.days.find((day) => day.date === todayString());
    if (!today || (!today.lunch && !today.dinner)) {
      container.innerHTML = '<p class="placeholder">No meals planned for today.</p><a class="btn btn--secondary" href="/mealplan.html?week=this">Plan this week</a>';
      return;
    }
    const mealRow = (slot, meal) => (meal ? `
      <div class="meal-row">
        ${foodTileHtml({ ...meal, mealType: slot.toLowerCase() })}
        <div class="meal-row__text">
          <span class="meal-row__slot">${slot}</span>
          <span class="meal-row__name">${escapeHtml(meal.recipeName)}</span>
        </div>
        <span class="muted num">${formatKr(meal.pricePerPortion)}</span>
      </div>` : '');
    container.innerHTML = `<div class="meal-list">${mealRow('Lunch', today.lunch)}${mealRow('Dinner', today.dinner)}</div>
      <a href="/mealplan.html?week=this">See the whole week</a>`;
  } catch (error) {
    container.innerHTML = `<p class="placeholder">${escapeHtml(error.message)}</p>`;
  }
}

// The next workout in this week's plan; returns the plan for the progress summary
async function loadNextWorkout() {
  const container = document.getElementById('next-workout');
  try {
    const plan = await api('/workouts/plan');
    if (!plan.nextSession) {
      container.innerHTML = '<p class="placeholder">No workout plan yet.</p><a class="btn btn--secondary" href="/workouts.html">Choose training days</a>';
      return plan;
    }
    const { day, isToday, workout } = plan.nextSession;
    container.innerHTML = `
      <div class="workout-teaser">
        <div>
          <p class="workout-teaser__name">${escapeHtml(workout.workoutName)}</p>
          <p class="meta">
            <span class="meta__item">${icon('calendar', 16)}${isToday ? 'Today' : day}</span>
            <span class="meta__item">${icon('clock', 16)}${workout.durationMinutes} min</span>
            <span class="meta__item capitalise">${icon('flame', 16)}${escapeHtml(workout.difficulty)}</span>
          </p>
        </div>
      </div>
      <a class="btn btn--secondary" href="/workouts.html">Go to workouts</a>`;
    return plan;
  } catch (error) {
    container.innerHTML = `<p class="placeholder">${escapeHtml(error.message)}</p>`;
    return null;
  }
}

function statLineHtml(iconName, value, label) {
  return `
    <div class="stat-line">
      <span class="icon-chip icon-chip--mist">${icon(iconName, 20)}</span>
      <div><p class="stat-line__value">${value}</p><p class="stat-line__label">${label}</p></div>
    </div>`;
}

// Workouts done this week and weight trend
async function loadProgressSummary(workoutPlanPromise) {
  const container = document.getElementById('week-stats');
  try {
    const [workoutPlan, weights] = await Promise.all([workoutPlanPromise, api('/progress/weights')]);
    const lines = [];
    if (workoutPlan && workoutPlan.sessions.length) {
      const done = workoutPlan.sessions.filter((session) => session.isDone).length;
      lines.push(statLineHtml('trophy', `${done} of ${workoutPlan.sessions.length}`, 'workouts done this week'));
    }
    if (weights.length) {
      const latest = weights[weights.length - 1];
      lines.push(statLineHtml('scale', `${latest.weightKg.toFixed(1)} kg`,
        `latest weight, ${formatDate(latest.logDate, { day: 'numeric', month: 'short' })}`));
      if (weights.length > 1) {
        const change = Math.round((latest.weightKg - weights[0].weightKg) * 10) / 10;
        const changeText = change === 0 ? 'No change' : `${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(1)} kg`;
        lines.push(statLineHtml('chart', changeText, `since ${formatDate(weights[0].logDate, { day: 'numeric', month: 'short' })}`));
      }
    }
    container.innerHTML = lines.length
      ? lines.join('')
      : '<p class="placeholder">Log a workout or your weight to see your progress here.</p><a class="btn btn--secondary" href="/progress.html">Log your weight</a>';
  } catch (error) {
    container.innerHTML = `<p class="placeholder">${escapeHtml(error.message)}</p>`;
  }
}

async function loadHome() {
  const pageMessage = document.getElementById('page-message');
  document.getElementById('today-label').textContent = formatDate(todayString(), { weekday: 'long', day: 'numeric', month: 'long' });
  try {
    const account = await api('/users/me');
    const firstName = account.fullName.split(' ')[0];
    document.getElementById('greeting').textContent = `${greetingForNow()}, ${firstName}`;

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
loadProgressSummary(loadNextWorkout());
