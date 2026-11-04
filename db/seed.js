// Seed script: drops every table, recreates the schema and inserts demo data.
// Run with `npm run seed`. Also used by the tests and on first start-up.
const fs = require('fs');
const path = require('path');
const { hashPasswordSync } = require('../utils/passwords');
const { daysAgo } = require('../utils/dates');
const { ensureRecipeImages } = require('./recipeImages');


// Child tables first so foreign keys never block a drop
const ALL_TABLES = [
  'ShoppingCheck', 'FavouriteRecipe', 'WeightLog', 'WorkoutExercise', 'RecipeStep',
  'RecipeDietTag', 'RecipeImage', 'RecipeIngredient', 'UserProfile', 'WorkoutLog', 'MealPlanEntry',
  'Admins', 'Workouts', 'Recipes', 'Users',
];

// ---------- Recipes ----------
// Ingredients are for ONE portion: [name, quantity, unit, cost in kr].
// PricePerPortion is the sum of the ingredient costs.
const RECIPES = [
  // Breakfast
  {
    name: 'Overnight Oats with Banana', mealType: 'breakfast', calories: 420, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Rolled oats', 70, 'g', 2.00], ['Oat drink', 200, 'ml', 3.50], ['Banana', 1, 'pcs', 2.50], ['Peanut butter', 15, 'g', 1.50], ['Cinnamon', 1, 'tsp', 0.50]],
    steps: ['Put the oats and cinnamon in a jar or box.', 'Pour in the oat drink and stir well.', 'Cover and leave in the fridge overnight.', 'In the morning, top with sliced banana and peanut butter.'],
  },
  {
    name: 'Scrambled Eggs on Rye', mealType: 'breakfast', calories: 450, vegetarian: true, tags: ['halal'],
    ingredients: [['Eggs', 3, 'pcs', 7.50], ['Rye bread', 2, 'slices', 3.00], ['Butter', 10, 'g', 1.00], ['Cherry tomatoes', 80, 'g', 4.00]],
    steps: ['Whisk the eggs with a pinch of salt and pepper.', 'Melt the butter in a pan over low heat.', 'Add the eggs and stir gently until just set.', 'Toast the rye bread and serve the eggs on top with halved tomatoes.'],
  },
  {
    name: 'Greek Yogurt Berry Bowl', mealType: 'breakfast', calories: 380, vegetarian: true, tags: ['halal'],
    ingredients: [['Greek yogurt', 200, 'g', 7.00], ['Frozen berries', 100, 'g', 5.00], ['Honey', 1, 'tbsp', 1.50], ['Granola', 40, 'g', 3.50]],
    steps: ['Thaw the berries in the microwave for 30 seconds.', 'Spoon the yogurt into a bowl.', 'Top with berries and granola.', 'Drizzle with honey.'],
  },
  {
    name: 'Peanut Butter Banana Toast', mealType: 'breakfast', calories: 410, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Wholegrain bread', 2, 'slices', 3.00], ['Peanut butter', 30, 'g', 3.00], ['Banana', 1, 'pcs', 2.50], ['Chia seeds', 10, 'g', 2.00]],
    steps: ['Toast the bread.', 'Spread peanut butter on both slices.', 'Top with sliced banana and sprinkle with chia seeds.'],
  },
  {
    name: 'Spinach and Feta Omelette', mealType: 'breakfast', calories: 430, vegetarian: true, tags: ['halal'],
    ingredients: [['Eggs', 3, 'pcs', 7.50], ['Spinach', 50, 'g', 4.00], ['Feta cheese', 40, 'g', 6.00], ['Rye bread', 1, 'slices', 1.50]],
    steps: ['Whisk the eggs with salt and pepper.', 'Wilt the spinach in a hot non-stick pan.', 'Pour in the eggs and cook until almost set.', 'Crumble the feta over one half and fold the omelette.', 'Serve with a slice of rye bread.'],
  },

  // Lunch
  {
    name: 'Chickpea Hummus Wrap', mealType: 'lunch', calories: 520, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Tortilla wraps', 2, 'pcs', 4.00], ['Chickpeas (canned)', 120, 'g', 4.00], ['Cucumber', 100, 'g', 2.50], ['Hummus', 50, 'g', 5.00], ['Carrot', 1, 'pcs', 1.00], ['Lettuce', 30, 'g', 2.00]],
    steps: ['Drain and rinse the chickpeas, then lightly mash them with a fork.', 'Grate the carrot and slice the cucumber.', 'Spread hummus over the wraps.', 'Add chickpeas, vegetables and lettuce, then roll up tightly.'],
  },
  {
    name: 'Tuna Pasta Salad', mealType: 'lunch', calories: 560, vegetarian: false, tags: ['halal'],
    ingredients: [['Pasta', 100, 'g', 2.00], ['Tuna (canned)', 120, 'g', 9.00], ['Sweetcorn (canned)', 80, 'g', 3.00], ['Red onion', 0.5, 'pcs', 1.00], ['Mayonnaise', 1, 'tbsp', 1.00]],
    steps: ['Cook the pasta in salted water, then rinse in cold water.', 'Drain the tuna and sweetcorn.', 'Finely chop the red onion.', 'Mix everything with the mayonnaise and season to taste.'],
  },
  {
    name: 'Red Lentil Soup', mealType: 'lunch', calories: 410, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Red lentils', 100, 'g', 3.00], ['Carrot', 1, 'pcs', 1.00], ['Onion', 1, 'pcs', 1.50], ['Chopped tomatoes (canned)', 200, 'g', 4.00], ['Vegetable stock cube', 1, 'pcs', 1.00], ['Ground cumin', 1, 'tsp', 0.50]],
    steps: ['Chop the onion and carrot.', 'Soften them in a pot with a little oil for 5 minutes.', 'Add cumin, lentils, tomatoes, the stock cube and 500 ml water.', 'Simmer for 20 minutes until the lentils are soft.', 'Blend until smooth or leave chunky.'],
  },
  {
    name: 'Chicken Rice Bowl', mealType: 'lunch', calories: 610, vegetarian: false, tags: ['halal'],
    ingredients: [['Rice', 90, 'g', 2.00], ['Chicken breast (halal)', 150, 'g', 16.00], ['Frozen broccoli', 100, 'g', 3.00], ['Soy sauce', 1, 'tbsp', 1.00], ['Garlic', 1, 'clove', 0.50]],
    steps: ['Cook the rice according to the packet.', 'Slice the chicken and fry until cooked through.', 'Add crushed garlic, broccoli and soy sauce and stir-fry for 4 minutes.', 'Serve over the rice.'],
  },
  {
    name: 'Egg Fried Rice', mealType: 'lunch', calories: 540, vegetarian: true, tags: ['halal'],
    ingredients: [['Rice', 90, 'g', 2.00], ['Eggs', 2, 'pcs', 5.00], ['Frozen peas', 80, 'g', 2.50], ['Spring onion', 2, 'pcs', 2.00], ['Soy sauce', 1, 'tbsp', 1.00], ['Rapeseed oil', 1, 'tbsp', 0.50]],
    steps: ['Cook the rice and let it cool (day-old rice works best).', 'Heat the oil, add the peas and fry for 2 minutes.', 'Push to the side, scramble the eggs in the pan.', 'Add the rice and soy sauce and fry until hot.', 'Top with sliced spring onion.'],
  },
  {
    name: 'Halloumi Couscous Salad', mealType: 'lunch', calories: 590, vegetarian: true, tags: ['halal'],
    ingredients: [['Couscous', 80, 'g', 2.50], ['Halloumi', 80, 'g', 12.00], ['Cucumber', 100, 'g', 2.50], ['Cherry tomatoes', 80, 'g', 4.00], ['Lemon', 0.5, 'pcs', 1.50]],
    steps: ['Pour boiling water over the couscous, cover and leave for 5 minutes.', 'Slice and dry-fry the halloumi until golden.', 'Chop the cucumber and tomatoes.', 'Fluff the couscous, mix with the vegetables and lemon juice, and top with halloumi.'],
  },
  {
    name: 'Black Bean Quesadilla', mealType: 'lunch', calories: 580, vegetarian: true, tags: ['halal'],
    ingredients: [['Tortilla wraps', 2, 'pcs', 4.00], ['Black beans (canned)', 120, 'g', 4.00], ['Grated cheese', 50, 'g', 6.00], ['Red pepper', 0.5, 'pcs', 3.00], ['Salsa', 2, 'tbsp', 2.00]],
    steps: ['Drain the beans and dice the pepper.', 'Spread beans, pepper and cheese over one tortilla.', 'Cover with the second tortilla.', 'Dry-fry for 3 minutes on each side until crisp.', 'Cut into wedges and serve with salsa.'],
  },

  // Dinner
  {
    name: 'Vegetable Chilli', mealType: 'dinner', calories: 560, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Kidney beans (canned)', 120, 'g', 4.00], ['Chopped tomatoes (canned)', 200, 'g', 4.00], ['Onion', 1, 'pcs', 1.50], ['Red pepper', 0.5, 'pcs', 3.00], ['Rice', 90, 'g', 2.00], ['Chilli powder', 1, 'tsp', 0.50]],
    steps: ['Chop the onion and pepper and soften in a little oil.', 'Add the chilli powder and cook for 1 minute.', 'Add the beans and tomatoes and simmer for 15 minutes.', 'Cook the rice and serve with the chilli.'],
  },
  {
    name: 'Spaghetti Bolognese', mealType: 'dinner', calories: 680, vegetarian: false, tags: ['halal'],
    ingredients: [['Spaghetti', 100, 'g', 2.00], ['Beef mince (halal)', 125, 'g', 14.00], ['Chopped tomatoes (canned)', 200, 'g', 4.00], ['Onion', 1, 'pcs', 1.50], ['Garlic', 1, 'clove', 0.50], ['Carrot', 1, 'pcs', 1.00]],
    steps: ['Finely chop the onion, carrot and garlic.', 'Brown the mince in a hot pan.', 'Add the vegetables and cook for 5 minutes.', 'Add the tomatoes and simmer for 20 minutes.', 'Cook the spaghetti and serve with the sauce.'],
  },
  {
    name: 'Chicken Curry with Rice', mealType: 'dinner', calories: 720, vegetarian: false, tags: ['halal'],
    ingredients: [['Chicken thigh (halal)', 150, 'g', 14.00], ['Rice', 90, 'g', 2.00], ['Coconut milk', 100, 'ml', 4.00], ['Curry paste', 1, 'tbsp', 3.00], ['Onion', 1, 'pcs', 1.50], ['Spinach', 50, 'g', 4.00]],
    steps: ['Dice the chicken and onion.', 'Fry the onion, then add the curry paste for 1 minute.', 'Add the chicken and brown on all sides.', 'Pour in the coconut milk and simmer for 15 minutes.', 'Stir in the spinach until wilted and serve with rice.'],
  },
  {
    name: 'Baked Salmon with Potatoes', mealType: 'dinner', calories: 650, vegetarian: false, tags: ['halal'],
    ingredients: [['Salmon fillet', 125, 'g', 25.00], ['Potatoes', 250, 'g', 3.00], ['Frozen green beans', 100, 'g', 3.00], ['Lemon', 0.5, 'pcs', 1.50], ['Olive oil', 1, 'tbsp', 1.00]],
    steps: ['Heat the oven to 200 °C.', 'Cut the potatoes into wedges, toss in oil and roast for 20 minutes.', 'Add the salmon with lemon slices to the tray and bake for 12 more minutes.', 'Boil the green beans for 4 minutes and serve.'],
  },
  {
    name: 'Pork and Vegetable Stir-Fry', mealType: 'dinner', calories: 640, vegetarian: false, tags: [],
    ingredients: [['Pork strips', 150, 'g', 15.00], ['Egg noodles', 100, 'g', 4.00], ['Stir-fry vegetables', 200, 'g', 8.00], ['Soy sauce', 2, 'tbsp', 2.00], ['Garlic', 1, 'clove', 0.50]],
    steps: ['Cook the noodles and drain.', 'Stir-fry the pork in a hot pan until browned.', 'Add garlic and vegetables and cook for 4 minutes.', 'Toss in the noodles and soy sauce and serve.'],
  },
  {
    name: 'Tofu Veggie Stir-Fry', mealType: 'dinner', calories: 560, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Firm tofu', 150, 'g', 9.00], ['Rice noodles', 100, 'g', 5.00], ['Stir-fry vegetables', 200, 'g', 8.00], ['Soy sauce', 2, 'tbsp', 2.00], ['Garlic', 1, 'clove', 0.50]],
    steps: ['Press the tofu dry and cut into cubes.', 'Fry the tofu until golden, then set aside.', 'Soak the rice noodles in hot water for 5 minutes.', 'Stir-fry garlic and vegetables for 4 minutes.', 'Add tofu, noodles and soy sauce and toss together.'],
  },
  {
    name: 'Mushroom Risotto', mealType: 'dinner', calories: 600, vegetarian: true, tags: ['halal'],
    ingredients: [['Arborio rice', 90, 'g', 4.00], ['Mushrooms', 150, 'g', 8.00], ['Onion', 1, 'pcs', 1.50], ['Vegetable stock cube', 1, 'pcs', 1.00], ['Parmesan', 20, 'g', 5.00], ['Butter', 10, 'g', 1.00]],
    steps: ['Dissolve the stock cube in 500 ml hot water.', 'Soften the chopped onion and sliced mushrooms in the butter.', 'Add the rice and stir for 1 minute.', 'Add the stock a ladle at a time, stirring, for about 18 minutes.', 'Stir in the grated parmesan and serve.'],
  },
  {
    name: 'Sausage and Bean Casserole', mealType: 'dinner', calories: 700, vegetarian: false, tags: [],
    ingredients: [['Pork sausages', 2, 'pcs', 10.00], ['Baked beans (canned)', 200, 'g', 5.00], ['Potatoes', 250, 'g', 3.00], ['Onion', 1, 'pcs', 1.50]],
    steps: ['Boil the potatoes in chunks for 15 minutes.', 'Brown the sausages in a pan, then slice.', 'Fry the chopped onion, add sausages and beans and simmer for 10 minutes.', 'Serve with the potatoes.'],
  },
  {
    name: 'Lamb Kofta Flatbread', mealType: 'dinner', calories: 690, vegetarian: false, tags: ['halal'],
    ingredients: [['Lamb mince (halal)', 125, 'g', 22.00], ['Flatbread', 1, 'pcs', 5.00], ['Greek yogurt', 50, 'g', 2.00], ['Cucumber', 50, 'g', 1.25], ['Ground cumin', 1, 'tsp', 0.50]],
    steps: ['Mix the lamb with cumin, salt and pepper.', 'Shape into 4 small sausages.', 'Grill or fry for 8–10 minutes, turning often.', 'Grate the cucumber into the yogurt for a quick sauce.', 'Serve in the warm flatbread with the sauce.'],
  },
  {
    name: 'Sweet Potato Chickpea Curry', mealType: 'dinner', calories: 620, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Sweet potato', 200, 'g', 6.00], ['Chickpeas (canned)', 120, 'g', 4.00], ['Coconut milk', 100, 'ml', 4.00], ['Curry paste', 1, 'tbsp', 3.00], ['Rice', 90, 'g', 2.00], ['Spinach', 50, 'g', 4.00]],
    steps: ['Peel and dice the sweet potato.', 'Fry the curry paste for 1 minute in a little oil.', 'Add sweet potato, chickpeas, coconut milk and 100 ml water.', 'Simmer for 20 minutes until the potato is soft.', 'Stir in the spinach and serve with rice.'],
  },

  // Snacks
  {
    name: 'Hummus and Veg Sticks', mealType: 'snack', calories: 250, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Hummus', 80, 'g', 8.00], ['Carrot', 1, 'pcs', 1.00], ['Cucumber', 100, 'g', 2.50]],
    steps: ['Peel the carrot.', 'Cut the carrot and cucumber into sticks.', 'Serve with the hummus for dipping.'],
  },
  {
    name: 'Banana Oat Energy Balls', mealType: 'snack', calories: 330, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Rolled oats', 50, 'g', 1.50], ['Banana', 1, 'pcs', 2.50], ['Peanut butter', 30, 'g', 3.00], ['Raisins', 30, 'g', 3.00]],
    steps: ['Mash the banana in a bowl.', 'Mix in the oats, peanut butter and raisins.', 'Roll into 6 small balls.', 'Chill for 30 minutes before eating.'],
  },
  {
    name: 'Cottage Cheese with Apple', mealType: 'snack', calories: 280, vegetarian: true, tags: ['halal'],
    ingredients: [['Cottage cheese', 150, 'g', 6.00], ['Apple', 1, 'pcs', 3.00], ['Cinnamon', 1, 'tsp', 0.50], ['Walnuts', 15, 'g', 3.00]],
    steps: ['Spoon the cottage cheese into a bowl.', 'Dice the apple and add it on top.', 'Sprinkle with cinnamon and chopped walnuts.'],
  },
  {
    name: 'Boiled Eggs and Crispbread', mealType: 'snack', calories: 260, vegetarian: true, tags: ['halal'],
    ingredients: [['Eggs', 2, 'pcs', 5.00], ['Rye crispbread', 3, 'pcs', 3.00], ['Cherry tomatoes', 80, 'g', 4.00]],
    steps: ['Boil the eggs for 8 minutes.', 'Cool them in cold water and peel.', 'Slice and serve on crispbread with the tomatoes.'],
  },
];

// Additional recipes added after the original demo catalog. Keep these unique by name so
// ensureAdditionalRecipes can safely migrate an existing database without reseeding it.
const ADDITIONAL_RECIPES = [
  {
    name: 'Apple Cinnamon Overnight Oats', mealType: 'breakfast', calories: 390, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Rolled oats', 60, 'g', 2.50], ['Oat drink', 180, 'ml', 3.00], ['Apple', 1, 'pcs', 3.00], ['Cinnamon', 1, 'tsp', 0.50], ['Raisins', 15, 'g', 1.50]],
    steps: ['Add oats, oat drink, cinnamon and raisins to a jar.', 'Grate half the apple and stir it through.', 'Cover and chill overnight.', 'Top with the remaining sliced apple before serving.'],
  },
  {
    name: 'Avocado Egg Toast', mealType: 'breakfast', calories: 430, vegetarian: true, tags: ['halal'],
    ingredients: [['Wholegrain bread', 2, 'slices', 3.00], ['Eggs', 2, 'pcs', 5.00], ['Avocado', 0.5, 'pcs', 6.00], ['Lemon', 0.25, 'pcs', 0.75]],
    steps: ['Toast the bread until crisp.', 'Mash the avocado with lemon juice, salt and pepper.', 'Fry or poach the eggs to your liking.', 'Spread the avocado on the toast and top with the eggs.'],
  },
  {
    name: 'Fluffy Apple Pancakes', mealType: 'breakfast', calories: 460, vegetarian: true, tags: ['halal'],
    ingredients: [['Plain flour', 70, 'g', 2.00], ['Milk', 100, 'ml', 2.00], ['Egg', 1, 'pcs', 3.00], ['Apple', 0.5, 'pcs', 2.00], ['Baking powder', 1, 'tsp', 0.50], ['Yogurt', 40, 'g', 2.00]],
    steps: ['Whisk flour, baking powder, milk and egg into a smooth batter.', 'Grate the apple and fold it into the batter.', 'Cook small pancakes in a lightly oiled pan until golden on both sides.', 'Serve with a spoonful of yogurt.'],
  },
  {
    name: 'Banana Cottage Cheese Bowl', mealType: 'breakfast', calories: 370, vegetarian: true, tags: ['halal'],
    ingredients: [['Cottage cheese', 150, 'g', 6.00], ['Banana', 1, 'pcs', 2.50], ['Rolled oats', 25, 'g', 0.75], ['Walnuts', 10, 'g', 2.00], ['Honey', 1, 'tsp', 0.50]],
    steps: ['Spoon the cottage cheese into a bowl.', 'Slice the banana over the top.', 'Add oats and chopped walnuts.', 'Drizzle with honey and serve.'],
  },
  {
    name: 'Greek Chickpea Feta Salad', mealType: 'lunch', calories: 510, vegetarian: true, tags: ['halal'],
    ingredients: [['Chickpeas (canned)', 130, 'g', 4.50], ['Cucumber', 100, 'g', 2.50], ['Cherry tomatoes', 100, 'g', 5.00], ['Feta cheese', 35, 'g', 5.25], ['Olives', 20, 'g', 2.00], ['Lemon', 0.25, 'pcs', 0.75]],
    steps: ['Drain and rinse the chickpeas.', 'Chop the cucumber and halve the tomatoes.', 'Toss with olives and lemon juice.', 'Crumble feta over the salad and season with black pepper.'],
  },
  {
    name: 'Chicken Pesto Pasta', mealType: 'lunch', calories: 620, vegetarian: false, tags: ['halal'],
    ingredients: [['Pasta', 90, 'g', 1.80], ['Chicken breast (halal)', 120, 'g', 12.80], ['Pesto', 20, 'g', 3.00], ['Cherry tomatoes', 70, 'g', 3.50], ['Spinach', 30, 'g', 2.40]],
    steps: ['Cook the pasta according to the packet, then drain.', 'Pan-fry the chicken until cooked through and slice it.', 'Stir pesto through the warm pasta.', 'Fold in tomatoes, spinach and chicken.'],
  },
  {
    name: 'Black Bean Burrito Bowl', mealType: 'lunch', calories: 570, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Rice', 80, 'g', 1.80], ['Black beans (canned)', 120, 'g', 4.00], ['Sweetcorn (canned)', 50, 'g', 1.90], ['Tomato', 1, 'pcs', 2.50], ['Avocado', 0.25, 'pcs', 3.00], ['Lime', 0.25, 'pcs', 1.00]],
    steps: ['Cook the rice until fluffy.', 'Drain and warm the black beans and corn.', 'Dice the tomato and avocado.', 'Serve everything in a bowl with lime juice and chopped coriander.'],
  },
  {
    name: 'Roasted Veggie Hummus Pita', mealType: 'lunch', calories: 490, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Pita bread', 1, 'pcs', 3.00], ['Hummus', 45, 'g', 4.50], ['Red pepper', 0.5, 'pcs', 3.00], ['Courgette', 80, 'g', 2.40], ['Red onion', 0.25, 'pcs', 0.50], ['Lettuce', 20, 'g', 1.30]],
    steps: ['Slice the pepper, courgette and onion.', 'Roast with a little oil at 200 °C for 18 minutes.', 'Warm the pita and spread hummus inside.', 'Fill with roasted vegetables and lettuce.'],
  },
  {
    name: 'Tomato Mozzarella Sandwich', mealType: 'lunch', calories: 460, vegetarian: true, tags: ['halal'],
    ingredients: [['Wholegrain bread', 2, 'slices', 3.00], ['Mozzarella', 60, 'g', 6.00], ['Tomato', 1, 'pcs', 2.50], ['Fresh basil', 5, 'g', 1.50], ['Pesto', 10, 'g', 1.50]],
    steps: ['Toast the bread lightly if you like.', 'Spread a thin layer of pesto on each slice.', 'Layer sliced tomato, mozzarella and basil.', 'Close the sandwich and cut in half.'],
  },
  {
    name: 'Lemon Tuna Couscous', mealType: 'lunch', calories: 520, vegetarian: false, tags: ['halal'],
    ingredients: [['Couscous', 75, 'g', 2.40], ['Tuna (canned)', 100, 'g', 7.50], ['Cucumber', 60, 'g', 1.50], ['Sweetcorn (canned)', 40, 'g', 1.50], ['Lemon', 0.5, 'pcs', 1.50], ['Parsley', 5, 'g', 1.00]],
    steps: ['Cover couscous with boiling water and leave for 5 minutes.', 'Fluff with a fork and add lemon juice.', 'Drain the tuna and corn, then flake the tuna.', 'Mix with diced cucumber and parsley; season to taste.'],
  },
  {
    name: 'Turkey Meatballs Marinara Pasta', mealType: 'dinner', calories: 650, vegetarian: false, tags: ['halal'],
    ingredients: [['Turkey mince (halal)', 130, 'g', 13.00], ['Spaghetti', 90, 'g', 1.80], ['Chopped tomatoes (canned)', 150, 'g', 3.00], ['Onion', 0.5, 'pcs', 0.75], ['Garlic', 1, 'clove', 0.50], ['Breadcrumbs', 15, 'g', 1.00]],
    steps: ['Mix turkey mince with breadcrumbs, salt and pepper, then shape into small balls.', 'Brown the meatballs in a pan and set aside.', 'Soften onion and garlic, add tomatoes and simmer for 10 minutes.', 'Return meatballs to the sauce and cook through; serve with cooked spaghetti.'],
  },
  {
    name: 'Beef Taco Rice Bowl', mealType: 'dinner', calories: 690, vegetarian: false, tags: ['halal'],
    ingredients: [['Beef mince (halal)', 120, 'g', 13.20], ['Rice', 80, 'g', 1.80], ['Kidney beans (canned)', 70, 'g', 2.30], ['Tomato', 1, 'pcs', 2.50], ['Sweetcorn (canned)', 40, 'g', 1.50], ['Taco seasoning', 1, 'tsp', 0.80]],
    steps: ['Cook the rice according to the packet.', 'Brown the mince with taco seasoning.', 'Add drained beans and corn and heat through.', 'Serve over rice with diced tomato and a squeeze of lime.'],
  },
  {
    name: 'Spinach Chickpea Coconut Curry', mealType: 'dinner', calories: 610, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Chickpeas (canned)', 120, 'g', 4.00], ['Coconut milk', 100, 'ml', 4.00], ['Spinach', 60, 'g', 4.80], ['Chopped tomatoes (canned)', 100, 'g', 2.00], ['Curry paste', 1, 'tbsp', 3.00], ['Rice', 75, 'g', 1.70]],
    steps: ['Cook the rice.', 'Warm the curry paste in a pan for one minute.', 'Add tomatoes, chickpeas and coconut milk; simmer for 12 minutes.', 'Stir in spinach until wilted and serve with rice.'],
  },
  {
    name: 'Lemon Herb Chicken Tray Bake', mealType: 'dinner', calories: 630, vegetarian: false, tags: ['halal'],
    ingredients: [['Chicken thigh (halal)', 140, 'g', 13.00], ['Potatoes', 200, 'g', 2.40], ['Carrot', 1, 'pcs', 1.00], ['Lemon', 0.5, 'pcs', 1.50], ['Frozen green beans', 80, 'g', 2.40], ['Dried herbs', 1, 'tsp', 0.50]],
    steps: ['Heat the oven to 200 °C and cut potatoes and carrot into bite-size pieces.', 'Toss vegetables with oil, herbs, lemon and seasoning on a tray.', 'Add chicken and roast for 25–30 minutes until cooked through.', 'Add green beans for the final 8 minutes and serve.'],
  },
  {
    name: 'Lentil Shepherd’s Pie', mealType: 'dinner', calories: 580, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Green lentils (canned)', 130, 'g', 4.50], ['Potatoes', 220, 'g', 2.65], ['Carrot', 1, 'pcs', 1.00], ['Frozen peas', 50, 'g', 1.60], ['Chopped tomatoes (canned)', 100, 'g', 2.00], ['Vegetable stock cube', 0.5, 'pcs', 0.50]],
    steps: ['Boil potatoes until tender, then mash with a splash of oat drink.', 'Simmer lentils, diced carrot, peas, tomatoes and stock for 12 minutes.', 'Spoon the lentil mixture into a small baking dish and top with mash.', 'Bake at 200 °C for 15 minutes until the top is lightly golden.'],
  },
  {
    name: 'Vegetable Lasagna', mealType: 'dinner', calories: 640, vegetarian: true, tags: ['halal'],
    ingredients: [['Lasagna sheets', 3, 'sheets', 4.50], ['Courgette', 80, 'g', 2.40], ['Spinach', 40, 'g', 3.20], ['Chopped tomatoes (canned)', 150, 'g', 3.00], ['Ricotta', 50, 'g', 4.50], ['Grated cheese', 25, 'g', 3.00]],
    steps: ['Soften diced courgette in a pan, then add tomatoes and simmer for 8 minutes.', 'Layer tomato vegetables, lasagna sheets, spinach and ricotta in a small dish.', 'Finish with grated cheese.', 'Bake at 190 °C for 25–30 minutes until bubbling and tender.'],
  },
  {
    name: 'Teriyaki Tofu Noodle Bowl', mealType: 'dinner', calories: 590, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Firm tofu', 120, 'g', 7.20], ['Egg noodles', 80, 'g', 3.20], ['Frozen broccoli', 100, 'g', 3.00], ['Carrot', 1, 'pcs', 1.00], ['Teriyaki sauce', 20, 'ml', 2.00], ['Sesame seeds', 5, 'g', 1.00]],
    steps: ['Cook noodles according to the packet.', 'Cube and pan-fry tofu until golden.', 'Add broccoli and sliced carrot with a splash of water; cook until tender.', 'Toss with noodles and teriyaki sauce, then finish with sesame seeds.'],
  },
  {
    name: 'Garlic Pork Meatball Noodles', mealType: 'dinner', calories: 670, vegetarian: false, tags: [],
    ingredients: [['Pork mince', 120, 'g', 12.00], ['Egg noodles', 85, 'g', 3.40], ['Stir-fry vegetables', 120, 'g', 4.80], ['Soy sauce', 1, 'tbsp', 1.00], ['Garlic', 1, 'clove', 0.50], ['Breadcrumbs', 10, 'g', 0.70]],
    steps: ['Mix pork mince with breadcrumbs and half the crushed garlic; shape into meatballs.', 'Brown meatballs in a pan and cook through.', 'Cook noodles, then stir-fry vegetables with remaining garlic.', 'Toss noodles and vegetables with soy sauce and serve with meatballs.'],
  },
  {
    name: 'Apple Peanut Butter Rice Cakes', mealType: 'snack', calories: 290, vegetarian: true, tags: ['vegan', 'halal'],
    ingredients: [['Rice cakes', 3, 'pcs', 4.00], ['Peanut butter', 20, 'g', 3.50], ['Apple', 0.5, 'pcs', 2.50], ['Chia seeds', 5, 'g', 1.50]],
    steps: ['Spread peanut butter over the rice cakes.', 'Thinly slice the apple and arrange on top.', 'Sprinkle with chia seeds and serve.'],
  },
  {
    name: 'Berry Yogurt Smoothie Bowl', mealType: 'snack', calories: 320, vegetarian: true, tags: ['halal'],
    ingredients: [['Greek yogurt', 120, 'g', 4.20], ['Frozen berries', 100, 'g', 5.00], ['Banana', 0.5, 'pcs', 1.25], ['Granola', 20, 'g', 1.75], ['Honey', 1, 'tsp', 0.50]],
    steps: ['Blend yogurt with berries and banana until thick and smooth.', 'Pour into a bowl.', 'Top with granola and a small drizzle of honey.'],
  },
];

// ---------- Workouts ----------
// Exercises: [name, sets, reps, instructions]
const WORKOUTS = [
  // Lose weight
  {
    name: 'Beginner Fat-Burn Circuit', goal: 'lose weight', difficulty: 'easy', minutes: 20, beginner: true,
    exercises: [
      ['Jumping Jacks', 3, 20, 'Jump your feet out while raising your arms overhead, then return. Keep a steady pace.'],
      ['Bodyweight Squats', 3, 12, 'Feet shoulder-width apart, sit back as if onto a chair, keep your chest up, then stand.'],
      ['Knee Push-ups', 3, 8, 'Hands under shoulders, knees on the floor, lower your chest to the floor and push back up.'],
      ['Marching High Knees', 3, 20, 'March on the spot, lifting each knee to hip height. Count each knee as one rep.'],
      ['Glute Bridges', 3, 12, 'Lie on your back, knees bent, push through your heels to lift your hips, then lower slowly.'],
    ],
  },
  {
    name: 'Cardio HIIT Blast', goal: 'lose weight', difficulty: 'medium', minutes: 25, beginner: false,
    exercises: [
      ['Burpees', 4, 10, 'Squat, jump your feet back to a plank, jump them forward again and jump up with arms overhead.'],
      ['Mountain Climbers', 4, 20, 'From a plank, drive your knees towards your chest one at a time, quickly.'],
      ['Jump Squats', 4, 12, 'Squat down, then jump up explosively and land softly back into the squat.'],
      ['Skater Jumps', 4, 16, 'Leap sideways from one foot to the other, swinging your arms like a speed skater.'],
      ['Plank Shoulder Taps', 4, 16, 'Hold a high plank and tap each shoulder with the opposite hand without rocking your hips.'],
    ],
  },
  {
    name: 'Full-Body Fat Burner', goal: 'lose weight', difficulty: 'hard', minutes: 40, beginner: false,
    exercises: [
      ['Burpee Tuck Jumps', 5, 10, 'Do a burpee, then at the top jump and pull your knees towards your chest.'],
      ['Walking Lunges', 4, 20, 'Step forward into a lunge, back knee close to the floor, then step through with the other leg.'],
      ['Push-ups', 4, 15, 'Body in a straight line, lower your chest to just above the floor and push back up.'],
      ['Squat Thrusts', 4, 15, 'From standing, place your hands down, jump your feet back to a plank and back in, then stand.'],
      ['Bicycle Crunches', 4, 24, 'Lying down, bring opposite elbow to opposite knee in a pedalling motion.'],
      ['Sprint in Place', 5, 30, 'Run on the spot as fast as you can, pumping your arms. Count each foot strike.'],
    ],
  },

  // Build muscle
  {
    name: 'Beginner Strength Basics', goal: 'build muscle', difficulty: 'easy', minutes: 30, beginner: true,
    exercises: [
      ['Bodyweight Squats', 3, 15, 'Feet shoulder-width apart, sit back as if onto a chair, keep your chest up, then stand.'],
      ['Incline Push-ups', 3, 10, 'Hands on a table or bench, body straight, lower your chest to the edge and push up.'],
      ['Glute Bridges', 3, 15, 'Lie on your back, knees bent, push through your heels to lift your hips, then lower slowly.'],
      ['Bird Dogs', 3, 10, 'On hands and knees, extend the opposite arm and leg, hold for a second, then switch.'],
      ['Superman Raises', 3, 10, 'Lie face down and lift your arms, chest and legs off the floor, then lower slowly.'],
    ],
  },
  {
    name: 'Upper Body Builder', goal: 'build muscle', difficulty: 'medium', minutes: 35, beginner: false,
    exercises: [
      ['Push-ups', 4, 12, 'Body in a straight line, lower your chest to just above the floor and push back up.'],
      ['Chair Dips', 4, 10, 'Hands on the edge of a sturdy chair behind you, bend your elbows to lower, then push up.'],
      ['Pike Push-ups', 3, 8, 'Hips high in an upside-down V, bend your elbows to lower your head towards the floor.'],
      ['Backpack Rows', 4, 12, 'Hold a loaded backpack, hinge forward with a flat back and pull it to your stomach.'],
      ['Diamond Push-ups', 3, 8, 'Hands close together under your chest forming a diamond, lower and push up.'],
    ],
  },
  {
    name: 'Lower Body Power', goal: 'build muscle', difficulty: 'hard', minutes: 45, beginner: false,
    exercises: [
      ['Bulgarian Split Squats', 4, 10, 'Rear foot on a chair, lower your back knee towards the floor, then push up. Each leg.'],
      ['Jump Lunges', 4, 12, 'From a lunge, jump and switch legs in the air, landing softly in a lunge.'],
      ['Single-Leg Glute Bridges', 4, 12, 'Glute bridge with one leg extended. Lift through the planted heel. Each leg.'],
      ['Pistol Squat Negatives', 3, 6, 'Standing on one leg, lower yourself slowly to a chair or the floor. Each leg.'],
      ['Calf Raises', 4, 20, 'Stand on the edge of a step and rise onto your toes, then lower your heels below the step.'],
    ],
  },

  // Stay healthy
  {
    name: 'Morning Mobility Flow', goal: 'stay healthy', difficulty: 'easy', minutes: 15, beginner: true,
    exercises: [
      ['Cat-Cow Stretch', 2, 10, 'On hands and knees, round your back up, then let it dip down while lifting your head.'],
      ['Arm Circles', 2, 15, 'Arms out to the sides, make small circles that slowly get bigger. Reverse halfway.'],
      ['Hip Circles', 2, 10, 'Hands on hips, rotate your hips in big slow circles in each direction.'],
      ["World's Greatest Stretch", 2, 6, 'Step into a lunge, place both hands down, then rotate one arm up to the ceiling. Each side.'],
      ['Standing Toe Touches', 2, 10, 'Stand tall, then slowly roll down towards your toes with soft knees and roll back up.'],
    ],
  },
  {
    name: 'Active Living Mix', goal: 'stay healthy', difficulty: 'medium', minutes: 25, beginner: true,
    exercises: [
      ['Step-ups', 3, 20, 'Step up onto a sturdy step or low bench, then step down. Alternate the leading leg.'],
      ['Bodyweight Squats', 3, 15, 'Feet shoulder-width apart, sit back as if onto a chair, keep your chest up, then stand.'],
      ['Wall Push-ups', 3, 12, 'Hands on a wall at shoulder height, lean in until your nose nearly touches, then push back.'],
      ['Dead Bugs', 3, 12, 'On your back, arms and knees up, slowly lower the opposite arm and leg, then switch.'],
    ],
  },
  {
    name: 'Core and Balance Challenge', goal: 'stay healthy', difficulty: 'hard', minutes: 30, beginner: false,
    exercises: [
      ['Plank Up-Downs', 4, 12, 'From a forearm plank, push up onto one hand then the other, then lower back down.'],
      ['Single-Leg Deadlifts', 4, 10, 'Stand on one leg, hinge forward with a flat back while the other leg lifts behind you. Each leg.'],
      ['Side Plank Hip Dips', 3, 12, 'In a side plank, lower your hip towards the floor and lift it back up. Each side.'],
      ['Hollow Body Rocks', 3, 15, 'Lie on your back, lift arms, shoulders and legs, and rock gently while holding the shape.'],
      ['V-Ups', 3, 12, 'Lying flat, lift your legs and upper body at the same time to touch your toes, then lower.'],
    ],
  },
];

const ADDITIONAL_WORKOUTS = [
  {
    name: 'Low-Impact Cardio Circuit', goal: 'lose weight', difficulty: 'easy', minutes: 20, beginner: true,
    exercises: [
      ['March in Place', 3, 30, 'Stand tall and march steadily, lifting each knee comfortably while swinging your arms.'],
      ['Step Jacks', 3, 20, 'Step one foot out at a time while raising your arms, then return to the centre.'],
      ['Sit-to-Stand Squats', 3, 12, 'Lower onto a sturdy chair with control, then press through your feet to stand.'],
      ['Standing Knee Drives', 3, 16, 'Drive one knee up at a time, keeping your chest lifted and core gently braced.'],
      ['Wall Push-ups', 3, 12, 'Place hands on a wall at chest height, bend your elbows toward it, then press away.'],
    ],
  },
  {
    name: 'Cardio Endurance Intervals', goal: 'lose weight', difficulty: 'medium', minutes: 30, beginner: false,
    exercises: [
      ['Fast Feet', 4, 30, 'Run lightly in place with quick, small steps and soft knees.'],
      ['Reverse Lunges', 4, 12, 'Step one foot back, lower both knees with control, then drive through the front foot to stand. Each side.'],
      ['Mountain Climbers', 4, 20, 'From a strong plank, alternate driving your knees toward your chest at a steady pace.'],
      ['Skater Steps', 4, 16, 'Step laterally and reach the trailing foot behind you, alternating sides with balance.'],
      ['Plank Shoulder Taps', 3, 16, 'Hold a high plank and tap each shoulder with the opposite hand while keeping hips steady.'],
    ],
  },
  {
    name: 'Foundations Full-Body Strength', goal: 'build muscle', difficulty: 'easy', minutes: 30, beginner: true,
    exercises: [
      ['Tempo Squats', 3, 12, 'Lower into a comfortable squat for three counts, then stand steadily.'],
      ['Incline Push-ups', 3, 10, 'Place hands on a sturdy bench or table, keep your body straight, lower your chest and press up.'],
      ['Backpack Rows', 3, 12, 'Hold a lightly loaded backpack, hinge at the hips with a flat back, and pull it toward your ribs.'],
      ['Glute Bridges', 3, 15, 'Lie on your back with knees bent, squeeze your glutes to lift your hips, then lower slowly.'],
      ['Dead Bugs', 3, 10, 'Lie on your back with arms up and knees bent; slowly extend opposite arm and leg, then switch.'],
    ],
  },
  {
    name: 'Full-Body Strength Builder', goal: 'build muscle', difficulty: 'medium', minutes: 40, beginner: false,
    exercises: [
      ['Bulgarian Split Squats', 4, 10, 'Place your rear foot on a low stable seat, lower under control, and press through the front foot. Each side.'],
      ['Push-ups', 4, 12, 'Keep your body in a straight line, lower your chest toward the floor, then press back up.'],
      ['Backpack Rows', 4, 12, 'Hinge forward with a flat back and pull a loaded backpack toward your waist.'],
      ['Single-Leg Glute Bridges', 3, 12, 'Lift your hips using one planted foot while keeping the other leg raised. Each side.'],
      ['Pike Push-ups', 3, 8, 'Form an inverted V, bend your elbows to lower your head toward the floor, then press back up.'],
      ['Side Plank', 3, 20, 'Support yourself on one forearm and the side of your foot, keeping your body straight. Each side.'],
    ],
  },
  {
    name: 'Mobility and Core Reset', goal: 'stay healthy', difficulty: 'easy', minutes: 20, beginner: true,
    exercises: [
      ['Cat-Cow Stretch', 2, 10, 'On hands and knees, gently round your back, then arch it while lifting your chest.'],
      ['Bird Dogs', 3, 10, 'On hands and knees, extend the opposite arm and leg, pause, then switch sides.'],
      ['Glute Bridges', 3, 12, 'Lie on your back with knees bent, lift your hips by squeezing your glutes, then lower slowly.'],
      ['Standing Hip Circles', 2, 10, 'Stand tall and make slow, comfortable circles with your hips in both directions.'],
      ['Dead Bugs', 2, 10, 'Lie on your back and slowly lower opposite arm and leg while keeping your lower back comfortable.'],
    ],
  },
  {
    name: 'Everyday Strength and Balance', goal: 'stay healthy', difficulty: 'medium', minutes: 30, beginner: true,
    exercises: [
      ['Step-ups', 3, 12, 'Step onto a low, sturdy step and stand tall, then step down with control. Alternate legs.'],
      ['Chair Squats', 3, 15, 'Lower toward a sturdy chair, lightly tap the seat, then stand by pressing through your feet.'],
      ['Incline Push-ups', 3, 12, 'Use a sturdy counter or bench, keep your body straight, lower your chest, then press away.'],
      ['Calf Raises', 3, 15, 'Stand tall and rise onto the balls of your feet, pause, then lower slowly.'],
      ['Single-Leg Balance', 3, 20, 'Stand beside a wall for support and balance on one foot with a soft knee. Each side.'],
      ['Standing Torso Rotations', 2, 12, 'Stand with feet hip-width apart and gently rotate your upper body side to side.'],
    ],
  },
];

// A video search link so every exercise has an optional "watch how" link
function mediaUrlFor(exerciseName) {
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${exerciseName} exercise how to`);
}

// ---------- Demo students ----------
const STUDENTS = [
  { fullName: 'Emma Jensen', email: 'emma@example.com', budget: 300, goal: 'lose weight', diet: 'vegetarian', reminderDay: 'Sunday', trainingDays: 3, joinedDaysAgo: 42 },
  { fullName: 'Ali Hassan', email: 'ali@example.com', budget: 450, goal: 'build muscle', diet: 'halal', reminderDay: 'Saturday', trainingDays: 4, joinedDaysAgo: 20 },
  { fullName: 'Sofie Nielsen', email: 'sofie@example.com', budget: 600, goal: 'stay healthy', diet: 'vegan', reminderDay: 'Monday', trainingDays: 2, joinedDaysAgo: 5 },
];

// Round money to two decimals
function roundKr(amount) {
  return Math.round(amount * 100) / 100;
}

function resetSchema(db) {
  db.pragma('foreign_keys = OFF');
  for (const table of ALL_TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
}

function insertRecipes(db, recipes = [...RECIPES, ...ADDITIONAL_RECIPES]) {
  const insertRecipe = db.prepare(`INSERT INTO Recipes (RecipeName, MealType, PricePerPortion, Calories, IsVegetarian, DateAdded)
                                   VALUES (?, ?, ?, ?, ?, ?)`);
  const findRecipe = db.prepare('SELECT 1 FROM Recipes WHERE RecipeName = ?');
  const insertIngredient = db.prepare(`INSERT INTO RecipeIngredient (RecipeID, IngredientName, Quantity, Unit, Cost) VALUES (?, ?, ?, ?, ?)`);
  const insertStep = db.prepare('INSERT INTO RecipeStep (RecipeID, StepNumber, Instruction) VALUES (?, ?, ?)');
  const insertTag = db.prepare('INSERT INTO RecipeDietTag (RecipeID, DietType) VALUES (?, ?)');

  for (const recipe of recipes) {
    if (findRecipe.get(recipe.name)) continue;
    const price = roundKr(recipe.ingredients.reduce((sum, ingredient) => sum + ingredient[3], 0));
    const { lastInsertRowid: recipeId } = insertRecipe.run(
      recipe.name, recipe.mealType, price, recipe.calories, recipe.vegetarian ? 1 : 0, daysAgo(60),
    );
    for (const [name, quantity, unit, cost] of recipe.ingredients) insertIngredient.run(recipeId, name, quantity, unit, cost);
    recipe.steps.forEach((instruction, index) => insertStep.run(recipeId, index + 1, instruction));
    for (const tag of recipe.tags) insertTag.run(recipeId, tag);
  }
  ensureRecipeImages(db);
}

function insertWorkouts(db, workouts = [...WORKOUTS, ...ADDITIONAL_WORKOUTS]) {
  const insertWorkout = db.prepare(`INSERT INTO Workouts (WorkoutName, Goal, Difficulty, DurationMinutes, IsBeginnerFriendly, DateCreated)
                                    VALUES (?, ?, ?, ?, ?, ?)`);
  const findWorkout = db.prepare('SELECT 1 FROM Workouts WHERE WorkoutName = ?');
  const insertExercise = db.prepare(`INSERT INTO WorkoutExercise (WorkoutID, ExerciseName, Sets, Reps, Instructions, MediaURL)
                                     VALUES (?, ?, ?, ?, ?, ?)`);

  for (const workout of workouts) {
    if (findWorkout.get(workout.name)) continue;
    const { lastInsertRowid: workoutId } = insertWorkout.run(
      workout.name, workout.goal, workout.difficulty, workout.minutes, workout.beginner ? 1 : 0, daysAgo(60),
    );
    for (const [name, sets, reps, instructions] of workout.exercises) {
      insertExercise.run(workoutId, name, sets, reps, instructions, mediaUrlFor(name));
    }
  }
}

// Returns the UserID of the first demo student (who gets example progress data)
function insertUsers(db) {
  db.prepare('INSERT INTO Admins (Username, PasswordHash) VALUES (?, ?)').run('admin', hashPasswordSync('Admin123!'));

  const insertUser = db.prepare(`INSERT INTO Users (FullName, Email, PasswordHash, WeeklyBudget, IsActive, DateJoined)
                                 VALUES (?, ?, ?, ?, 1, ?)`);
  const insertProfile = db.prepare(`INSERT INTO UserProfile (UserID, Goal, DietType, ReminderDay, TrainingDays)
                                    VALUES (?, ?, ?, ?, ?)`);
  const studentHash = hashPasswordSync('Student123!');

  const userIds = STUDENTS.map((student) => {
    const { lastInsertRowid: userId } = insertUser.run(
      student.fullName, student.email, studentHash, student.budget, daysAgo(student.joinedDaysAgo),
    );
    insertProfile.run(userId, student.goal, student.diet, student.reminderDay, student.trainingDays);
    return userId;
  });
  return userIds[0];
}

// Six weeks of weekly weigh-ins and 2–4 workouts per week for one student
function insertProgressHistory(db, userId) {
  const insertWeight = db.prepare('INSERT INTO WeightLog (UserID, WeightKg, LogDate) VALUES (?, ?, ?)');
  const weights = [72.4, 72.0, 71.6, 71.7, 71.1, 70.6];
  weights.forEach((weight, week) => insertWeight.run(userId, weight, daysAgo(35 - week * 7)));

  const workoutIds = db.prepare("SELECT WorkoutID FROM Workouts WHERE Goal = 'lose weight' ORDER BY WorkoutID").all()
    .map((row) => row.WorkoutID);
  const insertLog = db.prepare('INSERT INTO WorkoutLog (UserID, WorkoutID, LogDate, IsCompleted) VALUES (?, ?, ?, 1)');
  const workoutDaysAgo = [40, 38, 36, 33, 31, 26, 24, 22, 20, 19, 15, 12, 10, 8, 5, 3, 1];
  workoutDaysAgo.forEach((days, index) => insertLog.run(userId, workoutIds[index % workoutIds.length], daysAgo(days)));
}

// Drop everything and fill the given database with demo data
function seedDatabase(db) {
  resetSchema(db);
  db.transaction(() => {
    insertRecipes(db);
    insertWorkouts(db);
    const demoUserId = insertUsers(db);
    insertProgressHistory(db, demoUserId);
  })();
}

// Seed only a brand-new database (no admins, users or recipes yet). Returns true if it seeded.
// Used on every start-up, so hosts without lasting storage (like Render free) start with demo data.
function seedIfEmpty(db) {
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  if (count('Admins') > 0 || count('Users') > 0 || count('Recipes') > 0) return false;
  seedDatabase(db);
  return true;
}

// Add only the newer catalog entries to a populated database; safe to run on every app start.
function ensureAdditionalRecipes(db) {
  db.transaction(() => insertRecipes(db, ADDITIONAL_RECIPES))();
}

function ensureAdditionalWorkouts(db) {
  db.transaction(() => insertWorkouts(db, ADDITIONAL_WORKOUTS))();
}

module.exports = { seedDatabase, seedIfEmpty, ensureAdditionalRecipes, ensureAdditionalWorkouts };

// `npm run seed` runs this file directly
if (require.main === module) {
  const db = require('./database');
  seedDatabase(db);
  console.log(`Database seeded: ${RECIPES.length + ADDITIONAL_RECIPES.length} recipes, ${WORKOUTS.length} workouts, ${STUDENTS.length} students, 1 admin.`);
}
