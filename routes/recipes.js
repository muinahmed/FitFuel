// Recipes & Meal Planning component – Albina Rana
// Browse, search and filter recipes, and view one recipe with ingredients and steps (FF-12).
const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/requireLogin');
const { DIET_TYPES, dietCondition } = require('../utils/dietFilter');

const router = express.Router();
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

router.use(requireLogin);

const RECIPE_COLUMNS = `r.RecipeID AS recipeId, r.RecipeName AS recipeName, r.MealType AS mealType,
  r.PricePerPortion AS pricePerPortion, r.Calories AS calories, r.IsVegetarian AS isVegetarian`;

const getRecipe = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM Recipes r WHERE r.RecipeID = ?`);
const getAllTags = db.prepare('SELECT RecipeID, DietType FROM RecipeDietTag ORDER BY DietType');
const getTags = db.prepare('SELECT DietType FROM RecipeDietTag WHERE RecipeID = ? ORDER BY DietType');
const getIngredients = db.prepare(`SELECT IngredientName AS ingredientName, Quantity AS quantity, Unit AS unit, Cost AS cost
                                   FROM RecipeIngredient WHERE RecipeID = ? ORDER BY RecipeIngredientID`);
const getSteps = db.prepare(`SELECT StepNumber AS stepNumber, Instruction AS instruction
                             FROM RecipeStep WHERE RecipeID = ? ORDER BY StepNumber`);

// Database row -> API shape (booleans instead of 0/1, plus diet tags)
function toRecipe(row, dietTags) {
  return { ...row, isVegetarian: Boolean(row.isVegetarian), dietTags };
}

// Escape LIKE wildcards so a search for "50%" matches the text literally
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (character) => '\\' + character);
}

// GET /api/recipes?search=&mealType=&diet= – recipe cards, optionally searched and filtered
router.get('/', (req, res) => {
  const { search = '', mealType = '', diet = '' } = req.query;
  if (typeof search !== 'string' || search.length > 80) return res.status(400).json({ error: 'Search text is too long.' });
  if (mealType && !MEAL_TYPES.includes(mealType)) return res.status(400).json({ error: 'Unknown meal type.' });
  if (diet && !DIET_TYPES.includes(diet)) return res.status(400).json({ error: 'Unknown diet type.' });

  const conditions = [];
  const params = [];
  if (search.trim()) {
    conditions.push("LOWER(r.RecipeName) LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(search.trim().toLowerCase())}%`);
  }
  if (mealType) {
    conditions.push('r.MealType = ?');
    params.push(mealType);
  }
  if (diet) {
    const condition = dietCondition(diet);
    conditions.push(condition.sql);
    params.push(...condition.params);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM Recipes r ${where} ORDER BY r.RecipeName`).all(...params);

  const tagsByRecipe = new Map();
  for (const { RecipeID, DietType } of getAllTags.all()) {
    if (!tagsByRecipe.has(RecipeID)) tagsByRecipe.set(RecipeID, []);
    tagsByRecipe.get(RecipeID).push(DietType);
  }
  res.json(rows.map((row) => toRecipe(row, tagsByRecipe.get(row.recipeId) || [])));
});

// GET /api/recipes/:id – one recipe with its ingredients and steps
router.get('/:id', (req, res) => {
  const recipeId = Number(req.params.id);
  const row = Number.isInteger(recipeId) ? getRecipe.get(recipeId) : undefined;
  if (!row) return res.status(404).json({ error: 'Recipe not found.' });

  const dietTags = getTags.all(recipeId).map((tag) => tag.DietType);
  res.json({ ...toRecipe(row, dietTags), ingredients: getIngredients.all(recipeId), steps: getSteps.all(recipeId) });
});

module.exports = router;
