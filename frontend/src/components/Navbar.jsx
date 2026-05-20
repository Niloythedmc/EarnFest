import { 
  Home, 
  ClipboardList, 
  Gamepad2, 
  Trophy,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

const NAV_CONFIG = [
  { Icon: Home, labelKey: 'home', path: '/' },
  { Icon: ClipboardList, labelKey: 'tasks', path: '/tasks', isHot: true },
  { Icon: Gamepad2, labelKey: 'games', path: '/games', isNew: true },
  { Icon: Trophy, labelKey: 'rank', path: '/leaderboard' },
  { Icon: Users, labelKey: 'refer', path: '/refer' },
];

const Navbar = () => {
  const { t } = useLanguage();

  return (
    <>
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-track">
        {NAV_CONFIG.map(({ Icon, labelKey, path, isNew, isHot }) => {
          const tutorialAttr =
            path === '/tasks' ? 'tasks' :
            path === '/games' ? 'games' :
            (path === '/leaderboard' || path === '/refer') ? 'rank-refer' : null;
          return (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            data-tutorial={tutorialAttr}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            {({ isActive }) => (
              <div className="nav-item-surface">
                {isActive && (
                  <motion.div
                    className="nav-item-pill"
                    layoutId="navbar-active-pill"
                    transition={{ duration: 0 }}
                    aria-hidden
                  />
                )}
                <span className="nav-item-stack">
                  <span className="nav-item-icon-wrap" data-active={isActive} style={{ position: 'relative' }}>
                    <Icon size={24} strokeWidth={isActive ? 2.35 : 2} aria-hidden />
                    {isNew && (
                      <span style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-8px',
                        background: '#ff4b4b',
                        color: '#fff',
                        fontSize: '0.5rem',
                        fontWeight: '900',
                        padding: '1px 5px',
                        borderRadius: '8px',
                        lineHeight: '1.2',
                        letterSpacing: '0.3px',
                        boxShadow: '0 2px 6px rgba(255,75,75,0.5)',
                      }}>
                        NEW
                      </span>
                    )}
                    {isHot && (
                      <span style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '-10px',
                        fontSize: '0.8rem',
                        lineHeight: '1',
                        filter: 'drop-shadow(0 2px 6px rgba(255,60,0,0.7))',
                        animation: 'hotPulse 1.5s ease-in-out infinite',
                      }}>
                        🔥
                      </span>
                    )}
                  </span>
                  <span className="nav-item-label">{t(labelKey)}</span>
                </span>
              </div>
            )}
          </NavLink>
          );
        })}
      </div>
    </nav>
    <style>{`
      @keyframes hotPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.25); }
      }
    `}</style>
    </>
  );
};

export default Navbar;
