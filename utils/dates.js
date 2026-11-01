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

module.exports = { toDateString, today, daysAgo };
