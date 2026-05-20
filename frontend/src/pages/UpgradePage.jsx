import { useState, useEffect } from 'react';
import { Card, Button, Badge, Stack, GameButton, GameCard } from '../components/UI';
import { toast } from 'sonner';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import {
  Shield,
  Zap,
  Sparkles,
  Diamond,
  RefreshCw,
  XCircle,
  X,
  Copy,
  ExternalLink,
  CheckCircle2,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useTonConnectUI, useTonAddress, TonConnectButton } from '@tonconnect/ui-react';
import { useLanguage } from '../context/LanguageContext';
import { AdsClient } from '../utils/AdsClient';
import { beginCell } from '@ton/core';
import Skeleton from '../components/Skeleton';
import { formatBalance, formatRewardAmount } from '../utils/formatters';


const UpgradePage = () => {
  const { user } = useUser();
  const { t } = useLanguage();
  const { tiers, apiBase } = useConfig();
  const [selectedTier, setSelectedTier] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [verifyCountdown, setVerifyCountdown] = useState(60);
  const [manualTxHash, setManualTxHash] = useState('');
  const [verifyingManualHash, setVerifyingManualHash] = useState(false);

  useEffect(() => {
    if (tiers && Object.keys(tiers).length > 0) {
      setConfigLoading(false);
    }
  }, [tiers]);

  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();

  // Show ad on wallet disconnect
  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      if (!wallet && walletAddress) {
        console.log('Wallet disconnected. Showing ad.');
        AdsClient.showInterstitial();
      }
    });
    return () => unsubscribe();
  }, [tonConnectUI, walletAddress]);

  const tierData = [
    { id: 'cash', name: 'Cash Fest', icon: <Shield size={28} />, color: '#bdc3c7', bgActive: 'linear-gradient(145deg, rgba(189, 195, 199, 0.3) 0%, rgba(30, 35, 40, 0.8) 100%)', bgInactive: 'linear-gradient(145deg, rgba(189, 195, 199, 0.15) 0%, rgba(15, 17, 20, 0.6) 100%)', badge: 'Standard' }, // Silver
    { id: 'reward', name: 'Reward Fest', icon: <Zap size={28} />, color: '#e74c3c', bgActive: 'linear-gradient(145deg, rgba(231, 76, 60, 0.3) 0%, rgba(40, 10, 10, 0.8) 100%)', bgInactive: 'linear-gradient(145deg, rgba(231, 76, 60, 0.15) 0%, rgba(20, 5, 5, 0.6) 100%)', badge: 'Popular' }, // Red
    { id: 'bonus', name: 'Bonus Fest', icon: <Sparkles size={28} />, color: '#f1c40f', bgActive: 'linear-gradient(145deg, rgba(241, 196, 15, 0.3) 0%, rgba(40, 35, 10, 0.8) 100%)', bgInactive: 'linear-gradient(145deg, rgba(241, 196, 15, 0.15) 0%, rgba(20, 17, 5, 0.6) 100%)', badge: 'Premium' }, // Gold
    { id: 'profit', name: 'Profit Fest', icon: <Diamond size={28} />, color: '#3498db', bgActive: 'linear-gradient(145deg, rgba(52, 152, 219, 0.3) 0%, rgba(10, 25, 40, 0.8) 100%)', bgInactive: 'linear-gradient(145deg, rgba(52, 152, 219, 0.15) 0%, rgba(5, 12, 20, 0.6) 100%)', badge: 'Elite' }, // Blue
  ];

  const handleBuyNow = async (tierId) => {
    setSelectedTier(tierId);
    setLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/subscriptions/buy`, {
        telegramId: user.telegramId,
        tier: tierId
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        setPaymentData(response.data);
        setModalOpen(true);
      }
    } catch (error) {
      console.error('Buy Error:', error.response?.data || error.message);
      toast.error('Failed to initialize payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleTonPayment = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    try {
      // Create text comment payload correctly using @ton/core
      const body = beginCell()
        .storeUint(0, 32) // Write 32-bit zero for text comment standard
        .storeStringTail(paymentData.memo)
        .endCell();

      const payloadBase64 = body.toBoc().toString('base64');

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: paymentData.address,
            amount: (parseFloat(paymentData.amountTon) * 1000000000).toFixed(0).toString(),
            payload: payloadBase64
          },
        ],
      };

      await tonConnectUI.sendTransaction(transaction);
      startAutoVerify();
    } catch (error) {
      console.error('Payment Error Details:', error);
      const errorMsg = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Check console for details';
      if (errorMsg.toLowerCase().includes('reject')) {
        toast.error('Transaction cancelled by user.');
      } else {
        toast.error('Transaction failed: ' + errorMsg);
      }
    }
  };

  const handleManualHashVerify = async () => {
    if (!manualTxHash || manualTxHash.trim().length < 10) {
      toast.error('Please enter a valid transaction hash');
      return;
    }

    setVerifyingManualHash(true);
    const tg = window.Telegram?.WebApp;
    try {
      const response = await axios.post(`${apiBase}/api/subscriptions/verify`, {
        telegramId: user.telegramId,
        tier: selectedTier,
        txHash: manualTxHash.trim()
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        setModalOpen(false);
        toast.success('Payment verified! Your tier has been upgraded.');
        window.location.reload();
      } else {
        toast.error(response.data.error || 'Failed to verify transaction.');
      }
    } catch (error) {
      console.error('Manual Verify Error:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Verification failed. Double check your hash.');
    } finally {
      setVerifyingManualHash(false);
    }
  };

  const startAutoVerify = () => {
    setAutoVerifying(true);
    setVerifyCountdown(60);
    setModalOpen(false);

    let timeLeft = 60;
    const tg = window.Telegram?.WebApp;

    const checkPayment = async () => {
      try {
        const response = await axios.post(`${apiBase}/api/subscriptions/verify`, {
          telegramId: user.telegramId,
          tier: selectedTier
        }, {
          headers: { 'x-telegram-init-data': tg?.initData }
        });
        return response.data.success;
      } catch {
        return false;
      }
    };

    const interval = setInterval(async () => {
      timeLeft -= 5;
      setVerifyCountdown(timeLeft);

      const isSuccess = await checkPayment();

      if (isSuccess) {
        clearInterval(interval);
        setAutoVerifying(false);
        toast.success('Payment verified! Your tier has been upgraded.');
        window.location.reload();
      } else if (timeLeft <= 0) {
        clearInterval(interval);
        setAutoVerifying(false);
        toast.error("Verification timeout. Please check your tier in a few minutes.");
      }
    }, 5000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="main-content stack-vertical">
      <header style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2.5rem' }}>
          <Diamond size={32} className="gold-text" /> {t('premium_tiers')}
        </h1>
        <p className="text-sm-muted font-gaming" style={{ fontSize: '0.75rem', marginTop: '4px' }}>BOOST YOUR EARNINGS • UNLOCK FEATURES</p>
      </header>

      {configLoading ? (
        <div className="stack-vertical" style={{ gap: '16px' }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="card" height="180px" />
          ))}
        </div>
      ) : (
        <div className="stack-vertical" style={{ gap: '16px' }}>
          {tierData.map((tier, i) => {
            const details = tiers[tier.id];
            const isCurrent = user?.tier === tier.id;
            const isSelected = selectedTier === tier.id;
            const tierRanks = ['free', 'cash', 'reward', 'bonus', 'profit'];
            const currentRank = tierRanks.indexOf(user?.tier || 'free');
            const thisRank = tierRanks.indexOf(tier.id);
            const isOwned = currentRank >= thisRank;

            return (
              <div key={tier.id}>
                <GameCard
                  onClick={() => setSelectedTier(tier.id)}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: isSelected ? tier.bgActive : tier.bgInactive,
                    border: isSelected ? `2px solid ${tier.color}` : `1px solid ${tier.color}40`,
                    padding: '0px',
                    borderRadius: '24px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ padding: '12px' }}>
                    {details.price > 0 && (
                      <div style={{
                        position: 'absolute', top: '14px', right: '-42px', background: 'var(--danger)', color: 'white', padding: '6px 20px', fontSize: '0.65rem', fontWeight: '900', transform: 'rotate(45deg)', boxShadow: 'none', zIndex: 10, letterSpacing: '1px', fontFamily: 'var(--font-gaming)'
                      }}>-50% OFF</div>
                    )}

                    {/* Glitters Overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: `radial-gradient(circle at 20% 30%, ${tier.color}80 1px, transparent 1px), radial-gradient(circle at 70% 60%, ${tier.color}80 1px, transparent 1px), radial-gradient(circle at 40% 80%, ${tier.color}80 1px, transparent 1px), radial-gradient(circle at 80% 20%, ${tier.color}80 1px, transparent 1px), radial-gradient(circle at 10% 80%, ${tier.color}80 1.5px, transparent 1.5px), radial-gradient(circle at 90% 90%, ${tier.color}80 1.5px, transparent 1.5px)`,
                      backgroundSize: '100px 100px',
                      opacity: 0.8,
                      pointerEvents: 'none',
                      zIndex: 0
                    }} />
                    <div style={{
                      position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
                      background: `radial-gradient(circle, ${tier.color}15 0%, transparent 60%)`,
                      pointerEvents: 'none',
                      zIndex: 0
                    }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div className="flex-row-between" style={{ marginBottom: '14px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{
                            width: '40px', height: '40px',
                            background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: tier.color
                          }}>
                            {tier.icon}
                          </div>
                          <div>
                            <h3 className="game-title" style={{ fontSize: '1.4rem', textAlign: 'left' }}>{tier.name}</h3>
                            <Badge className="font-gaming" style={{ fontSize: '0.6rem', padding: '2px 8px' }}>{tier.badge}</Badge>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', marginTop: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', flexDirection: 'column' }}>
                            {details.price > 0 && (
                              <span style={{ fontSize: '0.8rem', opacity: 0.6, textDecoration: 'line-through', marginBottom: '-5px' }}>${formatRewardAmount(details.price * 2)}</span>
                            )}

                            <div className="game-title gold-text" style={{ fontSize: '2.2rem', textAlign: 'right' }}>${formatRewardAmount(details.price)}</div>

                          </div>
                          {isCurrent && <span style={{ color: 'var(--success)', fontSize: '0.65rem', fontWeight: '700' }}>{t('active_now')}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                          <span className="text-sm-muted font-gaming" style={{ fontSize: '0.55rem', fontWeight: '700', opacity: 0.6 }}>{t('ad_reward')}</span>
                          <span className="font-gaming" style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary-gold)' }}>{formatBalance(details.ads)} $FEST</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                          <span className="text-sm-muted font-gaming" style={{ fontSize: '0.55rem', fontWeight: '700', opacity: 0.6 }}>MIN DEPOSIT/WITHDRAW</span>
                          <span className="font-gaming" style={{ fontSize: '0.9rem', fontWeight: '800', color: '#fff' }}>{formatBalance(details.minWithdraw)} $FEST</span>
                        </div>

                      </div>
                      {isSelected && (
                        <div style={{ marginTop: '12px' }}>
                          {isCurrent ? (
                            <Button disabled style={{ height: '36px', fontSize: '0.75rem', background: 'var(--success)', border: 'none', color: '#fff', opacity: 0.8 }}>
                              <CheckCircle2 size={14} style={{ marginRight: '6px' }} /> {t('active_now')}
                            </Button>
                          ) : isOwned ? (
                            <Button disabled style={{ height: '36px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                              Owned
                            </Button>
                          ) : (
                            <GameButton
                              disabled={loading}
                              onClick={(e) => { e.stopPropagation(); handleBuyNow(tier.id); }}
                              style={{ height: '42px', fontSize: '0.85rem' }}
                            >
                              {loading ? t('processing') : 'Upgrade'}
                            </GameButton>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </GameCard>
              </div>
            );
          })}
        </div>
      )}

      {/* TON Payment Modal */}
      {modalOpen && paymentData && (
        <>
          <div
            onClick={() => setModalOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, backdropFilter: 'blur(2px)' }}
          />
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: 'var(--secondary-bg)',
              borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
              padding: '30px 24px 40px', zIndex: 9999,
              borderTop: '1px solid var(--glass-border)',
              boxShadow: 'none'
            }}
          >
              <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', margin: '0 auto 20px' }} />

              <div className="flex-row-between" style={{ marginBottom: '25px' }}>
                <h2 className="game-title" style={{ fontSize: '1.5rem' }}>{t('payment_details')}</h2>
                <div onClick={() => setModalOpen(false)} style={{ cursor: 'pointer', opacity: 0.5 }}><XCircle size={24} /></div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p className="text-sm-muted" style={{ fontSize: '0.75rem', textAlign: 'center' }}>{t('send_ton')}</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                <Stack gap={15}>
                  <div className="flex-row-between">
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{t('amount')}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary-gold)' }}>{paymentData.amountTon} TON</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>(${paymentData.amountUsd})</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,255,136,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,255,136,0.1)' }}>
                    <div className="flex-row" style={{ gap: '10px', marginBottom: '8px' }}>
                      <Wallet size={20} className="gold-text" />
                      <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Platform Wallet</span>
                    </div>
                    <div className="flex-row-between">
                      <code style={{ fontSize: '0.65rem', opacity: 0.6 }}>{paymentData.address.slice(0, 12)}...{paymentData.address.slice(-12)}</code>
                      <Copy size={16} className="gold-text" onClick={() => copyToClipboard(paymentData.address)} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: '800', marginBottom: '4px' }}>{t('required_memo')}</div>
                    <div className="flex-row-between" style={{ background: 'rgba(255,77,77,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,77,77,0.1)' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>{paymentData.memo}</span>
                      <Copy size={20} className="gold-text" onClick={() => copyToClipboard(paymentData.memo)} />
                    </div>
                  </div>
                </Stack>
              </div>

              <div className="stack-vertical" style={{ gap: '10px' }}>
                <Button
                  onClick={handleTonPayment}
                  disabled={!walletAddress}
                  style={{ height: '48px', fontSize: '0.9rem' }}
                >
                  {t('pay_via_wallet')} <ExternalLink size={16} />
                </Button>

                <Button
                  onClick={startAutoVerify}
                  style={{ height: '48px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.8)' }}
                >
                  Verify Payment Automatically
                </Button>

                <div style={{ margin: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  <p className="text-sm-muted font-gaming" style={{ fontSize: '0.65rem', textAlign: 'center', marginBottom: '8px', opacity: 0.6 }}>
                    OR VERIFY MANUALLY BY TRANSACTION HASH:
                  </p>
                  <div className="flex-row" style={{ gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Enter TON transaction hash..."
                      value={manualTxHash}
                      onChange={(e) => setManualTxHash(e.target.value)}
                      style={{
                        flex: 1,
                        height: '38px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '0 12px',
                        color: 'white',
                        fontSize: '0.7rem',
                        fontFamily: 'monospace',
                        outline: 'none'
                      }}
                    />
                    <Button
                      onClick={handleManualHashVerify}
                      disabled={!manualTxHash || manualTxHash.trim().length < 10 || verifyingManualHash}
                      style={{
                        height: '38px',
                        fontSize: '0.75rem',
                        padding: '0 15px',
                        background: 'var(--primary-gold)',
                        color: 'black',
                        fontWeight: 'bold',
                        border: 'none',
                        borderRadius: '12px'
                      }}
                    >
                      {verifyingManualHash ? '...' : 'Verify'}
                    </Button>
                  </div>
                </div>
                {!walletAddress && <div style={{ textAlign: 'center' }}><TonConnectButton /></div>}
              </div>
          </div>
        </>
      )}

      {/* Auto Verify Overlay */}
      {autoVerifying && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}
        >
          <RefreshCw size={64} color="var(--primary-gold)" className="spin" style={{ marginBottom: '24px' }} />
          <h2 className="game-title" style={{ marginBottom: '10px', fontSize: '1.8rem' }}>Verifying Transaction...</h2>
          <p className="text-sm-muted" style={{ marginBottom: '20px' }}>Please don't close this screen.<br />Scanning blockchain for payment...</p>
          <div className="flex-center" style={{ gap: '10px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{verifyCountdown}s</span>
            <span className="text-sm-muted">remaining</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default UpgradePage;
