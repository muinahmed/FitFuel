// Users admin page (Accounts – Muin): statistics, sortable/searchable list, edit,
// deactivate/reactivate and delete student accounts.
const userTable = document.getElementById('user-table');
const usersMessage = document.getElementById('page-message');
const userDialog = document.getElementById('user-dialog');
const sorting = { sort: 'name', order: 'asc' };
let users = [];
let searchTimer = null;

async function loadStats() {
  const stats = await api('/admin/users/stats');
  document.getElementById('user-stats').innerHTML = statHtml('Total users', stats.total)
    + statHtml('Active', stats.active) + statHtml('Inactive', stats.inactive);

  const label = (week) => formatDate(week.weekStart, { day: 'numeric', month: 'short' });
  const total = stats.signupsPerWeek.reduce((sum, week) => sum + week.count, 0);
  document.querySelector('#signup-chart canvas').setAttribute('aria-label',
    `Bar chart of new sign-ups per week: ${total} in the last 8 weeks. `
    + stats.signupsPerWeek.map((week) => `${label(week)}: ${week.count}`).join(', '));
  animateProgressCounters(document.getElementById('user-stats'));
  renderBarChart(document.getElementById('signup-chart'), stats.signupsPerWeek.map((week) => ({
    label: label(week),
    value: week.count,
    tooltip: `<strong>${week.count} sign-up${week.count === 1 ? '' : 's'}</strong><br>Week of ${label(week)}`,
  })));
}

function userRowHtml(user) {
  return `
    <tr data-id="${user.userId}">
      <td>${escapeHtml(user.fullName)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${user.weeklyBudget > 0 ? formatKr(user.weeklyBudget) : '<span class="muted">Not set</span>'}</td>
      <td>${formatDate(user.dateJoined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
      <td><span class="badge ${user.isActive ? 'badge--diet' : 'badge--inactive'}">${user.isActive ? 'Active' : 'Inactive'}</span></td>
      <td class="row-actions">
        <button type="button" class="link-button" data-action="edit">Edit</button>
        <button type="button" class="link-button" data-action="toggle">${user.isActive ? 'Deactivate' : 'Reactivate'}</button>
        <button type="button" class="link-button link-button--danger" data-action="delete">Delete</button>
      </td>
    </tr>`;
}

// Show which column is sorted (aria-sort tells screen readers too)
function showSorting() {
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    const active = th.dataset.sort === sorting.sort;
    th.setAttribute('aria-sort', active ? (sorting.order === 'asc' ? 'ascending' : 'descending') : 'none');
    th.querySelector('button').dataset.arrow = active ? (sorting.order === 'asc' ? '▲' : '▼') : '';
  });
}

async function loadUsers() {
  const query = new URLSearchParams({ ...sorting, search: document.getElementById('search').value });
  users = await api(`/admin/users?${query}`);
  document.getElementById('result-count').textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;
  userTable.innerHTML = users.length
    ? users.map(userRowHtml).join('')
    : `<tr><td colspan="6">${emptyStateHtml({ compact: true, iconName: 'search', title: 'No users match your search', text: 'Check the spelling, or search by part of the name or email.' })}</td></tr>`;
  showSorting();
}

// Run an admin action, then reload the list and statistics
async function runAndReload(task, successText) {
  clearMessage(usersMessage);
  try {
    await task();
    await Promise.all([loadUsers(), loadStats()]);
    showMessage(usersMessage, successText, 'success');
  } catch (error) {
    showMessage(usersMessage, error.message);
  }
}

function editUser(user) {
  userDialog.querySelector('#edit-fullName').value = user.fullName;
  userDialog.querySelector('#edit-email').value = user.email;
  userDialog.querySelector('#edit-weeklyBudget').value = user.weeklyBudget;
  openFormDialog(userDialog, async (form) => {
    await api(`/admin/users/${user.userId}`, { method: 'PUT', body: Object.fromEntries(new FormData(form)) });
    await loadUsers();
    showMessage(usersMessage, `${form.fullName.value} was updated.`, 'success');
  });
}

userTable.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const user = users.find((item) => item.userId === Number(button.closest('tr').dataset.id));

  if (button.dataset.action === 'edit') {
    editUser(user);
  } else if (button.dataset.action === 'toggle') {
    runAndReload(
      () => api(`/admin/users/${user.userId}/status`, { method: 'PUT', body: { isActive: !user.isActive } }),
      `${user.fullName} was ${user.isActive ? 'deactivated' : 'reactivated'}.`,
    );
  } else if (button.dataset.action === 'delete') {
    const confirmed = window.confirm(`Delete ${user.fullName} (${user.email})?\n\n`
      + 'This permanently deletes the account and all of their meal plans, workout logs and weight entries.');
    if (confirmed) runAndReload(() => api(`/admin/users/${user.userId}`, { method: 'DELETE' }), `${user.fullName} was deleted.`);
  }
});

document.querySelectorAll('th[data-sort] button').forEach((button) => {
  button.addEventListener('click', () => {
    const column = button.closest('th').dataset.sort;
    sorting.order = sorting.sort === column && sorting.order === 'asc' ? 'desc' : 'asc';
    sorting.sort = column;
    loadUsers().catch((error) => showMessage(usersMessage, error.message));
  });
});

document.getElementById('user-search').addEventListener('submit', (event) => event.preventDefault());
document.getElementById('search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadUsers().catch((error) => showMessage(usersMessage, error.message)), 250);
});

Promise.all([loadUsers(), loadStats()]).catch((error) => showMessage(usersMessage, error.message));
