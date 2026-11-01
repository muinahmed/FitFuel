// Shared header for admin pages (Accounts – Muin): links to each admin area and log out.
// Put <header id="site-header"></header> on the page and load this script after api.js.

const ADMIN_LINKS = [
  { href: '/admin/dashboard.html', label: 'Dashboard' },
  { href: '/admin/users.html', label: 'Users' },
  { href: '/admin/recipes.html', label: 'Recipes' },
  { href: '/admin/workouts.html', label: 'Workouts' },
];

function renderAdminHeader() {
  const header = document.getElementById('site-header');
  header.className = 'site-header site-header--admin';
  const links = ADMIN_LINKS.map((link) => {
    const current = window.location.pathname === link.href ? ' aria-current="page"' : '';
    return `<li><a href="${link.href}"${current}>${link.label}</a></li>`;
  }).join('');

  header.innerHTML = `
    <div class="site-header__inner">
      <a class="brand" href="/admin/dashboard.html">
        <img src="/img/logo.png" alt="" width="44" height="44">
        FitFuel <span class="brand__tag">Admin</span>
      </a>
      <nav class="nav" aria-label="Admin">
        <ul>
          ${links}
          <li><button type="button" id="logout-button">Log out</button></li>
        </ul>
      </nav>
    </div>`;

  document.getElementById('logout-button').addEventListener('click', async () => {
    try {
      await api('/admin/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/admin/login.html';
    }
  });
}

renderAdminHeader();
