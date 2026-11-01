// Recipes & Meal Planning component – Albina Rana
// Shared "This week / Next week" switch for the meal plan and shopping list pages.
// The choice is kept in the page address (?week=this or ?week=next), so links and reloads keep it.
// With no choice the server decides: next week on Sunday, this week on other days.

// 'this', 'next', or '' when the address has no (valid) choice
function weekFromAddress() {
  const week = new URLSearchParams(window.location.search).get('week');
  return week === 'this' || week === 'next' ? week : '';
}

// Query string for API calls and links: '?week=next', or '' to let the server choose
function weekQuery(week) {
  return week ? `?week=${week}` : '';
}

// Draw the switch inside container. onChange(week) runs when the student picks a week.
// Returns { select(week) } to show which week is on screen.
function setUpWeekToggle(container, onChange) {
  container.innerHTML = `
    <fieldset class="week-toggle">
      <legend class="visually-hidden">Which week</legend>
      <input type="radio" name="week" id="week-this" value="this">
      <label for="week-this">This week</label>
      <input type="radio" name="week" id="week-next" value="next">
      <label for="week-next">Next week</label>
    </fieldset>`;

  container.addEventListener('change', (event) => {
    const week = event.target.value;
    const address = new URL(window.location.href);
    address.searchParams.set('week', week);
    window.history.replaceState(null, '', address);
    onChange(week);
  });

  return {
    select(week) {
      container.querySelector(`input[value="${week}"]`).checked = true;
    },
  };
}
