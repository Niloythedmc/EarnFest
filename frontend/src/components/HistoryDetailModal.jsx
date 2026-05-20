import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Users, TrendingUp } from 'lucide-react';

const HistoryDetailModal = ({ isOpen, onClose, item }) => {
  if (!item) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              zIndex: 3000,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--secondary-bg)',
              borderTopLeftRadius: '32px',
              borderTopRightRadius: '32px',
              padding: '30px 20px 40px',
              zIndex: 3001,
              maxHeight: '85vh',
              overflowY: 'auto',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
            }}
          >
            {/* Handle Bar */}
            <div style={{ 
              width: '40px', 
              height: '4px', 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '2px', 
              margin: '0 auto 20px' 
            }} />

            {/* Close Button */}
            <div 
              style={{ position: 'absolute', top: '24px', right: '24px', cursor: 'pointer', opacity: 0.5 }} 
              onClick={onClose}
            >
              <X size={24} />
            </div>

            <header style={{ marginBottom: '25px', textAlign: 'center' }}>
              <h2 className="heading-lg gold-text" style={{ fontSize: '1.4rem' }}>Game Details</h2>
              <p className="text-sm-muted" style={{ fontSize: '0.8rem' }}>Game #{item.id}</p>
            </header>

            <div className="stack-vertical" style={{ gap: '25px' }}>
              {/* Winner Section */}
              <div className="detail-section">
                <div style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.5, letterSpacing: '1px', marginBottom: '12px', textTransform: 'uppercase' }}>Winner</div>
                <div 
                  className={`winner-detail-section glitter-base ${item.winner.tier && item.winner.tier !== 'free' ? `tier-card-${item.winner.tier}` : ''}`} 
                  style={{ 
                    border: (item.winner.tier && item.winner.tier !== 'free') ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    background: (item.winner.tier && item.winner.tier !== 'free') ? '' : 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px',
                    borderRadius: '24px',
                    textAlign: 'center'
                  }}
                >
                  <Trophy size={20} className="gold-text" style={{ marginBottom: '12px' }} />
                  <img src={item.winner.photoUrl || 'https://img.icons8.com/isometric/512/user-male-circle.png'} alt="" style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--primary-gold)', marginBottom: '10px' }} />
                  <span style={{ fontWeight: '800', fontSize: '1.1rem' }}>{item.winner.firstName || item.winner.username}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>@{item.winner.username}</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: '900', marginTop: '10px', color: (item.winner.tier && item.winner.tier !== 'free') ? '#fff' : '#00ff88' }}>
                    +{item.winAmount.toFixed(0)} $FEST
                  </div>
                </div>
              </div>

              {/* Participants Section */}
              <div className="detail-section">
                <div style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.5, letterSpacing: '1px', marginBottom: '12px', textTransform: 'uppercase' }}>
                  Participants ({item.players?.length || item.participantsCount})
                </div>
                {!item.players ? (
                  <div style={{ fontSize: '0.75rem', opacity: 0.4, fontStyle: 'italic', textAlign: 'center' }}>
                    Note: Detailed player list not available for very old games.
                  </div>
                ) : (
                  <div className="stack-vertical" style={{ gap: '8px' }}>
                    {item.players.sort((a,b) => b.amount - a.amount).map((p, idx) => (
                      <div key={idx} style={{ 
                        background: 'rgba(255,255,255,0.02)', 
                        padding: '12px 16px', 
                        borderRadius: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px',
                        border: p.telegramId === item.winner.telegramId ? '1px solid var(--primary-gold)' : '1px solid transparent'
                      }}>
                        <img src={p.photoUrl || 'https://img.icons8.com/isometric/512/user-male-circle.png'} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{p.firstName || p.username}</div>
                          <div style={{ fontSize: '0.65rem', color: '#00d4ff', fontWeight: '700' }}>{((p.amount / item.totalPool) * 100).toFixed(0)}% chance</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{p.amount.toFixed(0)} $FEST</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default HistoryDetailModal;
