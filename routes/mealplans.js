// Recipes & Meal Planning component – Albina Rana
// This week's meal plan and shopping list for the logged-in student (FF-13, FF-14, FF-15).
// A week runs Monday to Sunday; each day has a lunch and a dinner.
const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/requireLogin');
const { weekStart, addDays } = require('../utils/dates');
const { dietCondition } = require('../utils/dietFilter');

const router = express.Router();
const MEAL_SLOTS = ['lunch', 'dinner'];
const DAYS_PER_WEEK = 7;

router.use(requireLogin);

const getBudgetAndDiet = db.prepare(`
  SELECT u.WeeklyBudget AS weeklyBudget, COALESCE(p.DietType, 'none') AS dietType
  FROM Users u LEFT JOIN UserProfile p ON p.UserID = u.UserID
  WHERE u.UserID = ?`);
const getWeekEntries = db.prepare(`
  SELECT e.EntryID AS entryId, e.PlanDate AS planDate, e.MealSlot AS mealSlot, r.RecipeID AS recipeId,
         r.RecipeName AS recipeName, r.PricePerPortion AS pricePerPortion, r.Calories AS calories
  FROM MealPlanEntry e JOIN Recipes r ON r.RecipeID = e.RecipeID
  WHERE e.UserID = ? AND e.PlanDate BETWEEN ? AND ?`);
const deleteWeekEntries = db.prepare('DELETE FROM MealPlanEntry WHERE UserID = ? AND PlanDate BETWEEN ? AND ?');
const insertEntry = db.prepare('INSERT INTO MealPlanEntry (UserID, RecipeID, PlanDate, MealSlot) VALUES (?, ?, ?, ?)');

// Ingredients of the week's plan, combined by name and unit
const getShoppingItems = db.prepare(`
  SELECT i.IngredientName AS ingredientName, i.Unit AS unit, SUM(i.Quantity) AS quantity,
         MAX(COALESCE(c.IsChecked, 0)) AS isChecked
  FROM MealPlanEntry e
  JOIN RecipeIngredient i ON i.RecipeID = e.RecipeID
  LEFT JOIN ShoppingCheck c ON c.UserID = e.UserID AND c.WeekStart = ? AND c.IngredientName = i.IngredientName
  WHERE e.UserID = ? AND e.PlanDate BETWEEN ? AND ?
  GROUP BY i.IngredientName, i.Unit
  ORDER BY i.IngredientName, i.Unit`);
const findPlannedIngredient = db.prepare(`
  SELECT 1 FROM MealPlanEntry e JOIN RecipeIngredient i ON i.RecipeID = e.RecipeID
  WHERE e.UserID = ? AND e.PlanDate BETWEEN ? AND ? AND i.IngredientName = ?`);
const updateCheck = db.prepare('UPDATE ShoppingCheck SET IsChecked = ? WHERE UserID = ? AND WeekStart = ? AND IngredientName = ?');
const insertCheck = db.prepare('INSERT INTO ShoppingCheck (UserID, WeekStart, IngredientName, IsChecked) VALUES (?, ?, ?, ?)');

// Work with money in øre (whole numbers) so sums never drift: 12.50 kr -> 1250
function toOre(kr) {
  return Math.round(kr * 100);
}

// Lunch and dinner recipes that fit the diet, cheapest first
function candidateRecipes(dietType) {
  const diet = dietCondition(dietType);
  const query = db.prepare(`SELECT r.RecipeID AS recipeId, r.PricePerPortion AS pricePerPortion
                            FROM Recipes r WHERE r.MealType = ? AND ${diet.sql}
                            ORDER BY r.PricePerPortion, r.RecipeID`);
  return {
    lunch: query.all('lunch', ...diet.params),
    dinner: query.all('dinner', ...diet.params),
  };
}

// Cost in øre of the cheapest possible week for these candidates
function cheapestWeekOre(candidates) {
  return DAYS_PER_WEEK * MEAL_SLOTS.reduce((sum, slot) => sum + toOre(candidates[slot][0].pricePerPortion), 0);
}

// Pick a recipe for every lunch and dinner of the week.
// Each pick leaves enough budget for the cheapest recipe in every slot still to fill,
// so the week stays within budget whenever that is possible. If even the cheapest week
// is over budget, every slot gets its cheapest recipe. Least-used recipes are preferred for variety.
function choosePlan(candidates, budgetOre, firstDay) {
  const slots = [];
  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    for (const mealSlot of MEAL_SLOTS) slots.push({ planDate: addDays(firstDay, day), mealSlot });
  }

  // reserveOre[i] = cheapest cost of filling slots i..end
  const reserveOre = new Array(slots.length + 1).fill(0);
  for (let i = slots.length - 1; i >= 0; i--) {
    reserveOre[i] = reserveOre[i + 1] + toOre(candidates[slots[i].mealSlot][0].pricePerPortion);
  }

  const timesUsed = new Map();
  let remainingOre = budgetOre;
  return slots.map((slot, index) => {
    const recipes = candidates[slot.mealSlot];
    let options = recipes.filter((recipe) => toOre(recipe.pricePerPortion) <= remainingOre - reserveOre[index + 1]);
    if (options.length === 0) options = [recipes[0]];

    const fewestUses = Math.min(...options.map((recipe) => timesUsed.get(recipe.recipeId) || 0));
    options = options.filter((recipe) => (timesUsed.get(recipe.recipeId) || 0) === fewestUses);
    const chosen = options[Math.floor(Math.random() * options.length)];

    timesUsed.set(chosen.recipeId, fewestUses + 1);
    remainingOre -= toOre(chosen.pricePerPortion);
    return { ...slot, recipeId: chosen.recipeId };
  });
}

// This week's plan in the shape the pages use
function buildWeekPlan(userId) {
  const start = weekStart();
  const end = addDays(start, DAYS_PER_WEEK - 1);
  const { weeklyBudget, dietType } = getBudgetAndDiet.get(userId);
  const entries = getWeekEntries.all(userId, start, end);

  const days = [];
  const dayByDate = new Map();
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    const day = { date: addDays(start, i), lunch: null, dinner: null };
    days.push(day);
    dayByDate.set(day.date, day);
  }
  for (const { planDate, mealSlot, ...meal } of entries) dayByDate.get(planDate)[mealSlot] = meal;

  const totalCost = entries.reduce((sum, entry) => sum + toOre(entry.pricePerPortion), 0) / 100;
  const overBudget = entries.length > 0 && totalCost > weeklyBudget;
  let warning = null;
  if (overBudget) {
    const candidates = candidateRecipes(dietType);
    const budgetTooLow = candidates.lunch.length && candidates.dinner.length && cheapestWeekOre(candidates) > toOre(weeklyBudget);
    warning = budgetTooLow
      ? 'Your budget is too low for a full week of meals that fit your diet, so this is the cheapest plan possible.'
      : 'This plan costs more than your weekly budget. Generate a new plan to bring it within budget.';
  }

  return { weekStart: start, weekEnd: end, weeklyBudget, dietType, hasPlan: entries.length > 0, totalCost, overBudget, warning, days };
}

// GET /api/mealplans/current – this week's plan (hasPlan is false when nothing is planned yet)
router.get('/current', (req, res) => {
  res.json(buildWeekPlan(req.session.userId));
});

// POST /api/mealplans/current/generate – create (or replace) this week's plan within the budget
router.post('/current/generate', (req, res) => {
  const userId = req.session.userId;
  const { weeklyBudget, dietType } = getBudgetAndDiet.get(userId);
  if (!(weeklyBudget > 0)) {
    return res.status(400).json({ error: 'Please set your weekly food budget on your profile first.' });
  }

  const candidates = candidateRecipes(dietType);
  if (!candidates.lunch.length || !candidates.dinner.length) {
    return res.status(409).json({ error: 'There are not enough lunch and dinner recipes for your diet yet.' });
  }

  const start = weekStart();
  const plan = choosePlan(candidates, toOre(weeklyBudget), start);
  db.transaction(() => {
    deleteWeekEntries.run(userId, start, addDays(start, DAYS_PER_WEEK - 1));
    for (const entry of plan) insertEntry.run(userId, entry.recipeId, entry.planDate, entry.mealSlot);
  })();

  res.status(201).json(buildWeekPlan(userId));
});

// GET /api/mealplans/current/shopping-list – combined ingredients for this week's plan
router.get('/current/shopping-list', (req, res) => {
  const start = weekStart();
  const items = getShoppingItems.all(start, req.session.userId, start, addDays(start, DAYS_PER_WEEK - 1))
    .map((item) => ({ ...item, quantity: Math.round(item.quantity * 100) / 100, isChecked: Boolean(item.isChecked) }));
  res.json({ weekStart: start, items });
});

// PUT /api/mealplans/current/shopping-list/items – tick or untick an ingredient { ingredientName, isChecked }
router.put('/current/shopping-list/items', (req, res) => {
  const userId = req.session.userId;
  const { ingredientName, isChecked } = req.body;
  if (typeof ingredientName !== 'string' || !ingredientName) return res.status(400).json({ error: 'Ingredient name is required.' });
  if (typeof isChecked !== 'boolean') return res.status(400).json({ error: 'isChecked must be true or false.' });

  const start = weekStart();
  if (!findPlannedIngredient.get(userId, start, addDays(start, DAYS_PER_WEEK - 1), ingredientName)) {
    return res.status(404).json({ error: 'This item is not on your shopping list.' });
  }

  const checked = isChecked ? 1 : 0;
  db.transaction(() => {
    if (updateCheck.run(checked, userId, start, ingredientName).changes === 0) {
      insertCheck.run(userId, start, ingredientName, checked);
    }
  })();
  res.json({ ingredientName, isChecked });
});

module.exports = router;
