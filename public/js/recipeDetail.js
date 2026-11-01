// Recipes & Meal Planning component – Albina Rana
// Shared recipe pieces: food tiles, diet badges, recipe cards with a favourite (heart) button,
// and the recipe detail dialog (ingredients and steps). Used on the home, recipes, favourites,
// meal plan and recipes admin pages. Load after icons.js and api.js.

let recipeDialog = null;

// Recipes have no photos, so each gets a food emoji picked from words in its name.
// The first matching rule wins, so specific dishes come before single ingredients.
const FOOD_EMOJI = [
  [/salmon|tuna|fish/i, '🐟'], [/curry/i, '🍛'], [/chilli|chili/i, '🌶️'], [/spaghetti|pasta|bolognese/i, '🍝'],
  [/soup|stew|casserole/i, '🍲'], [/wrap|kofta|flatbread/i, '🌯'], [/quesadilla|taco/i, '🌮'],
  [/fried rice/i, '🍚'], [/chicken/i, '🍗'], [/omelette|scrambled|\beggs?\b/i, '🍳'], [/oat|yogurt|granola/i, '🥣'],
  [/toast|bread/i, '🍞'], [/salad|couscous/i, '🥗'], [/stir-fry|noodle|tofu/i, '🥢'], [/risotto|mushroom/i, '🍄'],
  [/rice/i, '🍚'], [/sausage/i, '🌭'], [/banana/i, '🍌'], [/apple/i, '🍏'], [/hummus|veg/i, '🥕'],
];
const MEAL_TYPE_EMOJI = { breakfast: '🥣', lunch: '🥗', dinner: '🍲', snack: '🍎' };

function recipeEmoji(recipe) {
  const match = FOOD_EMOJI.find(([pattern]) => pattern.test(recipe.recipeName));
  return match ? match[1] : MEAL_TYPE_EMOJI[recipe.mealType] || '🍽️';
}

// Emoji tile tinted by meal type. size: '' (small) or 'large' (card / dialog header)
function foodTileHtml(recipe, size = '') {
  const mealType = recipe.mealType || 'dinner';
  return `<span class="food-tile food-tile--${mealType}${size ? ` food-tile--${size}` : ''}" aria-hidden="true">${recipeEmoji(recipe)}</span>`;
}

// Price and calories as icon + value pairs
function recipeMetaHtml(recipe) {
  return `
    <p class="meta">
      <span class="meta__item">${icon('wallet', 16)}<span class="visually-hidden">Price </span>${formatKr(recipe.pricePerPortion)}</span>
      <span class="meta__item">${icon('flame', 16)}${recipe.calories} kcal</span>
    </p>`;
}

// Badges for a recipe's diets (Vegetarian, Vegan, Halal)
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
    ${foodTileHtml(recipe, 'large')}
    <h2 id="recipe-dialog-title">${escapeHtml(recipe.recipeName)}</h2>
    <p class="recipe-meta"><span class="badge">${escapeHtml(recipe.mealType)}</span>${dietBadgesHtml(recipe)}</p>
    <div class="fact-tiles">
      <div class="fact-tile"><strong>${formatKr(recipe.pricePerPortion)}</strong><span>per portion</span></div>
      <div class="fact-tile"><strong>${recipe.calories}</strong><span>kcal</span></div>
      <div class="fact-tile"><strong>${recipe.ingredients.length}</strong><span>ingredients</span></div>
    </div>
    <h3>Ingredients for one portion</h3>
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

// A recipe card: food tile with a heart button (FF-25), badges, price, calories and "View recipe"
function recipeCardHtml(recipe) {
  const name = escapeHtml(recipe.recipeName);
  return `
    <article class="card recipe-card">
      <div class="recipe-card__top">
        ${foodTileHtml(recipe, 'large')}
        <button type="button" class="heart-button" data-favourite="${recipe.recipeId}"
                aria-pressed="${Boolean(recipe.isFavourite)}" aria-label="Favourite: ${name}">${icon('heart', 20)}</button>
      </div>
      <div class="recipe-card__body">
        <p class="recipe-meta"><span class="badge">${escapeHtml(recipe.mealType)}</span>${dietBadgesHtml(recipe)}</p>
        <h2>${name}</h2>
        ${recipeMetaHtml(recipe)}
        <button type="button" class="btn btn--secondary" data-recipe-id="${recipe.recipeId}">View recipe</button>
      </div>
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
