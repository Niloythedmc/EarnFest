import { motion, AnimatePresence } from 'framer-motion';
import { X, Megaphone, Users } from 'lucide-react';
import { Button } from './UI';
import { useLanguage } from '../context/LanguageContext';

const DEFAULT_CHATS = [
  { title: 'Earn Fest', username: 'EarnFest' },
  { title: 'Earn Fest Community', username: 'EarnFestChat' },
];

function openTelegramChat(username) {
  const u = String(username).replace(/^@/, '');
  const url = `https://t.me/${u}`;
  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Shown when ad reward is blocked until user joins required channel + community.
 */
export default function JoinMembershipModal({ open, onClose, missing }) {
  const { t } = useLanguage();
  const rows = missing?.length ? missing : DEFAULT_CHATS;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 9000,
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(380px, 100%)',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--secondary-bg)',
              borderRadius: '24px',
              border: '1px solid var(--glass-border)',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={22} />
            </button>

            <h3 className="heading-lg" style={{ fontSize: '1.15rem', marginBottom: '12px', paddingRight: '32px' }}>
              {t('join_modal_title')}
            </h3>
            <p className="text-sm-muted" style={{ fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '20px' }}>
              {t('join_modal_body')}
            </p>

            <div className="stack-vertical" style={{ gap: '10px' }}>
              {rows.map((row) => (
                <button
                  key={row.username}
                  type="button"
                  onClick={() => openTelegramChat(row.username)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: '16px',
                    border: '1px solid var(--page-accent-border, var(--glass-border))',
                    background: 'var(--page-tint-card, rgba(255,255,255,0.04))',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <span style={{ color: 'var(--primary-gold)', display: 'flex' }}>
                    {row.title.toLowerCase().includes('community') ? <Users size={22} /> : <Megaphone size={22} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem' }}>{row.title}</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.85, marginTop: '2px' }}>
                      @{String(row.username).replace(/^@/, '')}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <Button style={{ marginTop: '20px', width: '100%', height: '48px' }} onClick={onClose}>
              {t('join_modal_understood')}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
