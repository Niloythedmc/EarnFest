import { Card, Button, Badge, Stack, GameButton, GameCard } from '../components/UI';
import { toast } from 'sonner';
import { 
  Copy, 
  Users, 
  Gift, 
  Share2, 
  Sparkles, 
  PartyPopper, 
  Shield, 
  Zap, 
  Trophy,
  Diamond 
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { motion } from 'framer-motion';

import { AdsClient } from '../utils/AdsClient';
import { formatBalance } from '../utils/formatters';


const ReferralPage = () => {
  const { user } = useUser();
  const { t } = useLanguage();
  const referralLink = `https://t.me/EarnFestBot/Earn?startapp=${user?.telegramId || 'USERID'}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
    AdsClient.showInterstitial();
  };

  const inviteFriends = () => {
    const tg = window.Telegram?.WebApp;
    // Use Telegram's native share — opens the forward/share sheet with a pre-filled message
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🎉 Join EarnFest & earn real rewards watching videos, spinning the wheel and completing tasks! Use my invite link:')}` ;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const commissions = [
    { tier: 'Cash Fest', reward: '2000 $FEST', bonus: '1.2x Boost', color: '#e67e22', icon: <Shield size={18} /> },
    { tier: 'Reward Fest', reward: '4000 $FEST', bonus: '1.5x Boost', color: '#f1c40f', icon: <Zap size={18} /> },
    { tier: 'Bonus Fest', reward: '8000 $FEST', bonus: '2x Boost', color: '#bdc3c7', icon: <Sparkles size={18} /> },
    { tier: 'Profit Fest', reward: '20000 $FEST', bonus: 'VIP Perks', color: '#3498db', icon: <Diamond size={18} /> },
  ];

  return (
    <div className="main-content stack-vertical">
      <header style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2.5rem' }}>
          <Users size={32} className="gold-text" /> {t('network_growth')}
        </h1>
        <p className="text-sm-muted font-gaming" style={{ fontSize: '0.75rem', marginTop: '4px' }}>EXPAND YOUR NETWORK • EARN $FEST</p>
      </header>

      <GameCard innerPadding="24px" className="glitter-border">
        <div className="stack-vertical" style={{ alignItems: 'center', gap: '20px' }}>
          <div style={{ position: 'relative' }}>
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 4 }}
              style={{ 
                width: '70px', height: '70px', borderRadius: '20px', background: 'var(--primary-gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'none',
                transform: 'rotate(-5deg)'
              }}
            >
               <Share2 color="var(--primary-deep)" size={32} />
            </motion.div>
            <div className="badge-gold font-gaming" style={{ 
              position: 'absolute', bottom: '-28px', left: '50%', transform: 'translateX(-50%)',
              fontSize: '0.6rem', padding: '4px 12px', whiteSpace: 'nowrap',
              zIndex: 5, boxShadow: 'none'
            }}>
              YOUR UNIQUE LINK
            </div>
          </div>

          <div className="stack-vertical" style={{ width: '100%', gap: '15px', marginTop: '10px' }}>
            <div className="input-container glitter-border" style={{ background: 'rgba(0,0,0,0.3)', padding: '12px 16px' }}>
              <input readOnly value={referralLink} className="font-gaming" style={{ color: 'var(--primary-gold)', fontWeight: 'bold', fontSize: '0.85rem' }} />
              <motion.div 
                whileTap={{ scale: 0.8 }} 
                onClick={copyToClipboard} 
                style={{ cursor: 'pointer', color: 'var(--primary-gold)', padding: '5px' }}
              >
                <Copy size={20} />
              </motion.div>
            </div>
            
            <GameButton onClick={inviteFriends} padding="10px 20px" fontSize="1.1rem" fontWeight="bold">
              INVITE VIA TELEGRAM
            </GameButton>
          </div>
        </div>
      </GameCard>
      
      <div style={{ textAlign: 'center', padding: '10px', marginTop: '-5px' }}>
        <div className="badge-gold" style={{ display: 'inline-block', marginBottom: '10px', fontSize: '0.7rem' }}>ACTIVE BONUS</div>
        <p className="game-title gold-text" style={{ fontSize: '1.4rem', marginBottom: '4px', textShadow: 'none' }}>
          Earn 40 $FEST per Invite
        </p>
        <p className="text-sm-muted" style={{ fontSize: '0.7rem', lineHeight: '1.4', opacity: 0.8 }}>
          Friends must join our channels and view at least 1 ad to count as a valid referral.
        </p>
      </div>


      <div className="grid-cols-2" style={{ gap: '12px' }}>
        <Card style={{ 
          textAlign: 'center', padding: '16px', borderLeft: '4px solid #4a90e2',
          background: 'rgba(74, 144, 226, 0.05)' 
        }}>
           <div className="flex-center" style={{ marginBottom: '8px', opacity: 0.8 }}><Users size={20} color="#4a90e2" /></div>
           <div className="text-sm-muted font-gaming" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>{t('network_size')}</div>
           <div className="game-title" style={{ fontSize: '1.2rem' }}>{user?.referrals?.length || 0}</div>
        </Card>
        <Card style={{ 
          textAlign: 'center', padding: '16px', borderRight: '4px solid #00ff88',
          background: 'rgba(0, 255, 136, 0.05)'
        }}>
           <div className="flex-center" style={{ marginBottom: '8px', opacity: 0.8 }}><Gift size={20} color="#00ff88" /></div>
            <div className="text-sm-muted font-gaming" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>{t('total_earnings')}</div>
            <div className="game-title gold-text" style={{ fontSize: '1.2rem' }}>{formatBalance(user?.referralEarnings)}</div>
          </Card>
      </div>

      <div className="flex-row-between" style={{ marginTop: '10px' }}>
        <h3 className="game-title" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gift size={20} className="gold-text" /> {t('referral_bonuses')}
        </h3>
        <span className="text-sm-muted font-gaming" style={{ fontSize: '0.7rem' }}>{t('instant_payout')}</span>
      </div>

      <div className="stack-vertical" style={{ gap: '12px' }}>
        {commissions.map((c) => (
          <div key={c.tier} className="glass-card flex-row-between" style={{ padding: '10px 16px', border: `1px solid ${c.color}22`, background: 'rgba(255,255,255,0.02)' }}>
             <div className="flex-center" style={{ gap: '12px' }}>
               <div style={{ 
                 color: c.color, width: '40px', height: '40px', borderRadius: '12px', 
                 background: `${c.color}11`, display: 'flex', alignItems: 'center', justifyContent: 'center'
               }}>
                 {c.icon || <Trophy size={20} />}
               </div>
               <div className="stack-vertical" style={{ gap: '2px' }}>
                 <span style={{ fontWeight: '800', fontSize: '0.9rem' }}>{c.tier}</span>
                 <span className="text-sm-muted" style={{ fontSize: '0.6rem' }}>{c.bonus} Reward</span>
               </div>
             </div>
             <div className="stack-vertical" style={{ alignItems: 'flex-end', gap: '4px' }}>
                <div className="gold-text" style={{ fontWeight: '900', fontSize: '1.1rem' }}>{c.reward}</div>
                <div className="badge-gold" style={{ 
                  fontSize: '0.5rem', padding: '2px 8px', width: 'fit-content',
                  background: 'rgba(252, 194, 1, 0.1)', border: '1px solid rgba(252, 194, 1, 0.2)'
                }}>
                  {t('share_share')}
                </div>
             </div>
          </div>
        ))}
      </div>

      <Card className="flex-center" style={{ background: 'var(--page-tint-card)', gap: '12px' }}>
         <PartyPopper size={24} className="gold-text" />
         <p className="text-sm-muted font-gaming" style={{ fontSize: '0.7rem', lineHeight: '1.5' }}>
           {t('refer_unlimited')}
         </p>
      </Card>
    </div>
  );
};

export default ReferralPage;
