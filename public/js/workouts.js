// Workouts page (Workouts & Progress – Priyanka): training days, this week's plan with
// exercise instructions, "mark as done" and workout history.
const sessionsContainer = document.getElementById('sessions');
const historyList = document.getElementById('history');
const workoutsMessage = document.getElementById('page-message');
const daysForm = document.getElementById('days-form');

function exerciseHtml(exercise) {
  const video = exercise.mediaUrl
    ? `<a href="${escapeHtml(exercise.mediaUrl)}" target="_blank" rel="noopener noreferrer"
          aria-label="Watch how to do ${escapeHtml(exercise.exerciseName)} (opens in a new tab)">Watch how ↗</a>`
    : '';
  return `
    <li class="exercise">
      <div class="exercise__heading">
        <strong>${escapeHtml(exercise.exerciseName)}</strong>
        <span class="exercise__sets">${exercise.sets} sets × ${exercise.reps} reps</span>
      </div>
      <p>${escapeHtml(exercise.instructions || '')}</p>
      ${video}
    </li>`;
}

function sessionHtml(session, isNext) {
  const { workout } = session;
  const badges = [
    session.isToday ? '<span class="badge badge--today">Today</span>' : '',
    session.isDone ? '<span class="badge badge--done">Done ✓</span>' : '',
    workout.isBeginnerFriendly ? '<span class="badge badge--diet">Beginner-friendly</span>' : '',
  ].join('');
  const doneButton = session.isDone
    ? ''
    : `<button type="button" class="btn" data-log-workout="${workout.workoutId}" data-workout-name="${escapeHtml(workout.workoutName)}">Mark as done today</button>`;

  return `
    <article class="card session${session.isDone ? ' session--done' : ''}">
      <p class="session__day">${session.day} · ${formatDate(session.date, { day: 'numeric', month: 'short' })}</p>
      <h3>${escapeHtml(workout.workoutName)}</h3>
      <p class="recipe-meta">${badges}</p>
      <p class="muted">${workout.durationMinutes} min · ${escapeHtml(workout.difficulty)}</p>
      <details${isNext ? ' open' : ''}>
        <summary>Exercises (${workout.exercises.length})</summary>
        <ol class="exercise-list">${workout.exercises.map(exerciseHtml).join('')}</ol>
      </details>
      ${doneButton}
    </article>`;
}

function renderPlan(plan) {
  document.getElementById('trainingDays').value = plan.trainingDays || '';
  document.getElementById('goal-label').innerHTML = plan.goal
    ? `Goal: ${escapeHtml(plan.goal)} · <a href="/profile.html">change</a>`
    : '';

  if (!plan.goal) {
    sessionsContainer.innerHTML = '<p class="placeholder">Choose your fitness goal on your <a href="/profile.html">profile</a> to get workout suggestions.</p>';
  } else if (!plan.trainingDays) {
    sessionsContainer.innerHTML = '<p class="placeholder">Choose how many days a week you want to train, and we will suggest a plan.</p>';
  } else {
    const next = plan.nextSession;
    const allDone = plan.sessions.every((session) => session.isDone);
    const allDoneNote = allDone
      ? `<p class="message message--success all-done">All of this week's workouts are done – well done! Next up: ${escapeHtml(next.workout.workoutName)} on ${next.day}.</p>`
      : '';
    sessionsContainer.innerHTML = allDoneNote
      + plan.sessions.map((session) => sessionHtml(session, session.date === next.date)).join('');
  }
}

function renderHistory(logs) {
  historyList.innerHTML = logs.length
    ? logs.map((log) => `
        <li><span>${escapeHtml(log.workoutName)} <span class="muted">· ${log.durationMinutes} min</span></span>
            <span class="muted">${formatDate(log.logDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span></li>`).join('')
    : '<li class="placeholder">No workouts logged yet. Mark a workout as done to start your history.</li>';
}

async function loadWorkouts() {
  try {
    const [plan, history] = await Promise.all([api('/workouts/plan'), api('/workouts/history')]);
    renderPlan(plan);
    renderHistory(history);
  } catch (error) {
    showMessage(workoutsMessage, error.message);
  }
}

daysForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearMessage(workoutsMessage);
  withBusyButton(daysForm, async () => {
    try {
      renderPlan(await api('/workouts/plan', { method: 'PUT', body: { trainingDays: Number(daysForm.trainingDays.value) } }));
      showMessage(workoutsMessage, 'Training days saved. Your plan is updated.', 'success');
    } catch (error) {
      showMessage(workoutsMessage, error.message);
    }
  });
});

sessionsContainer.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-log-workout]');
  if (!button) return;

  clearMessage(workoutsMessage);
  button.disabled = true;
  try {
    await api(`/workouts/${button.dataset.logWorkout}/log`, { method: 'POST' });
    await loadWorkouts();
    showMessage(workoutsMessage, `Great job! ${button.dataset.workoutName} is logged for today.`, 'success');
  } catch (error) {
    button.disabled = false;
    showMessage(workoutsMessage, error.message);
  }
});

loadWorkouts();
