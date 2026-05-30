/**
 * specialUsers.js  (backend)
 * Central registry for privileged / special Telegram user IDs.
 *
 * Add or remove IDs here to control:
 *  - No hourly ad cap
 *  - No cooldown between ads
 *  - No anti-autoclicker / interstitial gates
 *  - Backend bypass of rate-limit checks
 */

export const SPECIAL_USER_IDS = [
  '7716785914',
  // Add more IDs here as needed:
  // '123456789',
];

/**
 * Returns true if the given telegramId belongs to a special/privileged user.
 * Accepts string or number.
 */
export function isSpecialUser(telegramId) {
  if (telegramId == null) return false;
  return SPECIAL_USER_IDS.includes(String(telegramId));
}
