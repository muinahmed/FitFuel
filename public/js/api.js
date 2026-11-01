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
