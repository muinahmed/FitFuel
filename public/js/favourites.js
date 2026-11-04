// Favourites page (Recipes & Meal Planning – Albina): the student's saved recipes (FF-25).
const favouritesGrid = document.getElementById('recipe-grid');
const favouritesCount = document.getElementById('result-count');
const favouritesMessage = document.getElementById('page-message');

function showCount(count) {
  favouritesCount.textContent = count ? `${count} favourite recipe${count === 1 ? '' : 's'}` : '';
  if (count === 0) {
    favouritesGrid.innerHTML = emptyStateHtml({
      image: '/img/home-banner-photo.png',
      title: 'No favourites yet',
      text: 'Tap the heart on any recipe and it is saved here, so your go-to meals are always one tap away.',
      action: { href: '/recipes.html', label: 'Browse recipes' },
    });
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
