// Tests for the schema and seed data used by all components.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');

const count = (sql, ...params) => db.prepare(sql).get(...params).n;

describe('Seed data', () => {
  test('has one admin and three demo students with profiles and different budgets', () => {
    assert.equal(count("SELECT COUNT(*) AS n FROM Admins WHERE Username = 'admin'"), 1);
    const students = db.prepare('SELECT u.WeeklyBudget FROM Users u JOIN UserProfile p ON p.UserID = u.UserID').all();
    assert.equal(students.length, 3);
    assert.equal(new Set(students.map((s) => s.WeeklyBudget)).size, 3);
  });

  test('has at least 24 recipes priced 10–45 kr, each with ingredients and 3–6 steps', () => {
    const recipes = db.prepare('SELECT RecipeID, PricePerPortion FROM Recipes').all();
    assert.ok(recipes.length >= 24);
    for (const recipe of recipes) {
      assert.ok(recipe.PricePerPortion >= 10 && recipe.PricePerPortion <= 45, `price ${recipe.PricePerPortion}`);
      assert.ok(count('SELECT COUNT(*) AS n FROM RecipeIngredient WHERE RecipeID = ?', recipe.RecipeID) > 0);
      const steps = count('SELECT COUNT(*) AS n FROM RecipeStep WHERE RecipeID = ?', recipe.RecipeID);
      assert.ok(steps >= 3 && steps <= 6, `recipe ${recipe.RecipeID} has ${steps} steps`);
    }
    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
      assert.ok(count('SELECT COUNT(*) AS n FROM Recipes WHERE MealType = ?', mealType) > 0);
    }
  });

  test('every vegan recipe is also vegetarian', () => {
    assert.equal(count(`SELECT COUNT(*) AS n FROM RecipeDietTag t JOIN Recipes r ON r.RecipeID = t.RecipeID
                        WHERE t.DietType = 'vegan' AND r.IsVegetarian = 0`), 0);
  });

  test('has 3 workouts per goal, each with 4–6 exercises', () => {
    for (const goal of ['lose weight', 'build muscle', 'stay healthy']) {
      assert.equal(count('SELECT COUNT(*) AS n FROM Workouts WHERE Goal = ?', goal), 3);
    }
    for (const { WorkoutID } of db.prepare('SELECT WorkoutID FROM Workouts').all()) {
      const exercises = count('SELECT COUNT(*) AS n FROM WorkoutExercise WHERE WorkoutID = ?', WorkoutID);
      assert.ok(exercises >= 4 && exercises <= 6);
    }
  });

  test('one demo student has weight and workout history', () => {
    assert.ok(count('SELECT COUNT(*) AS n FROM WeightLog') >= 4);
    assert.ok(count('SELECT COUNT(*) AS n FROM WorkoutLog WHERE IsCompleted = 1') >= 8);
  });
});

describe('Schema rules', () => {
  test('deleting a user cascades to their related rows', () => {
    const userId = db.prepare("SELECT UserID FROM Users WHERE Email = 'emma@example.com'").get().UserID;
    const recipeId = db.prepare('SELECT RecipeID FROM Recipes LIMIT 1').get().RecipeID;
    db.prepare("INSERT INTO MealPlanEntry (UserID, RecipeID, PlanDate, MealSlot) VALUES (?, ?, '2026-01-05', 'lunch')").run(userId, recipeId);
    db.prepare('INSERT INTO FavouriteRecipe (UserID, RecipeID) VALUES (?, ?)').run(userId, recipeId);

    db.prepare('DELETE FROM Users WHERE UserID = ?').run(userId);

    for (const table of ['UserProfile', 'MealPlanEntry', 'WorkoutLog', 'WeightLog', 'FavouriteRecipe', 'ShoppingCheck']) {
      assert.equal(count(`SELECT COUNT(*) AS n FROM ${table} WHERE UserID = ?`, userId), 0, table);
    }
  });

  test('CHECK constraints reject invalid values', () => {
    assert.throws(() => db.prepare(`INSERT INTO Recipes (RecipeName, MealType, PricePerPortion, Calories)
                                    VALUES ('Bad', 'brunch', 10, 100)`).run());
    assert.throws(() => db.prepare(`INSERT INTO Workouts (WorkoutName, Goal, Difficulty, DurationMinutes)
                                    VALUES ('Bad', 'lose weight', 'extreme', 10)`).run());
  });
});
