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

// Card Configurations matching the backend configuration
const TIERS_DETAILS = {
  mini: {
    id: 'mini',
    title: 'Mini Scratch',
    price: 10,
    maxPrize: 100,
    color: 'from-emerald-500 to-teal-700',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    badgeColor: 'bg-emerald-500'
  },
  mega: {
    id: 'mega',
    title: 'Mega Scratch',
    price: 100,
    maxPrize: 1000,
    color: 'from-blue-600 to-indigo-800',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    badgeColor: 'bg-blue-500'
  },
  jackpot: {
    id: 'jackpot',
    title: 'Jackpot Scratch',
    price: 300,
    maxPrize: 3000,
    color: 'from-purple-600 to-fuchsia-900',
    glowColor: 'rgba(168, 85, 247, 0.4)',
    badgeColor: 'bg-purple-500'
  },
  festillion: {
    id: 'festillion',
    title: 'Festillion Scratch',
    price: 500,
    maxPrize: 5000,
    color: 'from-amber-500 to-orange-700',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    badgeColor: 'bg-amber-500'
  }
};

const TIERS_KEYS = ['mini', 'mega', 'jackpot', 'festillion'];

const ScratchCardGame = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, buyScratchCard, playScratchCard } = useUser();
  
  const [activeTab, setActiveTab] = useState('shop'); // 'shop' or 'inventory'
  const [selectedInventoryTierIndex, setSelectedInventoryTierIndex] = useState(0);
  
  // Game states
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameResult, setGameResult] = useState(null); // { grid, reward, newBalance }
  const [scratchPercent, setScratchPercent] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Scratcher modes
  const [toolMode, setToolMode] = useState('hand'); // 'hand' or 'scratcher'
  
  // Modals & overlay
  const [buyingCard, setBuyingCard] = useState(null); // config object or null
  const [purchaseStatus, setPurchaseStatus] = useState(null); // 'success', 'error', 'loading'
  const [purchaseError, setPurchaseError] = useState('');
  const [showWinModal, setShowWinModal] = useState(false);
  const [errorToast, setErrorToast] = useState('');

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const activeTierKey = TIERS_KEYS[selectedInventoryTierIndex];
  const activeTier = TIERS_DETAILS[activeTierKey];
  const availableCount = user?.scratchCardsCount?.[activeTierKey] || 0;

  // Auto-switch tool mode to scratcher once user clicks scratch
  useEffect(() => {
    if (isPlaying) {
      setToolMode('scratcher');
    } else {
      setToolMode('hand');
    }
  }, [isPlaying]);

  // Initializing canvas
  useEffect(() => {
    if (isPlaying && canvasRef.current) {
      initCanvas();
    }
  }, [isPlaying, gameResult]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set width and height dynamically matching element dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 320;
    canvas.height = rect.height || 220;

    // Fill with background gradient (greeny base)
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0f766e'); // Teal-700
    grad.addColorStop(1, '#115e59'); // Teal-800
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load cover image if possible, fall back to textured paint
    const img = new Image();
    img.src = '/ScratchCard.jpg';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      addOverlayDetails(ctx, canvas.width, canvas.height);
    };
    img.onerror = () => {
      // Paint standard silver-white cover with texture
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Cracks texture
      ctx.strokeStyle = 'rgba(15, 118, 110, 0.2)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
      }
      addOverlayDetails(ctx, canvas.width, canvas.height);
    };
  };

  const addOverlayDetails = (ctx, w, h) => {
    // Elegant border
    ctx.strokeStyle = '#f59e0b'; // amber
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Title / Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px "Outfit", sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'center';
    ctx.fillText('EARN FEST', w / 2, h / 2 - 20);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px "Outfit", sans-serif';
    ctx.shadowBlur = 2;
    ctx.fillText('SCRATCH TO REVEAL REWARDS', w / 2, h / 2 + 15);

    // Reset shadow
    ctx.shadowBlur = 0;
  };

  // Scratch Drawing Handlers
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Handle touches
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
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
    // Prevent scrolling on touch screens
    if (e.cancelable) e.preventDefault();
    
    const pos = getMousePos(e);
    scratch(pos.x, pos.y);
    lastPos.current = pos;
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
    ctx.lineWidth = 32; // Size of scratch brush

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
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    const totalPixels = pixels.length / 4;
    let clearedCount = 0;
    
    // Check alpha values of pixels
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) {
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
    
    // Clear canvas completely
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Trigger confetti
    triggerConfetti();

    // Show win modal
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
    
    // Double explosion for festillion/jackpot
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

  // Buy Card Action
  const handleBuyCard = async () => {
    if (!buyingCard) return;
    setPurchaseStatus('loading');
    
    const res = await buyScratchCard(buyingCard.id);
    
    if (res.success) {
      setPurchaseStatus('success');
      // Trigger tiny success confetti
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

  // Scratch Action (Trigger backend resolution)
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

  // Carousel Swipe Logic (Framer Motion)
  const handleSwipeEnd = (e, info) => {
    if (isPlaying) return; // Disable switching during gameplay
    
    const offsetThreshold = 60;
    const velocityThreshold = 0.3;

    if (info.offset.x < -offsetThreshold || info.velocity.x < -velocityThreshold) {
      // Swipe Left -> Go to next tier
      if (selectedInventoryTierIndex < TIERS_KEYS.length - 1) {
        setSelectedInventoryTierIndex(selectedInventoryTierIndex + 1);
      }
    } else if (info.offset.x > offsetThreshold || info.velocity.x > velocityThreshold) {
      // Swipe Right -> Go to previous tier
      if (selectedInventoryTierIndex > 0) {
        setSelectedInventoryTierIndex(selectedInventoryTierIndex - 1);
      }
    }
  };

  return (
    <div className="main-content" style={{ padding: '16px', minHeight: '100vh', background: '#090a0f', color: '#fff', position: 'relative', overflowX: 'hidden' }}>
      
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
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/games')}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.5rem', fontWeight: '900', margin: 0, background: 'linear-gradient(135deg, #fff, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <Trophy size={22} className="gold-text" style={{ stroke: '#f59e0b' }} /> SCRATCH FEST
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)', padding: '6px 12px', borderRadius: '12px' }}>
          <Coins size={14} className="gold-text" />
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#ffd700' }}>{(user?.balance || 0).toLocaleString()}</span>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '14px', marginBottom: '24px' }}>
        <button
          onClick={() => { if (!isPlaying) setActiveTab('shop'); }}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '11px',
            border: 'none',
            fontSize: '0.9rem',
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
          <ShoppingBag size={18} /> Buy Cards
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '11px',
            border: 'none',
            fontSize: '0.9rem',
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
          <Trophy size={18} /> My Inventory
          {Object.values(user?.scratchCardsCount || {}).reduce((a, b) => a + b, 0) > 0 && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          )}
        </button>
      </div>

      {/* Main Content Areas */}
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
                    background: `linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))`,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    backdropFilter: 'blur(8px)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Background Glow */}
                  <div style={{ position: 'absolute', top: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: tier.glowColor, filter: 'blur(30px)', pointerEvents: 'none', zIndex: 0 }} />

                  {/* Card Art Thumbnail */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1.4',
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${tier.color.split(' ')[1]} 0%, ${tier.color.split(' ')[3]} 100%)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      border: '1px solid rgba(255,255,255,0.1)',
                      marginBottom: '16px',
                      boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.3)',
                      zIndex: 1
                    }}
                  >
                    <img
                      src="/ScratchCard.jpg"
                      alt="Art"
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.15,
                        borderRadius: '12px'
                      }}
                    />
                    <Gem size={26} style={{ color: '#ffd700', filter: `drop-shadow(0 0 8px ${tier.glowColor})`, marginBottom: '4px' }} />
                    <span style={{ fontSize: '0.65rem', letterSpacing: '2px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Max Reward</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{tier.maxPrize} $FEST</span>
                  </div>

                  {/* Stats */}
                  <div style={{ textAlign: 'center', width: '100%', zIndex: 1, marginBottom: '14px' }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: '800' }}>{tier.title}</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#ffd700', fontWeight: 'bold' }}>Cost: {tier.price} $FEST</p>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => setBuyingCard(tier)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '10px 0',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      zIndex: 1,
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
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
            {/* Scratcher Control Tools (only show if playing) */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '3px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)', opacity: isPlaying ? 1 : 0.4, transition: 'opacity 0.2s' }}>
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
                <Hand size={14} /> Hand (Move)
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

            {/* Swipeable Card Workspace */}
            <div style={{ width: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '310px', overflow: 'hidden' }}>
              
              {/* Swipe Guide Text */}
              {!isPlaying && (
                <div style={{ position: 'absolute', top: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>← Swipe left/right to change card type →</span>
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
                  height: '280px',
                  cursor: isPlaying ? (toolMode === 'scratcher' ? 'crosshair' : 'grab') : 'grab',
                  position: 'relative',
                  touchAction: isPlaying && toolMode === 'scratcher' ? 'none' : 'pan-y'
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTierKey}
                    initial={{ opacity: 0, scale: 0.9, rotateY: 15 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 0.9, rotateY: -15 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '24px',
                      background: `linear-gradient(135deg, ${activeTier.color.split(' ')[1]} 0%, ${activeTier.color.split(' ')[3]} 100%)`,
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      boxShadow: `0 15px 40px rgba(0,0,0,0.4), 0 0 30px ${activeTier.glowColor}`,
                      position: 'absolute',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      transformStyle: 'preserve-3d',
                      perspective: 1000
                    }}
                  >
                    {/* Header info */}
                    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>{activeTier.title}</span>
                      <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold' }}>MAX {activeTier.maxPrize} $FEST</span>
                    </div>

                    {/* Inner workspace: can scratch if playing, else show info */}
                    <div style={{ flex: 1, position: 'relative', background: 'rgba(0,0,0,0.1)' }}>
                      {availableCount === 0 && !isPlaying ? (
                        /* Blank State */
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
                          <ShoppingBag size={40} style={{ opacity: 0.2, marginBottom: '8px' }} />
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem' }}>No Cards Available</h4>
                          <p style={{ margin: '0 0 14px 0', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', maxWidth: '180px' }}>Purchase some from the shop to start scratching.</p>
                          <button
                            onClick={() => setActiveTab('shop')}
                            style={{
                              background: '#fff',
                              color: '#000',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              fontWeight: '900',
                              cursor: 'pointer'
                            }}
                          >
                            Go to Shop
                          </button>
                        </div>
                      ) : !isPlaying ? (
                        /* Unscratched static preview */
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                          <img
                            src="/ScratchCard.jpg"
                            alt="Cover preview"
                            style={{
                              position: 'absolute',
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              opacity: 0.1,
                              zIndex: 0
                            }}
                          />
                          <div style={{ zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '50%', padding: '16px' }}>
                              <Gem size={28} style={{ color: '#ffd700' }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' }}>
                              You hold: <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{availableCount}</strong> cards
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Playing (scratching canvas + grid underneath) */
                        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                          
                          {/* Revealed Grid Underneath */}
                          {gameResult && (
                            <div style={{
                              width: '100%',
                              height: '100%',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, 1fr)',
                              gridTemplateRows: 'repeat(2, 1fr)',
                              gap: '6px',
                              padding: '8px',
                              background: '#090a0f',
                            }}>
                              {gameResult.grid.map((symbol, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {symbol === 'diamond' ? (
                                    <Gem
                                      size={22}
                                      style={{
                                        color: '#00e5ff',
                                        filter: 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.4))'
                                      }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: '1.4rem' }}>🐻</span>
                                  )}
                                  <span style={{ position: 'absolute', bottom: '3px', fontSize: '0.5rem', opacity: 0.2 }}>Box {idx + 1}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Scratchable Canvas Overlay */}
                          <canvas
                            ref={canvasRef}
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
                              cursor: toolMode === 'scratcher' ? 'crosshair' : 'default',
                              opacity: isRevealed ? 0 : 1,
                              transition: 'opacity 0.5s ease-out',
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

            {/* Scratch Button under the card */}
            <div style={{ marginTop: '4px', width: '100%', maxWidth: '350px', textAlign: 'center' }}>
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
                    fontSize: '0.95rem',
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
                    {toolMode === 'scratcher' ? 'Drag on the card cover to scratch it off!' : 'Switch to Scratcher tool to scratch cover!'}
                  </span>
                </div>
              )}
            </div>

            {/* Selectable inventory tier carousel navigation */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '30px', width: '100%', padding: '0 8px', justifyContent: 'center' }}>
              {TIERS_KEYS.map((key, index) => {
                const tier = TIERS_DETAILS[key];
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
                    
                    {/* Available badge blue dot in absolute position */}
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

      {/* Buying confirmation drawer overlay */}
      <AnimatePresence>
        {buyingCard && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (purchaseStatus !== 'loading') setBuyingCard(null); }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
            />
            
            {/* Drawer */}
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
                        border: '1px solid rgba(255,255,255,0.06)',
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(6px)' }}
            />
            
            {/* Modal Box */}
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

              {/* Big Reward Display */}
              <div style={{ background: 'rgba(255, 215, 0, 0.05)', border: '1px dashed rgba(255, 215, 0, 0.25)', borderRadius: '16px', padding: '16px 24px', width: '100%', marginBottom: '24px' }}>
                <span style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>YOUR PRIZE</span>
                <span style={{ fontSize: '2rem', fontWeight: '950', color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                  +{gameResult.reward} <span style={{ fontSize: '1.1rem', fontWeight: '800' }}>$FEST</span>
                </span>
              </div>

              {/* Confirm button */}
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
