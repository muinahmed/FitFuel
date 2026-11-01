// Shopping list page (Recipes & Meal Planning – Albina): combined ingredients with saved tick boxes.
// Follows the week chosen with the This week / Next week switch.
const shoppingList = document.getElementById('shopping-list');
const progressText = document.getElementById('progress-text');
const shoppingMessage = document.getElementById('page-message');
const weekToggle = setUpWeekToggle(document.getElementById('week-toggle'), (week) => {
  selectedWeek = week;
  loadShoppingList();
});
let selectedWeek = weekFromAddress();

// 630 -> "630", 1.5 -> "1.5", 0.333 -> "0.33"
function formatQuantity(quantity) {
  return String(Math.round(quantity * 100) / 100);
}

function updateProgress() {
  const boxes = shoppingList.querySelectorAll('input[type="checkbox"]');
  const ticked = shoppingList.querySelectorAll('input[type="checkbox"]:checked');
  progressText.textContent = `${ticked.length} of ${boxes.length} items ticked off`;
}

function itemHtml(item, index) {
  return `
    <li class="shopping-item">
      <input type="checkbox" id="item-${index}" data-ingredient="${escapeHtml(item.ingredientName)}"${item.isChecked ? ' checked' : ''}>
      <label for="item-${index}">
        <span class="shopping-item__name">${escapeHtml(item.ingredientName)}</span>
        <span class="shopping-item__quantity">${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</span>
        <span class="shopping-item__cost">${formatKr(item.cost)}</span>
      </label>
    </li>`;
}

async function loadShoppingList() {
  clearMessage(shoppingMessage);
  try {
    const list = await api(`/mealplans/shopping-list${weekQuery(selectedWeek)}`);
    selectedWeek = list.week;
    weekToggle.select(list.week);
    document.getElementById('week-label').textContent = `Week of ${formatDate(list.weekStart, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    document.getElementById('plan-link').href = `/mealplan.html${weekQuery(list.week)}`;
    shoppingList.innerHTML = '';
    const totalCost = document.getElementById('total-cost');
    totalCost.hidden = list.items.length === 0;
    totalCost.innerHTML = `Estimated cost: <strong>${formatKr(list.totalCost)}</strong>`;
    if (list.items.length === 0) {
      const weekName = list.week === 'next' ? 'next week' : 'this week';
      progressText.innerHTML = `Your shopping list for ${weekName} is empty. <a href="/mealplan.html${weekQuery(list.week)}">Generate a meal plan</a> to fill it.`;
      return;
    }
    shoppingList.innerHTML = list.items.map(itemHtml).join('');
    updateProgress();
  } catch (error) {
    progressText.textContent = '';
    showMessage(shoppingMessage, error.message);
  }
}

// Save a tick straight away; undo it on screen if saving fails
async function saveTick(checkbox) {
  clearMessage(shoppingMessage);
  const isChecked = checkbox.checked;
  // The same ingredient can appear twice with different units – keep both lines in step
  const sameIngredient = [...shoppingList.querySelectorAll('input[type="checkbox"]')]
    .filter((box) => box.dataset.ingredient === checkbox.dataset.ingredient);
  sameIngredient.forEach((box) => { box.checked = isChecked; });
  updateProgress();

  try {
    await api(`/mealplans/shopping-list/items${weekQuery(selectedWeek)}`, {
      method: 'PUT',
      body: { ingredientName: checkbox.dataset.ingredient, isChecked },
    });
  } catch (error) {
    sameIngredient.forEach((box) => { box.checked = !isChecked; });
    updateProgress();
    showMessage(shoppingMessage, error.message);
  }
}

shoppingList.addEventListener('change', (event) => {
  if (event.target.matches('input[type="checkbox"]')) saveTick(event.target);
});

loadShoppingList();
