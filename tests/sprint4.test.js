// Sprint 4 tests: swap a meal (FF-23), shopping list cost (FF-24), favourites (FF-25),
// weekly reminder (FF-26) and the "page not found" page.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, signedUpAgent } = require('./helpers');

// A logged-in student with a budget, diet and a plan for this week
async function studentWithPlan(weeklyBudget, dietType = 'none') {
  const { agent, student } = await signedUpAgent();
  await agent.put('/api/users/me/budget').send({ weeklyBudget }).expect(200);
  await agent.put('/api/users/me/profile').send({ goal: 'stay healthy', dietType }).expect(200);
  const { body: plan } = await agent.post('/api/mealplans/generate?week=this').expect(201);
  return { agent, student, plan };
}

const recipeById = (recipeId) => db.prepare('SELECT * FROM Recipes WHERE RecipeID = ?').get(recipeId);
const hasTag = (recipeId, dietType) =>
  Boolean(db.prepare('SELECT 1 FROM RecipeDietTag WHERE RecipeID = ? AND DietType = ?').get(recipeId, dietType));

describe('Swap a meal (FF-23)', () => {
  test('swaps to another recipe of the same meal type and diet, keeping the week within budget', async () => {
    const { agent, plan } = await studentWithPlan(400, 'vegan');
    const meal = plan.days[2].dinner;

    const { body } = await agent.post(`/api/mealplans/entries/${meal.entryId}/swap?week=this`).expect(200);
    const swapped = body.days[2].dinner;

    assert.equal(swapped.entryId, meal.entryId);
    assert.notEqual(swapped.recipeId, meal.recipeId);
    assert.equal(recipeById(swapped.recipeId).MealType, 'dinner');
    assert.ok(hasTag(swapped.recipeId, 'vegan'));
    assert.ok(body.totalCost <= 400);
    assert.deepEqual(body.swapped, { from: meal.recipeName, to: swapped.recipeName });
  });

  test('the shopping list follows the swap', async () => {
    const { agent, plan } = await studentWithPlan(450);
    const meal = plan.days[0].lunch;
    const { body } = await agent.post(`/api/mealplans/entries/${meal.entryId}/swap?week=this`).expect(200);
    const newRecipeId = body.days[0].lunch.recipeId;

    const { body: list } = await agent.get('/api/mealplans/shopping-list?week=this').expect(200);
    const listed = new Set(list.items.map((item) => item.ingredientName));
    for (const { IngredientName } of db.prepare('SELECT IngredientName FROM RecipeIngredient WHERE RecipeID = ?').all(newRecipeId)) {
      assert.ok(listed.has(IngredientName), `${IngredientName} is on the list`);
    }
  });

  test('says so when no other recipe fits the budget', async () => {
    // Budget equal to the cheapest vegan week: every meal is already the cheapest choice
    const cheapest = (mealType) => db.prepare(`SELECT MIN(r.PricePerPortion) AS price FROM Recipes r
      JOIN RecipeDietTag t ON t.RecipeID = r.RecipeID AND t.DietType = 'vegan' WHERE r.MealType = ?`).get(mealType).price;
    const budget = 7 * (cheapest('lunch') + cheapest('dinner'));
    const { agent, plan } = await studentWithPlan(budget, 'vegan');

    const res = await agent.post(`/api/mealplans/entries/${plan.days[0].lunch.entryId}/swap?week=this`).expect(409);
    assert.equal(res.body.error, 'No other recipe fits your diet and budget for this meal.');
  });

  test("cannot swap another student's meal or a meal from another week", async () => {
    const { plan } = await studentWithPlan(450);
    const { agent: other } = await studentWithPlan(450);
    await other.post(`/api/mealplans/entries/${plan.days[0].lunch.entryId}/swap?week=this`).expect(404);

    const { agent, plan: ownPlan } = await studentWithPlan(450);
    await agent.post(`/api/mealplans/entries/${ownPlan.days[0].lunch.entryId}/swap?week=next`).expect(404);
  });
});

describe('Shopping list cost (FF-24)', () => {
  test('each item has an estimated cost and the total matches the plan', async () => {
    const { agent, plan } = await studentWithPlan(450);
    const { body: list } = await agent.get('/api/mealplans/shopping-list?week=this').expect(200);

    const itemSum = list.items.reduce((sum, item) => sum + item.cost, 0);
    assert.ok(Math.abs(list.totalCost - itemSum) < 0.001);
    // Recipe prices are the sum of their ingredient costs, so the list costs the same as the plan
    assert.ok(Math.abs(list.totalCost - plan.totalCost) < 0.001, `${list.totalCost} vs ${plan.totalCost}`);
  });

  test('the total updates when the plan changes', async () => {
    const { agent, plan } = await studentWithPlan(600);
    const { body: swapped } = await agent.post(`/api/mealplans/entries/${plan.days[1].dinner.entryId}/swap?week=this`).expect(200);
    const { body: list } = await agent.get('/api/mealplans/shopping-list?week=this').expect(200);
    assert.ok(Math.abs(list.totalCost - swapped.totalCost) < 0.001);
  });
});

describe('Favourite recipes (FF-25)', () => {
  test('save, list and remove favourites', async () => {
    const { agent } = await signedUpAgent();
    const ids = db.prepare('SELECT RecipeID FROM Recipes ORDER BY RecipeID LIMIT 2').all().map((row) => row.RecipeID);

    await agent.put(`/api/recipes/${ids[0]}/favourite`).expect(200);
    await agent.put(`/api/recipes/${ids[1]}/favourite`).expect(200);
    await agent.put(`/api/recipes/${ids[1]}/favourite`).expect(200); // saving twice is fine

    let favourites = (await agent.get('/api/recipes/favourites').expect(200)).body;
    assert.deepEqual(favourites.map((recipe) => recipe.recipeId).sort(), [...ids].sort());
    assert.ok(favourites.every((recipe) => recipe.isFavourite));

    const list = (await agent.get('/api/recipes').expect(200)).body;
    assert.equal(list.find((recipe) => recipe.recipeId === ids[0]).isFavourite, true);
    assert.equal(list.filter((recipe) => recipe.isFavourite).length, 2);

    await agent.delete(`/api/recipes/${ids[0]}/favourite`).expect(200);
    favourites = (await agent.get('/api/recipes/favourites').expect(200)).body;
    assert.deepEqual(favourites.map((recipe) => recipe.recipeId), [ids[1]]);
  });

  test('favourites are private to each student', async () => {
    const { agent: first } = await signedUpAgent();
    const { agent: second } = await signedUpAgent();
    const { RecipeID } = db.prepare('SELECT RecipeID FROM Recipes LIMIT 1').get();
    await first.put(`/api/recipes/${RecipeID}/favourite`).expect(200);
    assert.deepEqual((await second.get('/api/recipes/favourites').expect(200)).body, []);
  });

  test('unknown recipes cannot be saved, and favourites need a login', async () => {
    const { agent } = await signedUpAgent();
    await agent.put('/api/recipes/99999/favourite').expect(404);
    await request(app).get('/api/recipes/favourites').expect(401);
  });
});

describe('Weekly reminder (FF-26)', () => {
  test('the student picks a reminder day, or none', async () => {
    const { agent } = await signedUpAgent();
    let res = await agent.put('/api/users/me/reminder').send({ reminderDay: 'Sunday' }).expect(200);
    assert.equal(res.body.reminderDay, 'Sunday');
    res = await agent.get('/api/users/me').expect(200);
    assert.equal(res.body.reminderDay, 'Sunday');

    res = await agent.put('/api/users/me/reminder').send({ reminderDay: '' }).expect(200);
    assert.equal(res.body.reminderDay, null);

    await agent.put('/api/users/me/reminder').send({ reminderDay: 'Someday' }).expect(400);
  });
});

describe('Page not found', () => {
  test('unknown pages get a friendly 404 page; unknown API paths get JSON', async () => {
    const page = await request(app).get('/no-such-page.html').expect(404);
    assert.match(page.text, /Page not found/);
    const api = await request(app).get('/api/no-such-thing').expect(404);
    assert.equal(api.body.error, 'Not found');
  });
});
