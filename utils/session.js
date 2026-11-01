// Session helper shared by student and admin log in (Accounts component – Muin Ahmed).

// Start a fresh session (a new session ID prevents session fixation) and store values in it,
// e.g. startSession(req, { userId }) or startSession(req, { adminId })
function startSession(req, values) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      Object.assign(req.session, values);
      resolve();
    });
  });
}

// End the session and remove its cookie
function endSession(req, res) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) return reject(error);
      res.clearCookie('fitfuel.sid');
      resolve();
    });
  });
}

module.exports = { startSession, endSession };
