import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { Card, GameCard, GameButton, Badge, Stack } from '../components/UI';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Info, AlertTriangle, Trophy, Coins, PlayCircle, Sparkles } from 'lucide-react';
import { formatBalance } from '../utils/formatters';
import { encryptPayload } from '../utils/adCrypto';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import Lottie from 'lottie-react';
import axios from 'axios';

const LOTTIE_ASSETS = {
  win: "https://lottie.host/7e04f056-4c9d-433b-8580-f04495837651/2yYjXNfDPr.json",
};

const formatFestAmount = (value) => {
  const num = Number(value || 0);
  if (isNaN(num)) return '0';
  return num % 1 !== 0 ? num.toFixed(1) : num.toLocaleString('en-US');
};

const ITEMS = [
  { icon: '🍎', label: 'Apple', color: '#ff4d4d' },
  { icon: '🍋', label: 'Lemon', color: '#f1c40f' },
  { icon: '🍒', label: 'Cherry', color: '#ff1744' },
  { icon: '👑', label: 'Crown', color: '#ffab00' },
  { icon: '💎', label: 'Diamond', color: '#00e5ff' }
];

const BETS = [10, 25, 50, 75, 100];
const ITEM_HEIGHT = 70; // Smaller height

const Symbol = memo(({ idx, isWinner, spinning }) => {
  const item = ITEMS[idx];
  return (
    <motion.div 
      animate={isWinner ? { scale: [1, 1.2, 1] } : {}}
      style={{ 
        height: `${ITEM_HEIGHT}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        width: '100%'
      }}
    >
      <div style={{
        fontSize: '2.5rem', // Small size emojis
        zIndex: 2,
        position: 'relative',
        filter: isWinner ? `drop-shadow(0 0 10px ${item.color})` : 'none',
        opacity: spinning ? 0.6 : 1
      }}>
        {item.icon}
      </div>
    </motion.div>
  );
});

const Reel = memo(({ spinning, targetIndex, delay, color }) => {
  const controls = useAnimation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const list = Array.from({ length: 40 }, () => Math.floor(Math.random() * 5));
    setItems(list);
  }, []);

  useEffect(() => {
    if (spinning) {
      controls.start({
        y: [0, -2800],
        transition: { duration: 1, repeat: Infinity, ease: "linear" }
      });
    } else if (targetIndex !== null) {
      const finalY = -(targetIndex * ITEM_HEIGHT);
      controls.start({
        y: finalY,
        transition: { type: "spring", damping: 15, stiffness: 70, delay: delay * 0.1 }
      });
    }
  }, [spinning, targetIndex, controls, delay]);

  return (
    <div style={{
      height: '150px',
      width: '75px',
      background: '#000',
      borderRadius: '20px',
      overflow: 'hidden',
      border: `2px solid ${color}`,
      boxShadow: `0 0 10px ${color}33`,
      position: 'relative'
    }}>
      <motion.div animate={controls} initial={{ y: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
        {items.map((idx, i) => <Symbol key={i} idx={idx} isWinner={!spinning && idx === targetIndex} spinning={spinning} />)}
      </motion.div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.7) 100%)', pointerEvents: 'none', zIndex: 3 }} />
    </div>
  );
});

const SlotPage = () => {
  const navigate = useNavigate();
  const { user, playSlotGame, refreshUser } = useUser();
  const { adminIds, apiBase } = useConfig();
  const [betIndex, setBetIndex] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState([0, 0, 0]);
  const [gameResult, setGameResult] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [winAnimationData, setWinAnimationData] = useState(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [lastWinAmount, setLastWinAmount] = useState(0);

  const handleWatchExtraAd = async (event) => {
    if (!window.Adsgram) {
      toast.error('Ad provider not loaded. Please try again.');
      return;
    }

    try {
      const blockId = '33472';
      const adContext = 'SlotMachine';

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
      await axios.post(`${apiBase}/api/user/ad-watch/start`, { payload: encrypted });

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
            success: '20% Extra reward credited!',
            error: 'Failed to update balance'
          }
        );
      }
    } catch (err) {
      console.error('Failed to claim extra reward:', err);
      toast.error(err.response?.data?.error || 'Ad verification failed');
    }
  };
  
  const audioRefs = useRef({});
  const tg = window.Telegram?.WebApp;
  const currentBet = BETS[betIndex];

  useEffect(() => {
    fetch(LOTTIE_ASSETS.win).then(res => res.json()).then(data => setWinAnimationData(data));
    audioRefs.current = {
      spin: new Audio('https://www.soundjay.com/buttons/sounds/button-20.mp3'),
      win: new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3'),
      lose: new Audio('https://www.soundjay.com/buttons/sounds/button-11.mp3')
    };
    return () => Object.values(audioRefs.current).forEach(a => { a.pause(); a.src = ""; });
  }, []);

  const playSFX = (key) => {
    const sfx = audioRefs.current[key];
    if (sfx) { sfx.currentTime = 0; sfx.play().catch(() => {}); }
  };

  const handleSpin = async () => {
    if (spinning || !user) return;
    if (user.balance < currentBet) { toast.error('Insufficient balance!'); return; }
    setSpinning(true);
    setGameResult(null);
    playSFX('spin');
    tg?.HapticFeedback?.impactOccurred('medium');
    try {
      const res = await playSlotGame(currentBet);
      if (res.success) {
        setTimeout(() => {
          setSpinning(false);
          setResults(res.reels);
          setGameResult(res);
          if (res.payout > 0) {
            playSFX('win');
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            tg?.HapticFeedback?.notificationOccurred('success');
            setTimeout(() => {
              setLastWinAmount(res.payout);
              setShowRewardModal(true);
            }, 2000);
          } else {
            playSFX('lose');
            tg?.HapticFeedback?.notificationOccurred('error');
          }
        }, 1500);
      } else {
        setSpinning(false);
        toast.error(res.error || 'Spin failed');
      }
    } catch (err) {
      setSpinning(false);
      toast.error('Internal Error');
    }
  };

  if (!user) return null;

  return (
    <div className="main-content" style={{ paddingBottom: '120px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 className="game-title" style={{ fontSize: '1.6rem', color: '#fff', textShadow: '0 0 10px #7000ff' }}>NEON SLOTS</h2>
        <button onClick={() => setShowInfo(!showInfo)} style={{ background: 'rgba(112, 0, 255, 0.2)', border: '1px solid #7000ff', borderRadius: '15px', width: '40px', height: '40px', color: '#fff' }}>
          <Info size={20} />
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', margin: '0 0 18px' }}>
        {[
          { label: 'Spin', image: '/Wheel.png', path: '/spin' },
          { label: 'Mines', image: '/Mine.png', path: '/mines' },
          { label: 'PVP', image: '/Pvp.png', path: '/pvp' }
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

      <AnimatePresence>
        {showInfo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginBottom: '20px' }}>
            <Card style={{ padding: '20px', background: 'rgba(0,0,0,0.9)', border: '1.5px solid #7000ff', borderRadius: '25px' }}>
              <Stack gap={10}>
                {ITEMS.slice().reverse().map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span>{item.icon} 3x Match</span>
                    <span style={{ fontWeight: 'bold', color: '#00ffaa' }}>{i === 0 ? '2.0x' : i === 1 ? '1.5x' : i === 2 ? '0.6-1.4x' : i === 3 ? '0.5x' : '0x'}</span>
                  </div>
                ))}
              </Stack>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ margin: '0 0 20px', textAlign: 'center' }}>
        <div style={{ color: '#9a9cff', fontSize: '0.75rem', letterSpacing: '2px', fontWeight: '800', marginBottom: '8px' }}>BALANCE</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '12px 18px', borderRadius: '24px', border: '1px solid rgba(112,0,255,0.25)' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>{formatBalance(user.balance)}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#00ffaa' }}>$FEST</span>
        </div>
      </div>

      <div style={{ 
        background: 'linear-gradient(135deg, #1a0b2e 0%, #0a0a0a 100%)', 
        borderRadius: '40px', 
        padding: '25px', 
        border: '4px solid #7000ff',
        boxShadow: '0 0 40px rgba(112,0,255,0.4), inset 0 0 20px rgba(112,0,255,0.2)',
        position: 'relative'
      }}>
        {/* LED Strip Top */}
        <div style={{ position: 'absolute', top: '10px', left: '40px', right: '40px', height: '2px', background: '#00d4ff', boxShadow: '0 0 10px #00d4ff' }} />

        {/* Display Screen */}
        <div style={{ 
          background: '#000', 
          margin: '0 0 25px 0',
          padding: '30px 20px', 
          textAlign: 'center', 
          borderRadius: '25px',
          border: '2px solid #7000ff',
          boxShadow: 'inset 0 0 15px rgba(112,0,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '120px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#00ffaa', lineHeight: 1, textAlign: 'center' }}>
              {spinning ? 'SPINNING...' : `${formatFestAmount(gameResult?.payout)} $FEST`}
            </div>
          </div>
        </div>
        {/* Reels Area */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          justifyContent: 'center',
          padding: '15px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '30px',
          border: '1px solid rgba(112,0,255,0.2)'
        }}>
          <Reel spinning={spinning} targetIndex={results[0]} delay={0} color="#ff0080" />
          <Reel spinning={spinning} targetIndex={results[1]} delay={1} color="#7000ff" />
          <Reel spinning={spinning} targetIndex={results[2]} delay={2} color="#00d4ff" />
        </div>

        {/* Control Grid */}
        <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '16px', alignItems: 'stretch' }}>
          <GameButton 
            onClick={handleSpin} 
            loading={spinning}
            color="#00d4ff"
            style={{ height: '70px', borderRadius: '25px', boxShadow: '0 0 20px rgba(0,212,255,0.4)' }}
          >
            <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#000' }}>SPIN</span>
          </GameButton>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            background: '#050014',
            border: '2px solid #ff0080',
            borderRadius: '25px',
            padding: '0 10px',
            height: '70px',
            boxShadow: '0 0 15px rgba(255,0,128,0.25)'
          }}>
            <button
              type="button"
              onClick={() => {
                setBetIndex((p) => Math.max(0, p - 1));
                tg?.HapticFeedback?.impactOccurred('light');
              }}
              disabled={spinning}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '16px',
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '1.25rem',
                fontWeight: '900',
                cursor: spinning ? 'not-allowed' : 'pointer'
              }}
            >
              -
            </button>
            <div style={{ flex: 1, textAlign: 'center', color: '#fff', fontWeight: '900', fontSize: '1.35rem' }}>
              {currentBet}
            </div>
            <button
              type="button"
              onClick={() => {
                setBetIndex((p) => Math.min(BETS.length - 1, p + 1));
                tg?.HapticFeedback?.impactOccurred('light');
              }}
              disabled={spinning}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '16px',
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '1.25rem',
                fontWeight: '900',
                cursor: spinning ? 'not-allowed' : 'pointer'
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {spinning === false && gameResult?.payout > 0 && winAnimationData && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.7)', pointerEvents: 'none' }}
          >
             <Lottie animationData={winAnimationData} style={{ height: 350 }} loop={false} />
          </motion.div>
        )}
      </AnimatePresence>

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
                  +{(lastWinAmount * 0.2).toFixed(1)} $FEST Extra!
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
                  +20% Extra
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

export default SlotPage;
