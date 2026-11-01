// Shared header for logged-in student pages: logo, navigation links and log out button.
// Put <header id="site-header"></header> on the page and load this script after api.js.

const NAV_LINKS = [
  { href: '/home.html', label: 'Home' },
  { href: '/mealplan.html', label: 'Meals', alsoActiveOn: ['/recipes.html'] },
  { href: '/shopping.html', label: 'Shopping' },
  { href: '/workouts.html', label: 'Workouts' },
  { href: '/progress.html', label: 'Progress' },
  { href: '/profile.html', label: 'Profile' },
];

function renderHeader() {
  const header = document.getElementById('site-header');
  header.className = 'site-header';

  const links = NAV_LINKS.map((link) => {
    const path = window.location.pathname;
    const isActive = path === link.href || (link.alsoActiveOn || []).includes(path);
    const current = isActive ? ' aria-current="page"' : '';
    return `<li><a href="${link.href}"${current}>${link.label}</a></li>`;
  }).join('');

  header.innerHTML = `
    <div class="site-header__inner">
      <a class="brand" href="/home.html">
        <img src="/img/logo.png" alt="" width="44" height="44">
        FitFuel
      </a>
      <nav class="nav" aria-label="Main">
        <ul>
          ${links}
          <li><button type="button" id="logout-button">Log out</button></li>
        </ul>
      </nav>
    </div>`;

  document.getElementById('logout-button').addEventListener('click', logOut);
}

async function logOut() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/index.html';
  }
}

renderHeader();
