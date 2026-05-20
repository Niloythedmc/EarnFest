import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bomb, Sparkles, ChevronLeft, Wallet, Play, CheckCircle2, XCircle } from 'lucide-react';
import { Card, Button, GameButton, GameCard } from '../components/UI';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { AdsClient } from '../utils/AdsClient';
import { toast } from 'sonner';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { formatBalance } from '../utils/formatters';


const MinesPage = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const { apiBase } = useConfig();

  const [bet, setBet] = useState(1000);
  const [gameId, setGameId] = useState(null);
  const [grid, setGrid] = useState(Array(9).fill(null));
  const [multiplier, setMultiplier] = useState(0.5);
  const [status, setStatus] = useState('idle'); // idle, playing, lost, claimed
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(null);

  const canClaim = status === 'playing' && grid.filter(cell => cell === 'safe').length > 0;

  const handleStart = async () => {
    if (user?.balance < bet) {
      toast.error('Insufficient balance');
      return;
    }

    setLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/mines/start`, {
        bet,
        telegramId: user?.telegramId
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        setGameId(response.data.gameId);
        setGrid(Array(9).fill(null));
        setMultiplier(0.5);
        setStatus('playing');
        refreshUser();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async (index) => {
    if (status !== 'playing' || grid[index] !== null || opening !== null) return;

    setOpening(index);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/mines/open`, {
        gameId,
        boxIndex: index,
        telegramId: user?.telegramId
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        const newGrid = [...grid];
        if (response.data.bomb) {
          // Reveal all bombs
          const allBombs = response.data.allBombs || [];
          allBombs.forEach(idx => {
            newGrid[idx] = 'bomb';
          });
          setGrid(newGrid);
          setStatus('lost');
          
          if (window.navigator.vibrate) {
            window.navigator.vibrate([200, 100, 200]);
          }
          toast.error('Mine exploded!', { icon: '💥' });
        } else {
          newGrid[index] = 'safe';
          setGrid(newGrid);
          setMultiplier(response.data.multiplier);
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Network error');
    } finally {
      setOpening(null);
    }
  };

  const handleClaim = async () => {
    if (!canClaim || loading) return;

    setLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/mines/claim`, {
        gameId,
        telegramId: user?.telegramId
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        setStatus('claimed');
        confetti({ particleCount: 100, spread: 60, origin: { y: 0.7 } });
        toast.success(`Won ${response.data.prize} $FEST!`);
        refreshUser();
        AdsClient.showInterstitial();
      }
    } catch {
      toast.error('Claim failed');
    } finally {
      setLoading(false);
    }
  };

  const shakeAnimation = {
    shake: {
      x: [0, -10, 10, -10, 10, -5, 5, 0],
      rotate: [0, -1, 1, -1, 1, 0],
      transition: { duration: 0.4, ease: "easeInOut" }
    }
  };

  if (!user) return null;

  return (
    <div className="main-content stack-vertical" style={{ paddingBottom: '120px', gap: '15px', justifyContent: 'center', minHeight: '85vh' }}>
      {/* Top Header - Super Minimalist */}
      <header className="flex-row-between" style={{ padding: '5px 0' }}>
        <div style={{ textAlign: 'left' }}>
          <h1 className="game-title" style={{ fontSize: '1.2rem' }}>MINES</h1>
          <p style={{ fontSize: '0.6rem', opacity: 0.4, fontWeight: '800', letterSpacing: '1px' }}>3 BOMBS • HIGH RISK</p>
        </div>

        <div className="flex-center" style={{ gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '5px 12px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Wallet size={12} className="gold-text" />
          <span className="font-gaming" style={{ fontSize: '0.75rem', fontWeight: '900' }}>{formatBalance(user?.balance)}</span>
        </div>
      </header>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', margin: '10px 0 0' }}>
        {[
          { label: 'Spin', image: '/Wheel.png', path: '/spin' },
          { label: 'Slots', image: '/Slot.png', path: '/slots' },
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

      {/* Stats Area - Compact */}
      <div className="flex-center" style={{ gap: '20px', margin: '5px 0' }}>
        <div className="stack-vertical" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontWeight: '900' }}>MULTIPLIER</span>
          <h2 className="gold-text font-gaming" style={{ fontSize: '1.4rem', lineHeight: '1' }}>{multiplier}x</h2>
        </div>
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
        <div className="stack-vertical" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontWeight: '900' }}>POTENTIAL</span>
          <h2 className="font-gaming" style={{ fontSize: '1.4rem', lineHeight: '1' }}>{formatBalance(bet * multiplier)}</h2>
        </div>
      </div>

      {/* The Grid with Shake Animation */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <motion.div 
          variants={shakeAnimation}
          animate={status === 'lost' ? 'shake' : ''}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            width: '100%',
            maxWidth: '280px',
            padding: '8px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.03)'
          }}
        >
          {grid.map((cell, i) => (
            <motion.div
              key={i}
              whileTap={status === 'playing' && !cell ? { scale: 0.94 } : {}}
              onClick={() => handleOpen(i)}
              style={{
                aspectRatio: '1/1',
                background: cell === 'safe' ? 'linear-gradient(135deg, #00ff88 0%, #00a878 100%)' :
                  cell === 'bomb' ? 'linear-gradient(135deg, #ff4b2b 0%, #ff416c 100%)' :
                    '#1a1a1a',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: status === 'playing' && !cell ? 'pointer' : 'default',
                border: cell ? 'none' : '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: cell ? '0 5px 15px rgba(0,0,0,0.4)' : 'none'
              }}
            >
              <AnimatePresence mode="wait">
                {opening === i ? (
                  <motion.div
                    key="loading"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1, rotate: 360 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  >
                    <Sparkles size={20} className="gold-text" />
                  </motion.div>
                ) : cell === 'safe' ? (
                  <motion.div 
                    key="safe" 
                    initial={{ scale: 0, rotate: -45 }} 
                    animate={{ scale: 1, rotate: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    {/* EarnFest Logo Indicator (Star + Sparkle) */}
                    <Sparkles size={24} color="#001f11" strokeWidth={3} />
                  </motion.div>
                ) : cell === 'bomb' ? (
                  <motion.div 
                    key="bomb" 
                    initial={{ scale: 0, rotate: 45 }} 
                    animate={{ scale: 1.1, rotate: 0 }}
                    style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' }}
                  >
                    <Bomb size={28} color="white" strokeWidth={2} />
                  </motion.div>
                ) : (
                  <div key="dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Controls Area - Minimalist */}
      <div style={{ width: '100%', maxWidth: '280px', margin: '0 auto' }}>
        {status === 'idle' || status === 'claimed' || status === 'lost' ? (
          <div className="stack-vertical" style={{ gap: '12px' }}>
            <div className="flex-row-between" style={{ padding: '0 5px' }}>
              <span className="font-gaming" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px' }}>BET: {formatBalance(bet)}</span>
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>MAX: 10K</span>
            </div>

            <input
              type="range" min="100" max="10000" step="100" value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary-gold)', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', appearance: 'none', cursor: 'pointer' }}
            />
            <GameButton
              onClick={handleStart}
              disabled={loading}
              style={{ height: '50px', width: '100%', borderRadius: '14px', fontSize: '0.85rem', fontWeight: '900', letterSpacing: '1px' }}
            >
              {loading ? 'STARTING...' : `PLAY GAME`}
            </GameButton>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              onClick={() => setStatus('idle')}
              style={{ flex: 1, height: '50px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: '900' }}
            >
              QUIT
            </Button>
            <GameButton
              onClick={handleClaim}
              disabled={!canClaim || loading}
              style={{
                flex: 2, height: '50px', borderRadius: '14px', fontSize: '0.85rem', fontWeight: '900',
                background: !canClaim ? 'rgba(255,255,255,0.05)' : 'var(--success)',
                color: !canClaim ? 'rgba(255,255,255,0.2)' : '#001f11'
              }}
            >
              {loading ? '...' : `CLAIM ${formatBalance(bet * multiplier)}`}
            </GameButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default MinesPage;
