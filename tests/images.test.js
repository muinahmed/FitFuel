// Tests for recipe and exercise photos (Recipes admin – Albina, Workouts admin – Priyanka).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, signedUpAgent, adminAgent } = require('./helpers');

// A real 1×1 pixel PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const uploadedFile = (webPath) => path.join(process.env.UPLOAD_DIR, path.basename(webPath));

function upload(agent, body = PNG, type = 'image/png') {
  return agent.post('/api/admin/uploads').set('Content-Type', type).send(body);
}

function newRecipe(overrides = {}) {
  return {
    recipeName: 'Photo Test Salad', mealType: 'lunch', calories: 400, isVegetarian: true, dietTags: [],
    ingredients: [{ ingredientName: 'Lettuce', quantity: 100, unit: 'g', cost: 12 }],
    steps: ['Wash and serve.'],
    ...overrides,
  };
}

function newWorkout(exercises) {
  return { workoutName: 'Photo Test Stretch', goal: 'stay healthy', difficulty: 'easy', durationMinutes: 10, isBeginnerFriendly: true, exercises };
}

describe('Photo uploads', () => {
  test('an admin can upload a JPG, PNG or WebP image, which is then served', async () => {
    const admin = await adminAgent();
    const res = await upload(admin).expect(201);
    assert.match(res.body.path, /^\/uploads\/[a-f0-9]{32}\.png$/);
    assert.ok(fs.existsSync(uploadedFile(res.body.path)));
    const served = await request(app).get(res.body.path).expect(200);
    assert.equal(served.headers['content-type'], 'image/png');
  });

  test('the file type comes from the content, not the label', async () => {
    const admin = await adminAgent();
    const res = await upload(admin, Buffer.from('<script>alert(1)</script>'), 'image/png').expect(400);
    assert.equal(res.body.error, 'Choose a JPG, PNG or WebP image.');
    await upload(admin, PNG, 'text/plain').expect(400);
  });

  test('images over 2 MB are refused', async () => {
    const admin = await adminAgent();
    const tooBig = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const res = await upload(admin, tooBig).expect(413);
    assert.equal(res.body.error, 'The image is too big. Choose one under 2 MB.');
  });

  test('only admins can upload', async () => {
    const { agent: student } = await signedUpAgent();
    await upload(student).expect(401);
    await upload(request(app)).expect(401);
  });
});

describe('Recipe photos', () => {
  test('a recipe saved with a photo shows it to students; recipes without one have none', async () => {
    const admin = await adminAgent();
    const { body: { path: photo } } = await upload(admin).expect(201);
    const { body: recipe } = await admin.post('/api/admin/recipes').send(newRecipe({ imagePath: photo })).expect(201);
    assert.equal(recipe.imageUrl, photo);

    const { agent: student } = await signedUpAgent();
    const list = await student.get('/api/recipes?search=photo test').expect(200);
    assert.equal(list.body[0].imageUrl, photo);
    const other = await student.get('/api/recipes?search=lentil').expect(200);
    assert.equal(other.body[0].imageUrl, null);
  });

  test('rejects photo paths that are not uploads', async () => {
    const admin = await adminAgent();
    for (const imagePath of ['/etc/passwd', 'https://example.com/a.png', '/uploads/../server.js', `/uploads/${'a'.repeat(32)}.png`]) {
      const res = await admin.post('/api/admin/recipes').send(newRecipe({ imagePath }));
      assert.equal(res.status, 400, imagePath);
    }
  });

  test('replacing or removing a photo deletes the old file; deleting the recipe deletes its photo', async () => {
    const admin = await adminAgent();
    const { body: { path: first } } = await upload(admin);
    const { body: { path: second } } = await upload(admin);
    const { body: recipe } = await admin.post('/api/admin/recipes').send(newRecipe({ imagePath: first })).expect(201);

    await admin.put(`/api/admin/recipes/${recipe.recipeId}`).send(newRecipe({ imagePath: second })).expect(200);
    assert.ok(!fs.existsSync(uploadedFile(first)), 'replaced photo removed');

    const { body: noPhoto } = await admin.put(`/api/admin/recipes/${recipe.recipeId}`).send(newRecipe({ imagePath: '' })).expect(200);
    assert.equal(noPhoto.imageUrl, null);
    assert.ok(!fs.existsSync(uploadedFile(second)), 'removed photo deleted');

    const { body: { path: third } } = await upload(admin);
    await admin.put(`/api/admin/recipes/${recipe.recipeId}`).send(newRecipe({ imagePath: third })).expect(200);
    await admin.delete(`/api/admin/recipes/${recipe.recipeId}`).expect(204);
    assert.ok(!fs.existsSync(uploadedFile(third)), 'photo of a deleted recipe removed');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM RecipeImage WHERE RecipeID = ?').get(recipe.recipeId).n, 0);
  });

  test('meal plans include the recipe photo', async () => {
    const admin = await adminAgent();
    const { body: { path: photo } } = await upload(admin);
    const { RecipeID } = db.prepare("SELECT RecipeID FROM Recipes WHERE RecipeName = 'Red Lentil Soup'").get();
    db.prepare('INSERT INTO RecipeImage (RecipeID, ImagePath) VALUES (?, ?)').run(RecipeID, photo);

    const { agent: student } = await signedUpAgent();
    await student.put('/api/users/me/budget').send({ weeklyBudget: 600 }).expect(200);
    const { body: plan } = await student.post('/api/mealplans/generate?week=this').expect(201);
    const meals = plan.days.flatMap((day) => [day.lunch, day.dinner]);
    const photoOf = db.prepare('SELECT ImagePath FROM RecipeImage WHERE RecipeID = ?');
    for (const meal of meals) assert.equal(meal.imageUrl, (photoOf.get(meal.recipeId) || {}).ImagePath || null);
    assert.equal(photoOf.get(RecipeID).ImagePath, photo);
  });
});

describe('Exercise photos', () => {
  test('exercises keep their photos through an edit and students see them', async () => {
    const admin = await adminAgent();
    const { body: { path: photo } } = await upload(admin);
    const exercises = [
      { exerciseName: 'Neck Rolls', sets: 2, reps: 10, instructions: '', mediaUrl: '', imagePath: photo },
      { exerciseName: 'Shrugs', sets: 2, reps: 15, instructions: '', mediaUrl: '' },
    ];
    const { body: created } = await admin.post('/api/admin/workouts').send(newWorkout(exercises)).expect(201);
    assert.deepEqual(created.exercises.map((exercise) => exercise.imagePath), [photo, null]);

    // The edit form sends the photo path back with each exercise
    const { body: edited } = await admin.put(`/api/admin/workouts/${created.workoutId}`)
      .send(newWorkout([{ ...exercises[0], reps: 12 }, exercises[1]])).expect(200);
    assert.equal(edited.exercises[0].imagePath, photo);
    assert.ok(fs.existsSync(uploadedFile(photo)), 'photo kept');

    // Students see exercise photos in their plan (beginner-friendly easy workouts come first)
    const { agent: student } = await signedUpAgent();
    await student.put('/api/users/me/profile').send({ goal: 'stay healthy', dietType: 'none' }).expect(200);
    await student.put('/api/workouts/plan').send({ trainingDays: 5 }).expect(200);
    const { body: plan } = await student.get('/api/workouts/plan').expect(200);
    const shown = plan.sessions.flatMap((session) => session.workout.exercises).find((exercise) => exercise.exerciseName === 'Neck Rolls');
    assert.equal(shown.imageUrl, photo);

    // Dropping the photo in an edit deletes the file
    await admin.put(`/api/admin/workouts/${created.workoutId}`).send(newWorkout([{ ...exercises[0], imagePath: '' }])).expect(200);
    assert.ok(!fs.existsSync(uploadedFile(photo)), 'removed photo deleted');
  });

  test('rejects exercise photo paths that are not uploads', async () => {
    const admin = await adminAgent();
    const res = await admin.post('/api/admin/workouts')
      .send(newWorkout([{ exerciseName: 'Squats', sets: 3, reps: 10, imagePath: 'javascript:alert(1)' }])).expect(400);
    assert.match(res.body.error, /photo was not found/);
  });
});
