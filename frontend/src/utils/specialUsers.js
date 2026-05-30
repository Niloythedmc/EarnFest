/**
 * specialUsers.js
 * Central registry for privileged / special Telegram user IDs.
 *
 * Add or remove IDs here to control:
 *  - Unlimited ad watching (no hourly cap)
 *  - No auto-ads (interstitials / inApp Monetag) during rewarded ad sessions
 *  - Auto-watch panel visibility in TasksPage
 *  - Backend bypass of rate-limit and cooldown checks
 */

export const SPECIAL_USER_IDS = [
  '7716785914',
  // Add more IDs here as needed, e.g.:
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
