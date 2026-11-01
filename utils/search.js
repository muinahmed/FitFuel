// Search helper shared by all components.

// LIKE pattern that finds text anywhere in a value, ignoring letter case.
// Wildcards typed by the user are escaped, so "50%" matches literally.
// Use with: LOWER(column) LIKE ? ESCAPE '\'
function containsPattern(text) {
  const escaped = text.trim().toLowerCase().replace(/[\\%_]/g, (character) => '\\' + character);
  return `%${escaped}%`;
}

module.exports = { containsPattern };
