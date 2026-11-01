// Recipes admin page (Recipes & Meal Planning – Albina): search/filter, add, edit and delete
// recipes (with ingredients and steps) and view recipe usage.
const recipeTable = document.getElementById('recipe-table');
const recipesMessage = document.getElementById('page-message');
const recipeFormDialog = document.getElementById('recipe-dialog');
const recipeFilters = document.getElementById('recipe-filters');
let recipes = [];
let searchTimer = null;

const ingredientRows = setUpRowList(document.getElementById('ingredient-rows'), (item) => `
  <input data-field="ingredientName" aria-label="Ingredient name" placeholder="Ingredient" maxlength="60" required value="${attr(item.ingredientName)}">
  <input data-field="quantity" aria-label="Quantity" placeholder="Qty" type="number" min="0.01" step="0.01" required value="${attr(item.quantity)}">
  <input data-field="unit" aria-label="Unit" placeholder="Unit (g, pcs…)" maxlength="15" required value="${attr(item.unit)}">
  <input data-field="cost" aria-label="Cost in kr" placeholder="Cost kr" type="number" min="0" step="0.01" required value="${attr(item.cost)}">`,
document.getElementById('add-ingredient'));

const stepRows = setUpRowList(document.getElementById('step-rows'), (item) => `
  <input data-field="instruction" aria-label="Step instruction" placeholder="What to do" maxlength="255" required value="${attr(item.instruction)}">`,
document.getElementById('add-step'));

// Live "price per portion" while the admin types costs
function updatePriceTotal() {
  const total = ingredientRows.read().reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
  document.getElementById('price-total').textContent = formatKr(total);
}
document.getElementById('ingredient-rows').addEventListener('input', updatePriceTotal);

// Vegan recipes are always vegetarian
document.getElementById('vegan').addEventListener('change', (event) => {
  if (event.target.checked) document.getElementById('isVegetarian').checked = true;
});
document.getElementById('isVegetarian').addEventListener('change', (event) => {
  if (!event.target.checked) document.getElementById('vegan').checked = false;
});

function recipeRowHtml(recipe) {
  return `
    <tr data-id="${recipe.recipeId}">
      <td>${escapeHtml(recipe.recipeName)}</td>
      <td class="capitalise">${escapeHtml(recipe.mealType)}</td>
      <td>${formatKr(recipe.pricePerPortion)}</td>
      <td>${recipe.calories}</td>
      <td><span class="recipe-meta">${dietBadgesHtml(recipe) || '<span class="muted">–</span>'}</span></td>
      <td>${recipe.timesPlanned}</td>
      <td class="row-actions">
        <button type="button" class="link-button" data-action="edit">Edit</button>
        <button type="button" class="link-button link-button--danger" data-action="delete">Delete</button>
      </td>
    </tr>`;
}

async function loadRecipes() {
  const query = new URLSearchParams(new FormData(recipeFilters));
  recipes = await api(`/admin/recipes?${query}`);
  document.getElementById('result-count').textContent = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`;
  recipeTable.innerHTML = recipes.length
    ? recipes.map(recipeRowHtml).join('')
    : '<tr><td colspan="7" class="placeholder">No recipes match your search.</td></tr>';
}

async function loadUsage() {
  const usage = await api('/admin/recipes/usage');
  document.getElementById('usage-list').innerHTML = usage.map((row) => `
    <li><span>${escapeHtml(row.recipeName)} <span class="muted capitalise">· ${escapeHtml(row.mealType)}</span></span>
        <strong>${row.timesPlanned}×</strong></li>`).join('');
}

function reloadAll() {
  return Promise.all([loadRecipes(), loadUsage()]);
}

// Fill the dialog (empty for a new recipe) and save with POST or PUT
function openRecipeForm(recipe) {
  const form = recipeFormDialog.querySelector('form');
  form.reset();
  document.getElementById('recipe-dialog-title').textContent = recipe ? `Edit ${recipe.recipeName}` : 'Add recipe';
  form.recipeName.value = recipe ? recipe.recipeName : '';
  form.mealType.value = recipe ? recipe.mealType : 'dinner';
  form.calories.value = recipe ? recipe.calories : '';
  form.isVegetarian.checked = Boolean(recipe && recipe.isVegetarian);
  form.vegan.checked = Boolean(recipe && recipe.dietTags.includes('vegan'));
  form.halal.checked = Boolean(recipe && recipe.dietTags.includes('halal'));

  ingredientRows.clear();
  (recipe ? recipe.ingredients : [{}, {}]).forEach((item) => ingredientRows.add(item));
  stepRows.clear();
  (recipe ? recipe.steps : [{}, {}, {}]).forEach((step) => stepRows.add(step));
  updatePriceTotal();

  openFormDialog(recipeFormDialog, async () => {
    const body = {
      recipeName: form.recipeName.value,
      mealType: form.mealType.value,
      calories: form.calories.value,
      isVegetarian: form.isVegetarian.checked,
      dietTags: ['vegan', 'halal'].filter((tag) => form[tag].checked),
      ingredients: ingredientRows.read(),
      steps: stepRows.read().map((step) => step.instruction),
    };
    const saved = recipe
      ? await api(`/admin/recipes/${recipe.recipeId}`, { method: 'PUT', body })
      : await api('/admin/recipes', { method: 'POST', body });
    await reloadAll();
    showMessage(recipesMessage, `${saved.recipeName} was ${recipe ? 'updated' : 'added'}.`, 'success');
  });
}

// Delete; if students have it in current meal plans, ask again before forcing
async function deleteRecipe(recipe) {
  if (!window.confirm(`Delete the recipe "${recipe.recipeName}"?`)) return;
  clearMessage(recipesMessage);
  try {
    try {
      await api(`/admin/recipes/${recipe.recipeId}`, { method: 'DELETE' });
    } catch (error) {
      if (error.status !== 409) throw error;
      const forceIt = window.confirm(`${error.message}\n\nIf you delete it, those meals are removed from the plans `
        + 'and students will need to plan new ones. Delete anyway?');
      if (!forceIt) return;
      await api(`/admin/recipes/${recipe.recipeId}?force=true`, { method: 'DELETE' });
    }
    await reloadAll();
    showMessage(recipesMessage, `${recipe.recipeName} was deleted.`, 'success');
  } catch (error) {
    showMessage(recipesMessage, error.message);
  }
}

recipeTable.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const recipe = recipes.find((item) => item.recipeId === Number(button.closest('tr').dataset.id));
  if (button.dataset.action === 'delete') return deleteRecipe(recipe);
  try {
    openRecipeForm(await api(`/admin/recipes/${recipe.recipeId}`));
  } catch (error) {
    showMessage(recipesMessage, error.message);
  }
});

document.getElementById('add-button').addEventListener('click', () => openRecipeForm(null));
recipeFilters.addEventListener('submit', (event) => event.preventDefault());
recipeFilters.addEventListener('change', () => loadRecipes().catch((error) => showMessage(recipesMessage, error.message)));
document.getElementById('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadRecipes().catch((error) => showMessage(recipesMessage, error.message)), 250);
});

reloadAll().catch((error) => showMessage(recipesMessage, error.message));
