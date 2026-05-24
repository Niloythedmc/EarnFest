import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Home, ClipboardList, Gamepad2, Trophy, Users, Settings, Globe,
  CheckSquare, Gift, Link as LinkIcon, TrendingUp, BarChart2, Handshake, MessageSquare, LayoutList,
  ArrowLeft
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useUser } from '../context/UserContext';
import { formatBalance } from '../utils/formatters';

const MAIN_NAV = [
  { Icon: Home, labelKey: 'home', path: '/' },
  { Icon: ClipboardList, labelKey: 'tasks', path: '/tasks', isHot: true },
  { Icon: Gamepad2, labelKey: 'games', path: '/games', isNew: true },
  { Icon: Trophy, labelKey: 'rank', path: '/leaderboard' },
  { Icon: Users, labelKey: 'refer', path: '/refer' },
];

const ADMIN_TABS = [
  { id: 'platform', Icon: Settings, label: 'Platform' },
  { id: 'tasks', Icon: CheckSquare, label: 'Tasks' },
  { id: 'apiGenerator', Icon: Globe, label: 'API Gen' },
  { id: 'promos', Icon: Gift, label: 'Promos' },
  { id: 'referralLinks', Icon: LinkIcon, label: 'Referral Links' },
  { id: 'leaderboard', Icon: TrendingUp, label: 'Leaderboard' },
  { id: 'contests', Icon: Trophy, label: 'Contests' },
  { id: 'plans', Icon: LayoutList, label: 'Plans' },
  { id: 'stats', Icon: BarChart2, label: 'Stats' },
  { id: 'partners', Icon: Handshake, label: 'Partners' },
  { id: 'bot', Icon: MessageSquare, label: 'Bot Msg' },
];

const Sidebar = ({ width, setWidth, isAdmin }) => {
  const { t } = useLanguage();
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isResizing = useRef(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(450, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('sidebarWidth', width.toString());
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [width, setWidth]);

  const handleTouchStart = () => {
    isResizing.current = true;
  };

  useEffect(() => {
    const handleTouchMove = (e) => {
      if (!isResizing.current) return;
      const touch = e.touches[0];
      const newWidth = Math.max(200, Math.min(450, touch.clientX));
      setWidth(newWidth);
    };

    const handleTouchEnd = () => {
      if (isResizing.current) {
        isResizing.current = false;
        localStorage.setItem('sidebarWidth', width.toString());
      }
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [width, setWidth]);

  const activeAdminTab = searchParams.get('tab') || 'platform';
  const isAdminPath = location.pathname === '/admin';

  return (
    <div 
      className="sidebar-container" 
      style={{ 
        width: `${width}px`, 
        minWidth: `${width}px`,
        position: 'relative',
        height: '100vh',
        background: 'rgba(0, 12, 8, 0.95)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 16px',
        zIndex: 900
      }}
    >
      <div>
        {/* Header / Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
          <span style={{ fontSize: '1.8rem' }}>🎡</span>
          <span className="game-title gold-text" style={{ fontSize: '1.5rem', letterSpacing: '0.5px' }}>
            Earn Fest
          </span>
        </div>

        {/* Navigation list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isAdminPath ? (
            <>
              {/* Back to App Link */}
              <NavLink
                to="/"
                className="sidebar-item"
                style={{ marginBottom: '16px', background: 'rgba(255, 215, 0, 0.05)', border: '1px dashed rgba(255, 215, 0, 0.2)' }}
              >
                <ArrowLeft size={20} className="gold-text" />
                <span className="gold-text">Back to App</span>
              </NavLink>

              {/* Admin Panel Tabs as Sidebar Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
                {ADMIN_TABS.map(({ id, Icon, label }) => {
                  const isOn = activeAdminTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSearchParams({ tab: id })}
                      className={`sidebar-item${isOn ? ' sidebar-item--active' : ''}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <Icon size={20} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Main Navigation links */}
              {MAIN_NAV.map(({ Icon, labelKey, path, isNew, isHot }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) => `sidebar-item${isActive ? ' sidebar-item--active' : ''}`}
                >
                  <Icon size={20} />
                  <span>{t(labelKey)}</span>
                  {isNew && <span className="sidebar-badge-new">NEW</span>}
                  {isHot && <span className="sidebar-badge-hot">🔥</span>}
                </NavLink>
              ))}

              {/* Admin Panel Link */}
              {isAdmin && (
                <NavLink
                  to="/admin?tab=platform"
                  className={() => `sidebar-item${location.pathname === '/admin' ? ' sidebar-item--active' : ''}`}
                >
                  <Settings size={20} />
                  <span>Admin Panel</span>
                </NavLink>
              )}
            </>
          )}
        </div>
      </div>

      {/* User profile / footer card - only shown when not on Admin view */}
      {user && !isAdminPath && (
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/profile')}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden', border: '1px solid var(--primary-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span className="gold-text" style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                {(user.firstName || user.username || 'U')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '800', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.firstName || user.username || 'User'}
            </div>
            <div className="gold-text" style={{ fontSize: '0.75rem', fontWeight: '900' }}>
              {formatBalance(user.balance)} $FEST
            </div>
          </div>
        </div>
      )}

      {/* Draggable resize handle */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '6px',
          height: '100%',
          cursor: 'col-resize',
          zIndex: 1000,
          transition: 'background 0.2s',
        }}
        className="sidebar-resize-handle"
      />
    </div>
  );
};

export default Sidebar;
