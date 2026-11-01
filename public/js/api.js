// Shared helpers used by every page: calling the API, showing messages and formatting money.

// Call the FitFuel API. Returns the JSON response or throws an Error with a friendly message.
// If the session has ended (401 outside the auth routes), the student is sent to the login page.
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
  if (response.status === 401 && !path.startsWith('/auth/')) {
    window.location.href = '/login.html';
  }
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
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
