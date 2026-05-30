import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Sparkles, RotateCw, History, PlayCircle } from 'lucide-react';
import { Card, Button, GameButton, GameCard } from '../components/UI';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { AdsClient } from '../utils/AdsClient';
import { getPageTheme } from '../theme/pageThemes';
import { encryptPayload } from '../utils/adCrypto';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import axios from 'axios';

const SpinWheel = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { content: pageColors } = getPageTheme(pathname);
  const { user, playSpinGame, refreshUser } = useUser();
  const { apiBase } = useConfig();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [spinCount, setSpinCount] = useState(0);
  const [poolAmount, setPoolAmount] = useState(100000);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const controls = useAnimation();

  // Wheel values: 20, 50, 100, 100, 200, 500, 500, 1000
  // Arranged opposite to each other for balance
  const wheelValues = [20, 1000, 50, 500, 100, 500, 100, 200];
  const visualPrizes = wheelValues.map(v => `${v} $FEST`);
  const SPIN_COST = 100; // Fixed cost, hardcoded on backend

  // Fetch pool status on mount
  useEffect(() => {
    const fetchPoolStatus = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/user/pool-status`);
        setPoolAmount(res.data.poolAmount || 100000);
      } catch (e) {
        console.error('Failed to fetch pool status:', e);
      }
    };
    fetchPoolStatus();
  }, [apiBase]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const timer = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleWatchExtraAd = async (event) => {
    if (!window.Adsgram) {
      toast.error('Ad provider not loaded. Please try again.');
      return;
    }

    try {
      const blockId = '33471';
      const adContext = 'SpinWheel';

      // Telemetry payload
      const clickX = event ? Math.round(event.clientX || 0) : 100;
      const clickY = event ? Math.round(event.clientY || 0) : 100;
      const handshakePayload = {
        timestamp: Date.now(),
        isTrusted: event ? event.isTrusted : true,
        mouseTrail: [{ x: clickX, y: clickY, t: Date.now() }],
        blockId,
        adContext
      };

      const key = user?.hash || '';
      const encrypted = encryptPayload(handshakePayload, key);

      // Perform handshake
      const tg = window.Telegram?.WebApp;
      await axios.post(
        `${apiBase}/api/user/ad-watch/start`, 
        { telegramId: user?.telegramId || tg?.initDataUnsafe?.user?.id?.toString(), payload: encrypted },
        { headers: { 'x-telegram-init-data': tg?.initData || '' } }
      );

      // Load and show Adsgram ad
      const AdController = window.Adsgram.init({ blockId });
      const result = await AdController.show();

      if (result && result.done) {
        setShowRewardModal(false);
        // Wait briefly for S2S callback transaction to complete on backend
        toast.promise(
          new Promise((resolve) => setTimeout(resolve, 2000))
            .then(() => refreshUser()),
          {
            loading: 'Crediting extra reward...',
            success: '10% Extra reward credited!',
            error: 'Failed to update balance'
          }
        );
      }
    } catch (err) {
      console.error('Failed to claim extra reward:', err);
      toast.error(err.response?.data?.error || 'Ad verification failed');
    }
  };

  const handleSpin = async () => {
    const balance = user?.balance || 0;
    if (spinning || !user) return;
    
    if (cooldownRemaining > 0) {
      toast.error(`Please wait ${cooldownRemaining}s before spinning again`);
      return;
    }

    if (balance < SPIN_COST) {
      toast.error(`Insufficient balance. You need ${SPIN_COST} $FEST to spin.`);
      return;
    }

    setSpinning(true);

    try {
      const spinResult = await playSpinGame();
      
      if (!spinResult.success) {
        toast.error(spinResult.error || 'Spin failed. Please try again.');
        setSpinning(false);
        
        if (spinResult.error && spinResult.error.includes('cooldown')) {
          const match = spinResult.error.match(/wait (\d+)s/);
          if (match) setCooldownRemaining(parseInt(match[1]));
        }
        return;
      }

      setCooldownRemaining(10);

      const rewardAmount = spinResult.reward;
      const rewardIndex = spinResult.rewardIndex;
      
      const nextSpinCount = spinCount + 1;
      setSpinCount(nextSpinCount);

      // Alignment Fix: Each segment is 45deg, target the center (+22.5deg offset)
      const segmentAngle = (rewardIndex * 45) + 22.5;
      const finalRotation = (360 * 10 * nextSpinCount) + (360 - segmentAngle);

      await controls.start({
        rotate: finalRotation,
        transition: { duration: 5, ease: [0.45, 0.05, 0.55, 0.95] }
      });

      setSpinning(false);

      // Standard App Notification (80px from top)
      toast.success(`You Won ${rewardAmount} $FEST`, {
        style: {
          marginTop: '80px',
          padding: '16px 20px',
          fontSize: '1.1rem',
          fontWeight: '900',
          border: '1px solid var(--primary-gold)',
          background: 'rgba(0, 46, 26, 0.95)',
          color: '#fff',
          fontFamily: 'var(--font-gaming)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.8)'
        },
        duration: 4000
      });

      refreshUser();

      if (rewardAmount > 0) {
        setLastWinAmount(rewardAmount);
        setShowRewardModal(true);
      }

      confetti({
        particleCount: rewardAmount > SPIN_COST ? 200 : 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: [pageColors.accent, '#ffffff', pageColors.accentBright]
      });

      setTimeout(() => {
        AdsClient.showInterstitial();
      }, 2500);
    } catch (error) {
      console.error('Spin error:', error);
      toast.error('Spin failed. Please try again.');
      setSpinning(false);
    }
  };

  return (
    <div className="main-content stack-vertical" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <header style={{ textAlign: 'center', marginBottom: '0px' }}>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '1.5rem' }}>
          <RotateCw size={24} className="gold-text" /> Lucky Spin
        </h1>
        <p className="font-gaming text-sm-muted" style={{ fontSize: '0.65rem', marginTop: '2px', opacity: 0.5, letterSpacing: '1px' }}>WIN MASSIVE REWARDS</p>
      </header>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', margin: '18px 0' }}>
        {[
          { label: 'PVP', image: '/Pvp.png', path: '/pvp' },
          { label: 'Mines', image: '/Mine.png', path: '/mines' },
          { label: 'Slots', image: '/Slot.png', path: '/slots' }
        ].map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'transparent',
              color: '#fff',
              minWidth: '90px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 12px 25px rgba(0,0,0,0.2)'
            }}
          >
            <img src={item.image} alt={item.label} style={{ width: '32px', height: '32px', objectFit: 'contain', display: 'block', borderRadius: '8px' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.6px' }}>{item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', width: '320px', height: '320px', margin: '40px 0' }}>
        <div style={{ 
          position: 'absolute', inset: -20, borderRadius: '50%', 
          background: 'radial-gradient(circle, var(--page-tint-medium) 0%, transparent 70%)'
        }} />

        <div style={{ 
          position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)', 
          zIndex: 30, width: '30px', height: '50px', display: 'flex', justifyContent: 'center'
        }}>
          <div style={{ 
            width: '0', height: '0', 
            borderLeft: '15px solid transparent', borderRight: '15px solid transparent',
            borderTop: '35px solid #fff', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'
          }} />
        </div>
        
        <motion.div 
          animate={controls}
          style={{ 
            width: '100%', height: '100%', borderRadius: '50%', border: '10px solid var(--primary-gold)',
            position: 'relative', overflow: 'hidden', boxShadow: '0 0 50px rgba(0,0,0,0.8)',
            background: 'conic-gradient(#0a0a0a 0deg 45deg, #1a1a1a 45deg 90deg, #0a0a0a 90deg 135deg, #1a1a1a 135deg 180deg, #0a0a0a 180deg 225deg, #1a1a1a 225deg 270deg, #0a0a0a 270deg 315deg, #1a1a1a 315deg 360deg)'
          }}
        >
          {visualPrizes.map((prize, i) => (
            <div 
              key={i}
              style={{ 
                position: 'absolute', 
                top: '50%',
                left: '50%',
                width: '80px',
                height: '40px',
                transform: `translate(-50%, -50%) rotate(${i * 45 + 22.5}deg) translateY(-105px)`,
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                color: 'white',
                fontWeight: '900',
                fontSize: '12px',
                textShadow: 'none',
                zIndex: 5
              }}
            >
              <span style={{ fontSize: '13px', lineHeight: '1' }}>{prize.split(' ')[0]}</span>
              <span style={{ fontSize: '9px', opacity: 0.9, marginTop: '2px' }}>$FEST</span>
            </div>
          ))}
          <div style={{ 
            position: 'absolute', inset: 0, margin: 'auto', width: '80px', height: '80px', 
            background: 'linear-gradient(135deg, var(--primary-gold), var(--accent-gold))', 
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            boxShadow: '0 0 20px rgba(0,0,0,0.5), inset 0 0 10px rgba(255,255,255,0.5)', zIndex: 10,
            border: '4px solid var(--primary-deep)'
          }}>
             <RotateCw size={40} color="var(--primary-deep)" />
          </div>
        </motion.div>
      </div>

      <div style={{ width: '100%', maxWidth: '240px', margin: '0 auto' }} className="stack-vertical">
        <GameButton 
          onClick={handleSpin} 
          disabled={spinning || !user || user.balance < SPIN_COST || cooldownRemaining > 0}
          style={{ 
            height: '56px', 
            fontSize: '0.9rem', 
            fontWeight: '900',
            width: '100%'
          }}
        >
          {spinning ? 'SPINNING...' : cooldownRemaining > 0 ? `WAIT ${cooldownRemaining}S` : `SPIN FOR ${SPIN_COST}`}
        </GameButton>
        <p style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.4, marginTop: '12px' }}>
           COST: {SPIN_COST} $FEST • COOLDOWN: 10S
        </p>
      </div>

      <AnimatePresence>
        {showRewardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px',
              backdropFilter: 'blur(8px)'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                width: '100%',
                maxWidth: '340px',
                background: 'linear-gradient(135deg, #0e1e12 0%, #030a05 100%)',
                border: '2px solid var(--primary-gold)',
                borderRadius: '24px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(255, 215, 0, 0.2)'
              }}
            >
              <div style={{
                width: '70px',
                height: '70px',
                background: 'rgba(255, 215, 0, 0.1)',
                border: '1.5px solid var(--primary-gold)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Sparkles size={36} className="gold-text" />
              </div>

              <h2 className="font-gaming gold-text" style={{ fontSize: '1.4rem', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
                Congratulations!
              </h2>
              
              <p style={{ color: '#9ef0c2', fontSize: '0.85rem', marginBottom: '16px' }}>
                You won <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>{lastWinAmount}</span> $FEST
              </p>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed rgba(255, 215, 0, 0.2)',
                borderRadius: '16px',
                padding: '12px',
                marginBottom: '24px'
              }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#88a695' }}>
                  Boost your winnings by playing a quick video!
                </p>
                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--primary-gold)', marginTop: '4px' }}>
                  +{(lastWinAmount * 0.1).toFixed(1)} $FEST Extra!
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={handleWatchExtraAd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--primary-gold), #ffd700)',
                    color: '#000',
                    fontWeight: '900',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(255, 215, 0, 0.3)'
                  }}
                >
                  <PlayCircle size={18} />
                  +10% Extra
                </button>

                <button
                  onClick={() => setShowRewardModal(false)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: '#88a695',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  No thanks
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpinWheel;
