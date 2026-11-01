// Recipes & Meal Planning component – Albina Rana
// Weekly meal plan, swapping a meal, and the shopping list with its cost for the logged-in student
// (FF-13, FF-14, FF-15, FF-23, FF-24).
// A week runs Monday to Sunday; each day has a lunch and a dinner.
// Every route works on one week, chosen with ?week=this or ?week=next. Without a choice,
// Sunday means next week (the current week is nearly over) and every other day means this week.
const express = require('express');
const db = require('../db/database');
const { requireLogin } = require('../middleware/requireLogin');
const { weekStart, addDays } = require('../utils/dates');
const { dietCondition } = require('../utils/dietFilter');

const router = express.Router();
const MEAL_SLOTS = ['lunch', 'dinner'];
const DAYS_PER_WEEK = 7;
const WEEKS = ['this', 'next'];

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
const getEntry = db.prepare(`
  SELECT e.EntryID AS entryId, e.MealSlot AS mealSlot, e.RecipeID AS recipeId,
         r.RecipeName AS recipeName, r.PricePerPortion AS pricePerPortion
  FROM MealPlanEntry e JOIN Recipes r ON r.RecipeID = e.RecipeID
  WHERE e.EntryID = ? AND e.UserID = ? AND e.PlanDate BETWEEN ? AND ?`);
const updateEntryRecipe = db.prepare('UPDATE MealPlanEntry SET RecipeID = ? WHERE EntryID = ?');

// Ingredients of the week's plan, combined by name and unit, with their estimated cost
const getShoppingItems = db.prepare(`
  SELECT i.IngredientName AS ingredientName, i.Unit AS unit, SUM(i.Quantity) AS quantity, SUM(i.Cost) AS cost,
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

router.use(requireLogin);

// Work out which week the request is about and put it on req.week:
// { name: 'this' | 'next', start: Monday, end: Sunday }
router.use((req, res, next) => {
  let name = req.query.week;
  if (name === undefined || name === '') name = new Date().getDay() === 0 ? 'next' : 'this';
  if (!WEEKS.includes(name)) return res.status(400).json({ error: "Week must be 'this' or 'next'." });

  const start = name === 'next' ? addDays(weekStart(), DAYS_PER_WEEK) : weekStart();
  req.week = { name, start, end: addDays(start, DAYS_PER_WEEK - 1) };
  next();
});

// Work with money in øre (whole numbers) so sums never drift: 12.50 kr -> 1250
function toOre(kr) {
  return Math.round(kr * 100);
}

// Lunch and dinner recipes that fit the diet, cheapest first
function candidateRecipes(dietType) {
  const diet = dietCondition(dietType);
  const query = db.prepare(`SELECT r.RecipeID AS recipeId, r.RecipeName AS recipeName, r.PricePerPortion AS pricePerPortion
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

// The week's plan in the shape the pages use
function buildWeekPlan(userId, week) {
  const { weeklyBudget, dietType } = getBudgetAndDiet.get(userId);
  const entries = getWeekEntries.all(userId, week.start, week.end);

  const days = [];
  const dayByDate = new Map();
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    const day = { date: addDays(week.start, i), lunch: null, dinner: null };
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

  return {
    week: week.name, weekStart: week.start, weekEnd: week.end, weeklyBudget, dietType,
    hasPlan: entries.length > 0, totalCost, overBudget, warning, days,
  };
}

// GET /api/mealplans?week= – the week's plan (hasPlan is false when nothing is planned yet)
router.get('/', (req, res) => {
  res.json(buildWeekPlan(req.session.userId, req.week));
});

// POST /api/mealplans/generate?week= – create (or replace) the week's plan within the budget
router.post('/generate', (req, res) => {
  const userId = req.session.userId;
  const { weeklyBudget, dietType } = getBudgetAndDiet.get(userId);
  if (!(weeklyBudget > 0)) {
    return res.status(400).json({ error: 'Please set your weekly food budget on your profile first.' });
  }

  const candidates = candidateRecipes(dietType);
  if (!candidates.lunch.length || !candidates.dinner.length) {
    return res.status(409).json({ error: 'There are not enough lunch and dinner recipes for your diet yet.' });
  }

  const plan = choosePlan(candidates, toOre(weeklyBudget), req.week.start);
  db.transaction(() => {
    deleteWeekEntries.run(userId, req.week.start, req.week.end);
    for (const entry of plan) insertEntry.run(userId, entry.recipeId, entry.planDate, entry.mealSlot);
  })();

  res.status(201).json(buildWeekPlan(userId, req.week));
});

// POST /api/mealplans/entries/:entryId/swap?week= – replace one planned meal with another recipe of the
// same meal type and diet. The new recipe must keep the week within budget; if the week is already
// over budget (cheapest plan), it may not cost more than the meal it replaces. Least-used recipes first.
router.post('/entries/:entryId/swap', (req, res) => {
  const userId = req.session.userId;
  const { start, end } = req.week;
  const entry = getEntry.get(Number(req.params.entryId), userId, start, end);
  if (!entry) return res.status(404).json({ error: "This meal is not in your plan for that week." });

  const { weeklyBudget, dietType } = getBudgetAndDiet.get(userId);
  const weekEntries = getWeekEntries.all(userId, start, end);
  const otherMealsOre = weekEntries.reduce((sum, meal) => sum + toOre(meal.pricePerPortion), 0) - toOre(entry.pricePerPortion);
  const maxPriceOre = Math.max(toOre(weeklyBudget) - otherMealsOre, toOre(entry.pricePerPortion));

  let options = candidateRecipes(dietType)[entry.mealSlot]
    .filter((recipe) => recipe.recipeId !== entry.recipeId && toOre(recipe.pricePerPortion) <= maxPriceOre);
  if (options.length === 0) {
    return res.status(409).json({ error: 'No other recipe fits your diet and budget for this meal.' });
  }

  const timesUsed = (recipeId) => weekEntries.filter((meal) => meal.recipeId === recipeId).length;
  const fewestUses = Math.min(...options.map((recipe) => timesUsed(recipe.recipeId)));
  options = options.filter((recipe) => timesUsed(recipe.recipeId) === fewestUses);
  const chosen = options[Math.floor(Math.random() * options.length)];

  updateEntryRecipe.run(chosen.recipeId, entry.entryId);
  res.json({ ...buildWeekPlan(userId, req.week), swapped: { from: entry.recipeName, to: chosen.recipeName } });
});

// GET /api/mealplans/shopping-list?week= – combined ingredients for the week's plan, with estimated cost
router.get('/shopping-list', (req, res) => {
  const { start, end, name } = req.week;
  const items = getShoppingItems.all(start, req.session.userId, start, end).map((item) => ({
    ...item,
    quantity: Math.round(item.quantity * 100) / 100,
    cost: toOre(item.cost) / 100,
    isChecked: Boolean(item.isChecked),
  }));
  const totalCost = items.reduce((sum, item) => sum + toOre(item.cost), 0) / 100;
  res.json({ week: name, weekStart: start, totalCost, items });
});

// PUT /api/mealplans/shopping-list/items?week= – tick or untick an ingredient { ingredientName, isChecked }
router.put('/shopping-list/items', (req, res) => {
  const userId = req.session.userId;
  const { ingredientName, isChecked } = req.body;
  if (typeof ingredientName !== 'string' || !ingredientName) return res.status(400).json({ error: 'Ingredient name is required.' });
  if (typeof isChecked !== 'boolean') return res.status(400).json({ error: 'isChecked must be true or false.' });

  const { start, end } = req.week;
  if (!findPlannedIngredient.get(userId, start, end, ingredientName)) {
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
