// Workouts admin page (Workouts & Progress – Priyanka): filter, add, edit and delete
// workouts (with exercises) and view workout activity.
const workoutTable = document.getElementById('workout-table');
const workoutsMessage = document.getElementById('page-message');
const workoutDialog = document.getElementById('workout-dialog');
const workoutFilters = document.getElementById('workout-filters');
let workouts = [];

const exerciseRows = setUpRowList(document.getElementById('exercise-rows'), (item) => `
  <input data-field="exerciseName" aria-label="Exercise name" placeholder="Exercise" maxlength="60" required value="${attr(item.exerciseName)}">
  <input data-field="sets" aria-label="Sets" placeholder="Sets" type="number" min="1" max="20" step="1" required value="${attr(item.sets)}">
  <input data-field="reps" aria-label="Reps" placeholder="Reps" type="number" min="1" max="500" step="1" required value="${attr(item.reps)}">
  <input data-field="instructions" class="row-wide" aria-label="Instructions" placeholder="Short instructions" maxlength="255" value="${attr(item.instructions)}">
  <input data-field="mediaUrl" class="row-wide" aria-label="Image or video link (optional)" placeholder="https://… (optional video link)" type="url" maxlength="255" value="${attr(item.mediaUrl)}">
  <div class="row-wide">${photoPickerHtml(item.imagePath, 'exercise photo')}</div>`,
document.getElementById('add-exercise'), 'Remove exercise');

function workoutRowHtml(workout) {
  return `
    <tr data-id="${workout.workoutId}">
      <td>${escapeHtml(workout.workoutName)}</td>
      <td class="capitalise">${escapeHtml(workout.goal)}</td>
      <td class="capitalise">${escapeHtml(workout.difficulty)}</td>
      <td>${workout.durationMinutes}</td>
      <td>${workout.isBeginnerFriendly ? 'Yes' : 'No'}</td>
      <td>${workout.exerciseCount}</td>
      <td>${workout.timesLogged}</td>
      <td class="row-actions">
        <button type="button" class="link-button" data-action="edit">Edit</button>
        <button type="button" class="link-button link-button--danger" data-action="delete">Delete</button>
      </td>
    </tr>`;
}

async function loadWorkouts() {
  const query = new URLSearchParams(new FormData(workoutFilters));
  workouts = await api(`/admin/workouts?${query}`);
  document.getElementById('result-count').textContent = `${workouts.length} workout${workouts.length === 1 ? '' : 's'}`;
  workoutTable.innerHTML = workouts.length
    ? workouts.map(workoutRowHtml).join('')
    : '<tr><td colspan="8" class="placeholder">No workouts match these filters.</td></tr>';
}

async function loadActivity() {
  const activity = await api('/admin/workouts/activity');
  document.getElementById('activity-list').innerHTML = activity.map((row) => `
    <li><span>${escapeHtml(row.workoutName)} <span class="muted">(${escapeHtml(row.goal)})</span></span>
        <strong>${row.timesLogged}×</strong></li>`).join('');
}

function reloadAll() {
  return Promise.all([loadWorkouts(), loadActivity()]);
}

// Fill the dialog (empty for a new workout) and save with POST or PUT
function openWorkoutForm(workout) {
  const form = workoutDialog.querySelector('form');
  form.reset();
  document.getElementById('workout-dialog-title').textContent = workout ? `Edit ${workout.workoutName}` : 'Add workout';
  form.workoutName.value = workout ? workout.workoutName : '';
  form.goal.value = workout ? workout.goal : 'stay healthy';
  form.difficulty.value = workout ? workout.difficulty : 'easy';
  form.durationMinutes.value = workout ? workout.durationMinutes : '';
  form.isBeginnerFriendly.checked = Boolean(workout && workout.isBeginnerFriendly);
  exerciseRows.clear();
  (workout ? workout.exercises : [{}, {}, {}, {}]).forEach((exercise) => exerciseRows.add(exercise));

  openFormDialog(workoutDialog, async () => {
    const body = {
      workoutName: form.workoutName.value,
      goal: form.goal.value,
      difficulty: form.difficulty.value,
      durationMinutes: form.durationMinutes.value,
      isBeginnerFriendly: form.isBeginnerFriendly.checked,
      exercises: exerciseRows.read(),
    };
    const saved = workout
      ? await api(`/admin/workouts/${workout.workoutId}`, { method: 'PUT', body })
      : await api('/admin/workouts', { method: 'POST', body });
    await reloadAll();
    showMessage(workoutsMessage, `${saved.workoutName} was ${workout ? 'updated' : 'added'}.`, 'success');
  });
}

async function deleteWorkout(workout) {
  const logs = workout.timesLogged
    ? `\n\nIt has been logged ${workout.timesLogged} time${workout.timesLogged === 1 ? '' : 's'}; those entries will be removed from students' workout history.`
    : '';
  if (!window.confirm(`Delete the workout "${workout.workoutName}"?${logs}`)) return;
  clearMessage(workoutsMessage);
  try {
    await api(`/admin/workouts/${workout.workoutId}`, { method: 'DELETE' });
    await reloadAll();
    showMessage(workoutsMessage, `${workout.workoutName} was deleted.`, 'success');
  } catch (error) {
    showMessage(workoutsMessage, error.message);
  }
}

workoutTable.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const workout = workouts.find((item) => item.workoutId === Number(button.closest('tr').dataset.id));
  if (button.dataset.action === 'delete') return deleteWorkout(workout);
  try {
    openWorkoutForm(await api(`/admin/workouts/${workout.workoutId}`));
  } catch (error) {
    showMessage(workoutsMessage, error.message);
  }
});

setUpPhotoPickers(workoutDialog, workoutDialog.querySelector('.message'));
document.getElementById('add-button').addEventListener('click', () => openWorkoutForm(null));
workoutFilters.addEventListener('change', () => loadWorkouts().catch((error) => showMessage(workoutsMessage, error.message)));

reloadAll().catch((error) => showMessage(workoutsMessage, error.message));
