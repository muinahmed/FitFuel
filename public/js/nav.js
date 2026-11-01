// Shared site header for every logged-in page (Accounts – Muin): logo, navigation links,
// log out button, and a Menu button that shows and hides the links on small screens.
// Student pages also get a bottom tab bar on phones with the five main sections.
// Student pages: put <header id="site-header"></header> on the page.
// Admin pages: the same, plus <body data-area="admin"> to get the admin links.
// Load this script after icons.js and api.js.

const HEADER_AREAS = {
  student: {
    home: '/home.html',
    navLabel: 'Main',
    links: [
      { href: '/home.html', label: 'Home', icon: 'home' },
      { href: '/mealplan.html', label: 'Meals', icon: 'meals', alsoActiveOn: ['/recipes.html', '/favourites.html'] },
      { href: '/shopping.html', label: 'Shopping', icon: 'cart' },
      { href: '/workouts.html', label: 'Workouts', icon: 'dumbbell' },
      { href: '/progress.html', label: 'Progress', icon: 'chart' },
      { href: '/profile.html', label: 'Profile', icon: 'user', notInTabBar: true },
    ],
    logoutPath: '/auth/logout',
    afterLogout: '/index.html',
  },
  admin: {
    home: '/admin/dashboard.html',
    tag: 'Admin',
    navLabel: 'Admin',
    links: [
      { href: '/admin/dashboard.html', label: 'Dashboard', icon: 'home' },
      { href: '/admin/users.html', label: 'Users', icon: 'users' },
      { href: '/admin/recipes.html', label: 'Recipes', icon: 'book' },
      { href: '/admin/workouts.html', label: 'Workouts', icon: 'dumbbell' },
    ],
    logoutPath: '/admin/auth/logout',
    afterLogout: '/admin/login.html',
  },
};

function isActiveLink(link) {
  const path = window.location.pathname;
  return path === link.href || (link.alsoActiveOn || []).includes(path);
}

// Phone-only bar at the bottom of student pages
function renderTabBar(area) {
  const tabBar = document.createElement('nav');
  tabBar.className = 'tab-bar';
  tabBar.setAttribute('aria-label', 'Sections');
  tabBar.innerHTML = area.links.filter((link) => !link.notInTabBar).map((link) => `
    <a href="${link.href}"${isActiveLink(link) ? ' aria-current="page"' : ''}>
      ${icon(link.icon, 22)}<span>${link.label}</span>
    </a>`).join('');
  document.body.appendChild(tabBar);
  document.body.classList.add('has-tab-bar');
}

function renderHeader() {
  const areaName = document.body.dataset.area === 'admin' ? 'admin' : 'student';
  const area = HEADER_AREAS[areaName];
  const header = document.getElementById('site-header');
  header.className = `site-header site-header--${areaName}`;

  const links = area.links.map((link) => `
    <li><a href="${link.href}"${isActiveLink(link) ? ' aria-current="page"' : ''}>${icon(link.icon, 18)}${link.label}</a></li>`).join('');

  header.innerHTML = `
    <div class="site-header__inner">
      <a class="brand" href="${area.home}">
        <img src="/img/logo.png" alt="" width="44" height="44">
        <span>FitFuel</span>${area.tag ? `<span class="brand__tag">${area.tag}</span>` : ''}
      </a>
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav">
        <span class="nav-toggle__bars" aria-hidden="true"></span>Menu
      </button>
      <nav class="nav" id="site-nav" aria-label="${area.navLabel}">
        <ul>
          ${links}
          <li><button type="button" id="logout-button">${icon('logout', 18)}Log out</button></li>
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

  if (areaName === 'student') renderTabBar(area);
}

renderHeader();
