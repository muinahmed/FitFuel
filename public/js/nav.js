// Shared site header for every logged-in page (Accounts – Muin): logo, navigation links,
// log out button, and a Menu button that shows and hides the links on small screens.
// Student pages: put <header id="site-header"></header> on the page.
// Admin pages: the same, plus <body data-area="admin"> to get the admin links.
// Load this script after api.js.

const HEADER_AREAS = {
  student: {
    home: '/home.html',
    navLabel: 'Main',
    links: [
      { href: '/home.html', label: 'Home' },
      { href: '/mealplan.html', label: 'Meals', alsoActiveOn: ['/recipes.html', '/favourites.html'] },
      { href: '/shopping.html', label: 'Shopping' },
      { href: '/workouts.html', label: 'Workouts' },
      { href: '/progress.html', label: 'Progress' },
      { href: '/profile.html', label: 'Profile' },
    ],
    logoutPath: '/auth/logout',
    afterLogout: '/index.html',
  },
  admin: {
    home: '/admin/dashboard.html',
    tag: 'Admin',
    navLabel: 'Admin',
    links: [
      { href: '/admin/dashboard.html', label: 'Dashboard' },
      { href: '/admin/users.html', label: 'Users' },
      { href: '/admin/recipes.html', label: 'Recipes' },
      { href: '/admin/workouts.html', label: 'Workouts' },
    ],
    logoutPath: '/admin/auth/logout',
    afterLogout: '/admin/login.html',
  },
};

function renderHeader() {
  const areaName = document.body.dataset.area === 'admin' ? 'admin' : 'student';
  const area = HEADER_AREAS[areaName];
  const header = document.getElementById('site-header');
  header.className = `site-header site-header--${areaName}`;

  const path = window.location.pathname;
  const links = area.links.map((link) => {
    const isActive = path === link.href || (link.alsoActiveOn || []).includes(path);
    return `<li><a href="${link.href}"${isActive ? ' aria-current="page"' : ''}>${link.label}</a></li>`;
  }).join('');

  header.innerHTML = `
    <div class="site-header__inner">
      <a class="brand" href="${area.home}">
        <img src="/img/logo.png" alt="" width="44" height="44">
        FitFuel${area.tag ? ` <span class="brand__tag">${area.tag}</span>` : ''}
      </a>
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav">
        <span class="nav-toggle__bars" aria-hidden="true"></span>Menu
      </button>
      <nav class="nav" id="site-nav" aria-label="${area.navLabel}">
        <ul>
          ${links}
          <li><button type="button" id="logout-button">Log out</button></li>
        </ul>
      </nav>
    </div>`;

  const toggle = header.querySelector('.nav-toggle');
  const nav = header.querySelector('.nav');
  const setMenuOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('nav--open', open);
  };
  toggle.addEventListener('click', () => setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  // Escape closes the open menu and puts focus back on the Menu button
  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('nav--open')) {
      setMenuOpen(false);
      toggle.focus();
    }
  });

  document.getElementById('logout-button').addEventListener('click', async () => {
    try {
      await api(area.logoutPath, { method: 'POST' });
    } finally {
      window.location.href = area.afterLogout;
    }
  });
}

renderHeader();
