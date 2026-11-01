// Recipes & Meal Planning component – Albina Rana
// Browse, search and filter recipes, and view one recipe with ingredients and steps (FF-12).
const express = require('express');
const { requireLogin } = require('../middleware/requireLogin');
const { readRecipeFilters, listRecipes, getRecipeDetail } = require('../db/recipeQueries');

const router = express.Router();

router.use(requireLogin);

// GET /api/recipes?search=&mealType=&diet= – recipe cards, optionally searched and filtered
router.get('/', (req, res) => {
  const filters = readRecipeFilters(req.query);
  if (filters.error) return res.status(400).json({ error: filters.error });
  res.json(listRecipes(filters));
});

// GET /api/recipes/:id – one recipe with its ingredients and steps
router.get('/:id', (req, res) => {
  const recipe = getRecipeDetail(Number(req.params.id));
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  res.json(recipe);
});

module.exports = router;
