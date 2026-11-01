// Recipes & Meal Planning component – Albina Rana
// Which recipes fit a diet type. Used by recipe browsing and meal plan generation.
// Vegetarian uses Recipes.IsVegetarian; vegan and halal use RecipeDietTag.

const DIET_TYPES = ['none', 'vegetarian', 'vegan', 'halal'];

// SQL condition (for a query where Recipes is aliased as r) plus its parameters.
// Only fixed SQL text is returned; the diet value is always passed as a parameter.
function dietCondition(dietType) {
  if (dietType === 'vegetarian') return { sql: 'r.IsVegetarian = 1', params: [] };
  if (dietType === 'vegan' || dietType === 'halal') {
    return {
      sql: 'EXISTS (SELECT 1 FROM RecipeDietTag t WHERE t.RecipeID = r.RecipeID AND t.DietType = ?)',
      params: [dietType],
    };
  }
  return { sql: '1 = 1', params: [] }; // 'none': every recipe fits
}

module.exports = { DIET_TYPES, dietCondition };
