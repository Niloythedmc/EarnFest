import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Button, GameCard } from '../components/UI';
import { Trophy, Users, Medal, Crown, Timer, TrendingUp } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useUser } from '../context/UserContext';
import axios from 'axios';
import Skeleton from '../components/Skeleton';
import { formatBalance } from '../utils/formatters';

const FEST_TO_USD = 0.00005;

const TAB_REFERS = 'refers';
const TAB_EARNING = 'earning';

const LeaderboardPage = () => {
  const { apiBase } = useConfig();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(TAB_REFERS);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState(null);

  // Contest state
  const [activeContest, setActiveContest] = useState(null);
  const [contestLeaderboard, setContestLeaderboard] = useState([]);
  const [contestMyPosition, setContestMyPosition] = useState(null);
  const [contestLoading, setContestLoading] = useState(false);
  const [countdown, setCountdown] = useState('');
  const countdownRef = useRef(null);

  const tg = window.Telegram?.WebApp;
  const headers = { 'x-telegram-init-data': tg?.initData };

  // Map frontend tab value to backend API type
  const tabToApiType = (tab) => tab === 'refers' ? 'refer' : 'earning';

  // Fetch lifetime leaderboard for the active tab
  const fetchLeaderboard = useCallback(async (type) => {
    setLoading(true);
    setError(null);
    try {
      // Backend now accepts 'refers' as alias for 'refer'
      const res = await axios.get(`${apiBase}/api/contests/leaderboard/${type}`, {
        params: { limit: 100 },
        headers,
      });
      setLeaderboard(res.data.leaderboard || []);
      setCurrentPosition(res.data.myPosition || null);
    } catch (err) {
      console.error('Leaderboard fetch failed', err);
      setError(err.response?.data?.error || 'Unable to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // Fetch active contest
  const fetchActiveContest = useCallback(async () => {
    setContestLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/contests/active`, { headers });
      const { contest, leaderboard: cLeaderboard, myPosition } = res.data;
      setActiveContest(contest);
      setContestLeaderboard(cLeaderboard || []);
      setContestMyPosition(myPosition);
    } catch (err) {
      console.error('Active contest fetch failed', err);
      setActiveContest(null);
    } finally {
      setContestLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchLeaderboard(activeTab);
    fetchActiveContest();
  }, [activeTab, fetchLeaderboard, fetchActiveContest]);

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
        // Re-fetch to update contest status
        fetchActiveContest();
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
  }, [activeContest, fetchActiveContest]);

  const getRankCardStyle = (rank) => {
    if (rank === 1) {
      return {
        background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,165,0,0.15))',
        border: '2px solid rgba(255,215,0,0.6)',
        boxShadow: '0 0 20px rgba(255,215,0,0.3), inset 0 0 20px rgba(255,215,0,0.05)',
      };
    }
    if (rank === 2) {
      return {
        background: 'linear-gradient(135deg, rgba(185,242,255,0.2), rgba(0,191,255,0.1))',
        border: '2px solid rgba(185,242,255,0.5)',
        boxShadow: '0 0 15px rgba(185,242,255,0.2), inset 0 0 15px rgba(185,242,255,0.05)',
      };
    }
    if (rank === 3) {
      return {
        background: 'linear-gradient(135deg, rgba(192,192,192,0.2), rgba(169,169,169,0.1))',
        border: '2px solid rgba(192,192,192,0.5)',
        boxShadow: '0 0 15px rgba(192,192,192,0.2), inset 0 0 15px rgba(192,192,192,0.05)',
      };
    }
    return {};
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown size={22} color="#FFD700" />;
    if (rank === 2) return <Medal size={20} color="#B9F2FF" />;
    if (rank === 3) return <Medal size={20} color="#C0C0C0" />;
    return null;
  };

  const getPrizeForRank = (rank) => {
    if (!activeContest || !activeContest.prizes) return null;
    return activeContest.prizes.find(p => p.rank === rank);
  };

  const renderPrizeBadge = (rank) => {
    const prize = getPrizeForRank(rank);
    if (!prize) return null;

    if (activeContest.prizeType === 'tier') {
      const tierName = prize.tier?.charAt(0).toUpperCase() + prize.tier?.slice(1) || '';
      return (
        <div style={{ fontSize: '0.6rem', color: '#FFD700', marginTop: '2px', fontWeight: '700' }}>
          🏆 {tierName} Tier
        </div>
      );
    }

    if (activeContest.prizeType === 'fest') {
      const amount = prize.festAmount || 0;
      const usdValue = (amount * FEST_TO_USD).toFixed(2);
      return (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#FFD700' }}>
            {formatBalance(amount)} <span style={{ fontSize: '0.55rem', fontWeight: '600', opacity: 0.8 }}>$FEST</span>
          </div>
          <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>${usdValue}</div>
        </div>
      );
    }

    return null;
  };

  const renderLeaderboardItem = (entry, index, showPrize = false) => {
    const rank = index + 1;
    const cardStyle = showPrize ? getRankCardStyle(rank) : {};
    const rankIcon = showPrize ? getRankIcon(rank) : null;
    const valueLabel = activeTab === TAB_REFERS ? 'REFERS' : '$FEST EARNED';
    const valueDisplay = activeTab === TAB_REFERS
      ? entry.value
      : formatBalance(entry.value);

    return (
      <GameCard
        key={entry.telegramId || index}
        className="glitter-base"
        innerPadding="5px 10px"
        style={{ padding: '0px', ...cardStyle }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: '14px', alignItems: 'center' }}>
          <div style={{ minWidth: '30px', fontWeight: '900', fontSize: '1.1rem', color: rank < 4 ? '#FFD700' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {rankIcon}
            <span>#{rank}</span>
          </div>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {entry.photoUrl ? (
              <img src={entry.photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Users size={24} opacity={0.5} />
            )}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: '800', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {entry.firstName || 'User'}
            </div>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#FFD700', marginTop: '2px' }}>
              {valueDisplay} <span style={{ fontSize: '0.55rem', fontWeight: '500', opacity: 0.7 }}>{valueLabel}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {showPrize ? (
              renderPrizeBadge(rank)
            ) : (
              <>
                <div className="game-title gold-text" style={{ fontSize: '1.2rem', textAlign: 'right' }}>
                  {valueDisplay}
                </div>
                <div className="font-gaming text-sm-muted" style={{ fontSize: '0.6rem' }}>{valueLabel}</div>
              </>
            )}
          </div>
        </div>
      </GameCard>
    );
  };

  // Determine which leaderboard to show
  // Contest only affects the tab matching its type (refer contest → Refers tab, earning contest → Earning tab)
  const contestMatchesTab = activeContest && tabToApiType(activeTab) === activeContest.type;
  const displayLeaderboard = contestMatchesTab ? contestLeaderboard : leaderboard;
  const displayMyPosition = contestMatchesTab ? contestMyPosition : currentPosition;
  const isContestActive = !!contestMatchesTab;

  return (
    <div className="main-content stack-vertical" style={{ gap: '18px', paddingBottom: '140px' }}>
      <header style={{ textAlign: 'center', marginBottom: '5px' }}>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2.5rem' }}>
          <Trophy size={32} className="gold-text" /> Leaderboard
        </h1>
        <p className="text-sm-muted font-gaming" style={{ fontSize: '0.75rem', marginTop: '4px' }}>TOP REFERRERS & EARNERS</p>
      </header>

      {/* Contest Countdown Banner - only when contest matches active tab */}
      {contestMatchesTab && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))',
          border: '1px solid rgba(255,215,0,0.4)',
          borderRadius: '16px',
          padding: '14px 18px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
            <Timer size={18} color="#FFD700" />
            <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#FFD700' }}>
              {activeContest.type === 'refer' ? 'Referral' : 'Earning'} Contest Active
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#FFD700', fontFamily: 'monospace', letterSpacing: '2px' }}>
            {countdown || '—'}
          </div>
          <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '4px' }}>
            Ends: {new Date(activeContest.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '14px',
        padding: '4px',
        gap: '4px',
      }}>
        {[
          { id: TAB_REFERS, label: 'Refers', icon: Users },
          { id: TAB_EARNING, label: 'Earning', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === id ? 'rgba(255,215,0,0.15)' : 'transparent',
              color: activeTab === id ? '#FFD700' : 'var(--text-secondary)',
              fontWeight: activeTab === id ? '800' : '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Contest Header Row - only during contest */}
      {contestMatchesTab && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto 1fr auto',
          gap: '14px',
          alignItems: 'center',
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255,215,0,0.2)',
          fontSize: '0.7rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: '#FFD700',
          opacity: 0.7,
        }}>
          <div style={{ minWidth: '30px', textAlign: 'center' }}>Rank</div>
          <div style={{ width: '40px' }}></div>
          <div>User</div>
          <div style={{ textAlign: 'right' }}>Prize</div>
        </div>
      )}

      {/* My Position Card - only when no contest */}
      {!contestMatchesTab && displayMyPosition && (
        <GameCard className="glitter-base" innerPadding="5px 10px" style={{ border: '1px solid var(--primary-gold)', background: 'rgba(252, 194, 1, 0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: '14px', alignItems: 'center' }}>
            <div style={{ minWidth: '30px', fontWeight: '900', fontSize: '1.2rem', color: 'var(--primary-gold)' }}>
              #{displayMyPosition.position || '—'}
            </div>
            <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary-gold)' }}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Users size={24} className="gold-text" />
              )}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div className="font-gaming" style={{ fontSize: '0.65rem', letterSpacing: '1px', opacity: 0.7, marginBottom: '2px' }}>YOUR RANKING</div>
              <div style={{ fontWeight: '800', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.firstName || 'You'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="game-title gold-text" style={{ fontSize: '1.4rem' }}>
                {activeTab === TAB_REFERS ? displayMyPosition.value : formatBalance(displayMyPosition.value)}
              </div>
              <div className="font-gaming" style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                {activeTab === TAB_REFERS ? 'REFERS' : '$FEST EARNED'}
              </div>
            </div>
          </div>
        </GameCard>
      )}

      {/* Leaderboard List */}
      {loading || contestLoading ? (
        <div className="stack-vertical" style={{ gap: '12px' }}>
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} variant="card" height="76px" />
          ))}
        </div>
      ) : error ? (
        <Card style={{ padding: '24px', textAlign: 'center', color: '#ff7474' }}>
          <p>{error}</p>
        </Card>
      ) : (
        <div className="stack-vertical" style={{ gap: '12px' }}>
          {displayLeaderboard.map((entry, index) => renderLeaderboardItem(entry, index, isContestActive))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !contestLoading && !error && displayLeaderboard.length === 0 && (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '24px' }}>
          <Trophy size={44} className="gold-text" style={{ marginBottom: '15px' }} />
          <p className="font-gaming text-sm-muted" style={{ fontSize: '0.75rem', lineHeight: '1.6' }}>
            {activeTab === TAB_REFERS 
              ? 'NO REFERRALS YET. START REFERRING TO CLIMB THE RANKINGS!'
              : 'NO EARNINGS YET. COMPLETE TASKS AND WATCH ADS TO EARN $FEST!'}
          </p>
        </div>
      )}

      <Button onClick={() => { fetchLeaderboard(activeTab); fetchActiveContest(); }} style={{ maxWidth: '260px', margin: '0 auto' }}>
        Refresh
      </Button>

      {/* Fixed "My Position" bar above navbar */}
      {displayMyPosition && (
        <div style={{
          position: 'fixed',
          bottom: '82px',
          left: '0',
          right: '0',
          zIndex: 999,
          padding: '8px 16px',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.06))',
          borderTop: '1px solid rgba(255,215,0,0.3)',
          borderBottom: '1px solid rgba(255,215,0,0.3)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontWeight: '900', fontSize: '1rem', color: '#FFD700' }}>
              #{displayMyPosition.position}
            </div>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,215,0,0.4)' }}>
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Users size={16} color="#FFD700" style={{ padding: '8px' }} />
              )}
            </div>
            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>
              {user?.firstName || 'You'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '900', fontSize: '0.95rem', color: '#FFD700' }}>
              {activeTab === TAB_REFERS ? displayMyPosition.value : formatBalance(displayMyPosition.value)}
            </div>
            <div style={{ fontSize: '0.55rem', opacity: 0.6 }}>
              {activeTab === TAB_REFERS ? 'REFERS' : '$FEST'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
