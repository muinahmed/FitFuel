// Progress page (Workouts & Progress – Priyanka): log, edit and delete weight entries,
// and charts of weight over time and workouts per week.
const weightForm = document.getElementById('weight-form');
const weightTable = document.getElementById('weight-table');
const weightChart = document.getElementById('weight-chart');
const progressMessage = document.getElementById('page-message');
const logMessage = document.getElementById('log-message');
const entriesMessage = document.getElementById('entries-message');
let weights = [];
let weeks = [];
const statsReady = { weights: false, workouts: false };

const formatKg = (kg) => `${Number(kg).toFixed(1)} kg`;
const shortDate = (date) => formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' });

// value can be a number (counts up from zero) or text
function statTileHtml(iconName, value, label, { decimals = 0, suffix = '' } = {}) {
  const shown = typeof value === 'number'
    ? `<span data-count-to="${value}" data-count-decimals="${decimals}" data-count-suffix="${suffix}">${value.toFixed(decimals)}${suffix}</span>`
    : value;
  return `
    <div class="card stat-tile">
      <span class="icon-chip">${icon(iconName, 22)}</span>
      <div><p class="stat-line__value">${shown}</p><p class="stat-line__label">${label}</p></div>
    </div>`;
}

// Summary tiles at the top: latest weight, change, workouts this week and in 8 weeks
function renderStats() {
  const tiles = [];
  if (weights.length) {
    const first = weights[0];
    const latest = weights[weights.length - 1];
    tiles.push(statTileHtml('scale', latest.weightKg, 'latest weight', { decimals: 1, suffix: ' kg' }));
    if (weights.length > 1) {
      const change = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
      tiles.push(statTileHtml('chart', change === 0 ? 'No change' : `${change > 0 ? '+' : '−'}${formatKg(Math.abs(change))}`,
        `since ${formatDate(first.logDate, { day: 'numeric', month: 'short' })}`));
    }
  }
  if (weeks.length) {
    tiles.push(statTileHtml('trophy', weeks[weeks.length - 1].count, 'workouts this week'));
    tiles.push(statTileHtml('calendar', weeks.reduce((sum, week) => sum + week.count, 0), 'workouts in 8 weeks'));
  }
  // Wait until both weights and workouts have loaded, so the tiles appear (and count up) once
  if (!statsReady.weights || !statsReady.workouts) return;
  const container = document.getElementById('progress-stats');
  container.innerHTML = tiles.length
    ? tiles.join('')
    : emptyStateHtml({ compact: true, iconName: 'chart', title: 'Your progress starts here', text: 'Log your weight below or finish a workout to see your numbers.' });
  animateProgressCounters(container);
}

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
    : '<tr><td colspan="3" class="placeholder">No weight entries yet. Add your first one above.</td></tr>';
}

async function loadWeights() {
  weights = await api('/progress/weights');
  statsReady.weights = true;
  renderWeightTable();
  renderWeightChart();
  renderStats();
}

async function loadWorkoutChart() {
  weeks = await api('/progress/workouts-per-week');
  statsReady.workouts = true;
  renderStats();
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
      const saved = await api('/progress/weights', { method: 'POST', body: Object.fromEntries(new FormData(weightForm)) });
      weightForm.weightKg.value = '';
      showMessage(logMessage, 'Weight saved.', 'success');
      await loadWeights();
      flash(weightTable.querySelector(`tr[data-id="${saved.weightLogId}"]`), 'highlight');
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
