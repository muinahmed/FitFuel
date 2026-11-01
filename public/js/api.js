// Shared helpers used by every page: calling the API, showing messages and formatting money.

// Call the FitFuel API. Returns the JSON response or throws an Error with a friendly message.
// If the session has ended (401 outside the log-in routes), the visitor is sent to the right
// login page: the admin login for /admin/ calls, the student login otherwise.
async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch('/api' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));
  const isLogInCall = path.startsWith('/auth/') || path.startsWith('/admin/auth/');
  if (response.status === 401 && !isLogInCall) {
    window.location.href = path.startsWith('/admin/') ? '/admin/login.html' : '/login.html';
  }
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.');
    error.status = response.status; // e.g. 409, so a page can ask "delete anyway?"
    error.data = data;
    throw error;
  }
  return data;
}

// Show a message in an element. type: 'error' | 'success' | 'info'
function showMessage(element, text, type = 'error') {
  element.className = `message message--${type}`;
  element.textContent = text;
}

function clearMessage(element) {
  element.textContent = '';
}

// 300 -> "300.00 kr"
function formatKr(amount) {
  return `${Number(amount).toFixed(2)} kr`;
}

// Bar of planned cost against the weekly budget (FF-22). Over budget it turns the warning colour
// and says by how much, so the state never depends on colour alone.
function budgetMeterHtml(spent, budget) {
  const over = spent > budget;
  const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 100;
  const status = over ? `⚠ ${formatKr(spent - budget)} over budget` : `${formatKr(budget - spent)} left`;
  return `
    <div class="budget-meter${over ? ' budget-meter--over' : ''}">
      <div class="budget-meter__labels">
        <span><strong>${formatKr(spent)}</strong> of ${formatKr(budget)}</span>
        <span class="budget-meter__status">${status}</span>
      </div>
      <div class="budget-meter__track" role="meter" aria-label="Planned spending"
           aria-valuemin="0" aria-valuemax="${Math.max(budget, spent)}" aria-valuenow="${spent}"
           aria-valuetext="${formatKr(spent)} of ${formatKr(budget)}, ${status.replace('⚠ ', '')}">
        <div class="budget-meter__fill" style="width: ${percent}%"></div>
      </div>
    </div>`;
}

// Circular progress ring (SVG). fraction 0–1; centreHtml goes in the middle.
// The ring scales to its box, so CSS sets the size (.ring). Options: over (true = warning colour),
// light (for white cards instead of the dark hero).
function progressRingHtml(fraction, centreHtml, { over = false, light = false } = {}) {
  const size = 132;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = Math.max(0, Math.min(1, fraction));
  return `
    <div class="ring${over ? ' ring--over' : ''}${light ? ' ring--light' : ''}">
      <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" aria-hidden="true" focusable="false">
        <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"/>
        <circle class="ring__value" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"
                stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - shown)}"/>
      </svg>
      <div class="ring__centre">${centreHtml}</div>
    </div>`;
}

// Make text safe to put inside innerHTML
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));
}

// Today's date as 'YYYY-MM-DD' in local time (same format as the API)
function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' -> e.g. "Monday 3 Nov" (options can change the format)
function formatDate(dateString, options = { weekday: 'long', day: 'numeric', month: 'short' }) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', options);
}

// Disable a form's submit button while a request runs, then re-enable it
async function withBusyButton(form, task) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await task();
  } finally {
    button.disabled = false;
  }
}
