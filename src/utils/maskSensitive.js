// Roles allowed to see an unmasked passport number / visa share code.
// Deliberately narrower than RIGHT_TO_WORK's own VIEW-level access
// (Manager holds that, but must not see these two fields unmasked).
const UNMASKED_ROLES = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'];

/** Masks all but the last 4 characters, e.g. '123456789' -> '*****6789'. */
function maskValue(value) {
  if (!value) return value;
  const str = String(value);
  if (str.length <= 4) return '*'.repeat(str.length);
  return '*'.repeat(str.length - 4) + str.slice(-4);
}

function canSeeUnmasked(roleKey) {
  return UNMASKED_ROLES.includes(roleKey);
}

module.exports = { maskValue, canSeeUnmasked, UNMASKED_ROLES };
