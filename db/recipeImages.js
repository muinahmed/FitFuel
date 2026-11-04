// Generated recipe photos follow the same order as the seeded RECIPES array in seed.js.
const RECIPE_IMAGE_NAMES = [
  'Overnight Oats with Banana', 'Scrambled Eggs on Rye', 'Greek Yogurt Berry Bowl',
  'Peanut Butter Banana Toast', 'Spinach and Feta Omelette', 'Chickpea Hummus Wrap',
  'Tuna Pasta Salad', 'Red Lentil Soup', 'Chicken Rice Bowl', 'Egg Fried Rice',
  'Halloumi Couscous Salad', 'Black Bean Quesadilla', 'Vegetable Chilli',
  'Spaghetti Bolognese', 'Chicken Curry with Rice', 'Baked Salmon with Potatoes',
  'Pork and Vegetable Stir-Fry', 'Tofu Veggie Stir-Fry', 'Mushroom Risotto',
  'Sausage and Bean Casserole', 'Lamb Kofta Flatbread', 'Sweet Potato Chickpea Curry',
  'Hummus and Veg Sticks', 'Banana Oat Energy Balls', 'Cottage Cheese with Apple',
  'Boiled Eggs and Crispbread',
  'Apple Cinnamon Overnight Oats', 'Avocado Egg Toast', 'Fluffy Apple Pancakes',
  'Banana Cottage Cheese Bowl', 'Greek Chickpea Feta Salad', 'Chicken Pesto Pasta',
  'Black Bean Burrito Bowl', 'Roasted Veggie Hummus Pita', 'Tomato Mozzarella Sandwich',
  'Lemon Tuna Couscous', 'Turkey Meatballs Marinara Pasta', 'Beef Taco Rice Bowl',
  'Spinach Chickpea Coconut Curry', 'Lemon Herb Chicken Tray Bake', 'Lentil Shepherd’s Pie',
  'Vegetable Lasagna', 'Teriyaki Tofu Noodle Bowl', 'Garlic Pork Meatball Noodles',
  'Apple Peanut Butter Rice Cakes', 'Berry Yogurt Smoothie Bowl',
];

function ensureRecipeImages(db) {
  const findRecipe = db.prepare('SELECT RecipeID FROM Recipes WHERE RecipeName = ?');
  const insertImage = db.prepare('INSERT OR IGNORE INTO RecipeImage (RecipeID, ImagePath) VALUES (?, ?)');
  RECIPE_IMAGE_NAMES.forEach((name, index) => {
    const recipe = findRecipe.get(name);
    if (recipe) insertImage.run(recipe.RecipeID, `/img/recipes/${String(index + 1).padStart(2, '0')}.png`);
  });
}

module.exports = { ensureRecipeImages };
