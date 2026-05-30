import { useState, useEffect, useMemo, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { Card, Button, Badge } from '../components/UI';
import { toast } from 'sonner';
import {
  Ticket,
  Sparkles,
  Globe,
  X,
  Gem,
  Activity,
  Clock,
  Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import PromoModal from '../components/PromoModal';
import { useConfig } from '../context/ConfigContext';
import axios from 'axios';
import BannerCarousel from '../components/BannerCarousel';
import Skeleton from '../components/Skeleton';
import { formatBalance, formatRewardAmount } from '../utils/formatters';
import ProfileDropdown from '../components/ProfileDropdown';
import StreakMilestone from '../components/StreakMilestone';

const FEST_TO_USD_RATE = 0.00005;

const Home = () => {
  const { user } = useUser();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [showPromo, setShowPromo] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPromoBox, setShowPromoBox] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [inlinePromoCode, setInlinePromoCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [promoMeta, setPromoMeta] = useState(null);
  const [activeOffer, setActiveOffer] = useState(null);
  const [activeContest, setActiveContest] = useState(null);
  const [countdown, setCountdown] = useState('');
  const countdownRef = useRef(null);
  const promoBoxRef = useRef(null);


  const { apiBase, adminIds } = useConfig();

  const handleProfileClick = () => {
    setShowDropdown(prev => !prev);
    const currentCount = adminClickCount + 1;
    setAdminClickCount(currentCount);
    if (currentCount === 5) {
      if (adminIds.includes(user.telegramId.toString())) {
        navigate('/admin');
      }
      setAdminClickCount(0);
    }
  };

  const handleRedeem = async (codeToRedeem, setCodeInput) => {
    const cleanCode = codeToRedeem?.trim();
    if (!cleanCode) return;
    setRedeemLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/promocodes/check`, {
        code: cleanCode
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        setPromoMeta(response.data.promo);
        setCodeInput('');
        toast.success('Promo code redeemed successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid promocode');
    } finally {
      setRedeemLoading(false);
    }
  };

  const langOptions = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
    { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
    { code: 'id', name: 'Bahasa', flag: '🇮🇩' },
  ];

  useEffect(() => {
    const fetchOffer = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/withdraw/offer`);
        if (res.data.active) {
          setActiveOffer(res.data);
        }
      } catch {
        console.error('Failed to fetch offer');
      }
    };
    fetchOffer();

    const fetchActiveContest = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        const headers = { 'x-telegram-init-data': tg?.initData };
        const res = await axios.get(`${apiBase}/api/contests/active`, { headers });
        const { contest } = res.data;
        if (contest) {
          setActiveContest(contest);
        }
      } catch (err) {
        console.error('Active contest fetch failed', err);
      }
    };
    fetchActiveContest();

    const firstTimer = setTimeout(() => {
      setShowPromo(true);
    }, 1500);

    const interval = setInterval(() => {
      setShowPromo(true);
    }, 180000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(interval);
    };
  }, [apiBase]);

  // Countdown timer for active contest
  useEffect(() => {
    if (!activeContest) {
      setCountdown('');
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const end = activeContest.endTime;
      const diff = end - now;

      if (diff <= 0) {
        setCountdown('Ended');
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [activeContest]);


  // Close promo box when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (promoBoxRef.current && !promoBoxRef.current.contains(e.target)) {
        setShowPromoBox(false);
      }
    };
    if (showPromoBox) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPromoBox]);

  const isAdmin = useMemo(() => {
    return user && adminIds?.includes(user.telegramId?.toString());
  }, [user, adminIds]);

  const usdValue = user ? (user.balance * FEST_TO_USD_RATE).toFixed(4) : '0';

  if (!user) return (
    <div className="main-content stack-vertical" style={{ paddingBottom: '120px' }}>
      <header className="flex-row-between" style={{ padding: '10px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Skeleton variant="circle" width="56px" height="56px" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Skeleton variant="text" width="120px" height="20px" />
            <Skeleton variant="text" width="80px" height="14px" />
          </div>
        </div>
      </header>

      <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <Skeleton variant="text" width="60px" height="14px" />
          <Skeleton variant="text" width="180px" height="40px" />
          <div className="flex-center" style={{ gap: '12px', marginTop: '8px', width: '100%' }}>
            <Skeleton variant="rect" height="44px" borderRadius="16px" style={{ flex: 1 }} />
            <Skeleton variant="rect" height="44px" borderRadius="16px" style={{ flex: 1 }} />
          </div>
        </div>
      </Card>
    </div>
  );

  const promoTiers = [
    { name: 'Cash Fest', price: 0.5, icon: <Gem size={24} color="#e67e22" />, color: '#e67e22' },
    { name: 'Reward Fest', price: 1.0, icon: <Sparkles size={24} color="#f1c40f" />, color: '#f1c40f' },
    { name: 'Bonus Fest', price: 2.0, icon: <Sparkles size={24} color="#bdc3c7" />, color: '#bdc3c7' },
    { name: 'Profit Fest', price: 5.0, icon: <Gem size={24} color="#3498db" />, color: '#3498db' },
  ];

  return (
    <div className="main-content stack-vertical" style={{ paddingBottom: '120px', position: 'relative' }}>
      {/* Decorative Elements */}
      <div
        style={{ position: 'fixed', top: '10%', right: '5%', pointerEvents: 'none', zIndex: 0 }}
      >
        <Sparkles size={100} className="gold-text" style={{ opacity: 0.1 }} />
      </div>

      {/* Profile Section - Only profile pic + balance */}
      <header className="flex-row-between" style={{ position: 'relative', zIndex: 10, padding: '10px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          {/* Profile Picture - opens dropdown */}
          <div
            data-tutorial="profile-pic"
            onClick={handleProfileClick}
            style={{
              width: '56px', height: '56px', borderRadius: '50%',
              border: '2px solid var(--glass-border)', padding: '2px',
              cursor: 'pointer', position: 'relative'
            }}
          >
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'rgba(255,255,255,0.03)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
              {user.photoUrl ? (
                <img src={user.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span className="heading-lg gold-text" style={{ fontSize: '1.2rem' }}>
                  {(user.firstName || user.username || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <ProfileDropdown
              onClose={() => setShowDropdown(false)}
              onLanguageOpen={() => setShowLangModal(true)}
            />
          )}

          {/* $FEST Balance + USD Value */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span className="game-title" style={{ fontSize: '1.8rem', color: 'var(--primary-gold)' }}>
                {formatBalance(user.balance)}
              </span>
              <span className="game-title" style={{ fontSize: '0.9rem', color: 'var(--primary-gold)', opacity: 0.7 }}>
                $FEST
              </span>
            </div>
            <span className="font-gaming" style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: '500' }}>
              ≈ ${usdValue} USD
            </span>
          </div>
        </div>

        {/* Promo Code Icon - top right */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} ref={promoBoxRef}>
          <div
            onClick={() => setShowPromoBox(prev => !prev)}
            style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'rgba(241,196,15,0.1)',
              border: '1px solid rgba(241,196,15,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            <Ticket size={22} color="var(--primary-gold)" />
          </div>
          <span style={{
            fontSize: '0.5rem',
            color: 'var(--primary-gold)',
            marginTop: '2px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            opacity: 0.7
          }}>
            Promo
          </span>

          {/* Floating Promo Code Dropdown */}
          {showPromoBox && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '300px',
              background: 'var(--secondary-bg)',
              borderRadius: '14px',
              border: '1px solid var(--glass-border)',
              padding: '14px 16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              zIndex: 100
            }}>
              <div className="flex-center" style={{ gap: '6px', justifyContent: 'flex-start', marginBottom: '10px' }}>
                <Ticket size={16} className="gold-text" />
                <span className="font-gaming" style={{ fontSize: '0.75rem', fontWeight: '800', letterSpacing: '1px', opacity: 0.8 }}>PROMO CODE</span>
              </div>
              <div className="flex-row" style={{ gap: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter Code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  style={{
                    background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', color: 'white',
                    flex: 1, minWidth: 0,
                    fontSize: '0.85rem', fontWeight: '700', outline: 'none', padding: '10px 12px', borderRadius: '8px'
                  }}
                />
                <Button
                  onClick={() => handleRedeem(promoCode, setPromoCode)}
                  disabled={redeemLoading || !promoCode}
                  style={{ width: 'auto', padding: '0 20px', height: '35px', fontSize: '0.85rem', borderRadius: '8px', boxShadow: 'none', flexShrink: 0 }}
                >
                  {redeemLoading ? '...' : 'Redeem'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="home-desktop-grid">
        <div className="home-main-col">
          {/* Banner Carousel */}
          <BannerCarousel />

          {/* Active Contest Dashboard Widget */}
          {activeContest && (
            <Card
              className="glitter-base"
              style={{
                padding: '20px',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(0,0,0,0.4) 100%)',
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div className="flex-row-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={20} className="gold-text" />
                  <span className="font-gaming" style={{ fontSize: '0.9rem', fontWeight: '800', color: '#FFD700', letterSpacing: '0.5px' }}>
                    LIVE CONTEST
                  </span>
                </div>
                <Badge variant="gold" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)', fontSize: '0.65rem' }}>
                  ONGOING
                </Badge>
              </div>
              <div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff', textTransform: 'capitalize' }}>
                  {activeContest.type === 'refer' ? 'Referral' : 'Earning'} Championship
                </h4>
                <p className="text-sm-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  {activeContest.type === 'refer' 
                    ? 'Climb the ranks by referring new members.' 
                    : 'Climb the ranks by maximizing your $FEST earnings.'}
                </p>
              </div>
              <div className="flex-row-between" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>TIME REMAINING</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#FFD700', fontFamily: 'monospace', letterSpacing: '1px', marginTop: '2px' }}>
                    {countdown || '—'}
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/leaderboard')}
                  style={{ width: 'auto', padding: '0 16px', height: '36px', fontSize: '0.75rem', borderRadius: '8px', boxShadow: 'none' }}
                >
                  Leaderboard
                </Button>
              </div>
            </Card>
          )}

          {/* Mini Game Banner - under promo section */}
          <div style={{ cursor: 'pointer', lineHeight: 0, borderRadius: '12px', overflow: 'hidden' }} onClick={() => navigate('/games')}>
            <img
              src="/minigameBanner.png"
              alt="Mini Games"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: '12px',
                transform: 'scale(1.06)'
              }}
            />
          </div>
        </div>

        <div className="home-side-col">
          {/* Daily Streak Milestone */}
          <div style={{
            background: 'var(--secondary-bg)',
            borderRadius: '14px',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden'
          }}>
            <StreakMilestone compact />
          </div>

          {/* Inline Promo Code Card */}
          <div style={{
            background: 'var(--secondary-bg)',
            borderRadius: '14px',
            border: '1px solid var(--glass-border)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Ticket size={18} color="var(--primary-gold)" />
              <span className="font-gaming" style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--primary-gold)' }}>
                Promo Code
              </span>
            </div>
            
            <p className="text-sm-muted" style={{ fontSize: '0.75rem', marginTop: '-4px', textAlign: 'left', lineHeight: '1.4' }}>
              Got a promo code? Enter it below to claim your bonus reward instantly!
            </p>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input
                type="text"
                placeholder="ENTER PROMO CODE"
                value={inlinePromoCode}
                onChange={(e) => setInlinePromoCode(e.target.value.toUpperCase())}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: 'white',
                  flex: 1,
                  minWidth: 0,
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  outline: 'none',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-gaming)'
                }}
              />
              <Button
                onClick={() => handleRedeem(inlinePromoCode, setInlinePromoCode)}
                disabled={redeemLoading || !inlinePromoCode}
                style={{
                  width: 'auto',
                  padding: '0 20px',
                  height: '38px',
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  boxShadow: 'none',
                  flexShrink: 0
                }}
              >
                {redeemLoading ? '...' : 'Redeem'}
              </Button>
            </div>
          </div>

          {/* Recent Activities */}
          {user.activities && user.activities.length > 0 && (
            <div className="stack-vertical" style={{ gap: '10px' }}>
              <h3 className="game-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', opacity: 0.8 }}>
                <Activity size={16} className="gold-text" /> Recent Activities
              </h3>
              <div className="stack-vertical" style={{ gap: '6px' }}>
                {[...user.activities]
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .slice(0, 10)
                  .map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: 'rgba(255,255,255,0.04)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem'
                        }}>
                          {item.type === 'task_completion' ? '📋' :
                           item.type === 'promocode_reward' ? '🎁' :
                           item.type === 'referral_commission' ? '👥' :
                           item.type === 'spin_ad_view' ? '📺' :
                           item.type === 'spin' || item.type === 'spin_game' ? '🎡' :
                           item.type === 'slot_game' ? '🎰' : '📌'}
                        </div>
                        <div>
                          <div className="font-gaming" style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'capitalize' }}>
                            {item.type.replace(/_/g, ' ')}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', opacity: 0.4 }}>
                            <Clock size={10} />
                            {item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </div>
                        </div>
                      </div>
                      {item.amount != null && (
                        <span className="game-title" style={{ fontSize: '0.85rem', color: item.amount > 0 ? '#00c896' : '#ff4d4d' }}>
                          {item.amount > 0 ? '+' : ''}{item.amount}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Promotional Modal */}
      {showPromo && !['bonus', 'profit'].includes(user?.tier) && (
        <>
          <div
            onClick={() => setShowPromo(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, backdropFilter: 'blur(2px)' }}
          />
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: 'var(--secondary-bg)',
              borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
              padding: '30px 24px 40px', zIndex: 2001,
              borderTop: '1px solid var(--glass-border)',
              boxShadow: 'none'
            }}
          >
              <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', margin: '0 auto 20px' }} />

              <div style={{ position: 'absolute', top: '24px', right: '24px', cursor: 'pointer', opacity: 0.5 }} onClick={() => setShowPromo(false)}>
                <X size={24} />
              </div>

              <div style={{ marginBottom: '25px' }}>
                <h2 className="heading-lg gold-text">{t('promo_title')}</h2>
                <p className="text-sm-muted" style={{ fontSize: '0.8rem' }}>{t('promo_desc')}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '25px' }}>
                {promoTiers.map((tier) => (
                  <div key={tier.name} style={{ position: 'relative', overflow: 'hidden', padding: '16px', borderRadius: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ marginBottom: '8px' }}>{tier.icon}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', marginBottom: '4px' }}>{tier.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <div className="gold-text" style={{ fontSize: '1rem', fontWeight: '900' }}>${formatRewardAmount(tier.price)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={() => { setShowPromo(false); navigate('/upgrade'); }} style={{ height: '52px', fontSize: '1rem' }}>
                {t('see_more')}
              </Button>
          </div>
        </>
      )}

      {/* Language Selection Modal */}
      {showLangModal && (
        <>
          <div
            onClick={() => setShowLangModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 3000, backdropFilter: 'blur(2px)' }}
          />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%', maxWidth: '340px', background: 'var(--secondary-bg)',
              borderRadius: '32px', padding: '32px', zIndex: 3001,
              border: '1px solid var(--glass-border)', textAlign: 'center',
              boxShadow: 'none'
            }}
          >
              <h3 className="game-title" style={{ marginBottom: '24px', fontSize: '1.8rem' }}>Select Language</h3>
              <div className="stack-vertical" style={{ gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                {langOptions.map((opt) => (
                  <motion.div
                    key={opt.code}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setLanguage(opt.code); setShowLangModal(false); }}
                    style={{
                      padding: '16px', borderRadius: '16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '15px',
                      background: language === opt.code ? 'var(--page-tint-highlight)' : 'rgba(255,255,255,0.02)',
                      border: language === opt.code ? '1px solid var(--primary-gold)' : '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '1.6rem' }}>{opt.flag}</span>
                    <span style={{ fontWeight: language === opt.code ? '800' : '600', fontSize: '1rem' }}>{opt.name}</span>
                    {language === opt.code && <div style={{ marginLeft: 'auto', color: 'var(--primary-gold)' }}><Gem size={18} /></div>}
                  </motion.div>
                ))}
              </div>
              <Button
                style={{ marginTop: '24px', height: '52px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
                onClick={() => setShowLangModal(false)}
              >
                Close
              </Button>
          </div>
        </>
      )}

      {/* Promo Selection Modal */}
      <AnimatePresence>
        {promoMeta && (
          <PromoModal
            promo={promoMeta}
            onClose={() => setPromoMeta(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
