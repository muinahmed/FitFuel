// Favourites page (Recipes & Meal Planning – Albina): the student's saved recipes (FF-25).
const favouritesGrid = document.getElementById('recipe-grid');
const favouritesCount = document.getElementById('result-count');
const favouritesMessage = document.getElementById('page-message');

function showCount(count) {
  favouritesCount.textContent = count
    ? `${count} favourite recipe${count === 1 ? '' : 's'}`
    : 'No favourites yet. Tap the heart on a recipe to save it here.';
}

async function loadFavourites() {
  try {
    const recipes = await api('/recipes/favourites');
    showCount(recipes.length);
    favouritesGrid.innerHTML = recipes.map(recipeCardHtml).join('');
  } catch (error) {
    favouritesCount.textContent = '';
    showMessage(favouritesMessage, error.message);
  }
}

favouritesGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-recipe-id]');
  if (button) openRecipeDetail(button.dataset.recipeId);
});
// Removing the heart takes the card off this page
setUpFavouriteButtons(favouritesGrid, favouritesMessage, (recipeId, isFavourite) => {
  if (isFavourite) return;
  favouritesGrid.querySelector(`[data-favourite="${recipeId}"]`).closest('.recipe-card').remove();
  showCount(favouritesGrid.querySelectorAll('.recipe-card').length);
  showMessage(favouritesMessage, 'Removed from your favourites.', 'success');
});

loadFavourites();
