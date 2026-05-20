import { memo } from 'react';
import { motion } from 'framer-motion';

export const Card = memo(({ children, className = '', style = {}, onClick }) => (
  <div 
    className={`glass-card ${className}`}
    style={{ ...style }}
    onClick={onClick}
  >
    {children}
  </div>

));

export const Button = memo(({ children, onClick, className = '', style = {}, disabled, loading, type = 'button' }) => (
  <button
    onClick={(e) => {
      if (onClick) onClick(e);
    }}
    disabled={disabled || loading}
    type={type}
    className={`btn-primary ${className}`}
    style={{ ...style, cursor: (disabled || loading) ? 'not-allowed' : 'pointer' }}
  >
    {loading ? '...' : children}
  </button>
));

export const GameButton = memo(({ children, onClick, className = '', style = {}, disabled, loading, color = 'var(--primary-gold)', padding = '16px 32px', borderRadius = '16px', fontSize = '1.2rem', fontWeight = 'normal' }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`game-btn-container ${className}`}
      style={{
        ...style,
        "--btn-bg": color,
        position: 'relative',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        width: '100%',
      }}
    >
      <div className="game-btn-shadow" style={{ borderRadius }} />
      <div className="game-btn-edge" style={{ borderRadius }} />
      <div className="game-btn-front" style={{ fontSize, fontWeight, borderRadius, height: style.height || '56px' }}>
        {loading ? <div className="loader-mini" /> : children}
      </div>
    </motion.button>
  );
});

export const GameCard = memo(({ children, className = '', style = {}, onClick, title, innerPadding = '24px' }) => (
  <div 
    className={`premium-glitter-card glass-card ${className}`}
    style={{ ...style, borderRadius: '24px', padding: '2px' }}
    onClick={onClick}
  >
    <div style={{ 
      background: 'rgba(0,0,0,0.6)', 
      borderRadius: '22px', 
      padding: innerPadding,
      height: '100%',
      border: '1px solid rgba(255,255,255,0.15)',
      backdropFilter: 'blur(20px)'
    }}>
      {title && <h3 className="game-title" style={{ fontSize: '1.4rem', marginBottom: '15px', textAlign: 'left' }}>{title}</h3>}
      {children}
    </div>
  </div>

));

export const Badge = memo(({ children, className = '', variant = 'gold' }) => (
  <span className={`badge-gold ${variant !== 'gold' ? 'badge-' + variant : ''} ${className}`}>
    {children}
  </span>
));

export const Stack = memo(({ children, gap = 16, className = '', style = {} }) => (
  <div className={`stack-vertical ${className}`} style={{ gap: `${gap}px`, ...style }}>
    {children}
  </div>
));
