import { useState, useEffect } from 'react';
import { Flame, Gift, Loader2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import axios from 'axios';

const apiBase = import.meta.env.VITE_API_URL || 'https://eidfest.up.railway.app';

const MILESTONES = { 1: 10, 3: 50, 7: 200, 15: 750 };
const MILESTONE_DAYS = [1, 3, 7, 15];
const MAX_STREAK = 15;

const StreakMilestone = ({ compact = false }) => {
  const { user, streakData, streakLoading, claimStreakMilestone } = useUser();

  const [claiming, setClaiming] = useState(false);
  const [claimedReward, setClaimedReward] = useState(null);
  const [showClaimModal, setShowClaimModal] = useState(false);

  const handleClaimMilestone = async (milestoneDay) => {
    if (!user?.telegramId || claiming) return;
    setClaiming(true);
    try {
      const data = await claimStreakMilestone(milestoneDay);
      setClaimedReward(data);
      setShowClaimModal(true);
    } catch (e) {
      console.error('Claim milestone error:', e);
    } finally {
      setClaiming(false);
    }
  };

  if (streakLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px' }}>
        <Loader2 className="spin" size={16} color="var(--primary-gold)" />
      </div>
    );
  }

  if (!streakData) return null;

  const streak = streakData.streak || 0;
  const claimedMilestones = streakData.claimedMilestones || [];
  const claimableMilestones = streakData.claimableMilestones || [];

  const chestSize = compact ? 48 : 56;
  const dotSize = compact ? 12 : 14;
  const fontSize = compact ? '0.65rem' : '0.75rem';
  const rewardFontSize = compact ? '0.55rem' : '0.65rem';

  return (
    <>
      <div style={{ padding: '20px', paddingTop: compact ? '8px' : '12px', paddingBottom: compact ? '8px' : '12px', position: 'relative' }}>
        {/* Streak header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={compact ? 16 : 18} color="#ff6b35" />
            <span style={{ fontSize: compact ? '0.75rem' : '0.85rem', fontWeight: '900', color: '#ff6b35', fontFamily: 'var(--font-gaming)' }}>
              Daily Streak
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: compact ? '1rem' : '1.2rem', fontWeight: '900', color: '#ff6b35', fontFamily: 'var(--font-gaming)' }}>
              {streak}
            </span>
            <span style={{ fontSize: compact ? '0.6rem' : '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              /{MAX_STREAK}
            </span>
          </div>
        </div>

        {/* Milestone path container */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          position: 'relative',
          gap: '0',
          paddingTop: '4px',
          paddingBottom: '4px'
        }}>
          {MILESTONE_DAYS.map((day, index) => {
            const isReached = streak >= day;
            const isClaimed = claimedMilestones.includes(day);
            const isClaimable = claimableMilestones.includes(day);
            const reward = MILESTONES[day];

            return (
              <div key={day} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: '1 1 0%',
                position: 'relative',
                zIndex: 1
              }}>
                {/* Day label - ABOVE the chest */}
                <div style={{
                  fontSize,
                  fontWeight: '900',
                  color: isReached ? 'var(--primary-gold)' : 'rgba(255,255,255,0.3)',
                  marginBottom: '3px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.3px'
                }}>
                  Day {day}
                </div>

                {/* Line segment to the right (except last) - connects at chest center */}
                {index < MILESTONE_DAYS.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    top: `calc(${chestSize / 2}px + 15px)`,
                    left: '50%',
                    width: 'calc(100% + 4px)',
                    height: '2px',
                    background: isReached && streak >= MILESTONE_DAYS[index + 1]
                      ? 'linear-gradient(90deg, var(--primary-gold), var(--primary-gold))'
                      : 'rgba(255,255,255,0.08)',
                    zIndex: 0
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
                    boxShadow: isClaimable ? '0 0 16px rgba(241,196,15,0.6), 0 0 32px rgba(241,196,15,0.3)' : 'none',
                    borderRadius: '6px',
                    zIndex: 2,
                    flexShrink: 0
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
                      top: '-6px',
                      right: '-6px',
                      background: '#ff6b35',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'pulse 1.5s infinite',
                      boxShadow: '0 0 8px rgba(255,107,53,0.7)',
                      border: '2px solid rgba(0,0,0,0.3)'
                    }}>
                      <Gift size={10} color="#fff" />
                    </div>
                  )}
                </div>

                {/* Reward - UNDER the chest */}
                <div style={{
                  fontSize: rewardFontSize,
                  color: isReached ? 'rgba(241,196,15,0.85)' : 'rgba(255,255,255,0.2)',
                  fontWeight: isReached ? '900' : 'bold',
                  whiteSpace: 'nowrap',
                  marginTop: '2px',
                  letterSpacing: '0.2px'
                }}>
                  {reward} $FEST
                </div>
              </div>
            );
          })}
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
              position: 'relative'
            }}>
              <img
                src="/openedchest.png"
                alt="Reward"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  filter: 'none'
                }}
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
              onClick={() => setShowClaimModal(false)}
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
              Awesome!
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

export default StreakMilestone;