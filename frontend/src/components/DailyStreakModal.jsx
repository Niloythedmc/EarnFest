import { useState, useEffect } from 'react';
import { X, ChevronRight, Flame, Loader2, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL || 'https://eidfest.up.railway.app';

const MILESTONES = { 1: 10, 3: 50, 7: 200, 15: 750 };
const MILESTONE_DAYS = [1, 3, 7, 15];
const MAX_STREAK = 15;

const DailyStreakModal = ({ onClose }) => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const tg = window.Telegram?.WebApp;

  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [continuing, setContinuing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [error, setError] = useState(null);

  // Fetch streak status on mount
  useEffect(() => {
    if (!user?.telegramId) return;
    const fetchStreak = async () => {
      try {
        const headers = {};
        if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
        const res = await axios.get(`${apiBase}/api/user/streak/${user.telegramId}`, { headers });
        setStreakData(res.data);
      } catch (e) {
        console.error('Failed to fetch streak:', e);
        setError('Failed to load streak data');
      } finally {
        setLoading(false);
      }
    };
    fetchStreak();
  }, [user?.telegramId]);

  // Show RichAds interstitial first, then Adsgram
  const showStreakAds = async () => {
    // Step 1: RichAds interstitial
    try {
      if (window.TelegramAdsController) {
        await new Promise((resolve, reject) => {
          window.TelegramAdsController.showAd({ type: 'interstitial' }, {
            onDone: () => resolve(),
            onError: (err) => { console.warn('RichAds interstitial failed:', err); resolve(); }
          });
        });
      }
    } catch (e) {
      console.warn('RichAds interstitial error:', e);
    }

    // Step 2: Adsgram interstitial
    try {
      if (window.Adsgram) {
        const blockIds = ['int-26606', 'int-27024', 'int-27026', 'int-27027'];
        const randomId = blockIds[Math.floor(Math.random() * blockIds.length)];
        const AdController = window.Adsgram.init({ blockId: randomId });
        await AdController.show();
      }
    } catch (e) {
      console.warn('Adsgram interstitial error:', e);
    }
  };

  const handleClaimMilestone = async (milestoneDay) => {
    if (!user?.telegramId || claiming) return;
    setClaiming(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
      const res = await axios.post(`${apiBase}/api/user/streak/claim`, {
        telegramId: user.telegramId
      }, { headers });
      const data = res.data;
      setClaimedReward(data);
      setShowClaimModal(true);
      setStreakData(prev => ({
        ...prev,
        claimedMilestones: [...(prev?.claimedMilestones || []), milestoneDay],
        claimableMilestones: (prev?.claimableMilestones || []).filter(d => d !== milestoneDay)
      }));
      setUser(prev => ({
        ...prev,
        balance: (prev.balance || 0) + data.reward
      }));
    } catch (e) {
      console.error('Claim milestone error:', e);
    } finally {
      setClaiming(false);
    }
  };

  const handleContinue = async () => {
    if (!user?.telegramId) return;
    setContinuing(true);
    setError(null);

    try {
      // Show interstitial ads first (RichAds then Adsgram)
      await showStreakAds();

      // Then send request to backend
      const headers = { 'Content-Type': 'application/json' };
      if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;

      const res = await axios.post(`${apiBase}/api/user/streak/continue`, {
        telegramId: user.telegramId
      }, { headers });

      const data = res.data;
      setStreakData(prev => ({
        ...prev,
        streak: data.streak,
        alreadyBookedToday: true,
        lastStreakDate: new Date().toISOString()
      }));

      // Update local user context
      setUser(prev => ({
        ...prev,
        dailyStreak: data.streak,
        lastStreakDate: new Date().toISOString()
      }));

      // If today is a milestone day, show claim option and navigate to tasks
      if (data.isMilestoneToday) {
        // Show claim modal for the milestone
        setShowClaimModal(true);
      }

      // Close the main modal after a short delay
      setTimeout(() => {
        onClose();
        // If milestone day, navigate to tasks page
        if (data.isMilestoneToday) {
          navigate('/tasks');
        }
      }, 1500);

    } catch (e) {
      console.error('Continue streak error:', e);
      setError(e.response?.data?.error || 'Failed to continue streak');
    } finally {
      setContinuing(false);
    }
  };

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div style={modalContainerStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <Loader2 className="spin" size={32} color="var(--primary-gold)" />
          </div>
        </div>
      </div>
    );
  }

  const streak = streakData?.streak || 0;
  const alreadyBookedToday = streakData?.alreadyBookedToday || false;

  return (
    <>
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalContainerStyle} onClick={e => e.stopPropagation()}>
          {/* Close button */}
          <button onClick={onClose} style={closeButtonStyle}>
            <X size={20} />
          </button>

          {/* Sticky milestone section - stays fixed at top when scrolling */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            background: 'linear-gradient(180deg, #0a2a1a 0%, #0a2a1a 85%, transparent 100%)',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(241,196,15,0.1)',
            marginBottom: '16px'
          }}>
            {/* Header */}
            <div style={headerStyle}>
              <Flame size={28} color="#ff6b35" style={{ marginRight: '8px' }} />
              <h2 style={titleStyle}>Daily Streak</h2>
            </div>

            {/* Streak counter */}
            <div style={streakCounterStyle}>
              <span style={streakNumberStyle}>{streak}</span>
              <span style={streakLabelStyle}>Day Streak</span>
            </div>

            {/* Milestone Path */}
            <div style={{
              padding: '4px 0 8px',
              position: 'relative'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                position: 'relative',
                paddingTop: '2px'
              }}>
                {MILESTONE_DAYS.map((day, index) => {
                  const isReached = streak >= day;
                  const isClaimed = (streakData?.claimedMilestones || []).includes(day);
                  const isClaimable = (streakData?.claimableMilestones || []).includes(day);
                  const reward = MILESTONES[day];
                  const chestSize = 28;

                  return (
                    <div key={day} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: index === 0 || index === MILESTONE_DAYS.length - 1 ? '0 0 auto' : '1 1 0%',
                      position: 'relative'
                    }}>
                      {/* Day label - ABOVE the chest */}
                      <div style={{
                        fontSize: '0.4rem',
                        fontWeight: 'bold',
                        color: isReached ? 'var(--primary-gold)' : 'rgba(255,255,255,0.2)',
                        marginBottom: '2px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                      }}>
                        Day {day}
                      </div>

                      {/* Line segment to the right (except last) - connects at chest center */}
                      {index < MILESTONE_DAYS.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          top: `calc(${chestSize / 2}px + 10px)`,
                          left: '50%',
                          width: '100%',
                          height: '2px',
                          background: isReached && streak >= MILESTONE_DAYS[index + 1]
                            ? 'linear-gradient(90deg, var(--primary-gold), var(--primary-gold))'
                            : 'rgba(255,255,255,0.08)',
                          zIndex: 1,
                          transform: 'translateX(0)'
                        }} />
                      )}

                      {/* Chest - replaces the dot, sits on the path line */}
                      <div
                        onClick={() => isClaimable && handleClaimMilestone(day)}
                        style={{
                          width: `${chestSize}px`,
                          height: `${chestSize}px`,
                          cursor: isClaimable ? 'pointer' : 'default',
                          position: 'relative',
                          transition: 'all 0.3s ease',
                          filter: isClaimed ? 'none' : (isClaimable ? 'none' : 'grayscale(1) brightness(0.5)'),
                          boxShadow: isClaimable ? '0 0 12px rgba(241,196,15,0.6), 0 0 24px rgba(241,196,15,0.3)' : 'none',
                          borderRadius: '4px',
                          zIndex: 2
                        }}
                      >
                        <img
                          src={isClaimed ? '/openedchest.png' : '/chest.png'}
                          alt={isClaimed ? 'Opened' : 'Chest'}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            display: 'block',
                            transition: 'all 0.3s ease'
                          }}
                        />
                        {isClaimable && (
                          <div style={{
                            position: 'absolute',
                            top: '-3px',
                            right: '-3px',
                            background: '#ff6b35',
                            borderRadius: '50%',
                            width: '14px',
                            height: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'pulse 1.5s infinite',
                            boxShadow: '0 0 6px rgba(255,107,53,0.5)'
                          }}>
                            <Gift size={8} color="#fff" />
                          </div>
                        )}
                      </div>

                      {/* Reward - UNDER the chest */}
                      <div style={{
                        fontSize: '0.35rem',
                        color: isReached ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)',
                        fontWeight: isReached ? 'bold' : 'normal',
                        whiteSpace: 'nowrap',
                        marginTop: '1px'
                      }}>
                        {reward} $FEST
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Continue button */}
          {!alreadyBookedToday && (
            <button
              onClick={handleContinue}
              disabled={continuing}
              style={continueButtonStyle}
            >
              {continuing ? (
                <>
                  <Loader2 className="spin" size={18} />
                  <span style={{ marginLeft: '8px' }}>Continuing...</span>
                </>
              ) : (
                <>
                  <Flame size={18} />
                  <span style={{ marginLeft: '8px' }}>Continue Today Streak</span>
                  <ChevronRight size={18} style={{ marginLeft: '8px' }} />
                </>
              )}
            </button>
          )}

          {alreadyBookedToday && (
            <div style={{
              textAlign: 'center',
              padding: '12px',
              background: 'rgba(241,196,15,0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(241,196,15,0.2)',
              fontSize: '0.8rem',
              color: 'var(--primary-gold)',
              fontWeight: 'bold'
            }}>
              ✅ Today's streak already booked! Come back tomorrow.
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(255,77,77,0.1)',
              borderRadius: '8px',
              color: '#ff4d4d',
              fontSize: '0.75rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

        </div>
      </div>

      {/* Claim Reward Modal */}
      {showClaimModal && claimedReward && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #0a2a1a 0%, #001a10 100%)',
            border: '1px solid rgba(241,196,15,0.3)',
            borderRadius: '24px',
            padding: '32px 24px',
            maxWidth: '320px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 16px',
              position: 'relative',
              boxShadow: '0 0 20px rgba(241,196,15,0.5), 0 0 40px rgba(241,196,15,0.2)',
              borderRadius: '8px'
            }}>
              <img
                src="/openedchest.png"
                alt="Reward"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', filter: 'none' }}
              />
            </div>
            <h3 style={{ color: 'var(--primary-gold)', fontSize: '1.2rem', marginBottom: '8px', fontFamily: 'var(--font-gaming)' }}>
              🎉 Milestone Reached!
            </h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '16px' }}>
              You've reached day {claimedReward.streak}!
            </p>
            <div style={{
              fontSize: '2rem',
              fontWeight: '900',
              color: 'var(--primary-gold)',
              marginBottom: '8px'
            }}>
              +{claimedReward.reward} $FEST
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '20px' }}>
              ≈ ${(claimedReward.reward * 0.00005).toFixed(4)}
            </div>
            <button
              onClick={() => { setShowClaimModal(false); navigate('/tasks'); }}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, var(--primary-gold), #d4af37)',
                border: 'none',
                borderRadius: '14px',
                color: '#000',
                fontWeight: '900',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Go to Tasks
            </button>
          </div>
        </div>
      )}

      {/* Claiming overlay */}
      {claiming && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #0a2a1a 0%, #001a10 100%)',
            borderRadius: '24px',
            padding: '40px 24px',
            maxWidth: '280px',
            width: '100%',
            textAlign: 'center'
          }}>
            <Loader2 className="spin" size={40} color="var(--primary-gold)" />
            <p style={{ marginTop: '16px', fontSize: '0.85rem', opacity: 0.7 }}>Claiming your reward...</p>
          </div>
        </div>
      )}
    </>
  );
};

// Styles
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
  padding: '20px',
  backdropFilter: 'blur(4px)'
};

const modalContainerStyle = {
  background: 'linear-gradient(180deg, #0a2a1a 0%, #001a10 100%)',
  border: '1px solid rgba(241,196,15,0.3)',
  borderRadius: '24px',
  padding: '24px 20px',
  maxWidth: '400px',
  width: '100%',
  position: 'relative',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(241,196,15,0.05)',
  maxHeight: '90vh',
  overflowY: 'auto'
};

const closeButtonStyle = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '50%',
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.5)',
  zIndex: 10
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '20px'
};

const titleStyle = {
  fontSize: '1.4rem',
  fontWeight: '900',
  color: 'var(--primary-gold)',
  fontFamily: 'var(--font-gaming)',
  letterSpacing: '1px'
};

const streakCounterStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: '28px'
};

const streakNumberStyle = {
  fontSize: '3.5rem',
  fontWeight: '900',
  color: '#ff6b35',
  fontFamily: 'var(--font-gaming)',
  lineHeight: '1',
  textShadow: '0 0 20px rgba(255,107,53,0.3)'
};

const streakLabelStyle = {
  fontSize: '0.75rem',
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 'bold',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  marginTop: '4px'
};

const continueButtonStyle = {
  width: '100%',
  padding: '16px',
  background: 'linear-gradient(135deg, #ff6b35, #e85d2c)',
  border: 'none',
  borderRadius: '14px',
  color: '#fff',
  fontWeight: '900',
  fontSize: '0.95rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  boxShadow: '0 8px 20px rgba(255,107,53,0.3)',
  marginTop: '8px'
};

export default DailyStreakModal;