// Date helpers shared by all components.
// Dates are stored as 'YYYY-MM-DD' strings in the server's local time zone.

// Turn a Date into 'YYYY-MM-DD' using local time (not UTC)
function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Today's date as 'YYYY-MM-DD'
function today() {
  return toDateString(new Date());
}

// The date a number of days before today, as 'YYYY-MM-DD'
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateString(date);
}

// 'YYYY-MM-DD' -> Date at local midnight
function parseDateString(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Add (or subtract) days to a 'YYYY-MM-DD' string
function addDays(dateString, days) {
  const date = parseDateString(dateString);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

// Monday of the week that contains the given date, as 'YYYY-MM-DD'
function weekStart(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7; // getDay(): Sunday = 0
  monday.setDate(monday.getDate() - daysSinceMonday);
  return toDateString(monday);
}

module.exports = { toDateString, today, daysAgo, addDays, weekStart };
