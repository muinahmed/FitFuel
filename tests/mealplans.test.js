// Recipes & Meal Planning component – Albina Rana
// Tests for the weekly meal plan, shopping list and ticking off items (FF-13, FF-14, FF-15).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, signedUpAgent } = require('./helpers');
const { weekStart, addDays } = require('../utils/dates');

// A logged-in student with the given budget and diet
async function studentWith(weeklyBudget, dietType = 'none') {
  const { agent } = await signedUpAgent();
  await agent.put('/api/users/me/budget').send({ weeklyBudget }).expect(200);
  await agent.put('/api/users/me/profile').send({ goal: 'stay healthy', dietType }).expect(200);
  return agent;
}

// All 14 planned meals of a plan response
function plannedMeals(plan) {
  return plan.days.flatMap((day) => [day.lunch, day.dinner]);
}

const recipeById = (recipeId) => db.prepare('SELECT * FROM Recipes WHERE RecipeID = ?').get(recipeId);
const hasTag = (recipeId, dietType) =>
  Boolean(db.prepare('SELECT 1 FROM RecipeDietTag WHERE RecipeID = ? AND DietType = ?').get(recipeId, dietType));

describe('Week dates', () => {
  test('weeks start on Monday', () => {
    assert.equal(weekStart(new Date(2026, 10, 2)), '2026-11-02'); // Monday
    assert.equal(weekStart(new Date(2026, 10, 5)), '2026-11-02'); // Thursday
    assert.equal(weekStart(new Date(2026, 10, 8)), '2026-11-02'); // Sunday
    assert.equal(weekStart(new Date(2026, 0, 1)), '2025-12-29'); // across a year boundary
  });
});

describe('Weekly meal plan (FF-13)', () => {
  test('needs a login', async () => {
    await request(app).get('/api/mealplans/current').expect(401);
    await request(app).post('/api/mealplans/current/generate').expect(401);
  });

  test('a new student has no plan yet', async () => {
    const agent = await studentWith(400);
    const res = await agent.get('/api/mealplans/current').expect(200);
    assert.equal(res.body.hasPlan, false);
    assert.equal(res.body.days.length, 7);
  });

  test('needs a weekly budget first', async () => {
    const { agent } = await signedUpAgent();
    const res = await agent.post('/api/mealplans/current/generate').expect(400);
    assert.equal(res.body.error, 'Please set your weekly food budget on your profile first.');
  });

  test('creates 7 days x lunch + dinner for this week, starting Monday', async () => {
    const agent = await studentWith(500);
    const res = await agent.post('/api/mealplans/current/generate').expect(201);

    const monday = weekStart();
    assert.equal(res.body.weekStart, monday);
    assert.deepEqual(res.body.days.map((day) => day.date), [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i)));
    for (const day of res.body.days) {
      assert.equal(recipeById(day.lunch.recipeId).MealType, 'lunch');
      assert.equal(recipeById(day.dinner.recipeId).MealType, 'dinner');
    }

    const userId = db.prepare('SELECT UserID FROM Users ORDER BY UserID DESC LIMIT 1').get().UserID;
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM MealPlanEntry WHERE UserID = ?').get(userId).n, 14);
  });

  test('total cost stays within the budget and is shown against it', async () => {
    const agent = await studentWith(300, 'vegetarian');
    for (let attempt = 0; attempt < 10; attempt++) {
      const { body } = await agent.post('/api/mealplans/current/generate').expect(201);
      const sum = plannedMeals(body).reduce((total, meal) => total + meal.pricePerPortion, 0);
      assert.ok(Math.abs(body.totalCost - sum) < 0.001);
      assert.ok(body.totalCost <= 300, `plan cost ${body.totalCost}`);
      assert.equal(body.weeklyBudget, 300);
      assert.equal(body.overBudget, false);
      assert.equal(body.warning, null);
    }
  });

  test('respects the diet type', async () => {
    for (const diet of ['vegetarian', 'vegan', 'halal']) {
      const agent = await studentWith(600, diet);
      const { body } = await agent.post('/api/mealplans/current/generate').expect(201);
      for (const meal of plannedMeals(body)) {
        if (diet === 'vegetarian') assert.equal(recipeById(meal.recipeId).IsVegetarian, 1);
        else assert.ok(hasTag(meal.recipeId, diet), `${meal.recipeName} should be ${diet}`);
      }
    }
  });

  test('uses the cheapest valid plan with a warning when the budget is too low', async () => {
    const agent = await studentWith(50, 'vegan');
    const { body } = await agent.post('/api/mealplans/current/generate').expect(201);

    const cheapest = (mealType) => db.prepare(`SELECT MIN(r.PricePerPortion) AS price FROM Recipes r
      JOIN RecipeDietTag t ON t.RecipeID = r.RecipeID AND t.DietType = 'vegan' WHERE r.MealType = ?`).get(mealType).price;
    assert.ok(Math.abs(body.totalCost - 7 * (cheapest('lunch') + cheapest('dinner'))) < 0.001);
    assert.equal(body.overBudget, true);
    assert.match(body.warning, /cheapest plan possible/);
  });

  test('regenerating replaces the week instead of adding to it', async () => {
    const agent = await studentWith(450);
    await agent.post('/api/mealplans/current/generate').expect(201);
    await agent.post('/api/mealplans/current/generate').expect(201);

    const userId = db.prepare('SELECT UserID FROM Users ORDER BY UserID DESC LIMIT 1').get().UserID;
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM MealPlanEntry WHERE UserID = ?').get(userId).n, 14);
  });

  test('students only see their own plan', async () => {
    const planner = await studentWith(450);
    await planner.post('/api/mealplans/current/generate').expect(201);
    const other = await studentWith(450);
    const res = await other.get('/api/mealplans/current').expect(200);
    assert.equal(res.body.hasPlan, false);
  });
});

describe('Shopping list (FF-14)', () => {
  test('combines ingredients by name and unit with summed quantities', async () => {
    const agent = await studentWith(450);
    const { body: plan } = await agent.post('/api/mealplans/current/generate').expect(201);
    const { body: list } = await agent.get('/api/mealplans/current/shopping-list').expect(200);

    // Work out the expected totals straight from the recipes in the plan
    const expected = new Map();
    for (const meal of plannedMeals(plan)) {
      const ingredients = db.prepare('SELECT IngredientName, Unit, Quantity FROM RecipeIngredient WHERE RecipeID = ?').all(meal.recipeId);
      for (const { IngredientName, Unit, Quantity } of ingredients) {
        const key = `${IngredientName}|${Unit}`;
        expected.set(key, (expected.get(key) || 0) + Quantity);
      }
    }

    assert.equal(list.items.length, expected.size, 'one line per ingredient and unit');
    for (const item of list.items) {
      const total = expected.get(`${item.ingredientName}|${item.unit}`);
      assert.ok(Math.abs(item.quantity - total) < 0.01, `${item.ingredientName}: ${item.quantity} vs ${total}`);
      assert.equal(item.isChecked, false);
    }
  });

  test('is empty when there is no plan', async () => {
    const agent = await studentWith(450);
    const res = await agent.get('/api/mealplans/current/shopping-list').expect(200);
    assert.deepEqual(res.body.items, []);
  });
});

describe('Tick off shopping items (FF-15)', () => {
  test('a ticked item stays ticked after reloading, and can be unticked', async () => {
    const agent = await studentWith(450);
    await agent.post('/api/mealplans/current/generate').expect(201);
    const { body: list } = await agent.get('/api/mealplans/current/shopping-list').expect(200);
    const { ingredientName } = list.items[0];

    await agent.put('/api/mealplans/current/shopping-list/items').send({ ingredientName, isChecked: true }).expect(200);
    let reloaded = await agent.get('/api/mealplans/current/shopping-list').expect(200);
    assert.equal(reloaded.body.items.find((item) => item.ingredientName === ingredientName).isChecked, true);

    await agent.put('/api/mealplans/current/shopping-list/items').send({ ingredientName, isChecked: false }).expect(200);
    reloaded = await agent.get('/api/mealplans/current/shopping-list').expect(200);
    assert.equal(reloaded.body.items.find((item) => item.ingredientName === ingredientName).isChecked, false);
  });

  test('rejects items not on the list and invalid values', async () => {
    const agent = await studentWith(450);
    await agent.post('/api/mealplans/current/generate').expect(201);
    await agent.put('/api/mealplans/current/shopping-list/items')
      .send({ ingredientName: 'Caviar', isChecked: true }).expect(404);
    await agent.put('/api/mealplans/current/shopping-list/items')
      .send({ ingredientName: 'Onion', isChecked: 'yes' }).expect(400);
  });
});
