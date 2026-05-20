import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import PvpWheel from '../components/PvpWheel';
import WinnerModal from '../components/WinnerModal';
import HistoryDetailModal from '../components/HistoryDetailModal';
import Skeleton from '../components/Skeleton';
import { formatBalance } from '../utils/formatters';
import { getStoredDeviceFingerprint } from '../utils/deviceFingerprint';
import '../styles/PvpPage.css';


const PvpPage = () => {
  const { user, refreshUser } = useUser();
  const { apiBase } = useConfig();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState({
    status: 'waiting',
    players: [],
    totalPool: 0,
    startTime: null,
    winner: null,
    winningAngle: 0,
    activeUsers: 0,
    lastGame: null,
    luckiest: null
  });
  const [joinAmount, setJoinAmount] = useState('2000');
  const [loading, setLoading] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCustom, setIsCustom] = useState(false);
  const [pvpConfig, setPvpConfig] = useState({ minJoin: 1000, isActive: true });
  const [shortcuts, setShortcuts] = useState(() => {
    const saved = localStorage.getItem('pvp_shortcuts');
    return saved ? JSON.parse(saved) : [2000, 4000, 10000, 20000];
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  const tg = window.Telegram?.WebApp;
  const headers = { 'x-telegram-init-data': tg?.initData };

  const selectShortcut = (amt, index) => {
    setJoinAmount(amt.toString());
    setIsCustom(false);
    setEditingIndex(index);
  };

  // Polling for game status
  useEffect(() => {

    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/pvp/status`);
        const newGame = res.data;
        
        // Detect state transition to finished to show modal (Resilient Trigger)
        if (newGame.status === 'finished' && !showWinnerModal) {
          console.log('Game Result Detected: Showing Winner Modal.');
          setShowWinnerModal(true);
          refreshUser(); // Refresh balance
        }

        // Detect if we transitioned to a COMPLETELY NEW game (waiting)
        if (newGame.gameId !== gameState.gameId && gameState.gameId !== undefined) {
           console.log(`New Game Detected: #${newGame.gameId}`);
           if (newGame.status === 'waiting') {
             setShowWinnerModal(false); // Close modal if a next game starts
           }
        }
        
        setGameState(newGame);
      } catch (e) {
        console.error('Failed to fetch PvP status', e);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, (gameState.status === 'rolling' || gameState.status === 'finished') ? 1000 : 2000);
    return () => clearInterval(interval);
  }, [apiBase, gameState.status, gameState.gameId, refreshUser, showWinnerModal]);


  useEffect(() => {
    if (gameState.status === 'pending' && gameState.startTime) {
      const timer = setInterval(() => {
        const remaining = Math.max(0, Math.floor((gameState.startTime - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining <= 0) clearInterval(timer);
      }, 500);
      return () => clearInterval(timer);
    }
  }, [gameState.status, gameState.startTime]);
  // Fetch PvP Config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/pvp/config`);
        setPvpConfig(res.data);
      } catch (e) { console.error('PVP Config Fetch Error', e); }
    };
    fetchConfig();
  }, [apiBase]);

  const handleJoin = async () => {
    const amount = parseFloat(joinAmount);
    if (isNaN(amount) || amount < 1000) return alert('Minimum join amount is 1000 $FEST');
    if (user.balance < amount) return alert('Insufficient balance');

    setLoading(true);
    try {
      const deviceFingerprint = getStoredDeviceFingerprint();
      const res = await axios.post(`${apiBase}/api/pvp/join`, { 
        amount,
        deviceFingerprint
      }, { headers });
      if (res.data.success) {
        refreshUser();
      }
    } catch (e) {
      const errorData = e.response?.data;
      const errorMessage = errorData?.error || 'Failed to join game';
      
      // Handle multi-account error specifically
      if (errorData?.code === 'multi_account_forbidden') {
        alert(`⚠️ ${errorMessage}\n\nYou cannot participate in PVP with multiple accounts registered on this device.`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-close modal when game resets
  useEffect(() => {
    if (gameState.status === 'waiting' && showWinnerModal) {
      setShowWinnerModal(false);
    }
  }, [gameState.status, showWinnerModal]);

  const getChance = (amount) => {
    if (!gameState.totalPool) return 0;
    return ((amount / gameState.totalPool) * 100).toFixed(0);
  };

  const fetchHistory = async (isNew = false) => {
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const lastItem = isNew ? null : historyItems[historyItems.length - 1];
      const url = `${apiBase}/api/pvp/history${lastItem ? `?lastTimestamp=${lastItem.timestamp}` : ''}`;
      console.log('Fetching history from:', url);
      const res = await axios.get(url);
      
      let data = res.data;
      
      // Fallback: If no history exists yet, prepend the lastGame from gameState if available
      if (isNew && data.length === 0 && gameState.lastGame) {
          data = [{
            ...gameState.lastGame,
            participantsCount: '?',
            chance: (gameState.lastGame.winAmount / gameState.lastGame.totalPool) * 100 || 0,
            winner: gameState.lastGame.winner
          }];
      }

      if (isNew) {
        setHistoryItems(data);
        setHasMore(data.length === 10);
      } else {
        setHistoryItems(prev => [...prev, ...data]);
        if (data.length < 10) setHasMore(false);
      }
    } catch (e) {
      console.error('PvP History Fetch Error:', e);
      alert('Failed to load history: ' + (e.response?.data?.error || e.message));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistory = () => {
    setShowHistory(true);
    if (tg) tg.BackButton.show();
    fetchHistory(true);
  };

  // Local override for BackButton when History is open
  useEffect(() => {
    if (!tg || !showHistory) return;

    const handleBack = () => {
      setShowHistory(false);
      // Re-evaluate main back button status for the page
      if (location.pathname === '/') tg.BackButton.hide();
    };

    tg.BackButton.onClick(handleBack);
    return () => tg.BackButton.offClick(handleBack);
  }, [showHistory, tg]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '...';
    const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className="pvp-container">
      <div className="pvp-header glitter-base">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
           <h1 className="heading-lg" style={{ margin: 0 }}>PVP Arena</h1>
           <span className="game-id-text">Game #{gameState.gameId || 1}</span>
        </div>
        <div className="active-users">
          <div className="pulse-dot" />
          <span>{gameState.activeUsers} Active</span>
        </div>
      </div>

      {/* Stats Cards: Last Winner & Luckiest */}
      <div className="pvp-stats-row">
        <div className="stat-card glitter-base" 
          onClick={handleOpenHistory}
          style={{ 
          background: 'linear-gradient(145deg, #004d3d 0%, #00a878 45%, #34e0a1 100%)', 
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: 'none',
          cursor: 'pointer'
        }}>
          <span className="stat-label" style={{ color: '#fff', opacity: 0.9 }}>LAST WINNER</span>
          {gameState.lastGame ? (
            <div className="stat-user">
              <img src={gameState.lastGame.winner.photoUrl} alt="" className="stat-avatar" />
              <div className="stat-info">
                <span className="stat-name" style={{ color: '#fff' }}>{gameState.lastGame.winner.username}</span>
                <span className="stat-amount" style={{ color: '#fff', fontWeight: '900' }}>+{formatBalance(gameState.lastGame.winAmount)} $FEST</span>
              </div>

            </div>
          ) : (
            <span className="text-sm-muted" style={{ color: 'rgba(255,255,255,0.6)' }}>No history</span>
          )}
        </div>
        <div className="stat-card glitter-base" 
          onClick={handleOpenHistory}
          style={{ 
          background: 'linear-gradient(145deg, #6b4f0a 0%, #c9a227 42%, #f4d03f 100%)', 
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: 'none',
          cursor: 'pointer'
        }}>
          <span className="stat-label" style={{ color: '#fff', opacity: 0.9 }}>LUCKIEST</span>
          {gameState.luckiest ? (
            <div className="stat-user">
              <img src={gameState.luckiest.winner.photoUrl} alt="" className="stat-avatar" />
              <div className="stat-info">
                <span className="stat-name" style={{ color: '#fff' }}>{gameState.luckiest.winner.username}</span>
                <span className="stat-amount" style={{ color: '#fff', fontWeight: '900' }}>{(gameState.luckiest.chance || 0).toFixed(0)}%</span>
              </div>
            </div>
          ) : (
            <span className="text-sm-muted" style={{ color: 'rgba(255,255,255,0.6)' }}>None yet</span>
          )}
        </div>
      </div>

      {/* Wheel Section */}
      <div className="wheel-section glitter-base">
        <PvpWheel 
          players={gameState.players} 
          totalPool={gameState.totalPool} 
          status={gameState.status}
          winningAngle={gameState.winningAngle}
          countdown={countdown}
        />

        <div className="platform-fee-note">
           5% platform fee applies to total pool
        </div>
      </div>

      {/* Join Controls */}
      <div className="controls-section glass-panel glitter-base">
        <div className="flex-row-between" style={{ marginBottom: '12px' }}>
          <span className="control-label">ADD TO POOL</span>
          <div className="user-balance-mini">
            Balance: <span className="gold-text">{formatBalance(user?.balance)} $FEST</span>
          </div>

        </div>

        <div className="shortcuts-row">
          {shortcuts.map((amt, idx) => (
            <button 
              key={idx}
              className={`shortcut-btn-mini ${!isCustom && editingIndex === idx ? 'active' : ''}`}
              onClick={() => selectShortcut(amt, idx)}
            >
              {amt} $FEST
            </button>
          ))}
          <button 
            className={`shortcut-btn-mini edit ${isCustom ? 'active' : ''}`} 
            onClick={() => {
              if (editingIndex !== null && !isCustom) {
                // If a shortcut is selected, toggle edit mode for that shortcut
                setIsCustom(true);
              } else {
                setIsCustom(!isCustom);
              }
            }}
          >
            {isCustom ? 'DONE' : 'EDIT'}
          </button>
        </div>

        {isCustom && (
          <div className="custom-amount-input-row" style={{ marginTop: '10px' }}>
            <input 
              type="number" 
              className="amount-input-refined"
              value={joinAmount}
              onChange={(e) => setJoinAmount(e.target.value)}
              placeholder={`Min ${pvpConfig.minJoin}`}
              step="0.01"
              autoFocus
            />
            <button className="cancel-edit-btn" onClick={() => {
              if (editingIndex !== null) {
                const newShortcuts = [...shortcuts];
                newShortcuts[editingIndex] = parseFloat(joinAmount) || shortcuts[editingIndex];
                setShortcuts(newShortcuts);
                localStorage.setItem('pvp_shortcuts', JSON.stringify(newShortcuts));
              }
              setIsCustom(false);
            }}>DONE</button>
          </div>
        )}

        <div className="action-row-split" style={{ marginTop: (isCustom || joinAmount) ? '15px' : '5px' }}>
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button 
              className="deposit-join-btn-split"
              onClick={() => navigate('/withdraw?tab=deposit')}
              style={{ flex: 1, background: '#00d4ff', color: '#000', fontWeight: '900', fontSize: '0.75rem' }}
            >
              DEPOSIT
            </button>
            <button 
              className="deposit-join-btn-split"
              onClick={handleJoin}
              disabled={loading || !joinAmount}
              style={{ flex: 1.5, background: 'var(--success)', color: '#000', fontWeight: '900', fontSize: '0.75rem' }}
            >
              {loading ? '...' : `ADD ${formatBalance(joinAmount)} $FEST`}
            </button>

            <button 
              className="deposit-join-btn-split"
              onClick={() => navigate('/')}
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: '900', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              EARN
            </button>
          </div>
        </div>
      </div>

      {/* Players List */}

      {/* Players List (Moved Down) */}
      <div className="players-list-section glass-panel">
        <div className="flex-row-between" style={{ marginBottom: '15px' }}>
          <span className="section-title">PARTICIPANTS</span>
          <div className="total-pool-badge">
            POOL: {formatBalance(gameState.totalPool)} $FEST
          </div>

        </div>

        <div className="players-table">
          {gameState.players.sort((a,b) => b.amount - a.amount).map((p, i) => (
            <div key={i} className="player-row">
              <div className="player-identity">
                <img src={p.photoUrl || 'https://img.icons8.com/isometric/512/user-male-circle.png'} alt="" className="player-pic" style={{ borderColor: p.color }} />
                <div className="player-meta">
                  <span className="player-name">{p.username} {p.telegramId === user?.telegramId && '(You)'}</span>
                  <span className="player-chance-text">{getChance(p.amount)}% Chance</span>
                </div>
              </div>
              <div className="player-contribution">
                <div style={{ fontWeight: 800 }}>{formatBalance(p.amount)} $FEST</div>
              </div>

            </div>
          ))}
          {gameState.players.length === 0 && (
            <div className="empty-players-note">
              No players yet. Be the first to join!
            </div>
          )}
        </div>
      </div>

      <WinnerModal 
        isOpen={showWinnerModal}
        winner={gameState.winner}
        winAmount={gameState.winner?.winAmount}
        isMe={gameState.winner?.telegramId === user?.telegramId}
        onClose={() => setShowWinnerModal(false)}
      />

      {/* History Overlay */}
      {showHistory && (
        <div 
          className="history-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0a0a0a',
            zIndex: 2000,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto'
          }}
        >
            <div className="flex-row-between" style={{ marginBottom: '24px', justifyContent: 'center' }}>
              <h2 className="heading-lg" style={{ margin: 0 }}>Arena History</h2>
            </div>

            <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historyLoading && historyItems.length === 0 ? (
                <>
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} variant="card" height="80px" />
                  ))}
                </>
              ) : (
                <>
                  {historyItems.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`stat-card glitter-base history-item-clickable ${item.winner.tier && item.winner.tier !== 'free' ? `tier-card-${item.winner.tier}` : ''}`} 
                      onClick={() => setSelectedHistoryItem(item)}
                      style={{ 
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '20px'
                      }}
                    >
                      <div className="flex-row-between">
                         <div className="stat-user">
                            <img src={item.winner.photoUrl || 'https://img.icons8.com/isometric/512/user-male-circle.png'} alt="" className="stat-avatar" />
                            <div className="stat-info">
                               <span className="stat-name" style={{ color: 'white', fontSize: '0.9rem' }}>{item.winner.username}</span>
                               <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span className="participants-badge" style={{ fontSize: '0.65rem' }}>{item.participantsCount} Participants</span>
                                  <span className="chance-skyblue" style={{ fontSize: '0.65rem', fontWeight: 800 }}>{item.chance?.toFixed(0) || item.winChance?.toFixed(0) || '0'}%</span>
                               </div>
                            </div>
                         </div>
                         <div style={{ textAlign: 'right' }}>
                            <div className="win-amount-green" style={{ fontWeight: 900, fontSize: '1.1rem' }}>+{formatBalance(item.winAmount)} $FEST</div>
                            <div className="text-sm-muted" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>

                               <Clock size={10} /> {formatTimeAgo(item.timestamp)}
                            </div>
                         </div>
                      </div>
                    </div>
                  ))}

                  {historyLoading && (
                    <div className="flex-center" style={{ padding: '20px' }}>
                       <Loader2 className="spin" size={24} color="var(--primary-gold)" />
                    </div>
                  )}

                  {hasMore && !historyLoading && historyItems.length > 0 && (
                    <button 
                      className="shortcut-btn-mini" 
                      onClick={() => fetchHistory(false)}
                      style={{ width: '100%', height: '50px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}
                    >
                      LOAD MORE HISTORY
                    </button>
                  )}

                  {!hasMore && historyItems.length > 0 && (
                     <div style={{ textAlign: 'center', opacity: 0.3, fontSize: '0.7rem', padding: '20px' }}>
                        You've reached the end of history
                     </div>
                  )}

                  {historyItems.length === 0 && !historyLoading && (
                     <div style={{ textAlign: 'center', opacity: 0.5, padding: '40px' }}>
                        No history found yet.
                     </div>
                  )}
                </>
              )}
            </div>
        </div>
      )}

      <HistoryDetailModal 
        isOpen={!!selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
        item={selectedHistoryItem}
      />
    </div>
  );
};


export default PvpPage;
