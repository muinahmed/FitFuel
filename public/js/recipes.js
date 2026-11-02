// Recipes page (Recipes & Meal Planning – Albina): search, filter, open and favourite recipes.
const filterForm = document.getElementById('recipe-filters');
const recipeGrid = document.getElementById('recipe-grid');
const resultCount = document.getElementById('result-count');
const recipesMessage = document.getElementById('page-message');
let searchTimer = null;

// Fetch recipes that match the current search and filters
async function loadRecipes() {
  clearMessage(recipesMessage);
  const query = new URLSearchParams(new FormData(filterForm));
  try {
    const recipes = await api(`/recipes?${query}`);
    resultCount.textContent = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'} found`;
    recipeGrid.innerHTML = recipes.length
      ? recipes.map(recipeCardHtml).join('')
      : `<div class="empty-state">
          <span class="icon-chip">${icon('search', 26)}</span>
          <h2>No recipes match</h2>
          <p>Try other words, or set Meal type and Diet back to all.</p>
        </div>`;
  } catch (error) {
    resultCount.textContent = '';
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
setUpFavouriteButtons(recipeGrid, recipesMessage);

setUp();
