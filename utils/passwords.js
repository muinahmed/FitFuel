// Password helpers shared by student and admin accounts (Accounts component – Muin Ahmed).
const bcrypt = require('bcrypt');

const BCRYPT_COST = 10;

// Compared against when there is no account, so a wrong username takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

// For the seed script
function hashPasswordSync(password) {
  return bcrypt.hashSync(password, BCRYPT_COST);
}

// True only if there is a stored hash and the password matches it
async function passwordMatches(password, storedHash) {
  const matches = await bcrypt.compare(password, storedHash || DUMMY_HASH);
  return matches && Boolean(storedHash);
}

module.exports = { hashPassword, hashPasswordSync, passwordMatches };
