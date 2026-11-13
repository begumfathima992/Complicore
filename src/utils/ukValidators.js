// UK National Insurance number: 2 prefix letters (excluding a handful of
// reserved combinations), 6 digits, 1 suffix letter A-D. e.g. AB123456C.
const NI_REGEX = /^(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/;

function normalizeNiNumber(value) {
  return (value || '').replace(/\s+/g, '').toUpperCase();
}

function isValidNiNumber(value) {
  return NI_REGEX.test(normalizeNiNumber(value));
}

/** eVisa/right-to-work share code: 9 characters, letters and numbers only. */
function normalizeShareCode(value) {
  return (value || '').replace(/[\s-]+/g, '').toUpperCase();
}

function isValidShareCode(value) {
  const normalized = normalizeShareCode(value);
  return normalized.length === 9 && /^[A-Z0-9]+$/.test(normalized);
}

/** UK phone: a 0-prefixed or +44-prefixed mobile/landline number. */
function normalizeUkPhone(value) {
  return (value || '').replace(/[\s()-]+/g, '');
}

function isValidUkPhone(value) {
  const normalized = normalizeUkPhone(value);
  return /^(\+44\d{9,10}|0\d{9,10})$/.test(normalized);
}

module.exports = {
  normalizeNiNumber,
  isValidNiNumber,
  normalizeShareCode,
  isValidShareCode,
  normalizeUkPhone,
  isValidUkPhone,
};
