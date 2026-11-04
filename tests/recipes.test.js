// Recipes & Meal Planning component – Albina Rana
// Tests for browsing, searching and filtering recipes and the recipe detail (FF-12).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, signedUpAgent } = require('./helpers');

describe('Browse recipes (FF-12)', () => {
  test('needs a login', async () => {
    await request(app).get('/api/recipes').expect(401);
  });

  test('lists every recipe with name, meal type, price and calories', async () => {
    const { agent } = await signedUpAgent();
    const res = await agent.get('/api/recipes').expect(200);

    assert.equal(res.body.length, db.prepare('SELECT COUNT(*) AS n FROM Recipes').get().n);
    for (const recipe of res.body) {
      assert.equal(typeof recipe.recipeName, 'string');
      assert.ok(['breakfast', 'lunch', 'dinner', 'snack'].includes(recipe.mealType));
      assert.equal(typeof recipe.pricePerPortion, 'number');
      assert.equal(typeof recipe.calories, 'number');
      assert.equal(typeof recipe.isVegetarian, 'boolean');
      assert.ok(Array.isArray(recipe.dietTags));
    }
  });

  test('searches by name, ignoring letter case', async () => {
    const { agent } = await signedUpAgent();
    const res = await agent.get('/api/recipes?search=CURRY').expect(200);
    assert.ok(res.body.length >= 2);
    for (const recipe of res.body) assert.match(recipe.recipeName, /curry/i);
  });

  test('a search with no matches returns an empty list', async () => {
    const { agent } = await signedUpAgent();
    const res = await agent.get('/api/recipes?search=' + encodeURIComponent('100%_nothing')).expect(200);
    assert.deepEqual(res.body, []);
  });

  test('filters by meal type', async () => {
    const { agent } = await signedUpAgent();
    const res = await agent.get('/api/recipes?mealType=snack').expect(200);
    assert.ok(res.body.length > 0);
    for (const recipe of res.body) assert.equal(recipe.mealType, 'snack');
  });

  test('filters by diet', async () => {
    const { agent } = await signedUpAgent();

    const vegetarian = await agent.get('/api/recipes?diet=vegetarian').expect(200);
    assert.ok(vegetarian.body.length > 0);
    for (const recipe of vegetarian.body) assert.equal(recipe.isVegetarian, true);

    for (const diet of ['vegan', 'halal']) {
      const res = await agent.get(`/api/recipes?diet=${diet}`).expect(200);
      assert.ok(res.body.length > 0);
      for (const recipe of res.body) assert.ok(recipe.dietTags.includes(diet), `${recipe.recipeName} is ${diet}`);
    }
  });

  test('search and filters combine', async () => {
    const { agent } = await signedUpAgent();
    const res = await agent.get('/api/recipes?search=curry&mealType=dinner&diet=vegan').expect(200);
    assert.ok(res.body.length > 0);
    assert.ok(res.body.some((recipe) => recipe.recipeName === 'Sweet Potato Chickpea Curry'));
    for (const recipe of res.body) {
      assert.match(recipe.recipeName, /curry/i);
      assert.equal(recipe.mealType, 'dinner');
      assert.ok(recipe.dietTags.includes('vegan'), recipe.recipeName);
    }
    // Curries that are not vegan dinners are left out
    const all = await agent.get('/api/recipes?search=curry').expect(200);
    assert.ok(all.body.length > res.body.length);
  });

  test('rejects unknown meal types and diets', async () => {
    const { agent } = await signedUpAgent();
    await agent.get('/api/recipes?mealType=brunch').expect(400);
    await agent.get('/api/recipes?diet=keto').expect(400);
  });
});

describe('Recipe detail (FF-12)', () => {
  test('shows ingredients and numbered steps', async () => {
    const { agent } = await signedUpAgent();
    const { RecipeID } = db.prepare("SELECT RecipeID FROM Recipes WHERE RecipeName = 'Red Lentil Soup'").get();
    const res = await agent.get(`/api/recipes/${RecipeID}`).expect(200);

    assert.equal(res.body.recipeName, 'Red Lentil Soup');
    assert.deepEqual(res.body.dietTags, ['halal', 'vegan']);
    assert.equal(res.body.ingredients.length, 6);
    assert.deepEqual(Object.keys(res.body.ingredients[0]).sort(), ['cost', 'ingredientName', 'quantity', 'unit']);
    assert.deepEqual(res.body.steps.map((step) => step.stepNumber), [1, 2, 3, 4, 5]);
  });

  test('unknown recipe gives 404', async () => {
    const { agent } = await signedUpAgent();
    await agent.get('/api/recipes/99999').expect(404);
    await agent.get('/api/recipes/abc').expect(404);
  });
});
