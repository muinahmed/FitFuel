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

function mealHtml(label, meal, dayName) {
  if (!meal) {
    return `<div class="plan-meal"><div class="plan-meal__text"><span class="plan-meal__slot">${label}</span>
      <span class="placeholder">Nothing planned</span></div></div>`;
  }
  const recipe = { ...meal, mealType: label.toLowerCase() };
  return `
    <div class="plan-meal">
      ${foodTileHtml(recipe)}
      <div class="plan-meal__text">
        <span class="plan-meal__slot">${label}</span>
        <button type="button" class="link-button" data-recipe-id="${meal.recipeId}">${escapeHtml(meal.recipeName)}</button>
        ${recipeMetaHtml(recipe)}
      </div>
      <button type="button" class="swap-button" data-swap-entry="${meal.entryId}"
              aria-label="Swap ${dayName} ${label.toLowerCase()}: ${escapeHtml(meal.recipeName)}">${icon('swap', 18)}</button>
    </div>`;
}

function dayHtml(day) {
  const isToday = day.date === todayString();
  const dayName = formatDate(day.date);
  return `
    <section class="card plan-day${isToday ? ' plan-day--today' : ''}" aria-label="${dayName}">
      <h2>${formatDate(day.date, { weekday: 'long' })}
        <span class="muted">${formatDate(day.date, { day: 'numeric', month: 'short' })}</span>
        ${isToday ? '<span class="badge badge--today">Today</span>' : ''}</h2>
      ${mealHtml('Lunch', day.lunch, dayName)}
      ${mealHtml('Dinner', day.dinner, dayName)}
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
    const hasBudget = plan.weeklyBudget > 0;
    costSummary.innerHTML = hasBudget
      ? `<p>Your budget for ${weekName(plan)} is <strong>${formatKr(plan.weeklyBudget)}</strong>.</p>`
      : '<p>No weekly food budget yet.</p>';
    planGrid.innerHTML = emptyStateHtml({
      image: '/img/meal-prep-banner.png',
      title: hasBudget ? `No meals planned for ${weekName(plan)} yet` : 'Set your budget to start planning',
      text: hasBudget
        ? `FitFuel fills 7 days of lunches and dinners that fit your diet and ${formatKr(plan.weeklyBudget)} budget.`
        : 'Tell FitFuel how much you can spend on food each week, then generate a plan.',
      action: hasBudget ? { button: 'empty-generate', label: `Plan ${weekName(plan)}` } : { href: '/profile.html', label: 'Set your budget' },
    });
    return;
  }

  costSummary.innerHTML = `<p class="plan-summary__title">Planned spending for ${weekName(plan)}</p>`
    + budgetMeterHtml(plan.totalCost, plan.weeklyBudget);
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
    revealChildren(planGrid);
    if (!currentPlan.warning) showMessage(planMessage, `Your meal plan for ${weekName(currentPlan)} is ready.`, 'success');
  } catch (error) {
    showMessage(planMessage, error.message);
  } finally {
    generateButton.disabled = false;
  }
}

// Swap one meal for another recipe that keeps the week within budget (FF-23)
async function swapMeal(button) {
  clearMessage(planMessage);
  button.disabled = true;
  try {
    const result = await api(`/mealplans/entries/${button.dataset.swapEntry}/swap${weekQuery(selectedWeek)}`, { method: 'POST' });
    renderPlan(result);
    if (!result.warning) showMessage(planMessage, `Swapped ${result.swapped.from} for ${result.swapped.to}. Your shopping list is updated.`, 'success');
    // Keep keyboard focus on the same meal's Swap button after the plan is redrawn
    const sameButton = planGrid.querySelector(`[data-swap-entry="${button.dataset.swapEntry}"]`);
    if (sameButton) {
      sameButton.focus();
      flash(sameButton.closest('.plan-meal'), 'highlight');
    }
  } catch (error) {
    button.disabled = false;
    showMessage(planMessage, error.message);
  }
}

generateButton.addEventListener('click', generatePlan);
planGrid.addEventListener('click', (event) => {
  if (event.target.closest('#empty-generate')) return generatePlan();
  const swapButton = event.target.closest('[data-swap-entry]');
  if (swapButton) return swapMeal(swapButton);
  const recipeButton = event.target.closest('[data-recipe-id]');
  if (recipeButton) openRecipeDetail(recipeButton.dataset.recipeId);
});

loadPlan();
