import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bot, Users, Link as LinkIcon, Upload,
  Image as ImageIcon, Check, X, AlertCircle, Loader2,
  Wallet, Send, Copy, ExternalLink, RefreshCw, Rocket,
} from 'lucide-react';
import { Card, Button, Stack } from '../components/UI';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { toast } from 'sonner';
import axios from 'axios';
import { copyTextToClipboard } from '../utils/clipboard';
import { useTonConnectUI, useTonAddress, TonConnectButton } from '@tonconnect/ui-react';
import { beginCell } from '@ton/core';

const TON_LOGO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path fill="#0098EA" d="M14 0C6.27 0 0 6.27 0 14s6.27 14 14 14 14-6.27 14-14S21.73 0 14 0zm0 2.33c6.44 0 11.67 5.23 11.67 11.67S20.44 25.67 14 25.67 2.33 20.44 2.33 14 7.56 2.33 14 2.33zm-1.17 5.83v9.34L8.46 8.16h4.37zm2.34 0h4.37l-4.37 9.34V8.16zM7.33 7.16l6.67 14 6.67-14v-.01H7.33z"/></svg>');

const PLAN_KEY = 'only_task';
const PLAN_PRICE = 10;

const TASK_TYPES = [
  { key: 'bot', label: 'Bot', icon: <Bot size={18} />, color: '#8b5cf6' },
  { key: 'channel', label: 'Channel / Group', icon: <Users size={18} />, color: '#00c896' },
  { key: 'link', label: 'Link', icon: <LinkIcon size={18} />, color: '#4a90e2' },
];

const OnlyTaskPage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { apiBase } = useConfig();
  const fileInputRef = useRef(null);

  const [taskType, setTaskType] = useState('bot');
  const [linkInput, setLinkInput] = useState('');
  const [channelUsername, setChannelUsername] = useState('');
  const [channelCheck, setChannelCheck] = useState(null); // { ok, error, username } or null
  const [channelChecking, setChannelChecking] = useState(false);
  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  // Payment states
  const [paymentInit, setPaymentInit] = useState(null); // { address, amountTon, memo }
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [publishStatus, setPublishStatus] = useState(null);
  const [planId, setPlanId] = useState(null);

  // Modal & auto-verify states (like UpgradePage)
  const [modalOpen, setModalOpen] = useState(false);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [verifyCountdown, setVerifyCountdown] = useState(60);

  // TON Connect (like UpgradePage)
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();

  const tg = window.Telegram?.WebApp;
  const headers = { 'x-telegram-init-data': tg?.initData };

  // Parse link and extract username
  const parseLink = (val) => {
    setLinkInput(val);
    if (taskType === 'channel') {
      const trimmed = val.trim();
      let username = '';
      if (trimmed.startsWith('https://t.me/')) {
        username = trimmed.replace('https://t.me/', '').split('/')[0].split('?')[0];
      } else if (trimmed.startsWith('t.me/')) {
        username = trimmed.replace('t.me/', '').split('/')[0].split('?')[0];
      } else if (trimmed.startsWith('@')) {
        username = trimmed.slice(1);
      }
      if (username) {
        setChannelUsername(username);
        setChannelCheck(null);
      } else {
        setChannelUsername('');
        setChannelCheck(null);
      }
    }
  };

  // Check channel/group bot access
  const handleChannelCheck = async () => {
    if (!channelUsername) {
      toast.error('Enter a channel/group link first');
      return;
    }
    setChannelChecking(true);
    setChannelCheck(null);
    try {
      const res = await axios.post(`${apiBase}/api/promote/check-channel`, { link: linkInput }, { headers });
      setChannelCheck(res.data);
      if (res.data.ok) {
        toast.success('Bot has access! ✓');
      }
    } catch (e) {
      setChannelCheck({ ok: false, error: 'Failed to check channel' });
    } finally {
      setChannelChecking(false);
    }
  };

  // Auto-check when link changes for channel type
  useEffect(() => {
    if (taskType === 'channel' && channelUsername && linkInput) {
      const debounce = setTimeout(() => {
        handleChannelCheck();
      }, 1200);
      return () => clearTimeout(debounce);
    }
  }, [channelUsername, linkInput, taskType]);

  // Image handling
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large. Max 5MB.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      const res = await axios.post(`${apiBase}/api/upload`, formData, { headers });
      setImageUrl(res.data.url);
      return res.data.url;
    } catch (e) {
      toast.error('Failed to upload image');
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  // Initiate payment — opens modal like UpgradePage
  const handleInitPayment = async () => {
    if (!title.trim()) {
      toast.error('Enter a task title');
      return;
    }
    if (!linkInput.trim() && taskType !== 'bot') {
      toast.error('Enter a link');
      return;
    }

    setPaymentLoading(true);
    try {
      const res = await axios.post(`${apiBase}/api/promote/init-payment`, { planKey: PLAN_KEY }, { headers });
      if (res.data.success) {
        setPaymentInit(res.data);
        setModalOpen(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  // Pay via TON Connect wallet — like UpgradePage handleTonPayment
  const handleTonPayment = async () => {
    if (!walletAddress || !paymentInit) {
      toast.error('Please connect your wallet first.');
      return;
    }

    try {
      const body = beginCell()
        .storeUint(0, 32)
        .storeStringTail(paymentInit.memo)
        .endCell();

      const payloadBase64 = body.toBoc().toString('base64');

      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: paymentInit.address,
            amount: (parseFloat(paymentInit.amountTon) * 1000000000).toFixed(0).toString(),
            payload: payloadBase64
          },
        ],
      };

      await tonConnectUI.sendTransaction(transaction);
      startAutoVerify();
    } catch (error) {
      console.error('Payment Error:', error);
      const errorMsg = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Check console for details';
      if (errorMsg.toLowerCase().includes('reject')) {
        toast.error('Transaction cancelled by user.');
      } else {
        toast.error('Transaction failed: ' + errorMsg);
      }
    }
  };

  // Auto-verify with countdown — like UpgradePage startAutoVerify
  const startAutoVerify = () => {
    setAutoVerifying(true);
    setVerifyCountdown(60);
    setModalOpen(false);

    let timeLeft = 60;

    const checkPayment = async () => {
      try {
        const res = await axios.post(`${apiBase}/api/promote/verify-payment`, {
          planKey: PLAN_KEY,
          memo: paymentInit.memo,
        }, { headers });
        if (res.data.success) {
          setTxHash(res.data.txHash);
          setPaid(true);
          return true;
        }
        return false;
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
        toast.success('Payment confirmed!');
      } else if (timeLeft <= 0) {
        clearInterval(interval);
        setAutoVerifying(false);
        toast.error("Verification timeout. You can verify manually below.");
      }
    }, 5000);
  };

  // Manual verify
  const handleVerifyPayment = async () => {
    if (!paymentInit) return;
    setProcessing(true);
    try {
      const res = await axios.post(`${apiBase}/api/promote/verify-payment`, {
        planKey: PLAN_KEY,
        memo: paymentInit.memo,
      }, { headers });

      if (res.data.success) {
        setTxHash(res.data.txHash);
        setPaid(true);
        toast.success('Payment confirmed!');
      } else {
        toast.error('Payment not found yet. Please wait and try again.');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Verification failed');
    } finally {
      setProcessing(false);
    }
  };

  // Publish
  const handlePublish = async () => {
    if (!txHash) return;
    setProcessing(true);
    try {
      let uploadUrl = imageUrl;
      if (imageFile && !uploadUrl) {
        uploadUrl = await uploadImage();
      }

      const tasks = [{
        title: title.trim(),
        link: linkInput.trim() || ('https://t.me/' + channelUsername),
        type: taskType === 'bot' ? 'partner' : taskType === 'channel' ? 'channel' : 'link',
        imageUrl: uploadUrl || null,
      }];

      const payload = {
        planKey: PLAN_KEY,
        txHash,
        tasks,
        channelCheck: taskType === 'channel' ? {
          required: true,
          username: channelUsername,
          passed: channelCheck?.ok || false,
        } : null,
      };

      const res = await axios.post(`${apiBase}/api/promote/publish`, payload, { headers });

      if (res.data.success) {
        setPublishStatus(res.data.publishStatus);
        setPlanId(res.data.planId);
        if (res.data.publishStatus === 'published') {
          toast.success('Your task has been published! 🎉');
        } else {
          toast.success('Payment confirmed! Add the bot to your channel to publish.');
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to publish');
    } finally {
      setProcessing(false);
    }
  };

  // Re-check and publish for channel access
  const handleRecheckAndPublish = async (planId) => {
    setProcessing(true);
    try {
      const res = await axios.post(`${apiBase}/api/promote/recheck-and-publish`, { planId }, { headers });
      if (res.data.success && res.data.publishStatus === 'published') {
        setPublishStatus('published');
        toast.success('Task published! 🎉');
      } else {
        toast.error(res.data.error || 'Bot still needs admin access');
        if (navigator.vibrate) navigator.vibrate(200);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to publish');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text) => {
    copyTextToClipboard(text);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (publishStatus === 'published') {
    return (
      <div className="main-content" style={{ paddingTop: '60px' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ textAlign: 'center' }}
        >
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'var(--success)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(0,200,150,0.3)',
          }}>
            <Check size={40} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '900', marginBottom: '8px' }}>Published! 🎉</h2>
          <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '24px' }}>
            Your task is now live in the Tasks page.
          </p>
          <Button onClick={() => navigate('/tasks')} style={{ width: '100%' }}>
            View Tasks
          </Button>
        </motion.div>
      </div>
    );
  }

  if (publishStatus === 'pending_access') {
    return (
      <div className="main-content" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'rgba(245,158,11,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <AlertCircle size={30} color="#f59e0b" />
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '8px' }}>Bot Access Required</h2>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, lineHeight: '1.5', marginBottom: '16px' }}>
            Please add <strong style={{ color: '#4a90e2', cursor: 'pointer' }} onClick={() => copyToClipboard('@EarnFestBot')}>@EarnFestBot</strong> as an administrator to your channel/group.
          </p>
          <div style={{
            background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
            padding: '16px', marginBottom: '20px',
            fontSize: '0.75rem', opacity: 0.6, lineHeight: '1.6',
          }}>
            1. Open your channel/group settings<br />
            2. Go to Administrators → Add Admin<br />
            3. Search for <strong>@EarnFestBot</strong><br />
            4. Add with any permissions (no special rights needed)<br />
            5. Come back and click "Check & Publish"
          </div>
          <Button
            onClick={() => handleRecheckAndPublish(planId)}
            disabled={processing || !planId}
            style={{ width: '100%', background: '#f59e0b', border: 'none' }}
          >
            {processing ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
            {' '}Check & Publish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ paddingBottom: '40px' }}>
      {/* Back */}
      <button
        onClick={() => navigate('/promote')}
        style={{
          background: 'none', border: 'none', color: 'inherit',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '0.85rem', opacity: 0.6, padding: '12px 0', cursor: 'pointer',
        }}
      >
        <ArrowLeft size={18} /> Back to Plans
      </button>

      <h2 style={{ fontSize: '1.3rem', fontWeight: '900', marginBottom: '20px' }}>
        Create Your Task
      </h2>

      <Stack gap={20}>
        {/* Task Type Selector */}
        <Card style={{ padding: '16px' }}>
          <p style={{ fontWeight: '800', fontSize: '0.75rem', opacity: 0.7, marginBottom: '12px', letterSpacing: '0.5px' }}>
            TASK TYPE
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {TASK_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => {
                  setTaskType(type.key);
                  setChannelCheck(null);
                  setChannelUsername('');
                }}
                style={{
                  padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                  background: taskType === type.key ? `${type.color}20` : 'rgba(255,255,255,0.03)',
                  border: taskType === type.key ? `1.5px solid ${type.color}` : '1px solid transparent',
                  color: taskType === type.key ? type.color : 'rgba(255,255,255,0.5)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  transition: 'all 0.2s', fontWeight: taskType === type.key ? '700' : '500',
                  fontSize: '0.7rem',
                }}
              >
                {type.icon}
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Link Input */}
        <Card style={{ padding: '16px' }}>
          <label className="input-label" style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', display: 'block', opacity: 0.7 }}>
            {taskType === 'bot' ? 'Bot Username / Link' : taskType === 'channel' ? 'Channel / Group Link' : 'Link URL'}
          </label>
          <div className="input-container">
            <LinkIcon size={16} className="gold-text" />
            <input
              type="text"
              placeholder={
                taskType === 'bot' ? 'e.g. @mybot or https://t.me/mybot' :
                taskType === 'channel' ? 'e.g. https://t.me/mychannel' :
                'e.g. https://example.com'
              }
              value={linkInput}
              onChange={(e) => parseLink(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>

          {/* Channel check status */}
          {taskType === 'channel' && channelUsername && (
            <div style={{ marginTop: '10px' }}>
              {channelChecking ? (
                <div className="flex-row" style={{ gap: '8px', fontSize: '0.75rem', opacity: 0.6 }}>
                  <Loader2 size={14} className="spin" /> Checking bot access...
                </div>
              ) : channelCheck ? (
                <div style={{
                  padding: '10px 12px', borderRadius: '10px',
                  background: channelCheck.ok ? 'rgba(0,200,150,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${channelCheck.ok ? 'rgba(0,200,150,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  fontSize: '0.7rem', lineHeight: '1.5',
                }}>
                  {channelCheck.ok ? (
                    <div className="flex-row" style={{ gap: '8px', color: '#00c896' }}>
                      <Check size={14} /> Bot has access to @{channelCheck.username}
                    </div>
                  ) : (
                    <div style={{ color: '#ef4444' }}>
                      <div className="flex-row" style={{ gap: '8px', marginBottom: '4px' }}>
                        <X size={14} /> <span>{channelCheck.error}</span>
                      </div>
                      {(channelCheck.botUsername && channelCheck.channelUsername) && (
                        <div style={{ marginTop: '6px', fontSize: '0.65rem' }}>
                          <span
                            style={{ color: '#4a90e2', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => copyToClipboard(channelCheck.botUsername)}
                          >
                            {channelCheck.botUsername}
                          </span>
                          {' '}needs admin access in{' '}
                          <span
                            style={{ color: '#4a90e2', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => window.open(`https://t.me/${channelCheck.channelUsername.replace('@', '')}`, '_blank')}
                          >
                            {channelCheck.channelUsername}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </Card>

        {/* Title Input */}
        <Card style={{ padding: '16px' }}>
          <label className="input-label" style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '8px', display: 'block', opacity: 0.7 }}>
            TASK TITLE
          </label>
          <div className="input-container">
            <input
              type="text"
              placeholder="e.g. Join our awesome community!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1 }}
              maxLength={120}
            />
          </div>
        </Card>

        {/* Image Upload */}
        <Card style={{ padding: '16px' }}>
          <p style={{ fontWeight: '800', fontSize: '0.75rem', opacity: 0.7, marginBottom: '12px' }}>
            TASK IMAGE (Optional)
          </p>
          {imagePreview ? (
            <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
              <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '12px' }} />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); setImageUrl(''); }}
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '12px',
                padding: '30px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <ImageIcon size={30} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>Click to upload an image</p>
              <p style={{ fontSize: '0.6rem', opacity: 0.3, marginTop: '4px' }}>PNG, JPG, WEBP (max 5MB)</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
        </Card>

        {/* Payment Section */}
        <Card style={{ padding: '16px', background: 'rgba(0,200,150,0.03)', border: '1px solid rgba(0,200,150,0.15)' }}>
          {!paid ? (
            <>
              {!paymentInit ? (
                <Button
                  onClick={handleInitPayment}
                  disabled={paymentLoading || !title.trim()}
                  style={{ width: '100%', background: '#0f0f0f', border: '1px solid #0098EA' }}
                >
                  {paymentLoading ? (
                    <Loader2 size={18} className="spin" />
                  ) : (
                    <>
                      <img src={TON_LOGO} alt="TON" style={{ width: '20px', height: '20px' }} />
                      Pay {PLAN_PRICE}
                    </>
                  )}
                </Button>
              ) : (
                <div>
                  <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', color: '#00c896' }}>
                    Payment Ready
                  </p>
                  <div style={{ fontSize: '0.75rem', marginBottom: '8px', opacity: 0.7 }}>
                    Send exactly <strong style={{ color: '#0098EA' }}>{paymentInit.amountTon} TON</strong> to:
                  </div>
                  <div
                    onClick={() => copyToClipboard(paymentInit.address)}
                    style={{
                      background: 'rgba(0,0,0,0.4)', borderRadius: '10px',
                      padding: '12px', fontSize: '0.7rem',
                      fontFamily: 'monospace', wordBreak: 'break-all',
                      cursor: 'pointer', marginBottom: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div className="flex-row-between">
                      <span>{paymentInit.address}</span>
                      <Copy size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '12px' }}>
                    Memo: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>{paymentInit.memo}</code>
                  </div>

                  {/* Pay via Wallet button (like UpgradePage) */}
                  <div className="stack-vertical" style={{ gap: '10px' }}>
                    <Button
                      onClick={handleTonPayment}
                      disabled={!walletAddress}
                      style={{ width: '100%', height: '48px', fontSize: '0.9rem' }}
                    >
                      <Wallet size={18} /> Pay via Wallet <ExternalLink size={16} />
                    </Button>
                    <Button
                      onClick={handleVerifyPayment}
                      disabled={processing}
                      style={{ width: '100%', height: '48px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.8)' }}
                    >
                      {processing ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                      {' '}Verify Payment Manually
                    </Button>
                    {!walletAddress && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                        <TonConnectButton />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div>
              <div className="flex-row" style={{ gap: '10px', marginBottom: '12px' }}>
                <Check size={20} color="#00c896" />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#00c896' }}>Payment Confirmed ✓</div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>Tx: {txHash?.slice(0, 16)}...</div>
                </div>
              </div>
              <Button
                onClick={handlePublish}
                disabled={processing || (taskType === 'channel' && !channelCheck?.ok)}
                style={{ width: '100%', background: 'var(--success)', border: 'none', color: '#000' }}
              >
                {processing ? <Loader2 className="spin" size={18} /> : <Rocket size={18} />}
                {' '}Publish Task
              </Button>
              {taskType === 'channel' && !channelCheck?.ok && (
                <p style={{ fontSize: '0.65rem', opacity: 0.5, textAlign: 'center', marginTop: '8px' }}>
                  Bot needs admin access in your channel to publish
                </p>
              )}
            </div>
          )}
        </Card>
      </Stack>

      {/* Payment Modal (like UpgradePage) */}
      <AnimatePresence>
        {modalOpen && paymentInit && (
          <>
            <div
              onClick={() => setModalOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, backdropFilter: 'blur(2px)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                background: 'var(--secondary-bg)',
                borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
                padding: '30px 24px 40px', zIndex: 9999,
                borderTop: '1px solid var(--glass-border)',
              }}
            >
              <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', margin: '0 auto 20px' }} />

              <div className="flex-row-between" style={{ marginBottom: '25px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '900' }}>Payment Details</h2>
                <div onClick={() => setModalOpen(false)} style={{ cursor: 'pointer', opacity: 0.5 }}><X size={24} /></div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.6, textAlign: 'center' }}>Send the exact amount with the memo to complete payment</p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
                <Stack gap={15}>
                  <div className="flex-row-between">
                    <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Amount</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary-gold)' }}>{paymentInit.amountTon} TON</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>(${paymentInit.amountUsd})</div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,255,136,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(0,255,136,0.1)' }}>
                    <div className="flex-row" style={{ gap: '10px', marginBottom: '8px' }}>
                      <Wallet size={20} className="gold-text" />
                      <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Platform Wallet</span>
                    </div>
                    <div className="flex-row-between">
                      <code style={{ fontSize: '0.65rem', opacity: 0.6 }}>{paymentInit.address.slice(0, 12)}...{paymentInit.address.slice(-12)}</code>
                      <Copy size={16} className="gold-text" onClick={() => copyToClipboard(paymentInit.address)} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: '800', marginBottom: '4px' }}>REQUIRED MEMO</div>
                    <div className="flex-row-between" style={{ background: 'rgba(255,77,77,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,77,77,0.1)' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: '900' }}>{paymentInit.memo}</span>
                      <Copy size={20} className="gold-text" onClick={() => copyToClipboard(paymentInit.memo)} />
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
                  <Wallet size={18} /> Pay via Wallet <ExternalLink size={16} />
                </Button>
                <Button
                  onClick={() => { setModalOpen(false); startAutoVerify(); }}
                  style={{ height: '48px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.8)' }}
                >
                  Verify Payment Manually
                </Button>
                {!walletAddress && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <TonConnectButton />
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Auto Verify Overlay (like UpgradePage) */}
      <AnimatePresence>
        {autoVerifying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}
          >
            <RefreshCw size={64} color="var(--primary-gold)" className="spin" style={{ marginBottom: '24px' }} />
            <h2 style={{ fontSize: '1.8rem', fontWeight: '900', marginBottom: '10px' }}>Verifying Transaction...</h2>
            <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '20px' }}>Please don't close this screen.<br />Scanning blockchain for payment...</p>
            <div className="flex-center" style={{ gap: '10px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{verifyCountdown}s</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>remaining</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default OnlyTaskPage;