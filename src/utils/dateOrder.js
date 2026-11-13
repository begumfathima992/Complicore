const AppError = require('./AppError');

/** Throws a 400 AppError unless laterDate is strictly after earlierDate. Both are DATEONLY strings ('YYYY-MM-DD'), which compare correctly lexically. No-op if either is missing. */
function assertDateAfter(laterDate, earlierDate, message) {
  if (!laterDate || !earlierDate) return;
  if (laterDate <= earlierDate) {
    throw new AppError(message, 400);
  }
}

module.exports = { assertDateAfter };
