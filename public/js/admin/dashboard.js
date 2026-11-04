// Admin dashboard (all components): one card per admin area with headline numbers.

async function loadDashboard() {
  try {
    const [userStats, recipeUsage, workoutActivity] = await Promise.all([
      api('/admin/users/stats'), api('/admin/recipes/usage'), api('/admin/workouts/activity'),
    ]);

    document.getElementById('user-stats').innerHTML = statHtml('Total', userStats.total)
      + statHtml('Active', userStats.active) + statHtml('Inactive', userStats.inactive);

    const topRecipe = recipeUsage[0];
    document.getElementById('recipe-stats').innerHTML = `
      <div class="stat-row">${statHtml('Recipes', recipeUsage.length)}</div>
      <p class="muted">Most planned: ${topRecipe && topRecipe.timesPlanned
        ? `${escapeHtml(topRecipe.recipeName)} (${topRecipe.timesPlanned}×)` : 'no meal plans yet'}</p>`;

    const topWorkout = workoutActivity[0];
    document.getElementById('workout-stats').innerHTML = `
      <div class="stat-row">${statHtml('Workouts', workoutActivity.length)}</div>
      <p class="muted">Most logged: ${topWorkout && topWorkout.timesLogged
        ? `${escapeHtml(topWorkout.workoutName)} (${topWorkout.timesLogged}×)` : 'no workouts logged yet'}</p>`;
  } catch (error) {
    showMessage(document.getElementById('page-message'), error.message);
  }
}

loadDashboard().then(() => animateProgressCounters());
