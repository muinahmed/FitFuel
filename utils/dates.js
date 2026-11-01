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

// True for a real calendar date written as 'YYYY-MM-DD' (rejects e.g. '2026-02-30')
function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateString(parseDateString(value)) === value;
}

// Monday of the oldest week when looking back over the last `weeks` weeks (this week included)
function firstWeekStart(weeks) {
  return addDays(weekStart(), -7 * (weeks - 1));
}

// How many of the dates fall in each of the last `weeks` weeks, oldest first: [{ weekStart, count }]
function countByWeek(dateStrings, weeks) {
  const firstMonday = firstWeekStart(weeks);
  const result = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(firstMonday, 7 * i), count: 0 }));
  const weekByStart = new Map(result.map((week) => [week.weekStart, week]));
  for (const date of dateStrings) {
    const week = weekByStart.get(weekStart(parseDateString(date)));
    if (week) week.count += 1;
  }
  return result;
}

module.exports = {
  toDateString, today, daysAgo, parseDateString, addDays, weekStart, isDateString, firstWeekStart, countByWeek,
};
