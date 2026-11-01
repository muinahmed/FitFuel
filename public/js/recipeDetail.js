// Recipes & Meal Planning component – Albina Rana
// Shared recipe pieces: diet badges, recipe cards with a favourite (heart) button, and the
// recipe detail dialog (ingredients and steps). Used on the recipes, favourites, meal plan and
// recipes admin pages. Load after api.js.

let recipeDialog = null;

// Badges for a recipe's diets, e.g. Vegetarian · Vegan · Halal
function dietBadgesHtml(recipe) {
  const labels = [];
  if (recipe.isVegetarian) labels.push('Vegetarian');
  if (recipe.dietTags.includes('vegan')) labels.push('Vegan');
  if (recipe.dietTags.includes('halal')) labels.push('Halal');
  return labels.map((label) => `<span class="badge badge--diet">${label}</span>`).join('');
}

// Create the <dialog> the first time it is needed
function getRecipeDialog() {
  if (recipeDialog) return recipeDialog;

  recipeDialog = document.createElement('dialog');
  recipeDialog.className = 'recipe-dialog';
  recipeDialog.setAttribute('aria-labelledby', 'recipe-dialog-title');
  recipeDialog.innerHTML = `
    <button type="button" class="dialog-close" aria-label="Close recipe">×</button>
    <div class="recipe-dialog__body"></div>`;
  document.body.appendChild(recipeDialog);

  recipeDialog.querySelector('.dialog-close').addEventListener('click', () => recipeDialog.close());
  // Clicking the dark area outside the dialog closes it
  recipeDialog.addEventListener('click', (event) => {
    if (event.target === recipeDialog) recipeDialog.close();
  });
  return recipeDialog;
}

function recipeDetailHtml(recipe) {
  const ingredients = recipe.ingredients.map((item) => `
    <li><span>${escapeHtml(Number(item.quantity))} ${escapeHtml(item.unit)} ${escapeHtml(item.ingredientName)}</span>
        <span class="muted">${formatKr(item.cost)}</span></li>`).join('');
  const steps = recipe.steps.map((step) => `<li>${escapeHtml(step.instruction)}</li>`).join('');

  return `
    <h2 id="recipe-dialog-title">${escapeHtml(recipe.recipeName)}</h2>
    <p class="recipe-meta">
      <span class="badge">${escapeHtml(recipe.mealType)}</span>${dietBadgesHtml(recipe)}
    </p>
    <p><strong>${formatKr(recipe.pricePerPortion)}</strong> per portion · ${recipe.calories} kcal</p>
    <h3>Ingredients <span class="muted">(1 portion)</span></h3>
    <ul class="ingredient-list">${ingredients}</ul>
    <h3>Steps</h3>
    <ol class="step-list">${steps}</ol>`;
}

// Open the dialog and load the recipe into it
async function openRecipeDetail(recipeId) {
  const dialog = getRecipeDialog();
  const body = dialog.querySelector('.recipe-dialog__body');
  body.innerHTML = '<h2 id="recipe-dialog-title">Loading recipe…</h2>';
  dialog.showModal();

  try {
    body.innerHTML = recipeDetailHtml(await api(`/recipes/${recipeId}`));
  } catch (error) {
    body.innerHTML = `<h2 id="recipe-dialog-title">Recipe</h2><p class="message message--error">${escapeHtml(error.message)}</p>`;
  }
}

// A recipe card with a heart button (FF-25) and a "View recipe" button
function recipeCardHtml(recipe) {
  const name = escapeHtml(recipe.recipeName);
  return `
    <article class="card recipe-card">
      <div class="recipe-card__top">
        <p class="recipe-meta"><span class="badge">${escapeHtml(recipe.mealType)}</span>${dietBadgesHtml(recipe)}</p>
        <button type="button" class="heart-button" data-favourite="${recipe.recipeId}"
                aria-pressed="${Boolean(recipe.isFavourite)}" aria-label="Favourite: ${name}">
          <span aria-hidden="true">♥</span>
        </button>
      </div>
      <h2>${name}</h2>
      <p class="recipe-card__facts"><strong>${formatKr(recipe.pricePerPortion)}</strong> per portion · ${recipe.calories} kcal</p>
      <button type="button" class="btn btn--secondary" data-recipe-id="${recipe.recipeId}">View recipe</button>
    </article>`;
}

// Heart buttons inside container save or remove a favourite when clicked.
// onChange(recipeId, isFavourite) runs after a successful save; errors are shown in messageElement.
function setUpFavouriteButtons(container, messageElement, onChange) {
  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-favourite]');
    if (!button) return;
    const makeFavourite = button.getAttribute('aria-pressed') !== 'true';
    button.disabled = true;
    try {
      await api(`/recipes/${button.dataset.favourite}/favourite`, { method: makeFavourite ? 'PUT' : 'DELETE' });
      button.setAttribute('aria-pressed', String(makeFavourite));
      if (onChange) onChange(Number(button.dataset.favourite), makeFavourite);
    } catch (error) {
      showMessage(messageElement, error.message);
    } finally {
      button.disabled = false;
    }
  });
}
