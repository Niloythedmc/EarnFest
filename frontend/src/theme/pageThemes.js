import {
  ArrowUpCircle,
  MonitorPlay,
  Gamepad2,
  ClipboardList,
  Users,
  Trophy
} from 'lucide-react';

/**
 * Quick-action card styles (Home) + matching full-page atmosphere per route.
 * Page backgrounds layer soft radial glows in the route’s palette over the app base green.
 */
export const quickActionDefinitions = [
  { Icon: ArrowUpCircle, labelKey: 'tiers', path: '/upgrade', desc: 'Boost earnings', gradient: 'linear-gradient(145deg, #6b4f0a 0%, #c9a227 42%, #f4d03f 100%)', tint: '#3d2d06' },
  { Icon: MonitorPlay, labelKey: 'watch_ads', path: '/tasks', desc: 'Earn every 30s', gradient: 'linear-gradient(145deg, #004d3d 0%, #00a878 45%, #34e0a1 100%)', tint: '#00211a' },
  { Icon: Gamepad2, labelKey: 'games', path: '/games', desc: 'Mini games', gradient: 'linear-gradient(145deg, #8b4513 0%, #e67e22 40%, #f1c40f 100%)', tint: '#4a2509' },
  { Icon: ClipboardList, labelKey: 'tasks', path: '/tasks', desc: 'Micro jobs', gradient: 'linear-gradient(145deg, #4c1d95 0%, #7c3aed 42%, #a78bfa 100%)', tint: '#2e1259' },
  { Icon: Users, labelKey: 'referral', path: '/refer', desc: 'Earn from friends', gradient: 'linear-gradient(145deg, #9a3412 0%, #ea580c 45%, #fb923c 100%)', tint: '#431407' },
  { Icon: Trophy, labelKey: 'leaderboard', path: '/leaderboard', desc: 'Top earners', gradient: 'linear-gradient(145deg, #2d3748 0%, #4b5563 45%, #9ca3af 100%)', tint: '#1f2937' },
];

const BASE_FADE = '#001f11';

const PAGE_BACKGROUNDS = {
  '/': `
    radial-gradient(ellipse 95% 52% at 50% -12%, rgba(244, 208, 63, 0.14), transparent 52%),
    radial-gradient(ellipse 75% 45% at 100% 100%, rgba(52, 211, 153, 0.09), transparent 48%),
    radial-gradient(ellipse 55% 40% at 0% 85%, rgba(124, 58, 237, 0.06), transparent 45%),
    linear-gradient(180deg, #03150e 0%, ${BASE_FADE} 48%, #001208 100%)
  `,
  '/upgrade': `
    radial-gradient(ellipse 100% 58% at 50% -8%, rgba(244, 208, 63, 0.26), transparent 52%),
    radial-gradient(ellipse 60% 42% at 0% 100%, rgba(107, 79, 10, 0.32), transparent 52%),
    linear-gradient(180deg, #0f1408 0%, ${BASE_FADE} 52%, #050f0a 100%)
  `,
  '/games': `
    radial-gradient(ellipse 100% 58% at 50% -8%, rgba(241, 196, 15, 0.2), transparent 52%),
    radial-gradient(ellipse 65% 50% at 100% 90%, rgba(230, 126, 34, 0.28), transparent 50%),
    linear-gradient(180deg, #120f06 0%, ${BASE_FADE} 52%, #0a0804 100%)
  `,
  '/spin': `
    radial-gradient(ellipse 100% 58% at 50% -8%, rgba(241, 196, 15, 0.2), transparent 52%),
    radial-gradient(ellipse 65% 50% at 100% 90%, rgba(230, 126, 34, 0.28), transparent 50%),
    linear-gradient(180deg, #120f06 0%, ${BASE_FADE} 52%, #0a0804 100%)
  `,
  '/tasks': `
    radial-gradient(ellipse 100% 58% at 50% -10%, rgba(167, 139, 250, 0.22), transparent 54%),
    radial-gradient(ellipse 58% 48% at 0% 100%, rgba(76, 29, 149, 0.35), transparent 52%),
    linear-gradient(180deg, #0d0820 0%, ${BASE_FADE} 50%, #060510 100%)
  `,
  '/refer': `
    radial-gradient(ellipse 100% 58% at 50% -8%, rgba(251, 146, 60, 0.24), transparent 54%),
    radial-gradient(ellipse 58% 45% at 100% 100%, rgba(234, 88, 12, 0.3), transparent 50%),
    linear-gradient(180deg, #140902 0%, ${BASE_FADE} 52%, #0c0504 100%)
  `,
  '/leaderboard': `
    radial-gradient(ellipse 90% 52% at 50% -12%, rgba(147, 197, 253, 0.16), transparent 54%),
    radial-gradient(ellipse 75% 38% at 100% 90%, rgba(148, 163, 184, 0.18), transparent 48%),
    linear-gradient(180deg, #08101a 0%, ${BASE_FADE} 52%, #05090f 100%)
  `,
  '/slots': `
    radial-gradient(ellipse 100% 60% at 50% -10%, rgba(129, 140, 248, 0.22), transparent 54%),
    radial-gradient(ellipse 65% 45% at 100% 95%, rgba(168, 85, 247, 0.28), transparent 48%),
    linear-gradient(180deg, #09061b 0%, ${BASE_FADE} 52%, #06020f 100%)
  `,
  '/pvp': `
    radial-gradient(ellipse 90% 50% at 50% -12%, rgba(52, 211, 153, 0.17), transparent 55%),
    radial-gradient(ellipse 80% 40% at 100% 90%, rgba(14, 165, 233, 0.14), transparent 52%),
    linear-gradient(180deg, #061217 0%, ${BASE_FADE} 52%, #04080c 100%)
  `,
  '/withdraw': `
    radial-gradient(ellipse 90% 50% at 50% -8%, rgba(16, 185, 129, 0.2), transparent 52%),
    radial-gradient(ellipse 55% 40% at 100% 95%, rgba(212, 175, 55, 0.16), transparent 48%),
    linear-gradient(180deg, #04120e 0%, ${BASE_FADE} 100%)
  `,
  '/admin': `
    radial-gradient(ellipse 85% 48% at 50% -6%, rgba(248, 113, 113, 0.16), transparent 52%),
    radial-gradient(ellipse 50% 38% at 90% 90%, rgba(127, 29, 29, 0.28), transparent 50%),
    linear-gradient(180deg, #0f0606 0%, ${BASE_FADE} 55%, #060808 100%)
  `,

  '/mines': `
    radial-gradient(ellipse 100% 58% at 50% -10%, rgba(248, 113, 113, 0.12), transparent 54%),
    radial-gradient(ellipse 58% 48% at 0% 100%, rgba(31, 31, 31, 0.4), transparent 52%),
    linear-gradient(180deg, #1a1a1a 0%, ${BASE_FADE} 50%, #000000 100%)
  `,
};

const PAGE_CONTENT = {
  '/': {
    accent: '#e8c547',
    accentBright: '#fde68a',
    accentSoft: 'rgba(232, 197, 71, 0.14)',
    accentBorder: 'rgba(232, 197, 71, 0.38)',
    accentGlow: 'rgba(253, 224, 71, 0.32)',
  },
  '/upgrade': {
    accent: '#f4d03f',
    accentBright: '#fcd34d',
    accentSoft: 'rgba(244, 208, 63, 0.16)',
    accentBorder: 'rgba(244, 208, 63, 0.42)',
    accentGlow: 'rgba(252, 211, 77, 0.38)',
  },
  '/games': {
    accent: '#fbbf24',
    accentBright: '#fcd34d',
    accentSoft: 'rgba(251, 191, 36, 0.16)',
    accentBorder: 'rgba(230, 126, 34, 0.42)',
    accentGlow: 'rgba(241, 196, 15, 0.36)',
  },
  '/spin': {
    accent: '#fbbf24',
    accentBright: '#fcd34d',
    accentSoft: 'rgba(251, 191, 36, 0.16)',
    accentBorder: 'rgba(230, 126, 34, 0.42)',
    accentGlow: 'rgba(241, 196, 15, 0.36)',
  },
  '/tasks': {
    accent: '#a78bfa',
    accentBright: '#c4b5fd',
    accentSoft: 'rgba(167, 139, 250, 0.16)',
    accentBorder: 'rgba(124, 58, 237, 0.42)',
    accentGlow: 'rgba(196, 181, 253, 0.34)',
  },
  '/refer': {
    accent: '#fb923c',
    accentBright: '#fdba74',
    accentSoft: 'rgba(251, 146, 60, 0.16)',
    accentBorder: 'rgba(234, 88, 12, 0.42)',
    accentGlow: 'rgba(253, 186, 116, 0.36)',
  },
  '/leaderboard': {
    accent: '#93c5fd',
    accentBright: '#bfdbfe',
    accentSoft: 'rgba(147, 197, 253, 0.16)',
    accentBorder: 'rgba(148, 163, 184, 0.42)',
    accentGlow: 'rgba(191, 219, 254, 0.32)',
  },
  '/slots': {
    accent: '#8b5cf6',
    accentBright: '#a78bfa',
    accentSoft: 'rgba(139, 92, 246, 0.16)',
    accentBorder: 'rgba(168, 85, 247, 0.42)',
    accentGlow: 'rgba(168, 85, 247, 0.34)',
  },
  '/pvp': {
    accent: '#22d3ee',
    accentBright: '#67e8f9',
    accentSoft: 'rgba(34, 211, 238, 0.16)',
    accentBorder: 'rgba(14, 165, 233, 0.42)',
    accentGlow: 'rgba(34, 211, 238, 0.3)',
  },
  '/withdraw': {
    accent: '#34d399',
    accentBright: '#d4af37',
    accentSoft: 'rgba(52, 211, 153, 0.14)',
    accentBorder: 'rgba(212, 175, 55, 0.38)',
    accentGlow: 'rgba(52, 211, 153, 0.3)',
  },
  '/admin': {
    accent: '#f87171',
    accentBright: '#fca5a5',
    accentSoft: 'rgba(248, 113, 113, 0.14)',
    accentBorder: 'rgba(220, 38, 38, 0.38)',
    accentGlow: 'rgba(252, 165, 165, 0.28)',
  },

  '/mines': {
    accent: '#ff4b2b',
    accentBright: '#ff416c',
    accentSoft: 'rgba(255, 75, 43, 0.14)',
    accentBorder: 'rgba(255, 75, 43, 0.38)',
    accentGlow: 'rgba(255, 75, 43, 0.3)',
  },
};

export function getPageTheme(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  const rawBg = PAGE_BACKGROUNDS[path] || PAGE_BACKGROUNDS['/'];
  const content = PAGE_CONTENT[path] || PAGE_CONTENT['/'];
  return {
    background: rawBg.replace(/\s+/g, ' ').trim(),
    cssVars: {
      '--page-accent': content.accent,
      '--page-accent-bright': content.accentBright,
      '--page-accent-soft': content.accentSoft,
      '--page-accent-border': content.accentBorder,
      '--page-accent-glow': content.accentGlow,
      '--primary-gold': content.accent,
      '--accent-gold': content.accentBright,
    },
    content,
  };
}

/** @deprecated Use getPageTheme().background */
export function getPageBackground(pathname) {
  return getPageTheme(pathname).background;
}
