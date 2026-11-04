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
          <defs><linearGradient id="home-progress-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#B7E84B"/><stop offset="52%" stop-color="#48C58A"/><stop offset="100%" stop-color="#48B8D1"/></linearGradient></defs>
        <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"/>
        <circle class="ring__value" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${stroke}"
                  stroke="url(#home-progress-gradient)"
                stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - shown)}"
                style="--ring-start:${circumference};--ring-end:${circumference * (1 - shown)}"/>
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

// ---------- Shared UI: loading skeletons, empty states, action feedback ----------

// Grey shimmering shapes shown while a container waits for data. Kinds: card, recipe, row, chart, stat.
// wrapper: '' (a div group), 'li' for lists, 'tr' for table bodies, so the HTML stays valid.
function skeletonHtml(kind, count, wrapper = '') {
  const shape = {
    card: '<div class="skeleton skeleton--card"><span class="skeleton__line skeleton__line--title"></span><span class="skeleton__line"></span><span class="skeleton__line skeleton__line--short"></span></div>',
    recipe: '<div class="skeleton skeleton--recipe"><span class="skeleton__image"></span><span class="skeleton__line skeleton__line--title"></span><span class="skeleton__line skeleton__line--short"></span></div>',
    row: '<div class="skeleton skeleton--row"><span class="skeleton__dot"></span><span class="skeleton__line"></span></div>',
    chart: '<div class="skeleton skeleton--chart"></div>',
    stat: '<div class="skeleton skeleton--stat"><span class="skeleton__dot"></span><span class="skeleton__line skeleton__line--short"></span></div>',
  }[kind] || '';
  if (wrapper === 'li') return `<li class="skeleton-item" aria-hidden="true">${shape}</li>`.repeat(count);
  if (wrapper === 'tr') return `<tr class="skeleton-item" aria-hidden="true"><td colspan="9">${shape}</td></tr>`.repeat(count);
  return `<div class="skeleton-group skeleton-group--${kind}" aria-hidden="true">${shape.repeat(count)}</div>`;
}

// Containers marked data-skeleton="kind count" (e.g. "recipe 6") show skeletons until the page
// script puts real content in them; that first content then fades in once.
function fillSkeletons() {
  document.querySelectorAll('[data-skeleton]').forEach((container) => {
    const [kind, count] = container.dataset.skeleton.split(' ');
    const wrapper = { UL: 'li', OL: 'li', TBODY: 'tr' }[container.tagName] || '';
    container.innerHTML = skeletonHtml(kind, Number(count) || 3, wrapper);
    container.setAttribute('aria-busy', 'true');
    const observer = new MutationObserver(() => {
      observer.disconnect();
      container.removeAttribute('aria-busy');
      revealChildren(container);
    });
    observer.observe(container, { childList: true });
  });
}
fillSkeletons();

// Fade a container's children in one after another, once (e.g. after a new plan is generated)
function revealChildren(container) {
  container.classList.remove('just-loaded');
  void container.offsetWidth;
  container.classList.add('just-loaded');
  setTimeout(() => container.classList.remove('just-loaded'), 1000);
}

// Friendly "nothing here yet" block with one clear next step.
// image: a photo path, or iconName for an icon instead. text may hold trusted HTML (e.g. a link).
// action: { href, label } for a link, or { button: id, label } for a button the page wires up.
function emptyStateHtml({ image, iconName, title, text, action, compact = false }) {
  const picture = image
    ? `<img class="empty-state__image" src="${escapeHtml(image)}" alt="" loading="lazy">`
    : `<span class="empty-state__icon">${icon(iconName || 'leaf', 28)}</span>`;
  let actionHtml = '';
  if (action && action.href) actionHtml = `<a class="btn" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`;
  if (action && action.button) actionHtml = `<button type="button" class="btn" id="${escapeHtml(action.button)}">${escapeHtml(action.label)}</button>`;
  return `
    <div class="empty-state${compact ? ' empty-state--compact' : ''}">
      ${picture}
      <div class="empty-state__text">
        <p class="empty-state__title">${escapeHtml(title)}</p>
        ${text ? `<p class="empty-state__body">${text}</p>` : ''}
        ${actionHtml}
      </div>
    </div>`;
}

// Set a progress bar's fill width on the next frame, so it grows smoothly even when the bar
// has just been shown (CSS transitions do not run on an element that was display: none)
function setBarWidth(fill, percent) {
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = `${percent}%`; }));
}

// Big number with a small label (admin dashboard and users statistics). Numbers count up from
// zero when the page calls animateProgressCounters (countUp.js).
function statHtml(label, value) {
  const shown = typeof value === 'number' ? `<span data-count-to="${value}">${value}</span>` : escapeHtml(value);
  return `<div class="stat"><span class="stat__value">${shown}</span><span class="stat__label">${escapeHtml(label)}</span></div>`;
}

// Replay a short animation on an element that just changed. kind: pop, highlight, appear
function flash(element, kind = 'highlight') {
  if (!element) return;
  const className = `flash-${kind}`;
  element.classList.remove(className);
  void element.offsetWidth; // restart the animation if it is already running
  element.classList.add(className);
  element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
}
