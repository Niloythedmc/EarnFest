import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { Card, GameButton, Stack } from '../components/UI';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, PlayCircle, Sparkles } from 'lucide-react';
import { formatBalance } from '../utils/formatters';
import { encryptPayload } from '../utils/adCrypto';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import Lottie from 'lottie-react';
import axios from 'axios';

const LOTTIE_ASSETS = {
  win: "https://lottie.host/7e04f056-4c9d-433b-8580-f04495837651/2yYjXNfDPr.json",
};

const BETS = [10, 25, 50, 100, 250, 500];

const CoinFlip = () => {
  const navigate = useNavigate();
  const { user, playCoinFlip, refreshUser } = useUser();
  const { apiBase } = useConfig();
  const tg = window.Telegram?.WebApp;

  // Game state
  const [betIndex, setBetIndex] = useState(0);
  const [choice, setChoice] = useState('heads'); // 'heads' or 'tails'
  const [flipping, setFlipping] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [poolAmount, setPoolAmount] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  
  // Extra Reward Modal state
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const [winAnimationData, setWinAnimationData] = useState(null);

  const audioRefs = useRef({});
  const currentBet = BETS[betIndex];

  // Load Lottie & sound effects
  useEffect(() => {
    fetch(LOTTIE_ASSETS.win).then(res => res.json()).then(data => setWinAnimationData(data));
    audioRefs.current = {
      flip: new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3'),
      win: new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3'),
      lose: new Audio('https://www.soundjay.com/buttons/sounds/button-11.mp3')
    };

    // Fetch initial pool amount
    const fetchPool = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/user/pool-status`);
        setPoolAmount(res.data.poolAmount || 0);
      } catch (err) {
        console.error('Failed to fetch pool status:', err);
      }
    };
    fetchPool();

    return () => {
      Object.values(audioRefs.current).forEach(a => {
        a.pause();
        a.src = "";
      });
    };
  }, [apiBase]);

  const playSFX = (key) => {
    const sfx = audioRefs.current[key];
    if (sfx) {
      sfx.currentTime = 0;
      sfx.play().catch(() => {});
    }
  };

  const handleFlip = async () => {
    if (flipping || !user) return;
    if (user.balance < currentBet) {
      toast.error('Insufficient balance!');
      return;
    }

    setFlipping(true);
    playSFX('flip');
    tg?.HapticFeedback?.impactOccurred('medium');

    try {
      const res = await playCoinFlip(currentBet, choice);
      if (res && res.success) {
        // Calculate new 3D rotation (spin multiple times and land on target)
        // Heads is 0 degrees (front), Tails is 180 degrees (back)
        const currentSpins = Math.floor(rotation / 360) * 360;
        const extraTurns = 1440; // 4 full spins
        const targetFaceDeg = res.flipResult === 'heads' ? 0 : 180;
        const newRotation = currentSpins + extraTurns + targetFaceDeg;
        
        setRotation(newRotation);

        // Wait for animation to finish (1.5 seconds)
        setTimeout(() => {
          setFlipping(false);
          if (res.isWin) {
            playSFX('win');
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            tg?.HapticFeedback?.notificationOccurred('success');
            setLastWinAmount(res.payout);
            setTimeout(() => {
              setShowRewardModal(true);
            }, 1000);
          } else {
            playSFX('lose');
            tg?.HapticFeedback?.notificationOccurred('error');
            toast.error(`It landed on ${res.flipResult}. You lost!`);
          }
          
          // Refresh solo pool status
          axios.get(`${apiBase}/api/user/pool-status`)
            .then(pRes => setPoolAmount(pRes.data.poolAmount || 0))
            .catch(() => {});

        }, 1500);
      } else {
        setFlipping(false);
        toast.error(res?.error || 'Coin flip failed');
      }
    } catch (err) {
      setFlipping(false);
      toast.error('Internal Error');
    }
  };

  const handleWatchExtraAd = async () => {
    if (!window.Adsgram) {
      toast.error('Ad provider not loaded. Please try again.');
      return;
    }

    try {
      const blockId = '33472';
      const adContext = 'CoinFlip';
      const response = await axios.get(`${apiBase}/api/user/sync?telegramId=${user.telegramId}`);
      const serverTimestamp = response.headers.date ? new Date(response.headers.date).getTime() : Date.now();
      const payload = { telegramId: user.telegramId, timestamp: serverTimestamp, adContext };
      const encrypted = encryptPayload(payload);

      // Perform handshake
      await axios.post(
        `${apiBase}/api/user/ad-watch/start`, 
        { telegramId: user.telegramId, payload: encrypted },
        { headers: { 'x-telegram-init-data': tg?.initData || '' } }
      );

      // Load and show Adsgram ad
      const AdController = window.Adsgram.init({ blockId });
      const result = await AdController.show();

      if (result && result.done) {
        setShowRewardModal(false);
        toast.promise(
          new Promise((resolve) => setTimeout(resolve, 2000)).then(() => refreshUser()),
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

  if (!user) return null;

  return (
    <div className="main-content" style={{ paddingBottom: '120px', maxWidth: '480px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="game-title" style={{ fontSize: '1.6rem', color: '#fff', textShadow: '0 0 10px #7000ff' }}>COIN FLIP</h2>
        <button onClick={() => setShowInfo(!showInfo)} style={{ background: 'rgba(112, 0, 255, 0.2)', border: '1px solid #7000ff', borderRadius: '15px', width: '40px', height: '40px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Info size={20} />
        </button>
      </div>

      {/* Nav shortcuts */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', margin: '0 0 18px' }}>
        {[
          { label: 'Slots', image: '/Slot.png', path: '/slots' },
          { label: 'Spin', image: '/Wheel.png', path: '/spin' },
          { label: 'Mines', image: '/Mine.png', path: '/mines' }
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

      {/* Rules Info */}
      <AnimatePresence>
        {showInfo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: '20px' }}>
            <Card style={{ padding: '20px', background: 'rgba(0,0,0,0.9)', border: '1.5px solid #7000ff', borderRadius: '25px' }}>
              <Stack gap={10}>
                <h3 style={{ margin: 0, color: '#00d4ff', fontSize: '1rem', fontWeight: '800' }}>RULES & PROBABILITIES</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#c4b5fd', lineHeight: '1.4' }}>
                  Choose Heads or Tails, place your bet, and flip the coin!
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Correct Guess:</span>
                  <span style={{ fontWeight: 'bold', color: '#00ffaa' }}>2.0x Payout</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Incorrect Guess:</span>
                  <span style={{ fontWeight: 'bold', color: '#ff4d4d' }}>0x Loss</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Fairness:</span>
                  <span style={{ color: '#a78bfa' }}>50% chance backend RNG</span>
                </div>
              </Stack>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pool and Balance Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(0,0,0,0.6)', padding: '12px 14px', borderRadius: '20px', border: '1px solid rgba(112,0,255,0.2)', textAlign: 'center' }}>
          <div style={{ color: '#9a9cff', fontSize: '0.65rem', letterSpacing: '1.5px', fontWeight: '800', marginBottom: '4px' }}>BALANCE</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fff' }}>{formatBalance(user.balance)}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#00ffaa' }}>$FEST</span>
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.6)', padding: '12px 14px', borderRadius: '20px', border: '1px solid rgba(0,212,255,0.2)', textAlign: 'center' }}>
          <div style={{ color: '#00d4ff', fontSize: '0.65rem', letterSpacing: '1.5px', fontWeight: '800', marginBottom: '4px' }}>SOLO GAME POOL</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fff' }}>{formatBalance(poolAmount)}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#00ffaa' }}>$FEST</span>
          </div>
        </div>
      </div>

      {/* 3D Coin Display Area */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '240px',
        position: 'relative',
        perspective: '1000px',
        marginBottom: '20px'
      }}>
        {/* Glowing aura background */}
        <div style={{
          position: 'absolute',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(112,0,255,0.2) 0%, rgba(0,0,0,0) 70%)',
          zIndex: 0
        }} />

        <motion.div
          animate={flipping ? {} : { y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          style={{
            width: '160px',
            height: '160px',
            position: 'relative',
            transformStyle: 'preserve-3d',
            cursor: flipping ? 'not-allowed' : 'pointer',
            zIndex: 1
          }}
          onClick={handleFlip}
        >
          <motion.div
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              transformStyle: 'preserve-3d',
              transform: `rotateY(${rotation}deg)`
            }}
            transition={{
              duration: 1.5,
              ease: [0.25, 0.1, 0.25, 1.0]
            }}
          >
            {/* Front Side: Heads (Gold) */}
            <div style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              backfaceVisibility: 'hidden',
              background: 'radial-gradient(circle, #ffe066 0%, #d4af37 100%)',
              borderRadius: '50%',
              border: '6px solid #f3e5ab',
              boxShadow: '0 0 25px rgba(212, 175, 55, 0.6), inset 0 0 15px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Crown Emblem */}
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#684a00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
                <path d="M5 20h14" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontWeight: '950', color: '#684a00', letterSpacing: '2px', marginTop: '6px' }}>HEADS</span>
            </div>

            {/* Back Side: Tails (Silver) */}
            <div style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'radial-gradient(circle, #e2e8f0 0%, #94a3b8 100%)',
              borderRadius: '50%',
              border: '6px solid #f1f5f9',
              boxShadow: '0 0 25px rgba(148, 163, 184, 0.6), inset 0 0 15px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Star Emblem */}
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontWeight: '950', color: '#334155', letterSpacing: '2px', marginTop: '6px' }}>TAILS</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Guess Selection (Heads or Tails) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => {
            setChoice('heads');
            tg?.HapticFeedback?.impactOccurred('light');
          }}
          disabled={flipping}
          style={{
            padding: '16px',
            borderRadius: '20px',
            border: choice === 'heads' ? '3px solid #ffe066' : '1px solid rgba(255,255,255,0.1)',
            background: choice === 'heads' ? 'rgba(255, 224, 102, 0.15)' : 'rgba(0,0,0,0.4)',
            color: choice === 'heads' ? '#ffe066' : '#fff',
            fontWeight: '900',
            fontSize: '1rem',
            letterSpacing: '1px',
            cursor: flipping ? 'not-allowed' : 'pointer',
            boxShadow: choice === 'heads' ? '0 0 15px rgba(255, 224, 102, 0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          HEADS
        </button>

        <button
          type="button"
          onClick={() => {
            setChoice('tails');
            tg?.HapticFeedback?.impactOccurred('light');
          }}
          disabled={flipping}
          style={{
            padding: '16px',
            borderRadius: '20px',
            border: choice === 'tails' ? '3px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
            background: choice === 'tails' ? 'rgba(226, 232, 240, 0.15)' : 'rgba(0,0,0,0.4)',
            color: choice === 'tails' ? '#e2e8f0' : '#fff',
            fontWeight: '900',
            fontSize: '1rem',
            letterSpacing: '1px',
            cursor: flipping ? 'not-allowed' : 'pointer',
            boxShadow: choice === 'tails' ? '0 0 15px rgba(226, 232, 240, 0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          TAILS
        </button>
      </div>

      {/* Bet Amount Selector */}
      <div style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#c4b5fd', fontWeight: '800', letterSpacing: '1px' }}>BET AMOUNT</span>
          <span style={{ fontSize: '0.85rem', color: '#00ffaa', fontWeight: '900' }}>{currentBet} $FEST</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
          {BETS.map((betVal, idx) => (
            <button
              key={betVal}
              type="button"
              onClick={() => {
                setBetIndex(idx);
                tg?.HapticFeedback?.impactOccurred('light');
              }}
              disabled={flipping}
              style={{
                padding: '10px 0',
                borderRadius: '12px',
                border: betIndex === idx ? '2px solid #7000ff' : '1px solid rgba(255,255,255,0.08)',
                background: betIndex === idx ? 'rgba(112, 0, 255, 0.25)' : 'rgba(255,255,255,0.03)',
                color: '#fff',
                fontWeight: '900',
                fontSize: '0.75rem',
                cursor: flipping ? 'not-allowed' : 'pointer'
              }}
            >
              {betVal}
            </button>
          ))}
        </div>
      </div>

      {/* Play Action Button */}
      <GameButton
        onClick={handleFlip}
        disabled={flipping || user.balance < currentBet}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '20px',
          fontWeight: '950',
          fontSize: '1.1rem',
          letterSpacing: '1px',
          background: 'linear-gradient(135deg, #7000ff, #00d4ff)',
          boxShadow: '0 8px 30px rgba(112, 0, 255, 0.4), 0 0 15px rgba(0, 212, 255, 0.2)'
        }}
      >
        {flipping ? 'FLIPPING...' : `FLIP ${currentBet} $FEST`}
      </GameButton>

      {/* Win Celebration Lottie Effect */}
      <AnimatePresence>
        {!flipping && showRewardModal && winAnimationData && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.7)', pointerEvents: 'none' }}
          >
             <Lottie animationData={winAnimationData} style={{ height: 350 }} loop={false} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reward Double-Up Modal */}
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
                background: 'linear-gradient(135deg, #1c0e2b 0%, #0a0312 100%)',
                border: '2px solid #7000ff',
                borderRadius: '24px',
                padding: '24px',
                textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(112, 0, 255, 0.25)'
              }}
            >
              <div style={{
                width: '70px',
                height: '70px',
                background: 'rgba(112, 0, 255, 0.1)',
                border: '1.5px solid #7000ff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Sparkles size={36} style={{ color: '#00d4ff' }} />
              </div>

              <h2 className="font-gaming" style={{ fontSize: '1.4rem', color: '#00d4ff', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px', textShadow: '0 0 10px rgba(0,212,255,0.4)' }}>
                Congratulations!
              </h2>
              
              <p style={{ color: '#c4b5fd', fontSize: '0.85rem', marginBottom: '16px' }}>
                You won <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>{lastWinAmount}</span> $FEST
              </p>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px dashed rgba(112, 0, 255, 0.25)',
                borderRadius: '16px',
                padding: '12px',
                marginBottom: '24px'
              }}>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#a78bfa' }}>
                  Boost your winnings by playing a quick video!
                </p>
                <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#00ffaa', marginTop: '4px' }}>
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
                    background: 'linear-gradient(135deg, #7000ff, #00d4ff)',
                    color: '#fff',
                    fontWeight: '900',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(112, 0, 255, 0.3)'
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
                    color: '#a78bfa',
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

export default CoinFlip;
