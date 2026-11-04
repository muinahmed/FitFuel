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
      : emptyStateHtml({
        compact: true, iconName: 'search', title: 'No recipes match your search',
        text: 'Try other words, or clear the filters to see every recipe.',
        action: { button: 'clear-filters', label: 'Clear filters' },
      });
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
  if (event.target.closest('#clear-filters')) {
    filterForm.reset();
    loadRecipes();
    return;
  }
  const button = event.target.closest('[data-recipe-id]');
  if (button) openRecipeDetail(button.dataset.recipeId);
});
setUpFavouriteButtons(recipeGrid, recipesMessage);

setUp();
