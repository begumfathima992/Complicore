// Mirrors src/utils/ukValidators.js on the backend - this is just the
// client-side half (fast feedback); the server re-validates independently
// and is the actual authority.

const NI_REGEX = /^(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/;

export function normalizeNiNumber(value) {
  return (value || '').replace(/\s+/g, '').toUpperCase();
}

export function isValidNiNumber(value) {
  return NI_REGEX.test(normalizeNiNumber(value));
}

export function normalizeShareCode(value) {
  return (value || '').replace(/[\s-]+/g, '').toUpperCase();
}

export function isValidShareCode(value) {
  const normalized = normalizeShareCode(value);
  return normalized.length === 9 && /^[A-Z0-9]+$/.test(normalized);
}

export function normalizeUkPhone(value) {
  return (value || '').replace(/[\s()-]+/g, '');
}

export function isValidUkPhone(value) {
  const normalized = normalizeUkPhone(value);
  return /^(\+44\d{9,10}|0\d{9,10})$/.test(normalized);
}
