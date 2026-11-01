// Recipes & Meal Planning component – Albina Rana
// Browse, search and filter recipes, view one recipe with ingredients and steps (FF-12),
// and save favourite recipes (FF-25).
const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/requireLogin');
const { readRecipeFilters, listRecipes, listFavourites, getRecipeDetail } = require('../db/recipeQueries');
const { today } = require('../utils/dates');

const router = express.Router();

router.use(requireLogin);

const findFavourite = db.prepare('SELECT 1 FROM FavouriteRecipe WHERE UserID = ? AND RecipeID = ?');
const insertFavourite = db.prepare('INSERT INTO FavouriteRecipe (UserID, RecipeID, DateSaved) VALUES (?, ?, ?)');
const deleteFavourite = db.prepare('DELETE FROM FavouriteRecipe WHERE UserID = ? AND RecipeID = ?');

// GET /api/recipes?search=&mealType=&diet= – recipe cards, optionally searched and filtered
router.get('/', (req, res) => {
  const filters = readRecipeFilters(req.query);
  if (filters.error) return res.status(400).json({ error: filters.error });
  res.json(listRecipes(filters, { favouritesOf: req.session.userId }));
});

// GET /api/recipes/favourites – the student's favourite recipes, most recently saved first
router.get('/favourites', (req, res) => {
  res.json(listFavourites(req.session.userId));
});

// GET /api/recipes/:id – one recipe with its ingredients and steps
router.get('/:id', (req, res) => {
  const recipe = getRecipeDetail(Number(req.params.id));
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  res.json(recipe);
});

// PUT /api/recipes/:id/favourite – save a recipe to favourites (saving twice is fine)
router.put('/:id/favourite', (req, res) => {
  const recipeId = Number(req.params.id);
  if (!getRecipeDetail(recipeId)) return res.status(404).json({ error: 'Recipe not found.' });
  if (!findFavourite.get(req.session.userId, recipeId)) insertFavourite.run(req.session.userId, recipeId, today());
  res.json({ recipeId, isFavourite: true });
});

// DELETE /api/recipes/:id/favourite – remove a recipe from favourites
router.delete('/:id/favourite', (req, res) => {
  const recipeId = Number(req.params.id);
  deleteFavourite.run(req.session.userId, recipeId);
  res.json({ recipeId, isFavourite: false });
});

module.exports = router;
