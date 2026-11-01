// Input validation helpers shared by all components.
// Each check returns an error message, or null when the value is fine.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything longer

// Trim a value if it is a string, otherwise return an empty string
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function checkFullName(fullName) {
  if (!fullName) return 'Please enter your full name.';
  if (fullName.length > 50) return 'Full name must be 50 characters or fewer.';
  return null;
}

function checkEmail(email) {
  if (!email) return 'Please enter your email address.';
  if (email.length > 100 || !EMAIL_PATTERN.test(email)) return 'Please enter a valid email address.';
  return null;
}

function checkNewPassword(password, confirmPassword) {
  if (typeof password !== 'string' || !password) return 'Please enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) return 'Password is too long (maximum 72 characters).';
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

// Money amount stored as DECIMAL(6,2): positive and at most 9999.99. Label example: 'Weekly budget'
function checkPositiveAmount(amount, label) {
  if (amount === '' || amount === null || amount === undefined) return `${label} is required.`;
  const number = Number(amount);
  if (typeof amount === 'boolean' || !Number.isFinite(number) || number <= 0) return `${label} must be a positive number.`;
  if (number > 9999.99) return `${label} must be 9999.99 kr or less.`;
  return null;
}

module.exports = { cleanText, checkFullName, checkEmail, checkNewPassword, checkPositiveAmount };
