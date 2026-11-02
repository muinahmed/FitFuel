// Favourites page (Recipes & Meal Planning – Albina): the student's saved recipes (FF-25).
const favouritesGrid = document.getElementById('recipe-grid');
const favouritesCount = document.getElementById('result-count');
const favouritesMessage = document.getElementById('page-message');

function showCount(count) {
  favouritesCount.textContent = count ? `${count} favourite recipe${count === 1 ? '' : 's'}` : '';
  if (!count) {
    favouritesGrid.innerHTML = `
      <div class="empty-state">
        <span class="icon-chip">${icon('heart', 26)}</span>
        <h2>No favourites yet</h2>
        <p>Tap the heart on any recipe to keep it here for next time.</p>
        <a class="btn" href="/recipes.html">Browse recipes</a>
      </div>`;
  }
}

async function loadFavourites() {
  try {
    const recipes = await api('/recipes/favourites');
    favouritesGrid.innerHTML = recipes.map(recipeCardHtml).join('');
    showCount(recipes.length);
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
