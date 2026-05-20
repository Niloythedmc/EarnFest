import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, ExternalLink, ShieldCheck, Timer, Users, Info, Loader2 } from 'lucide-react';
import { Button, Card, Badge, GameButton, GameCard } from './UI';
import { toast } from 'sonner';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { AdsClient } from '../utils/AdsClient';
import { formatRewardAmount } from '../utils/formatters';

const PromoModal = ({ promo, onClose }) => {
  const { setUser } = useUser();
  const { apiBase } = useConfig();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);

  if (!promo) return null;

  const handleClaim = async () => {
    setLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/promocodes/claim`, {
        promoId: promo.id
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        setClaimed(true);
        setUser(prev => ({
          ...prev,
          balance: prev.balance + Number(response.data.reward)
        }));
        toast.success('Rewards claimed successfully!');
        AdsClient.showInterstitial(); // Combined Adsgram + RichAds
        setTimeout(() => onClose(), 2000);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Claim failed. Please make sure you completed the task.');
    } finally {
      setLoading(false);
    }
  };

  const themeColor = promo.themeColor || '#d4af37';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div 
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      />
      
      <div 
        style={{ 
          width: '100%', maxWidth: '360px', background: '#0a0a0a', 
          borderRadius: '28px', border: `1px solid ${themeColor}66`,
          overflow: 'hidden', position: 'relative', zIndex: 1,
          boxShadow: 'none'
        }}
      >
        {/* Header/Banner */}
        <div style={{ padding: '30px 24px', background: `linear-gradient(135deg, ${themeColor}22, transparent)`, textAlign: 'center', position: 'relative' }}>
          <div 
            onClick={onClose}
            style={{ position: 'absolute', top: '15px', right: '15px', padding: '8px', cursor: 'pointer', opacity: 0.5 }}
          >
            <X size={20} />
          </div>
          
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '20px', 
            background: themeColor, margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none'
          }}>
            <Gift size={32} color="#000" />
          </div>
          
          <h2 className="font-gaming" style={{ color: 'white', marginBottom: '4px', fontSize: '1.4rem' }}>{promo.title}</h2>
          <div className="flex-center" style={{ gap: '8px' }}>
             <Badge style={{ background: `${themeColor}22`, color: themeColor, border: `1px solid ${themeColor}44` }}>
               {promo.available} Left
             </Badge>
             <span className="text-sm-muted" style={{ fontSize: '0.75rem' }}>Limited Edition</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px 30px' }}>
          <p className="text-sm-muted" style={{ textAlign: 'center', marginBottom: '24px', fontSize: '0.85rem', lineHeight: '1.5' }}>
            {promo.description}
          </p>

          <Card style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
            <div className="flex-row-between" style={{ marginBottom: '12px' }}>
              <div className="flex-center" style={{ gap: '10px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>Reward Amount</span>
              </div>
              <span className="gold-text" style={{ fontWeight: '900', fontSize: '1.1rem' }}>+{formatRewardAmount(promo.reward)} $FEST</span>
            </div>

            {promo.task && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <div className="flex-row-between" style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.6 }}>Requirement</span>
                  <Badge style={{ fontSize: '0.6rem' }}>{promo.task.type.toUpperCase()}</Badge>
                </div>
                <div className="flex-row-between">
                   <p style={{ fontSize: '0.8rem', fontWeight: '800' }}>{promo.task.title}</p>
                   {promo.task.link && (
                     <a 
                       href={promo.task.link} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       style={{ color: themeColor, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: '700' }}
                     >
                       Join <ExternalLink size={12} />
                     </a>
                   )}
                </div>
              </div>
            )}
          </Card>

          {claimed ? (
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ textAlign: 'center', color: 'var(--success)' }}>
               <ShieldCheck size={40} style={{ margin: '0 auto 10px' }} />
               <p style={{ fontWeight: '800' }}>Rewards Claimed Successfully!</p>
            </motion.div>
          ) : (
            <GameButton 
               onClick={handleClaim}
               loading={loading}
               color={themeColor}
            >
              Claim Rewards Now
            </GameButton>
          )}
          
          <div className="flex-center" style={{ marginTop: '16px', gap: '6px', opacity: 0.5 }}>
             <Info size={12} />
             <span style={{ fontSize: '0.65rem' }}>Verification might take a few seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoModal;
