// Recipes & Meal Planning component – Albina Rana
// Recipes admin: add, edit, delete, search/filter recipes and view recipe usage.
const express = require('express');
const db = require('../../db/database');
const { requireAdmin } = require('../../middleware/requireAdmin');
const { MEAL_TYPES, readRecipeFilters, listRecipes, getRecipeDetail } = require('../../db/recipeQueries');
const { cleanText, readNumber } = require('../../utils/validation');
const { weekStart } = require('../../utils/dates');

const router = express.Router();
const DIET_TAGS = ['vegan', 'halal'];
const MAX_INGREDIENTS = 20;
const MAX_STEPS = 15;

router.use(requireAdmin);

const insertRecipe = db.prepare(`INSERT INTO Recipes (RecipeName, MealType, PricePerPortion, Calories, IsVegetarian)
                                 VALUES (?, ?, ?, ?, ?)`);
const updateRecipe = db.prepare(`UPDATE Recipes SET RecipeName = ?, MealType = ?, PricePerPortion = ?, Calories = ?, IsVegetarian = ?
                                 WHERE RecipeID = ?`);
const deleteRecipe = db.prepare('DELETE FROM Recipes WHERE RecipeID = ?');
const insertIngredient = db.prepare('INSERT INTO RecipeIngredient (RecipeID, IngredientName, Quantity, Unit, Cost) VALUES (?, ?, ?, ?, ?)');
const insertStep = db.prepare('INSERT INTO RecipeStep (RecipeID, StepNumber, Instruction) VALUES (?, ?, ?)');
const insertTag = db.prepare('INSERT INTO RecipeDietTag (RecipeID, DietType) VALUES (?, ?)');
const deleteIngredients = db.prepare('DELETE FROM RecipeIngredient WHERE RecipeID = ?');
const deleteSteps = db.prepare('DELETE FROM RecipeStep WHERE RecipeID = ?');
const deleteTags = db.prepare('DELETE FROM RecipeDietTag WHERE RecipeID = ?');
const countCurrentPlanUses = db.prepare('SELECT COUNT(*) AS count FROM MealPlanEntry WHERE RecipeID = ? AND PlanDate >= ?');
const getUsage = db.prepare(`
  SELECT r.RecipeID AS recipeId, r.RecipeName AS recipeName, r.MealType AS mealType, COUNT(e.EntryID) AS timesPlanned
  FROM Recipes r LEFT JOIN MealPlanEntry e ON e.RecipeID = r.RecipeID
  GROUP BY r.RecipeID, r.RecipeName, r.MealType
  ORDER BY timesPlanned DESC, r.RecipeName`);

// Check a recipe from the admin form. Returns { error } or the cleaned recipe.
// PricePerPortion is the sum of the ingredient costs (ingredients are for one portion).
function readRecipeInput(body) {
  const recipeName = cleanText(body.recipeName);
  if (!recipeName || recipeName.length > 80) return { error: 'Recipe name is required (up to 80 characters).' };
  if (!MEAL_TYPES.includes(body.mealType)) return { error: 'Please choose a meal type.' };
  const calories = readNumber(body.calories, 1, 5000, { integer: true });
  if (calories === null) return { error: 'Calories must be a whole number between 1 and 5000.' };
  if (typeof body.isVegetarian !== 'boolean') return { error: 'Say whether the recipe is vegetarian.' };

  const dietTags = Array.isArray(body.dietTags) ? [...new Set(body.dietTags)] : [];
  if (!dietTags.every((tag) => DIET_TAGS.includes(tag))) return { error: 'Diet tags can only be vegan or halal.' };
  if (dietTags.includes('vegan') && !body.isVegetarian) return { error: 'A vegan recipe must also be vegetarian.' };

  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0 || body.ingredients.length > MAX_INGREDIENTS) {
    return { error: `Add between 1 and ${MAX_INGREDIENTS} ingredients.` };
  }
  const ingredients = [];
  for (const [index, item] of body.ingredients.entries()) {
    const ingredientName = cleanText(item && item.ingredientName);
    const unit = cleanText(item && item.unit);
    const quantity = readNumber(item && item.quantity, 0.01, 9999.99);
    const cost = readNumber(item && item.cost, 0, 999.99);
    const row = `Ingredient ${index + 1}`;
    if (!ingredientName || ingredientName.length > 60) return { error: `${row}: name is required (up to 60 characters).` };
    if (quantity === null) return { error: `${row}: quantity must be a positive number.` };
    if (!unit || unit.length > 15) return { error: `${row}: unit is required (up to 15 characters).` };
    if (cost === null) return { error: `${row}: cost must be 0 kr or more.` };
    ingredients.push({ ingredientName, quantity, unit, cost: Math.round(cost * 100) / 100 });
  }

  if (!Array.isArray(body.steps) || body.steps.length === 0 || body.steps.length > MAX_STEPS) {
    return { error: `Add between 1 and ${MAX_STEPS} steps.` };
  }
  const steps = body.steps.map(cleanText);
  const badStep = steps.findIndex((step) => !step || step.length > 255);
  if (badStep >= 0) return { error: `Step ${badStep + 1}: write the instruction (up to 255 characters).` };

  const pricePerPortion = Math.round(ingredients.reduce((sum, item) => sum + item.cost * 100, 0)) / 100;
  if (pricePerPortion <= 0 || pricePerPortion > 999.99) return { error: 'The ingredient costs must add up to between 0.01 and 999.99 kr.' };

  return { recipeName, mealType: body.mealType, calories, isVegetarian: body.isVegetarian, dietTags, ingredients, steps, pricePerPortion };
}

// Write ingredients, steps and tags for a recipe (after any old ones are removed)
function insertRecipeParts(recipeId, recipe) {
  for (const item of recipe.ingredients) insertIngredient.run(recipeId, item.ingredientName, item.quantity, item.unit, item.cost);
  recipe.steps.forEach((instruction, index) => insertStep.run(recipeId, index + 1, instruction));
  for (const tag of recipe.dietTags) insertTag.run(recipeId, tag);
}

// The recipe id in /recipes/:id if that recipe exists, otherwise null
function existingRecipeId(req) {
  const recipeId = Number(req.params.id);
  return getRecipeDetail(recipeId) ? recipeId : null;
}

// GET /api/admin/recipes?search=&mealType=&diet= – all recipes with how often each was planned
router.get('/', (req, res) => {
  const filters = readRecipeFilters(req.query);
  if (filters.error) return res.status(400).json({ error: filters.error });
  const timesPlanned = new Map(getUsage.all().map((row) => [row.recipeId, row.timesPlanned]));
  res.json(listRecipes(filters).map((recipe) => ({ ...recipe, timesPlanned: timesPlanned.get(recipe.recipeId) || 0 })));
});

// GET /api/admin/recipes/usage – how many times each recipe appears in meal plans, most popular first
router.get('/usage', (req, res) => {
  res.json(getUsage.all());
});

// GET /api/admin/recipes/:id – one recipe with ingredients and steps (for the edit form)
router.get('/:id', (req, res) => {
  const recipe = getRecipeDetail(Number(req.params.id));
  if (!recipe) return res.status(404).json({ error: 'Recipe not found.' });
  res.json(recipe);
});

// POST /api/admin/recipes – add a recipe with ingredients and steps
router.post('/', (req, res) => {
  const recipe = readRecipeInput(req.body);
  if (recipe.error) return res.status(400).json({ error: recipe.error });

  const recipeId = db.transaction(() => {
    const { lastInsertRowid } = insertRecipe.run(recipe.recipeName, recipe.mealType, recipe.pricePerPortion,
      recipe.calories, recipe.isVegetarian ? 1 : 0);
    insertRecipeParts(lastInsertRowid, recipe);
    return Number(lastInsertRowid);
  })();
  res.status(201).json(getRecipeDetail(recipeId));
});

// PUT /api/admin/recipes/:id – replace a recipe's details, ingredients, steps and tags
router.put('/:id', (req, res) => {
  const recipeId = existingRecipeId(req);
  if (!recipeId) return res.status(404).json({ error: 'Recipe not found.' });
  const recipe = readRecipeInput(req.body);
  if (recipe.error) return res.status(400).json({ error: recipe.error });

  db.transaction(() => {
    updateRecipe.run(recipe.recipeName, recipe.mealType, recipe.pricePerPortion, recipe.calories,
      recipe.isVegetarian ? 1 : 0, recipeId);
    deleteIngredients.run(recipeId);
    deleteSteps.run(recipeId);
    deleteTags.run(recipeId);
    insertRecipeParts(recipeId, recipe);
  })();
  res.json(getRecipeDetail(recipeId));
});

// DELETE /api/admin/recipes/:id[?force=true]
// If students have the recipe in this week's or a future meal plan, answer 409 with the count
// so the admin can confirm; ?force=true deletes it anyway (those meals leave the plans).
router.delete('/:id', (req, res) => {
  const recipeId = existingRecipeId(req);
  if (!recipeId) return res.status(404).json({ error: 'Recipe not found.' });

  const { count } = countCurrentPlanUses.get(recipeId, weekStart());
  if (count > 0 && req.query.force !== 'true') {
    return res.status(409).json({
      error: `This recipe is in ${count} meal${count === 1 ? '' : 's'} in students' current meal plans.`,
      usedInCurrentPlans: count,
    });
  }

  deleteRecipe.run(recipeId);
  res.status(204).end();
});

module.exports = router;
