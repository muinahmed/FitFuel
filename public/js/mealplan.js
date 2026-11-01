// Meal plan page (Recipes & Meal Planning – Albina): generate a week's plan and show cost vs budget.
// The student can switch between this week and next week (see weekToggle.js).
const generateButton = document.getElementById('generate-button');
const planGrid = document.getElementById('plan-grid');
const costSummary = document.getElementById('cost-summary');
const planMessage = document.getElementById('page-message');
const weekToggle = setUpWeekToggle(document.getElementById('week-toggle'), (week) => {
  selectedWeek = week;
  loadPlan();
});
let selectedWeek = weekFromAddress();
let currentPlan = null;

function mealHtml(label, meal) {
  if (!meal) return `<div class="plan-meal"><span class="plan-meal__slot">${label}</span><span class="placeholder">Nothing planned</span></div>`;
  return `
    <div class="plan-meal">
      <span class="plan-meal__slot">${label}</span>
      <button type="button" class="link-button" data-recipe-id="${meal.recipeId}">${escapeHtml(meal.recipeName)}</button>
      <span class="muted">${formatKr(meal.pricePerPortion)} · ${meal.calories} kcal</span>
    </div>`;
}

function dayHtml(day) {
  const isToday = day.date === todayString();
  return `
    <section class="card plan-day${isToday ? ' plan-day--today' : ''}" aria-label="${formatDate(day.date)}">
      <h2>${formatDate(day.date)}${isToday ? ' <span class="badge badge--today">Today</span>' : ''}</h2>
      ${mealHtml('Lunch', day.lunch)}
      ${mealHtml('Dinner', day.dinner)}
    </section>`;
}

// "this week" / "next week" for messages
function weekName(plan) {
  return plan.week === 'next' ? 'next week' : 'this week';
}

function renderPlan(plan) {
  currentPlan = plan;
  selectedWeek = plan.week;
  weekToggle.select(plan.week);
  document.getElementById('week-label').textContent =
    `Week of ${formatDate(plan.weekStart, { day: 'numeric', month: 'long' })} – ${formatDate(plan.weekEnd, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  generateButton.textContent = plan.hasPlan ? 'Generate new plan' : 'Generate plan';
  const shoppingLink = document.getElementById('shopping-link');
  shoppingLink.hidden = !plan.hasPlan;
  shoppingLink.href = `/shopping.html${weekQuery(plan.week)}`;

  if (!plan.hasPlan) {
    costSummary.innerHTML = plan.weeklyBudget > 0
      ? `No plan for ${weekName(plan)} yet. Your budget is <strong>${formatKr(plan.weeklyBudget)}</strong> – press "Generate plan" to get started.`
      : 'Set your weekly food budget on your <a href="/profile.html">profile</a>, then generate a plan.';
    planGrid.innerHTML = '';
    return;
  }

  costSummary.innerHTML = `Total cost <strong>${formatKr(plan.totalCost)}</strong> of your <strong>${formatKr(plan.weeklyBudget)}</strong> weekly budget`
    + (plan.overBudget ? '' : ` · ${formatKr(plan.weeklyBudget - plan.totalCost)} left`);
  if (plan.warning) showMessage(planMessage, plan.warning, 'info');
  planGrid.innerHTML = plan.days.map(dayHtml).join('');
}

async function loadPlan() {
  clearMessage(planMessage);
  try {
    renderPlan(await api(`/mealplans${weekQuery(selectedWeek)}`));
  } catch (error) {
    costSummary.textContent = '';
    showMessage(planMessage, error.message);
  }
}

async function generatePlan() {
  if (currentPlan && currentPlan.hasPlan && !window.confirm(`Replace the meal plan for ${weekName(currentPlan)} with a new one?`)) return;

  clearMessage(planMessage);
  generateButton.disabled = true;
  try {
    renderPlan(await api(`/mealplans/generate${weekQuery(selectedWeek)}`, { method: 'POST' }));
    if (!currentPlan.warning) showMessage(planMessage, `Your meal plan for ${weekName(currentPlan)} is ready.`, 'success');
  } catch (error) {
    showMessage(planMessage, error.message);
  } finally {
    generateButton.disabled = false;
  }
}

generateButton.addEventListener('click', generatePlan);
planGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-recipe-id]');
  if (button) openRecipeDetail(button.dataset.recipeId);
});

loadPlan();
