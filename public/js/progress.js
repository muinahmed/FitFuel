// Progress page (Workouts & Progress – Priyanka): log, edit and delete weight entries,
// and charts of weight over time and workouts per week.
const weightForm = document.getElementById('weight-form');
const weightTable = document.getElementById('weight-table');
const weightChart = document.getElementById('weight-chart');
const progressMessage = document.getElementById('page-message');
const logMessage = document.getElementById('log-message');
const entriesMessage = document.getElementById('entries-message');
let weights = [];

const formatKg = (kg) => `${Number(kg).toFixed(1)} kg`;
const shortDate = (date) => formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' });

function renderWeightChart() {
  const summary = document.getElementById('weight-summary');
  const canvas = weightChart.querySelector('canvas');
  weightChart.hidden = weights.length === 0;
  if (weights.length === 0) {
    summary.textContent = 'Log your weight to see your progress chart.';
    return;
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const change = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  summary.textContent = weights.length === 1
    ? `${formatKg(last.weightKg)} on ${shortDate(last.logDate)}. Add more entries to see a trend.`
    : `${change === 0 ? 'No change' : `${change < 0 ? 'Down' : 'Up'} ${formatKg(Math.abs(change))}`} since ${shortDate(first.logDate)} (latest ${formatKg(last.weightKg)}).`;
  canvas.setAttribute('aria-label', `Line chart of your weight over time. ${summary.textContent} The full list is in the table below.`);

  renderLineChart(weightChart, weights.map((entry) => ({ date: entry.logDate, value: entry.weightKg })), { formatValue: formatKg });
}

function rowHtml(entry) {
  return `
    <tr data-id="${entry.weightLogId}">
      <td>${shortDate(entry.logDate)}</td>
      <td>${formatKg(entry.weightKg)}</td>
      <td class="row-actions">
        <button type="button" class="link-button" data-action="edit">Edit</button>
        <button type="button" class="link-button link-button--danger" data-action="delete">Delete</button>
      </td>
    </tr>`;
}

function editRowHtml(entry) {
  return `
    <tr data-id="${entry.weightLogId}" class="editing">
      <td><label class="visually-hidden" for="edit-date">Date</label>
          <input id="edit-date" type="date" value="${entry.logDate}" max="${todayString()}" required></td>
      <td><label class="visually-hidden" for="edit-weight">Weight in kg</label>
          <input id="edit-weight" type="number" min="20" max="400" step="0.1" value="${entry.weightKg}" required></td>
      <td class="row-actions">
        <button type="button" class="link-button" data-action="save">Save</button>
        <button type="button" class="link-button" data-action="cancel">Cancel</button>
      </td>
    </tr>`;
}

// Newest entries first in the table
function renderWeightTable() {
  weightTable.innerHTML = weights.length
    ? [...weights].reverse().map(rowHtml).join('')
    : '<tr><td colspan="3" class="placeholder">No weight entries yet.</td></tr>';
}

async function loadWeights() {
  weights = await api('/progress/weights');
  renderWeightTable();
  renderWeightChart();
}

async function loadWorkoutChart() {
  const weeks = await api('/progress/workouts-per-week');
  const label = (week) => formatDate(week.weekStart, { day: 'numeric', month: 'short' });
  const total = weeks.reduce((sum, week) => sum + week.count, 0);
  const summary = `${total} workout${total === 1 ? '' : 's'} in the last ${weeks.length} weeks, ${weeks[weeks.length - 1].count} this week.`;
  document.getElementById('workout-summary').textContent = summary;
  document.querySelector('#workout-chart canvas').setAttribute('aria-label', `Bar chart of completed workouts per week. ${summary}`);
  document.getElementById('workout-table').innerHTML = weeks
    .map((week) => `<tr><td>${label(week)}</td><td>${week.count}</td></tr>`).join('');

  renderBarChart(document.getElementById('workout-chart'), weeks.map((week) => ({
    label: label(week),
    value: week.count,
    tooltip: `<strong>${week.count} workout${week.count === 1 ? '' : 's'}</strong><br>Week of ${label(week)}`,
  })));
}

weightForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearMessage(logMessage);
  withBusyButton(weightForm, async () => {
    try {
      await api('/progress/weights', { method: 'POST', body: Object.fromEntries(new FormData(weightForm)) });
      weightForm.weightKg.value = '';
      showMessage(logMessage, 'Weight saved.', 'success');
      await loadWeights();
    } catch (error) {
      showMessage(logMessage, error.message);
    }
  });
});

weightTable.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const row = button.closest('tr');
  const entry = weights.find((item) => item.weightLogId === Number(row.dataset.id));
  clearMessage(entriesMessage);

  try {
    if (button.dataset.action === 'edit') {
      renderWeightTable(); // only one row in edit mode at a time
      weightTable.querySelector(`tr[data-id="${entry.weightLogId}"]`).outerHTML = editRowHtml(entry);
      document.getElementById('edit-weight').focus();
    } else if (button.dataset.action === 'cancel') {
      renderWeightTable();
    } else if (button.dataset.action === 'save') {
      const body = { logDate: document.getElementById('edit-date').value, weightKg: document.getElementById('edit-weight').value };
      await api(`/progress/weights/${entry.weightLogId}`, { method: 'PUT', body });
      await loadWeights();
      showMessage(entriesMessage, 'Entry updated.', 'success');
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm(`Delete your weight entry for ${shortDate(entry.logDate)}?`)) return;
      await api(`/progress/weights/${entry.weightLogId}`, { method: 'DELETE' });
      await loadWeights();
      showMessage(entriesMessage, 'Entry deleted.', 'success');
    }
  } catch (error) {
    showMessage(entriesMessage, error.message);
  }
});

async function loadProgress() {
  document.getElementById('logDate').value = todayString();
  document.getElementById('logDate').max = todayString();
  try {
    await Promise.all([loadWeights(), loadWorkoutChart()]);
  } catch (error) {
    showMessage(progressMessage, error.message);
  }
}

loadProgress();
