const crypto = require('crypto');

// Avoids visually-ambiguous characters (0/O, 1/I/l) since this is read off
// a screen and typed in by hand for a first login.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** A random temporary password for a newly-created user account. */
function generateTempPassword(length = 14) {
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return password;
}

module.exports = { generateTempPassword };
