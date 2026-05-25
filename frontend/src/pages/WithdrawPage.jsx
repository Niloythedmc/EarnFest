import { useState, useEffect, useMemo } from 'react';
import { Card, Button, GameButton } from '../components/UI';
import { useUser } from '../context/UserContext';
import { Wallet, Info, Banknote, Coins, CheckCircle2, XCircle } from 'lucide-react';
import axios from 'axios';
import { useConfig } from '../context/ConfigContext';
import Skeleton from '../components/Skeleton';
import { useLanguage } from '../context/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import OfferBanner from '../components/OfferBanner';
import { formatBalance } from '../utils/formatters';
import { getStoredDeviceFingerprint } from '../utils/deviceFingerprint';

const WithdrawPage = () => {
  const { user, setUser, refreshUser } = useUser();
  const { t } = useLanguage();
  const { apiBase, tiers, walletFather } = useConfig();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'withdraw' ? 'withdraw' : 'deposit');
  const [amount, setAmount] = useState('');
  const offchainCurrency = 'FEST';
  const [loading, setLoading] = useState(false);
  const [activeOffer, setActiveOffer] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(null);
  const [localTiers, setLocalTiers] = useState(tiers);
  const [offchainConnected, setOffchainConnected] = useState(false);
  const [checkingOffchain, setCheckingOffchain] = useState(false);
  const [tasks, setTasks] = useState([]);


  useEffect(() => {
    const fetchData = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        const [offerRes, configRes, settingsRes, tasksRes] = await Promise.all([
          axios.get(`${apiBase}/api/withdraw/offer`),
          axios.get(`${apiBase}/api/withdraw/config`),
          axios.get(`${apiBase}/api/admin/settings`, { headers: { 'x-telegram-init-data': tg?.initData } }).catch(() => ({ data: null })),
          axios.get(`${apiBase}/api/tasks`, { headers: { 'x-telegram-init-data': tg?.initData } }).catch(() => ({ data: [] }))
        ]);
        if (offerRes.data.active) setActiveOffer(offerRes.data);
        if (configRes.data.tiers) setLocalTiers(configRes.data.tiers);
        if (settingsRes.data) setGlobalSettings(settingsRes.data);
        if (tasksRes.data) setTasks(tasksRes.data);
      } catch {
        console.error('Failed to fetch data');
      }
    };
    fetchData();
  }, [apiBase]);

  useEffect(() => {
    const checkOffchainStatus = async () => {
      if (!user?.telegramId) return;
      setCheckingOffchain(true);
      try {
        const tg = window.Telegram?.WebApp;
        const response = await axios.get(`${apiBase}/api/withdraw/offchain/status/${user.telegramId}`, {
          headers: { 'x-telegram-init-data': tg?.initData }
        });
        setOffchainConnected(!!response.data?.connected);
      } catch {
        setOffchainConnected(false);
      } finally {
        setCheckingOffchain(false);
      }
    };
    checkOffchainStatus();
  }, [activeTab, user?.telegramId, apiBase]);



  // After sending the user to WalletFather to pay, auto-refresh balance for a short period
  // when they come back to the Mini App (WalletFather credits via server webhook).
  useEffect(() => {
    if (activeTab !== 'deposit') return;
    if (!user?.telegramId) return;

    const pendingAtRaw = sessionStorage.getItem('wf_deposit_pending_at');
    const pendingAt = pendingAtRaw ? Number(pendingAtRaw) : 0;
    if (!pendingAt || !Number.isFinite(pendingAt)) return;

    // Only auto-refresh for recent sessions (10 minutes)
    if (Date.now() - pendingAt > 10 * 60 * 1000) {
      sessionStorage.removeItem('wf_deposit_pending_at');
      return;
    }

    let tries = 0;
    const maxTries = 12; // ~1 minute @ 5s

    const interval = setInterval(async () => {
      tries += 1;
      await refreshUser?.();

      if (tries >= maxTries) {
        sessionStorage.removeItem('wf_deposit_pending_at');
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.telegramId]);

  const userTier = user?.tier || 'free';
  const standardMinLimit = globalSettings?.tierLimits?.[userTier] || localTiers[userTier]?.minWithdraw || 10000;
  const minWithdraw = activeOffer?.limits?.[userTier] !== undefined && activeOffer.isActive
    ? Number(activeOffer.limits[userTier])
    : standardMinLimit;
  const minDeposit = activeOffer?.limits?.[userTier] !== undefined && activeOffer.isActive
    ? Number(activeOffer.limits[userTier])
    : standardMinLimit;

  // Withdrawal requirements
  const activities = user?.activities || [];
  const completedTaskIds = new Set((user?.taskHistory || []).map(t => t.taskId));
  const completedCount = completedTaskIds.size;
  const tasksRequirementMet = completedCount >= 10;

  const todayStr = new Date().toISOString().slice(0, 10);
  const slotPlaysToday = activities.filter(a => {
    if (a.type !== 'slot_game') return false;
    const activityDate = new Date(a.timestamp).toISOString().slice(0, 10);
    return activityDate === todayStr;
  }).length;

  const spinPlaysToday = activities.filter(a => {
    if (a.type !== 'spin' && a.type !== 'spin_game') return false;
    const activityDate = new Date(a.timestamp).toISOString().slice(0, 10);
    return activityDate === todayStr;
  }).length;

  const streak = user?.dailyStreak || 0;

  const createdAt = user?.createdAt;
  let daysSinceJoined = 0;
  if (createdAt) {
    const createdDate = new Date(createdAt);
    const diffMs = Date.now() - createdDate.getTime();
    daysSinceJoined = diffMs / (1000 * 60 * 60 * 24);
  }

  const requirements = [
    { label: 'Complete 10 Tasks (Lifetime)', met: tasksRequirementMet, current: completedCount, required: 10 },
    { label: 'Play Slot Machine 10 Times Today', met: slotPlaysToday >= 10, current: slotPlaysToday, required: 10 },
    { label: 'Play Spin Wheel 10 Times Today', met: spinPlaysToday >= 10, current: spinPlaysToday, required: 10 },
    { label: '3-Day Daily Streak', met: streak >= 3, current: streak, required: 3 },
    { label: 'Account Age >= 5 Days', met: daysSinceJoined >= 5, current: Math.floor(daysSinceJoined), required: 5 },
  ];
  const canWithdraw = requirements.every(r => r.met);

  const openTelegramLink = (url) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return;
    }
    window.location.href = url;
  };

  const handleWalletFatherConnect = () => {
    if (!walletFather?.projectId) return alert('WalletFather project is not configured.');
    const url = `${walletFather.botBaseUrl}/connect?startapp=${encodeURIComponent(walletFather.projectId)}`;
    openTelegramLink(url);
  };

  const handleWalletFatherDeposit = () => {
    const parsedAmount = Number(amount);
    if (!walletFather?.projectId) return alert('WalletFather project is not configured.');
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return alert('Enter a valid amount.');
    
    if (parsedAmount < minDeposit) {
      return alert(`${t('min_deposit_is')} ${minDeposit.toLocaleString()} $FEST`);
    }

    const payload = `${walletFather.projectId}-${parsedAmount}-${offchainCurrency}`;
    const url = `${walletFather.botBaseUrl}/pay?startapp=${encodeURIComponent(payload)}`;
    // Mark "pending" so we can auto-refresh after the user returns
    sessionStorage.setItem('wf_deposit_pending_at', String(Date.now()));
    openTelegramLink(url);
  };

  const handleOffchainWithdraw = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < minWithdraw) {
      return alert(`${t('min_withdraw_is')} ${minWithdraw.toLocaleString()} $FEST`);
    }
    if (parsedAmount > (user?.balance || 0)) return alert(t('insufficient_balance'));
    // Check withdrawal requirements
    if (!canWithdraw) {
      const missing = requirements.filter(r => !r.met).map(r => r.label).join(', ');
      return alert(`Withdrawal requirements not met: ${missing}`);
    }
    setLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/withdraw/offchain/withdraw`, {
        amount: parsedAmount,
        currency: offchainCurrency
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });
      if (response.data.success) {
        alert('Offchain withdrawal sent successfully.');
        setUser(prev => ({ ...prev, balance: prev.balance - parsedAmount }));
        setAmount('');
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Offchain withdrawal failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="main-content stack-vertical">
        <header style={{ textAlign: 'center' }}>
          <Skeleton variant="text" width="200px" height="30px" style={{ margin: '0 auto 10px' }} />
          <Skeleton variant="text" width="250px" height="14px" style={{ margin: '0 auto' }} />
        </header>
        <Skeleton variant="rect" height="56px" borderRadius="14px" />
        <Skeleton variant="card" height="120px" />
        <div className="stack-vertical" style={{ gap: '20px' }}>
          <Skeleton variant="rect" height="80px" borderRadius="16px" />
          <Skeleton variant="rect" height="150px" borderRadius="16px" />
        </div>
      </div>
    );
  }

  // NOTE: Only WalletFather offchain deposit is supported. (On-chain deposit method removed.)

  return (
    <div className="main-content stack-vertical">
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2.5rem' }}>
          <Wallet size={32} className="gold-text" /> Finance Arena
        </h1>
        <p className="text-sm-muted font-gaming" style={{ fontSize: '0.75rem', marginTop: '4px' }}>DEPOSIT & WITHDRAW YOUR ASSETS</p>
      </header>

      <div className="tab-container glass-panel" style={{ display: 'flex', padding: '6px', borderRadius: '14px', gap: '8px' }}>
        <button className={`tab-btn font-gaming ${activeTab === 'deposit' ? 'active' : ''}`} onClick={() => { setActiveTab('deposit'); setAmount(''); }} style={{ flex: 1, minHeight: '50px', borderRadius: '10px', border: 'none', background: activeTab === 'deposit' ? 'var(--primary-gold)' : 'transparent', color: activeTab === 'deposit' ? '#000' : '#fff', fontWeight: '800', transition: '0.3s', textTransform: 'uppercase', fontSize: '0.75rem' }}>Deposit</button>
        <button className={`tab-btn font-gaming ${activeTab === 'withdraw' ? 'active' : ''}`} onClick={() => { setActiveTab('withdraw'); setAmount(''); }} style={{ flex: 1, minHeight: '50px', borderRadius: '10px', border: 'none', background: activeTab === 'withdraw' ? 'var(--primary-gold)' : 'transparent', color: activeTab === 'withdraw' ? '#000' : '#fff', fontWeight: '800', transition: '0.3s', textTransform: 'uppercase', fontSize: '0.75rem' }}>Withdraw</button>
      </div>

      {activeOffer && activeTab === 'withdraw' && <OfferBanner offer={activeOffer} />}

      <Card className="flex-center" style={{ padding: '32px 24px', textAlign: 'center', background: 'rgba(0,46,26,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '28px' }}>
        <div className="stack-vertical" style={{ alignItems: 'center', gap: '8px' }}>
          <div className="badge-gold font-gaming" style={{ fontSize: '0.7rem' }}>CURRENT BALANCE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2 className="game-title" style={{ fontSize: '3.5rem' }}>{formatBalance(user?.balance)}</h2>
            <span className="font-gaming gold-text" style={{ fontSize: '1.2rem', fontWeight: '800' }}>$FEST</span>
          </div>
        </div>
      </Card>

      <div className="stack-vertical" style={{ gap: '20px' }}>
        {activeTab === 'deposit' ? (
          <div className="stack-vertical" style={{ gap: '15px' }}>
            <div className="stack-vertical" style={{ gap: '8px' }}>
              <label className="input-label font-gaming">DEPOSIT AMOUNT</label>
              <div className="input-container glitter-border">
                <Banknote size={24} className="gold-text" />
                <input type="number" className="font-gaming" placeholder={`Min: ${minDeposit}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            {!offchainConnected ? (
              <GameButton 
                onClick={handleWalletFatherConnect} 
                fontSize="0.85rem" 
                fontWeight="800" 
                color="#ffffff" 
                style={{ color: '#000', minHeight: '40px', height: '40px' }}
              >
                <img src="/WalletFather.png" alt="" style={{ width: '20px', height: '20px', marginRight: '10px' }} />
                CONNECT WALLET FATHER
              </GameButton>
            ) : (
              <GameButton onClick={handleWalletFatherDeposit} disabled={!amount} fontSize="0.85rem" fontWeight="800" color="#4a90e2" style={{ minHeight: '40px', height: '40px' }}>DEPOSIT VIA WALLET FATHER</GameButton>
            )}
          </div>
        ) : (
          <div className="stack-vertical" style={{ gap: '15px' }}>
            {/* Withdrawal Requirements */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '14px 16px',
            }}>
              <p className="font-gaming" style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '1px', marginBottom: '10px', opacity: 0.7 }}>
                WITHDRAWAL REQUIREMENTS
              </p>
              <div className="stack-vertical" style={{ gap: '8px' }}>
                {requirements.map((req, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {req.met ? (
                      <CheckCircle2 size={16} color="#00c896" />
                    ) : (
                      <XCircle size={16} color="#ff4d4d" />
                    )}
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      color: req.met ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
                      flex: 1
                    }}>
                      {req.label}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      color: req.met ? '#00c896' : '#ff4d4d'
                    }}>
                      {req.current}/{req.required}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <>
              <div className="stack-vertical" style={{ gap: '8px' }}>
                <label className="input-label font-gaming">WITHDRAW AMOUNT</label>
                <div className="input-container glitter-border">
                  <Banknote size={24} className="gold-text" />
                  <input type="number" className="font-gaming" placeholder={`Min: ${minWithdraw}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>
              {!offchainConnected ? (
                <GameButton
                  onClick={handleWalletFatherConnect}
                  fontSize="0.85rem"
                  fontWeight="800"
                  color="#ffffff"
                  style={{ color: '#000', minHeight: '40px', height: '40px' }}
                >
                  <img src="/WalletFather.png" alt="" style={{ width: '20px', height: '20px', marginRight: '10px' }} />
                  CONNECT WALLET FATHER
                </GameButton>
              ) : (
                <GameButton onClick={handleOffchainWithdraw} loading={loading} disabled={!amount} fontSize="0.85rem" fontWeight="800" color="#4a90e2" style={{ minHeight: '40px', height: '40px' }}>WITHDRAW VIA WALLET FATHER</GameButton>
              )}
            </>
          </div>
        )}
      </div>

      <div className="glass-card flex-row" style={{ gap: '16px', background: 'rgba(74, 144, 226, 0.05)', border: '1px solid rgba(74, 144, 226, 0.15)', padding: '20px', borderRadius: '20px', alignItems: 'flex-start' }}>
        <div style={{ width: '40px', height: '40px', background: 'rgba(74, 144, 226, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Info size={22} color="#4a90e2" />
        </div>
        <p className="font-gaming" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
          DEPOSITS ARE POWERED BY WALLETFATHER. FUNDS ARE CREDITED INSTANTLY AFTER BOT CONFIRMATION.
        </p>
      </div>
    </div>
  );
};

export default WithdrawPage;
