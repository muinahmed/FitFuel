// Recipes page (Recipes & Meal Planning – Albina): search, filter and open recipes.
const filterForm = document.getElementById('recipe-filters');
const recipeGrid = document.getElementById('recipe-grid');
const resultCount = document.getElementById('result-count');
const recipesMessage = document.getElementById('page-message');
let searchTimer = null;

function recipeCardHtml(recipe) {
  return `
    <article class="card recipe-card">
      <p class="recipe-meta"><span class="badge">${escapeHtml(recipe.mealType)}</span>${dietBadgesHtml(recipe)}</p>
      <h2>${escapeHtml(recipe.recipeName)}</h2>
      <p class="recipe-card__facts"><strong>${formatKr(recipe.pricePerPortion)}</strong> per portion · ${recipe.calories} kcal</p>
      <button type="button" class="btn btn--secondary" data-recipe-id="${recipe.recipeId}">View recipe</button>
    </article>`;
}

// Fetch recipes that match the current search and filters
async function loadRecipes() {
  clearMessage(recipesMessage);
  const query = new URLSearchParams(new FormData(filterForm));
  try {
    const recipes = await api(`/recipes?${query}`);
    resultCount.textContent = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} found`;
    recipeGrid.innerHTML = recipes.length
      ? recipes.map(recipeCardHtml).join('')
      : '<p class="placeholder">No recipes match your search. Try other words or filters.</p>';
  } catch (error) {
    showMessage(recipesMessage, error.message);
  }
}

// Start with the student's own diet selected
async function setUp() {
  try {
    const account = await api('/users/me');
    if (account.dietType && account.dietType !== 'none') document.getElementById('diet').value = account.dietType;
  } catch {
    // Not important – show all recipes instead
  }
  loadRecipes();
}

filterForm.addEventListener('submit', (event) => event.preventDefault());
filterForm.addEventListener('change', loadRecipes);
document.getElementById('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadRecipes, 250);
});
recipeGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-recipe-id]');
  if (button) openRecipeDetail(button.dataset.recipeId);
});

setUp();
