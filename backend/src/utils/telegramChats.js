import { checkChatMember } from './bot.js';

/**
 * Public t.me link → username (no @). Null for invite links, bots, invalid URLs.
 * Supports https://t.me/username, https://t.me/username/123
 */
export function parsePublicUsernameFromTelegramLink(link) {
  if (!link || typeof link !== 'string') return null;
  const trimmed = link.trim();
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host !== 't.me' && host !== 'telegram.me') return null;
    const seg = u.pathname.split('/').filter(Boolean)[0];
    if (!seg) return null;
    const lower = seg.toLowerCase();
    if (lower === 'joinchat' || lower === '+' || seg.startsWith('+')) return null;
    if (lower.includes('bot') && lower.endsWith('bot')) return null;
    return seg.split('?')[0];
  } catch {
    return null;
  }
}

/**
 * Parses AD_REWARD_REQUIRED_CHATS env:
 *   EarnFest|Earn Fest,EarnFestChat|Earn Fest Community
 * Defaults to @EarnFest and @EarnFestChat with display titles.
 */
export function getRequiredChatsForAdReward() {
  const raw = process.env.AD_REWARD_REQUIRED_CHATS;
  if (raw && raw.trim()) {
    return raw.split(',').map((pair) => {
      const [username, title] = pair.split('|').map((s) => s.trim());
      return {
        username: username.replace(/^@/, ''),
        title: title || username.replace(/^@/, ''),
      };
    });
  }
  return [
    { username: 'EarnFest', title: 'Earn Fest' },
    { username: 'EarnFestChat', title: 'Earn Fest Community' },
  ];
}

/**
 * Returns { ok: true } or { ok: false, missing: [{ title, username }] }
 */
export async function checkAdRewardMembership(userId) {
  const chats = getRequiredChatsForAdReward();
  const missing = [];
  for (const c of chats) {
    const ok = await checkChatMember(userId, c.username);
    if (!ok) missing.push({ title: c.title, username: c.username });
  }
  if (missing.length) return { ok: false, missing };
  return { ok: true };
}
