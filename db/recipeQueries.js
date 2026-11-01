// Recipes & Meal Planning component – Albina Rana
// Recipe queries shared by the student recipe pages and the recipes admin.
const db = require('./database');
const { DIET_TYPES, dietCondition } = require('../utils/dietFilter');
const { containsPattern } = require('../utils/search');

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const RECIPE_COLUMNS = `r.RecipeID AS recipeId, r.RecipeName AS recipeName, r.MealType AS mealType,
  r.PricePerPortion AS pricePerPortion, r.Calories AS calories, r.IsVegetarian AS isVegetarian, ri.ImagePath AS imageUrl`;
// Recipes with their optional photo (imageUrl is null when there is none)
const RECIPES_WITH_IMAGE = 'Recipes r LEFT JOIN RecipeImage ri ON ri.RecipeID = r.RecipeID';

const getRecipe = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM ${RECIPES_WITH_IMAGE} WHERE r.RecipeID = ?`);
const getAllTags = db.prepare('SELECT RecipeID, DietType FROM RecipeDietTag ORDER BY DietType');
const getTags = db.prepare('SELECT DietType FROM RecipeDietTag WHERE RecipeID = ? ORDER BY DietType');
const getIngredients = db.prepare(`SELECT IngredientName AS ingredientName, Quantity AS quantity, Unit AS unit, Cost AS cost
                                   FROM RecipeIngredient WHERE RecipeID = ? ORDER BY RecipeIngredientID`);
const getSteps = db.prepare(`SELECT StepNumber AS stepNumber, Instruction AS instruction
                             FROM RecipeStep WHERE RecipeID = ? ORDER BY StepNumber`);
const getFavouriteIds = db.prepare('SELECT RecipeID FROM FavouriteRecipe WHERE UserID = ?');
const getFavourites = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM ${RECIPES_WITH_IMAGE}
                                  JOIN FavouriteRecipe f ON f.RecipeID = r.RecipeID
                                  WHERE f.UserID = ? ORDER BY f.DateSaved DESC, r.RecipeName`);

// Database row -> API shape (booleans instead of 0/1, plus diet tags)
function toRecipe(row, dietTags) {
  return { ...row, isVegetarian: Boolean(row.isVegetarian), dietTags };
}

// RecipeID -> ['halal', 'vegan', ...] for every recipe
function allDietTags() {
  const tagsByRecipe = new Map();
  for (const { RecipeID, DietType } of getAllTags.all()) {
    if (!tagsByRecipe.has(RecipeID)) tagsByRecipe.set(RecipeID, []);
    tagsByRecipe.get(RecipeID).push(DietType);
  }
  return tagsByRecipe;
}

// Check ?search=&mealType=&diet= from a request. Returns { error } or the filters.
function readRecipeFilters(query) {
  const { search = '', mealType = '', diet = '' } = query;
  if (typeof search !== 'string' || search.length > 80) return { error: 'Search text is too long.' };
  if (mealType && !MEAL_TYPES.includes(mealType)) return { error: 'Unknown meal type.' };
  if (diet && !DIET_TYPES.includes(diet)) return { error: 'Unknown diet type.' };
  return { search: search.trim(), mealType, diet };
}

// Recipe cards matching the filters (from readRecipeFilters), sorted by name.
// With favouritesOf (a UserID) each card also says whether that student saved it.
function listRecipes({ search, mealType, diet }, { favouritesOf } = {}) {
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push("LOWER(r.RecipeName) LIKE ? ESCAPE '\\'");
    params.push(containsPattern(search));
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
  const rows = db.prepare(`SELECT ${RECIPE_COLUMNS} FROM ${RECIPES_WITH_IMAGE} ${where} ORDER BY r.RecipeName`).all(...params);

  const tagsByRecipe = allDietTags();
  const recipes = rows.map((row) => toRecipe(row, tagsByRecipe.get(row.recipeId) || []));
  if (!favouritesOf) return recipes;
  const favouriteIds = new Set(getFavouriteIds.all(favouritesOf).map((row) => row.RecipeID));
  return recipes.map((recipe) => ({ ...recipe, isFavourite: favouriteIds.has(recipe.recipeId) }));
}

// A student's favourite recipes as cards, most recently saved first
function listFavourites(userId) {
  const tagsByRecipe = allDietTags();
  return getFavourites.all(userId).map((row) => ({ ...toRecipe(row, tagsByRecipe.get(row.recipeId) || []), isFavourite: true }));
}

// One recipe with its ingredients and steps, or undefined if there is no such recipe
function getRecipeDetail(recipeId) {
  const row = Number.isInteger(recipeId) ? getRecipe.get(recipeId) : undefined;
  if (!row) return undefined;
  const dietTags = getTags.all(recipeId).map((tag) => tag.DietType);
  return { ...toRecipe(row, dietTags), ingredients: getIngredients.all(recipeId), steps: getSteps.all(recipeId) };
}

module.exports = { MEAL_TYPES, readRecipeFilters, listRecipes, listFavourites, getRecipeDetail };
