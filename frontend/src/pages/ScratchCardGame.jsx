import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Trophy,
  Gem,
  Sparkles,
  ShoppingBag,
  ArrowLeft,
  Hand,
  Eraser,
  CheckCircle,
  HelpCircle,
  Coins
} from 'lucide-react';

const TIERS_DETAILS = {
  mini: {
    id: 'mini',
    title: 'Mini Scratch',
    price: 10,
    maxPrize: 100,
    glowColor: 'rgba(16, 185, 129, 0.45)',
    tintFilter: 'hue-rotate(0deg) saturate(1.1)', // Green (base)
  },
  mega: {
    id: 'mega',
    title: 'Mega Scratch',
    price: 100,
    maxPrize: 1000,
    glowColor: 'rgba(59, 130, 246, 0.55)',
    tintFilter: 'hue-rotate(100deg) saturate(1.4) brightness(0.9)', // Blue
  },
  jackpot: {
    id: 'jackpot',
    title: 'Jackpot Scratch',
    price: 300,
    maxPrize: 3000,
    glowColor: 'rgba(168, 85, 247, 0.55)',
    tintFilter: 'hue-rotate(190deg) saturate(1.6) brightness(0.9)', // Purple
  },
  festillion: {
    id: 'festillion',
    title: 'Festillion Scratch',
    price: 500,
    maxPrize: 5000,
    glowColor: 'rgba(245, 158, 11, 0.65)',
    tintFilter: 'hue-rotate(-45deg) saturate(2) brightness(1.15)', // Gold/Orange
  }
};

const TIERS_KEYS = ['mini', 'mega', 'jackpot', 'festillion'];

const ScratchCardGame = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, buyScratchCard, playScratchCard } = useUser();
  
  const [activeTab, setActiveTab] = useState('shop');
  const [selectedInventoryTierIndex, setSelectedInventoryTierIndex] = useState(0);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameResult, setGameResult] = useState(null); // { grid, reward, newBalance }
  const [scratchPercent, setScratchPercent] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  
  const [toolMode, setToolMode] = useState('hand');
  
  const [buyingCard, setBuyingCard] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState(null); // 'success', 'error', 'loading'
  const [purchaseError, setPurchaseError] = useState('');
  const [showWinModal, setShowWinModal] = useState(false);
  const [errorToast, setErrorToast] = useState('');

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const moveCount = useRef(0);

  const activeTierKey = TIERS_KEYS[selectedInventoryTierIndex];
  const activeTier = TIERS_DETAILS[activeTierKey];
  const availableCount = user?.scratchCardsCount?.[activeTierKey] || 0;

  useEffect(() => {
    if (isPlaying) {
      setToolMode('scratcher');
    } else {
      setToolMode('hand');
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying && canvasRef.current) {
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, gameResult]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Ensure we are drawing normally (source-over)
    ctx.globalCompositeOperation = 'source-over';

    // Clear
    ctx.clearRect(0, 0, 300, 150);

    // Create a luxury gold-champagne-silver metallic gradient
    const grad = ctx.createLinearGradient(0, 0, 300, 150);
    grad.addColorStop(0, '#cbd5e1'); // Silver
    grad.addColorStop(0.2, '#fef08a'); // Champagne Gold
    grad.addColorStop(0.5, '#ffffff'); // Platinum Highlight
    grad.addColorStop(0.8, '#fef08a'); // Champagne Gold
    grad.addColorStop(1, '#94a3b8'); // Darker metallic silver
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 300, 150);

    // Draw premium diagonal grid texture
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)'; // Soft gold lines
    ctx.lineWidth = 1.5;
    for (let i = -150; i < 300; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 150, 150);
      ctx.stroke();
    }

    // Gold inner border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, 294, 144);

    // Subtle dark gold pattern dots
    ctx.fillStyle = 'rgba(212, 175, 55, 0.6)';
    const points = [
      { x: 30, y: 30 }, { x: 270, y: 30 },
      { x: 30, y: 120 }, { x: 270, y: 120 },
      { x: 150, y: 25 }, { x: 150, y: 125 }
    ];
    points.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Elegant text guide
    ctx.fillStyle = '#1e293b';
    ctx.font = '900 13px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐ SCRATCH HERE ⭐', 150, 75);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const xCSS = clientX - rect.left;
    const yCSS = clientY - rect.top;

    // Convert CSS layout coordinate mapping to fixed 300x150 buffer resolution
    return {
      x: (xCSS / rect.width) * 300,
      y: (yCSS / rect.height) * 150
    };
  };

  const handleStartDrawing = (e) => {
    if (!isPlaying || toolMode !== 'scratcher' || isRevealed) return;
    isDrawing.current = true;
    const pos = getMousePos(e);
    lastPos.current = pos;
    scratch(pos.x, pos.y, true);
  };

  const handleDraw = (e) => {
    if (!isDrawing.current || !isPlaying || toolMode !== 'scratcher' || isRevealed) return;
    if (e.cancelable) e.preventDefault();
    
    const pos = getMousePos(e);
    scratch(pos.x, pos.y);
    lastPos.current = pos;

    moveCount.current++;
    if (moveCount.current % 3 === 0) {
      calculateScratchPercentage();
    }
  };

  const handleStopDrawing = () => {
    isDrawing.current = false;
    if (isPlaying && !isRevealed) {
      calculateScratchPercentage();
    }
  };

  const scratch = (x, y, start = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 32; 

    ctx.beginPath();
    if (start) {
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const calculateScratchPercentage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const imgData = ctx.getImageData(0, 0, 300, 150);
    const pixels = imgData.data;
    const totalPixels = pixels.length / 4;
    let clearedCount = 0;
    
    // Check alpha values less than 128 to capture partially scratched areas
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 128) {
        clearedCount++;
      }
    }

    
    const percent = Math.round((clearedCount / totalPixels) * 100);
    setScratchPercent(percent);

    if (percent >= 80) {
      revealCardFully();
    }
  };

  const revealCardFully = () => {
    setIsRevealed(true);
    setScratchPercent(100);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    triggerConfetti();

    setTimeout(() => {
      setShowWinModal(true);
    }, 800);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    });
    
    if (activeTierKey === 'jackpot' || activeTierKey === 'festillion') {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 }
        });
      }, 250);
    }
  };

  const handleBuyCard = async () => {
    if (!buyingCard) return;
    setPurchaseStatus('loading');
    
    const res = await buyScratchCard(buyingCard.id);
    
    if (res.success) {
      setPurchaseStatus('success');
      confetti({
        particleCount: 40,
        spread: 30,
        origin: { y: 0.8 }
      });
      setTimeout(() => {
        setBuyingCard(null);
        setPurchaseStatus(null);
      }, 1500);
    } else {
      setPurchaseStatus('error');
      setPurchaseError(res.error || 'Failed to complete purchase');
    }
  };

  const handleInitScratch = async () => {
    if (isPlaying) return;
    if (availableCount < 1) {
      showError('You do not have any cards in this category!');
      return;
    }

    setIsPlaying(true);
    setIsRevealed(false);
    setScratchPercent(0);
    setGameResult(null);

    const res = await playScratchCard(activeTierKey);
    if (res.success) {
      setGameResult({
        grid: res.grid,
        reward: res.reward,
        newBalance: res.newBalance
      });
    } else {
      setIsPlaying(false);
      showError(res.error || 'Failed to initialize scratch card');
    }
  };

  const showError = (msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(''), 3000);
  };

  const handleCloseWinModal = () => {
    setShowWinModal(false);
    setIsPlaying(false);
    setIsRevealed(false);
    setGameResult(null);
    setScratchPercent(0);
  };

  const handleSwipeEnd = (e, info) => {
    if (isPlaying) return;
    
    const offsetThreshold = 60;
    const velocityThreshold = 0.3;

    if (info.offset.x < -offsetThreshold || info.velocity.x < -velocityThreshold) {
      if (selectedInventoryTierIndex < TIERS_KEYS.length - 1) {
        setSelectedInventoryTierIndex(selectedInventoryTierIndex + 1);
      }
    } else if (info.offset.x > offsetThreshold || info.velocity.x > velocityThreshold) {
      if (selectedInventoryTierIndex > 0) {
        setSelectedInventoryTierIndex(selectedInventoryTierIndex - 1);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99,
        background: '#07090e',
        color: '#fff',
        padding: '16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              right: '20px',
              background: 'rgba(239, 68, 68, 0.95)',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontWeight: '600',
              fontSize: '0.85rem'
            }}
          >
            <HelpCircle size={18} />
            <span>{errorToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '30px', marginBottom: '14px', flexShrink: 0 }}>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.4rem', fontWeight: '900', margin: 0, background: 'linear-gradient(135deg, #ffd700, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <Trophy size={20} style={{ stroke: '#f59e0b', fill: '#ffd700' }} /> SCRATCH FEST
        </h1>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '14px', marginBottom: '16px', flexShrink: 0 }}>
        <button
          onClick={() => { if (!isPlaying) setActiveTab('shop'); }}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '11px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: '750',
            cursor: isPlaying ? 'not-allowed' : 'pointer',
            background: activeTab === 'shop' ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: activeTab === 'shop' ? '#fff' : 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <ShoppingBag size={16} /> Buy Cards
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '11px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: '750',
            cursor: 'pointer',
            background: activeTab === 'inventory' ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: activeTab === 'inventory' ? '#fff' : 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Trophy size={16} /> My Inventory
          {Object.values(user?.scratchCardsCount || {}).reduce((a, b) => a + b, 0) > 0 && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          )}
        </button>
      </div>

      {/* Balance Section - Under the tab to occupy the blank space */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '14px 18px',
          width: '100%',
          maxWidth: '350px',
          margin: '0 auto 16px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(255,215,0,0.1)', borderRadius: '10px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coins size={20} style={{ color: '#ffd700' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Balance</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff', fontFamily: 'monospace' }}>
              {(user?.balance || 0).toLocaleString()} <span style={{ fontSize: '0.8rem', color: '#ffd700' }}>$FEST</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'shop' ? (
            <motion.div
              key="shop-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid-cols-2"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}
            >
              {TIERS_KEYS.map((key) => {
                const tier = TIERS_DETAILS[key];
                return (
                  <div
                    key={key}
                    style={{
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '20px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: `0 8px 24px rgba(0, 0, 0, 0.25), 0 0 25px ${tier.glowColor}`,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Card template with ScratchCard.png background */}
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1.5',
                        borderRadius: '12px',
                        backgroundImage: 'url(/ScratchCard.png)',
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        position: 'relative',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        overflow: 'hidden',
                        filter: tier.tintFilter,
                        marginBottom: '8px'
                      }}
                    >
                      {/* Integrated Text Content Placed In Blank Space (lower half of card) */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '42%', 
                          left: '8%',
                          right: '8%',
                          bottom: '8%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'center',
                          color: '#fff',
                          pointerEvents: 'none'
                        }}
                      >
                        <h4 style={{
                          margin: 0,
                          fontSize: '0.72rem',
                          fontWeight: '900',
                          fontFamily: '"Outfit", sans-serif',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: '#ffd700',
                          textShadow: '1px 1px 0px #031c10, 0 1px 2px rgba(0,0,0,0.6)'
                        }}>
                          {tier.title}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
                          <span style={{
                            fontSize: '0.45rem',
                            letterSpacing: '0.5px',
                            fontWeight: '800',
                            color: '#a7f3d0',
                            opacity: 0.8,
                            textShadow: '1px 1px 0px #031c10'
                          }}>
                            MAX PRIZE
                          </span>
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: '950',
                            fontFamily: 'monospace',
                            color: '#ffffff',
                            textShadow: '1px 1px 0px #031c10, 0 1.5px 3px rgba(0,0,0,0.8)'
                          }}>
                            {tier.maxPrize} $FEST
                          </span>
                        </div>
                        
                        <span style={{
                          fontSize: '0.52rem',
                          background: 'rgba(0, 28, 16, 0.75)',
                          border: '1px solid rgba(255, 215, 0, 0.25)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontWeight: '900',
                          color: '#ffd700',
                          textShadow: '1px 1px 0px #000',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)'
                        }}>
                          {tier.price} $FEST
                        </span>
                      </div>
                    </div>

                    {/* Buy Button */}
                    <button
                      onClick={() => setBuyingCard(tier)}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#fff',
                        padding: '10px 0',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Buy Card
                    </button>
                  </div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="inventory-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              {/* Tool Mode selector (only shown when game is active) */}
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  padding: '3px',
                  marginBottom: '12px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  opacity: isPlaying ? 1 : 0.4,
                  transition: 'opacity 0.2s',
                  flexShrink: 0
                }}
              >
                <button
                  onClick={() => { if (isPlaying) setToolMode('hand'); }}
                  disabled={!isPlaying}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: toolMode === 'hand' && isPlaying ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: toolMode === 'hand' && isPlaying ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: isPlaying ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Hand size={14} /> Hand
                </button>
                <button
                  onClick={() => { if (isPlaying) setToolMode('scratcher'); }}
                  disabled={!isPlaying}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '9px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: toolMode === 'scratcher' && isPlaying ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: toolMode === 'scratcher' && isPlaying ? '#fff' : 'rgba(255,255,255,0.4)',
                    cursor: isPlaying ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Eraser size={14} /> Scratcher
                </button>
              </div>

              {/* Floated 3D Card Area */}
              <div style={{ width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '260px', flexShrink: 0 }}>
                
                {!isPlaying && (
                  <div style={{ position: 'absolute', top: -10, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }}>
                    ← Swipe to Switch Categories →
                  </div>
                )}

                <motion.div
                  drag={isPlaying ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={handleSwipeEnd}
                  animate={{ x: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  style={{
                    width: '92%',
                    maxWidth: '350px',
                    aspectRatio: '1.5',
                    cursor: isPlaying ? (toolMode === 'scratcher' ? 'crosshair' : 'grab') : 'grab',
                    position: 'relative',
                    touchAction: isPlaying && toolMode === 'scratcher' ? 'none' : 'pan-y'
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTierKey}
                      initial={{ opacity: 0, scale: 0.93, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.93, y: -10 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '24px',
                        backgroundImage: 'url(/ScratchCard.png)',
                        backgroundSize: '100% 100%',
                        backgroundRepeat: 'no-repeat',
                        filter: activeTier.tintFilter,
                        boxShadow: `0 20px 40px rgba(0,0,0,0.55), 0 0 35px ${activeTier.glowColor}`,
                        position: 'absolute',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Blank Space Container (positioned over the bottom green area exactly) */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '36%',
                          left: '6%',
                          right: '6%',
                          bottom: '6%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          borderRadius: '12px',
                          border: '2px solid rgba(212, 175, 55, 0.25)',
                          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.6)'
                        }}
                      >
                        {availableCount === 0 && !isPlaying ? (
                          /* Blank State inside the card */
                          <div style={{ textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <ShoppingBag size={22} style={{ color: '#ffd700', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                            <h4 style={{
                              margin: 0,
                              fontSize: '0.8rem',
                              fontWeight: '900',
                              color: '#ffd700',
                              textShadow: '1px 1px 0px #031c10, 0 1px 2px rgba(0,0,0,0.8)'
                            }}>{activeTier.title}</h4>
                            <span style={{ fontSize: '0.58rem', color: '#a7f3d0', textShadow: '1px 1px 0px #000' }}>0 Cards Available</span>
                            <button
                              onClick={() => setActiveTab('shop')}
                              style={{
                                marginTop: '4px',
                                background: '#ffd700',
                                color: '#000',
                                border: 'none',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                fontSize: '0.62rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              Go Shop
                            </button>
                          </div>
                        ) : !isPlaying ? (
                          /* Holds Cards - preview inside card */
                          <div style={{ textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <h4 style={{
                              margin: 0,
                              fontSize: '0.85rem',
                              fontWeight: '900',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              color: '#ffd700',
                              textShadow: '1.5px 1.5px 0px #031c10, 0 2px 4px rgba(0,0,0,0.9)'
                            }}>
                              {activeTier.title}
                            </h4>
                            <span style={{
                              fontSize: '0.65rem',
                              fontWeight: '900',
                              color: '#ffffff',
                              textShadow: '1px 1px 0px #031c10, 0 1px 2px rgba(0,0,0,0.9)'
                            }}>
                              Inventory: <strong style={{ color: '#ffd700', fontSize: '0.75rem' }}>{availableCount}</strong>
                            </span>
                            <span style={{
                              fontSize: '0.52rem',
                              letterSpacing: '0.5px',
                              color: '#a7f3d0',
                              opacity: 0.9,
                              textShadow: '1px 1px 0px #031c10'
                            }}>
                              TAP SCRATCH TO PLAY
                            </span>
                          </div>
                        ) : (
                          /* Playing Mode: Render 6 boxes and metallic scratch layer */
                          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                            
                            {/* 6 Boxes Grid (3 Columns, 2 Rows) */}
                            {gameResult && (
                              <div
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(3, 1fr)',
                                  gridTemplateRows: 'repeat(2, 1fr)',
                                  gap: '4px',
                                  padding: '4px',
                                  background: 'rgba(0, 24, 14, 0.95)',
                                  borderRadius: '10px'
                                }}
                              >
                                {gameResult.grid.map((symbol, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      background: 'rgba(2, 48, 32, 0.45)',
                                      border: '1px dashed rgba(212, 175, 55, 0.4)',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      position: 'relative'
                                    }}
                                  >
                                    {symbol === 'diamond' ? (
                                      <Gem
                                        size={18}
                                        style={{
                                          color: '#00e5ff',
                                          filter: 'drop-shadow(0 0 5px rgba(0, 229, 255, 0.6))'
                                        }}
                                      />
                                    ) : (
                                      <span style={{ fontSize: '1.2rem' }}>🐻</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Metallic Scratch Layer Canvas (placed exactly over the boxes) */}
                            <canvas
                              ref={canvasRef}
                              width={300}
                              height={150}
                              onMouseDown={handleStartDrawing}
                              onMouseMove={handleDraw}
                              onMouseUp={handleStopDrawing}
                              onMouseLeave={handleStopDrawing}
                              onTouchStart={handleStartDrawing}
                              onTouchMove={handleDraw}
                              onTouchEnd={handleStopDrawing}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                zIndex: 10,
                                borderRadius: '10px',
                                cursor: toolMode === 'scratcher' ? 'crosshair' : 'default',
                                opacity: isRevealed ? 0 : 1,
                                transition: 'opacity 0.4s ease-out',
                                pointerEvents: isRevealed ? 'none' : 'auto'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Control Action Button */}
              <div style={{ marginTop: '12px', width: '100%', maxWidth: '350px', textAlign: 'center', flexShrink: 0 }}>
                {!isPlaying ? (
                  <button
                    onClick={handleInitScratch}
                    disabled={availableCount === 0}
                    style={{
                      background: availableCount === 0 ? 'rgba(255,255,255,0.03)' : 'linear-gradient(135deg, #ffd700, #f59e0b)',
                      color: availableCount === 0 ? 'rgba(255,255,255,0.2)' : '#000',
                      border: availableCount === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      padding: '14px 40px',
                      borderRadius: '16px',
                      fontSize: '0.9rem',
                      fontWeight: '900',
                      cursor: availableCount === 0 ? 'not-allowed' : 'pointer',
                      width: '90%',
                      boxShadow: availableCount === 0 ? 'none' : '0 6px 20px rgba(245, 158, 11, 0.25)',
                      transition: 'all 0.2s'
                    }}
                  >
                    Scratch Card
                  </button>
                ) : (
                  <div style={{ width: '90%', margin: '0 auto', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '12px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Progress: {scratchPercent}%</span>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${scratchPercent}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #10b981)', borderRadius: '3px', transition: 'width 0.1s' }} />
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                      {toolMode === 'scratcher' ? 'Drag on the card cover to scratch!' : 'Toggle Scratcher mode above to scratch cover!'}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom selectors */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', width: '100%', padding: '0 8px', justifyContent: 'center', flexShrink: 0 }}>
                {TIERS_KEYS.map((key, index) => {
                  const count = user?.scratchCardsCount?.[key] || 0;
                  const isSelected = selectedInventoryTierIndex === index;

                  return (
                    <button
                      key={key}
                      onClick={() => { if (!isPlaying) setSelectedInventoryTierIndex(index); }}
                      style={{
                        flex: 1,
                        maxWidth: '80px',
                        aspectRatio: '1.1',
                        borderRadius: '16px',
                        border: isSelected ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                        background: isSelected ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.02)',
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isPlaying ? 'not-allowed' : 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? '0 4px 12px rgba(245, 158, 11, 0.1)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '0.55rem', opacity: isSelected ? 1 : 0.5, fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>{key}</span>
                      <Gem size={14} style={{ color: isSelected ? '#ffd700' : 'rgba(255,255,255,0.4)' }} />
                      
                      {count > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            background: '#3b82f6',
                            color: '#fff',
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 5px rgba(59, 130, 246, 0.4)'
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Buy confirmation Modal */}
      <AnimatePresence>
        {buyingCard && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (purchaseStatus !== 'loading') setBuyingCard(null); }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
            />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#0e1017',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                padding: '24px',
                zIndex: 101,
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              {purchaseStatus === 'loading' ? (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div className="skeleton-base" style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.6)' }}>PROCESSING TRANSACTION...</span>
                </div>
              ) : purchaseStatus === 'success' ? (
                <div style={{ padding: '30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '50%', padding: '12px' }}>
                    <CheckCircle size={32} color="#10b981" />
                  </div>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '1.2rem', fontWeight: '900' }}>PURCHASE SUCCESSFUL!</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Your card has been added to inventory.</p>
                </div>
              ) : purchaseStatus === 'error' ? (
                <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '50%', padding: '12px' }}>
                    <HelpCircle size={32} color="#ef4444" />
                  </div>
                  <h3 style={{ margin: '8px 0 0 0', fontSize: '1.1rem', fontWeight: '900', color: '#ef4444' }}>PURCHASE FAILED</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px' }}>{purchaseError}</p>
                  <button
                    onClick={() => setPurchaseStatus(null)}
                    style={{
                      marginTop: '16px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '8px 24px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ width: '40px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '20px' }} />
                  <Gem size={32} style={{ color: '#ffd700', marginBottom: '8px' }} />
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: '900' }}>Buy {buyingCard.title}</h3>
                  <p style={{ margin: '0 0 24px 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', maxWidth: '280px' }}>
                    Are you sure you want to purchase a {buyingCard.title} for <strong style={{ color: '#ffd700' }}>{buyingCard.price} $FEST</strong>?
                  </p>

                  <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button
                      onClick={() => setBuyingCard(null)}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        color: '#fff',
                        padding: '14px 0',
                        borderRadius: '16px',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBuyCard}
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
                        color: '#000',
                        border: 'none',
                        padding: '14px 0',
                        borderRadius: '16px',
                        fontSize: '0.9rem',
                        fontWeight: '900',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)'
                      }}
                    >
                      Confirm Buy
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Winner Reward Claim Modal */}
      <AnimatePresence>
        {showWinModal && gameResult && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(6px)' }}
            />
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: '360px',
                background: 'linear-gradient(135deg, #0e1017, #07080c)',
                border: '1px solid rgba(255, 215, 0, 0.15)',
                borderRadius: '24px',
                padding: '30px 24px',
                zIndex: 201,
                boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(245, 158, 11, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              <div style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid #ffd700', borderRadius: '50%', padding: '16px', marginBottom: '16px' }}>
                <Sparkles size={36} className="gold-text" style={{ color: '#ffd700' }} />
              </div>
              
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {gameResult.reward > 0 ? 'CONGRATULATIONS!' : 'BETTER LUCK NEXT TIME!'}
              </h2>
              
              <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                You revealed <strong style={{ color: '#00e5ff' }}>{gameResult.grid.filter(s => s === 'diamond').length}</strong> diamonds on your {activeTier.title}!
              </p>

              <div style={{ background: 'rgba(255, 215, 0, 0.05)', border: '1px dashed rgba(255, 215, 0, 0.25)', borderRadius: '16px', padding: '16px 24px', width: '100%', marginBottom: '24px' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>YOUR PRIZE</span>
                <span style={{ fontSize: '2rem', fontWeight: '950', color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                  +{gameResult.reward} <span style={{ fontSize: '1.1rem', fontWeight: '800' }}>$FEST</span>
                </span>
              </div>

              <button
                onClick={handleCloseWinModal}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #ffd700, #f59e0b)',
                  color: '#000',
                  border: 'none',
                  padding: '14px 0',
                  borderRadius: '16px',
                  fontSize: '0.95rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(245, 158, 11, 0.3)'
                }}
              >
                Claim Reward
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ScratchCardGame;
