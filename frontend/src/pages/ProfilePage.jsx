import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { Card, Button, Stack } from '../components/UI';
import { 
  Banknote, 
  Activity, 
  Gift, 
  ClipboardList, 
  RotateCw, 
  Users, 
  Wallet, 
  Coins,
  Swords,
  MonitorPlay
} from 'lucide-react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../components/Skeleton';
import { formatBalance } from '../utils/formatters';


const ProfilePage = () => {
  const { user } = useUser();
  const { apiBase } = useConfig();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('games');

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    const headers = { 'x-telegram-init-data': tg?.initData };
    const fetchProfileData = async () => {
      if (!user) return;
      
      try {
        const res = await axios.get(`${apiBase}/api/user/profile/${user.telegramId}`, { headers });
        setProfileData(res.data);
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, apiBase, tg?.initData]);

  if (!user || loading) {
    return (
      <div className="main-content" style={{ paddingBottom: '120px' }}>
        <div style={{ marginBottom: '25px' }}>
          <Skeleton variant="card" height="180px" />
        </div>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', opacity: 0.7, marginBottom: '12px', letterSpacing: '1px' }}>
          PROFILE STATISTICS
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
          <Skeleton variant="card" height="100px" />
          <Skeleton variant="card" height="100px" />
          <Skeleton variant="card" height="100px" />
          <Skeleton variant="card" height="100px" />
        </div>
        <Skeleton variant="rect" height="52px" borderRadius="14px" style={{ marginBottom: '16px' }} />
        <Stack gap={10}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="card" height="68px" />
          ))}
        </Stack>
      </div>
    );
  }

  // Use API data first, fall back to user context data if API returns empty
  const allActivities = (profileData?.activities && profileData.activities.length > 0)
    ? profileData.activities
    : (user.activities || []);
  const allRewards = (profileData?.rewardHistory && profileData.rewardHistory.length > 0)
    ? profileData.rewardHistory
    : (user.rewardHistory || []);
  const allSpinHistory = (profileData?.spinHistory && profileData.spinHistory.length > 0)
    ? profileData.spinHistory
    : (user.spinHistory || []);

  const filterGames = () => {
    // Game-related activity types from backend: spin, spin_game, slot_game, spin_ad_view
    const gameActivities = allActivities
      .filter(a => ['spin', 'spin_game', 'slot_game', 'spin_ad_view'].includes(a.type))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    // Also include spinHistory entries
    const spinHistoryItems = allSpinHistory.map(s => ({
      type: 'spin_game',
      amount: s.prize || s.reward || 0,
      timestamp: s.timestamp || s.createdAt,
      ...s
    }));
    return [...gameActivities, ...spinHistoryItems]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const filterHistory = () => {
    // All activity types from backend: task_completion, promocode_reward, referral_commission,
    // spin_ad_view, spin, spin_game, slot_game, deposit, withdrawal_request, withdrawal_refund
    return allActivities
      .filter(a => !['withdrawal_request', 'withdrawal_refund', 'deposit'].includes(a.type))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const filterTransactions = () => {
    // Combine activities that are transactions and reward history withdrawals
    const txActivities = allActivities.filter(a => ['withdrawal_request', 'withdrawal_refund', 'deposit'].includes(a.type));
    const rewards = allRewards.filter(r => r.type === 'withdrawal');
    return [...txActivities, ...rewards].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'spin_ad_view': return <MonitorPlay size={18} color="#4a90e2" />;
      case 'task_completion': return <ClipboardList size={18} color="#00c896" />;
      case 'promocode_reward': return <Gift size={18} color="#e56b6f" />;
      case 'referral_commission': return <Users size={18} color="#b27cf7" />;
      case 'spin': return <RotateCw size={18} color="#f5a623" />;
      case 'spin_game': return <RotateCw size={18} color="#f5a623" />;
      case 'slot_game': return <Gift size={18} color="#ff8c00" />;
      case 'withdrawal_request': return <Wallet size={18} color="#ff4d4d" />;
      case 'withdrawal': return <Wallet size={18} color="#ff4d4d" />;
      case 'withdrawal_refund': return <Banknote size={18} color="#00c896" />;
      case 'deposit': return <Coins size={18} color="#00d4ff" />;
      default: return <Activity size={18} color="#888" />;
    }
  };

  const getTierBadge = (tier) => {
    const badges = {
      free: { color: '#888', label: 'FREE' },
      cash: { color: '#e67e22', label: 'CASH' },
      reward: { color: '#f1c40f', label: 'REWARD' },
      bonus: { color: '#bdc3c7', label: 'BONUS' },
      profit: { color: '#3498db', label: 'PROFIT' }
    };
    const badge = badges[tier] || badges.free;
    return (
      <span className="font-gaming" style={{ 
        color: badge.color, 
        border: `2px solid ${badge.color}`,
        padding: '4px 12px', 
        borderRadius: '20px', 
        fontSize: '0.65rem', 
        fontWeight: '800',
        letterSpacing: '1px'
      }}>
        {badge.label}
      </span>
    );
  };

  return ( 
    <div className="main-content" style={{ paddingBottom: '120px' }}> 
      {/* Header */} 
      {/* Header */} 
      <div style={{ marginBottom: '25px' }}>

        <Card style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {user.photoUrl ? (
              <img 
                src={user.photoUrl} 
                alt={user.firstName}
                style={{ 
                  width: '80px', 
                  height: '80px', 
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--primary-gold)'
                }}
              />
            ) : (
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, var(--primary-gold), #b27cf7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: '800',
                color: '#000'
              }}>
                {user.firstName?.charAt(0) || 'U'}
              </div>
            )}
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <h2 className="game-title" style={{ fontSize: '1.6rem', textAlign: 'left' }}>
                {user.firstName || 'User'}
              </h2>
              <p className="text-sm-muted font-gaming" style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                @{user.username || 'N/A'}
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {getTierBadge(user.tier)}
                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                  ID: {user.telegramId}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                <Coins size={20} color="var(--primary-gold)" style={{ marginBottom: '4px' }} />
                <div className="game-title" style={{ fontSize: '1.2rem', color: 'var(--primary-gold)' }}>
                  {formatBalance(user.balance)}
                </div>

                <div className="font-gaming" style={{ fontSize: '0.6rem', opacity: 0.5 }}>BALANCE</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                <Users size={20} color="#00c896" style={{ marginBottom: '4px' }} />
                <div className="game-title" style={{ fontSize: '1.2rem', color: '#00c896' }}>
                  {user.referrals?.length || 0}
                </div>
                <div className="font-gaming" style={{ fontSize: '0.6rem', opacity: 0.5 }}>REFERRALS</div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Button 
                onClick={() => navigate('/withdraw?tab=deposit')}
                style={{ background: '#00d4ff', color: '#000', height: '44px', fontSize: '0.85rem', fontWeight: '900', boxShadow: 'none' }}
              >
                Deposit
              </Button>
              <Button 
                onClick={() => navigate('/withdraw?tab=withdraw')}
                style={{ background: 'var(--success)', color: '#000', height: '44px', fontSize: '0.85rem', fontWeight: '900', boxShadow: 'none' }}
              >
                Withdraw
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Stats Cards */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: '800', opacity: 0.7, marginBottom: '12px', letterSpacing: '1px' }}>
          PROFILE STATISTICS
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[
            { label: 'Total Earned', value: `${formatBalance(profileData?.totalEarned)}`, icon: <Banknote size={20} />, color: 'var(--primary-gold)' },

            { label: 'Tasks Done', value: profileData?.tasksCompleted || 0, icon: <ClipboardList size={20} />, color: '#00c896' },
            { label: 'Ads Watched', value: profileData?.adsWatched || 0, icon: <MonitorPlay size={20} />, color: '#b27cf7' },
            { label: 'Spins', value: profileData?.spinsCount || 0, icon: <RotateCw size={20} />, color: '#f5a623' },
          ].map((stat, idx) => (
            <Card key={idx} style={{ padding: '14px', background: 'rgba(255,255,255,0.015)' }}>
              <div style={{ color: stat.color, marginBottom: '6px' }}>{stat.icon}</div>
              <div className="game-title" style={{ fontSize: '1.4rem', color: stat.color }}>{stat.value}</div>
              <div className="font-gaming" style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: '700', letterSpacing: '0.5px', marginTop: '4px' }}>
                {stat.label.toUpperCase()}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="tab-container glass-panel" style={{ display: 'flex', padding: '6px', borderRadius: '14px', gap: '8px', marginBottom: '16px' }}>
          {['games', 'history', 'transactions'].map(id => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="font-gaming"
              style={{ 
                flex: 1, 
                height: '40px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === id ? 'var(--primary-gold)' : 'transparent',
                color: activeTab === id ? '#000' : '#fff',
                fontSize: '0.75rem',
                fontWeight: '900',
                textTransform: 'uppercase',
                transition: '0.3s'
              }}
            >
              {id}
            </button>
          ))}
        </div>

        <Stack gap={10}>
          {(() => {
            const items = activeTab === 'games' ? filterGames() : activeTab === 'history' ? filterHistory() : filterTransactions();
            
            if (items.length === 0) {
              return (
                <Card style={{ padding: '30px', textAlign: 'center' }}>
                  <Activity size={40} opacity={0.3} style={{ marginBottom: '12px' }} />
                  <p className="text-sm-muted">No {activeTab} records yet</p>
                </Card>
              );
            }

            return items.map((item, idx) => (
              <Card key={idx} style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '10px', 
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getActivityIcon(item.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '0.85rem', textTransform: 'capitalize' }} className="font-gaming">
                      {item.type.replace(/_/g, ' ')}
                    </div>
                    <div className="font-gaming" style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                      {formatDate(item.timestamp)}
                    </div>
                  </div>
                  {item.amount && (
                    <div className="game-title" style={{ color: (item.amount > 0 || item.type === 'deposit') ? '#00c896' : '#ff4d4d', fontSize: '1rem', textAlign: 'right' }}>
                      {(item.amount > 0 || item.type === 'deposit') ? '+' : ''}{formatBalance(Math.abs(item.amount))}
                    </div>
                  )}

                </div>
              </Card>
            ));
          })()}
        </Stack>
      </div>
    </div>
  );
};

export default ProfilePage;
