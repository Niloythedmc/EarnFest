import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Globe, ArrowUpRight, Wallet } from 'lucide-react';

const OPTIONS = [
  { label: 'Profile', icon: <User size={18} />, action: 'profile' },
  { label: 'Language', icon: <Globe size={18} />, action: 'language' },
  { label: 'Upgrade', icon: <ArrowUpRight size={18} />, action: 'upgrade', tutorial: 'upgrade' },
  { label: 'Wallet', icon: <Wallet size={18} />, action: 'wallet', tutorial: 'wallet' },
];

const ProfileDropdown = ({ onClose, onLanguageOpen }) => {
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAction = (action) => {
    onClose();
    switch (action) {
      case 'profile': navigate('/profile'); break;
      case 'language': onLanguageOpen(); break;
      case 'upgrade': navigate('/upgrade'); break;
      case 'wallet': navigate('/withdraw'); break;
      default: break;
    }
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '62px',
        left: '0',
        width: '200px',
        background: 'rgba(10, 20, 15, 0.96)',
        border: '1px solid rgba(255, 215, 0, 0.2)',
        borderRadius: '16px',
        padding: '8px',
        zIndex: 100,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      {OPTIONS.map((opt) => (
        <div
        key={opt.action}
        data-tutorial={opt.tutorial || null}
        onClick={() => handleAction(opt.action)}
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '12px',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '0.85rem',
            fontWeight: '600',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ opacity: 0.7 }}>{opt.icon}</span>
          <span>{opt.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ProfileDropdown;