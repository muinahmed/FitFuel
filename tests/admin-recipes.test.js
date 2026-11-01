// Recipes & Meal Planning component – Albina Rana
// Tests for the recipes admin.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { db, signedUpAgent, adminAgent } = require('./helpers');

// A valid recipe body; change parts with overrides
function newRecipe(overrides = {}) {
  return {
    recipeName: 'Admin Test Bean Stew',
    mealType: 'dinner',
    calories: 520,
    isVegetarian: true,
    dietTags: ['vegan', 'halal'],
    ingredients: [
      { ingredientName: 'Butter beans (canned)', quantity: 200, unit: 'g', cost: 6.5 },
      { ingredientName: 'Onion', quantity: 1, unit: 'pcs', cost: 1.5 },
      { ingredientName: 'Rice', quantity: 90, unit: 'g', cost: 2 },
    ],
    steps: ['Fry the onion.', 'Add the beans and simmer for 10 minutes.', 'Serve with rice.'],
    ...overrides,
  };
}

describe('Recipes admin', () => {
  test('adds a recipe with ingredients and steps; students can see it', async () => {
    const admin = await adminAgent();
    const { body: created } = await admin.post('/api/admin/recipes').send(newRecipe()).expect(201);

    assert.equal(created.pricePerPortion, 10, 'price is the sum of ingredient costs');
    assert.equal(created.ingredients.length, 3);
    assert.deepEqual(created.steps.map((step) => step.stepNumber), [1, 2, 3]);
    assert.deepEqual(created.dietTags, ['halal', 'vegan']);

    const { agent: student } = await signedUpAgent();
    const list = await student.get('/api/recipes?search=admin test bean').expect(200);
    assert.equal(list.body.length, 1);
    const detail = await student.get(`/api/recipes/${created.recipeId}`).expect(200);
    assert.equal(detail.body.steps[1].instruction, 'Add the beans and simmer for 10 minutes.');
  });

  test('rejects invalid recipes', async () => {
    const admin = await adminAgent();
    const bad = [
      { recipeName: '' },
      { mealType: 'brunch' },
      { calories: 0 },
      { calories: 'many' },
      { isVegetarian: 'yes' },
      { dietTags: ['keto'] },
      { isVegetarian: false, dietTags: ['vegan'] },
      { ingredients: [] },
      { ingredients: [{ ingredientName: 'Salt', quantity: 1, unit: 'tsp', cost: -1 }] },
      { ingredients: [{ ingredientName: '', quantity: 1, unit: 'tsp', cost: 1 }] },
      { ingredients: [{ ingredientName: 'Salt', quantity: 0, unit: 'tsp', cost: 1 }] },
      { steps: [] },
      { steps: ['Fine', '   '] },
    ];
    for (const overrides of bad) {
      const res = await admin.post('/api/admin/recipes').send(newRecipe(overrides));
      assert.equal(res.status, 400, JSON.stringify(overrides));
    }
  });

  test('edits a recipe, replacing its ingredients, steps and tags', async () => {
    const admin = await adminAgent();
    const { body: created } = await admin.post('/api/admin/recipes').send(newRecipe()).expect(201);

    const { body: edited } = await admin.put(`/api/admin/recipes/${created.recipeId}`).send(newRecipe({
      recipeName: 'Edited Stew',
      isVegetarian: false,
      dietTags: ['halal'],
      ingredients: [{ ingredientName: 'Chicken thigh (halal)', quantity: 150, unit: 'g', cost: 14 }],
      steps: ['Cook the chicken.'],
    })).expect(200);

    assert.equal(edited.recipeName, 'Edited Stew');
    assert.equal(edited.pricePerPortion, 14);
    assert.equal(edited.isVegetarian, false);
    assert.deepEqual(edited.dietTags, ['halal']);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM RecipeIngredient WHERE RecipeID = ?').get(created.recipeId).n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM RecipeStep WHERE RecipeID = ?').get(created.recipeId).n, 1);

    await admin.put('/api/admin/recipes/99999').send(newRecipe()).expect(404);
  });

  test('deletes an unused recipe straight away', async () => {
    const admin = await adminAgent();
    const { body: created } = await admin.post('/api/admin/recipes').send(newRecipe()).expect(201);
    await admin.delete(`/api/admin/recipes/${created.recipeId}`).expect(204);
    await admin.get(`/api/admin/recipes/${created.recipeId}`).expect(404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM RecipeIngredient WHERE RecipeID = ?').get(created.recipeId).n, 0);
  });

  test('warns before deleting a recipe used in current meal plans', async () => {
    const admin = await adminAgent();
    const { agent: student, student: details } = await signedUpAgent();
    await student.put('/api/users/me/budget').send({ weeklyBudget: 500 }).expect(200);
    const { body: plan } = await student.post('/api/mealplans/generate?week=this').expect(201);
    const { recipeId } = plan.days[0].lunch;
    const userId = db.prepare('SELECT UserID FROM Users WHERE Email = ?').get(details.email).UserID;
    const uses = db.prepare('SELECT COUNT(*) AS n FROM MealPlanEntry WHERE RecipeID = ? AND UserID = ?').get(recipeId, userId).n;

    const blocked = await admin.delete(`/api/admin/recipes/${recipeId}`).expect(409);
    assert.ok(blocked.body.usedInCurrentPlans >= uses);
    assert.ok(db.prepare('SELECT 1 FROM Recipes WHERE RecipeID = ?').get(recipeId), 'not deleted yet');

    await admin.delete(`/api/admin/recipes/${recipeId}?force=true`).expect(204);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM MealPlanEntry WHERE RecipeID = ?').get(recipeId).n, 0);
  });

  test('searches and filters recipes, showing how often each was planned', async () => {
    const admin = await adminAgent();
    const res = await admin.get('/api/admin/recipes?mealType=breakfast&diet=vegan').expect(200);
    assert.ok(res.body.length > 0);
    for (const recipe of res.body) {
      assert.equal(recipe.mealType, 'breakfast');
      assert.ok(recipe.dietTags.includes('vegan'));
      assert.equal(typeof recipe.timesPlanned, 'number');
    }
    await admin.get('/api/admin/recipes?mealType=brunch').expect(400);
  });

  test('usage counts MealPlanEntry rows per recipe, most popular first', async () => {
    const admin = await adminAgent();
    const { agent: student } = await signedUpAgent();
    await student.put('/api/users/me/budget').send({ weeklyBudget: 450 }).expect(200);
    await student.post('/api/mealplans/generate?week=next').expect(201);

    const { body: usage } = await admin.get('/api/admin/recipes/usage').expect(200);
    assert.equal(usage.length, db.prepare('SELECT COUNT(*) AS n FROM Recipes').get().n);
    const counts = usage.map((row) => row.timesPlanned);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
    for (const row of usage.slice(0, 5)) {
      assert.equal(row.timesPlanned, db.prepare('SELECT COUNT(*) AS n FROM MealPlanEntry WHERE RecipeID = ?').get(row.recipeId).n);
    }
  });
});
