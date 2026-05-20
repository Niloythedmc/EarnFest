import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bot, Users, Link as LinkIcon, Upload,
  Image as ImageIcon, Check, X, AlertCircle, Loader2,
  Wallet, Send, Copy, ExternalLink, RefreshCw, Rocket,
  LayoutGrid, MessageSquare, Handshake,
} from 'lucide-react';
import { Card, Button, Stack } from '../components/UI';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';
import { toast } from 'sonner';
import axios from 'axios';
import { useTonConnectUI, useTonAddress, TonConnectButton } from '@tonconnect/ui-react';
import { beginCell } from '@ton/core';

const TON_LOGO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path fill="#0098EA" d="M14 0C6.27 0 0 6.27 0 14s6.27 14 14 14 14-6.27 14-14S21.73 0 14 0zm0 2.33c6.44 0 11.67 5.23 11.67 11.67S20.44 25.67 14 25.67 2.33 20.44 2.33 14 7.56 2.33 14 2.33zm-1.17 5.83v9.34L8.46 8.16h4.37zm2.34 0h4.37l-4.37 9.34V8.16zM7.33 7.16l6.67 14 6.67-14v-.01H7.33z"/></svg>');

const TASK_TYPES = [
  { key: 'bot', label: 'Bot', icon: <Bot size={18} />, color: '#8b5cf6' },
  { key: 'channel', label: 'Channel / Group', icon: <Users size={18} />, color: '#00c896' },
  { key: 'link', label: 'Link', icon: <LinkIcon size={18} />, color: '#4a90e2' },
];

const PLAN_KEY = 'collaboration';
const PLAN_PRICE = 50;

// ── Reusable Task Form ────────────────────────────────────────────────────────
const TaskForm = ({ index, data, onChange }) => {
  const fileInputRef = useRef(null);

  const parseLink = (val) => {
    const taskData = { ...data, linkInput: val };
    if (data.taskType === 'channel') {
      const trimmed = val.trim();
      let username = '';
      if (trimmed.startsWith('https://t.me/')) {
        username = trimmed.replace('https://t.me/', '').split('/')[0].split('?')[0];
      } else if (trimmed.startsWith('t.me/')) {
        username = trimmed.replace('t.me/', '').split('/')[0].split('?')[0];
      } else if (trimmed.startsWith('@')) {
        username = trimmed.slice(1);
      }
      taskData.channelUsername = username || '';
      if (!username) taskData.channelCheck = null;
    }
    onChange(taskData);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large. Max 5MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => onChange({ ...data, imageFile: file, imagePreview: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <Card style={{ padding: '16px' }}>
      <p style={{ fontWeight: '800', fontSize: '0.75rem', opacity: 0.7, marginBottom: '12px', letterSpacing: '0.5px' }}>
        TASK {index} — TYPE
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {TASK_TYPES.map((type) => (
          <button
            key={type.key}
            onClick={() => onChange({ ...data, taskType: type.key, channelUsername: '', channelCheck: null })}
            style={{
              padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
              background: data.taskType === type.key ? `${type.color}20` : 'rgba(255,255,255,0.03)',
              border: data.taskType === type.key ? `1.5px solid ${type.color}` : '1px solid transparent',
              color: data.taskType === type.key ? type.color : 'rgba(255,255,255,0.5)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s', fontWeight: data.taskType === type.key ? '700' : '500',
              fontSize: '0.7rem',
            }}
          >
            {type.icon}
            <span>{type.label}</span>
          </button>
        ))}
      </div>

      <label style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '6px', display: 'block', opacity: 0.7 }}>
        {data.taskType === 'bot' ? 'Bot Username / Link' : data.taskType === 'channel' ? 'Channel / Group Link' : 'Link URL'}
      </label>
      <div className="input-container" style={{ marginBottom: '12px' }}>
        <LinkIcon size={16} className="gold-text" />
        <input
          type="text"
          placeholder={
            data.taskType === 'bot' ? 'e.g. @mybot' :
            data.taskType === 'channel' ? 'e.g. https://t.me/mychannel' :
            'e.g. https://example.com'
          }
          value={data.linkInput}
          onChange={(e) => parseLink(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>

      <label style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '6px', display: 'block', opacity: 0.7 }}>
        TASK {index} TITLE
      </label>
      <div className="input-container" style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="e.g. Join our awesome community!"
          value={data.title}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          style={{ flex: 1 }}
          maxLength={120}
        />
      </div>

      <p style={{ fontWeight: '800', fontSize: '0.7rem', opacity: 0.5, marginBottom: '8px' }}>
        IMAGE (Optional)
      </p>
      {data.imagePreview ? (
        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', marginBottom: '8px' }}>
          <img src={data.imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '10px' }} />
          <button
            onClick={() => onChange({ ...data, imageFile: null, imagePreview: null, imageUrl: '' })}
            style={{
              position: 'absolute', top: '6px', right: '6px',
              width: '26px', height: '26px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed rgba(255,255,255,0.12)', borderRadius: '10px',
            padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: '8px',
          }}
        >
          <ImageIcon size={24} style={{ opacity: 0.3, marginBottom: '6px' }} />
          <p style={{ fontSize: '0.7rem', opacity: 0.4 }}>Click to upload</p>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
    </Card>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const CollaborationPage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { apiBase } = useConfig();
  const tg = window.Telegram?.WebApp;
  const headers = { 'x-telegram-init-data': tg?.initData };

  // Two task forms
  const [activeTab, setActiveTab] = useState(1);
  const [task1, setTask1] = useState({ taskType: 'bot', linkInput: '', channelUsername: '', channelCheck: null, title: '', imageFile: null, imagePreview: null, imageUrl: '' });
  const [task2, setTask2] = useState({ taskType: 'bot', linkInput: '', channelUsername: '', channelCheck: null, title: '', imageFile: null, imagePreview: null, imageUrl: '' });
  const tasks = [task1, task2];

  // Banner
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [bannerImagePreview, setBannerImagePreview] = useState(null);
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerLink, setBannerLink] = useState('');
  const [bannerTitle, setBannerTitle] = useState('');
  const bannerFileInputRef = useRef(null);

  // Payment states
  const [paymentInit, setPaymentInit] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [publishStatus, setPublishStatus] = useState(null);
  const [planId, setPlanId] = useState(null);

  // Modal & auto-verify (like UpgradePage)
  const [modalOpen, setModalOpen] = useState(false);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [verifyCountdown, setVerifyCountdown] = useState(60);

  // TON Connect (like UpgradePage)
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();

  // Auto channel check with debounce
  useEffect(() => {
    const run = async () => {
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        if (t.taskType === 'channel' && t.channelUsername && t.linkInput && !t.channelCheck && !processing) {
          const debounce = setTimeout(async () => {
            const res = await axios.post(`${apiBase}/api/promote/check-channel`, { link: t.linkInput }, { headers }).catch(() => null);
            if (res?.data) {
              if (i === 0) setTask1(prev => ({ ...prev, channelCheck: res.data }));
              else setTask2(prev => ({ ...prev, channelCheck: res.data }));
            }
          }, 1200);
          return () => clearTimeout(debounce);
        }
      }
    };
    run();
  }, [task1.channelUsername, task1.linkInput, task2.channelUsername, task2.linkInput]);

  const handleBannerImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setBannerImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('image', file);
    const res = await axios.post(`${apiBase}/api/upload`, formData, { headers });
    return res.data.url;
  };

  // Init payment — opens modal like UpgradePage
  const handleInitPayment = async () => {
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t.title.trim()) { toast.error(`Enter a title for Task ${i + 1}`); return; }
      if (!t.linkInput.trim() && t.taskType !== 'bot') { toast.error(`Enter a link for Task ${i + 1}`); return; }
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

  // Auto-verify with countdown — like UpgradePage
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
        planKey: PLAN_KEY, memo: paymentInit.memo,
      }, { headers });
      if (res.data.success) {
        setTxHash(res.data.txHash);
        setPaid(true);
        toast.success('Payment confirmed!');
      } else {
        toast.error('Payment not found yet. Try again.');
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
      let t1img = task1.imageUrl;
      let t2img = task2.imageUrl;
      if (task1.imageFile && !t1img) t1img = await uploadImage(task1.imageFile);
      if (task2.imageFile && !t2img) t2img = await uploadImage(task2.imageFile);

      let bannerImg = bannerImageUrl;
      if (bannerImageFile && !bannerImg) bannerImg = await uploadImage(bannerImageFile);

      const tasksPayload = [
        {
          title: task1.title.trim(),
          link: task1.linkInput.trim() || ('https://t.me/' + (task1.channelUsername || '')),
          type: task1.taskType === 'bot' ? 'partner' : task1.taskType === 'channel' ? 'channel' : 'link',
          imageUrl: t1img || null,
        },
        {
          title: task2.title.trim(),
          link: task2.linkInput.trim() || ('https://t.me/' + (task2.channelUsername || '')),
          type: task2.taskType === 'bot' ? 'partner' : task2.taskType === 'channel' ? 'channel' : 'link',
          imageUrl: t2img || null,
        },
      ];

      const channelChecks = [];
      for (const t of tasks) {
        if (t.taskType === 'channel') {
          channelChecks.push({ required: true, username: t.channelUsername, passed: t.channelCheck?.ok || false });
        }
      }

      const payload = {
        planKey: PLAN_KEY,
        txHash,
        tasks: tasksPayload,
        channelCheck: channelChecks.length > 0 ? channelChecks[0] : null,
        banner: bannerImg ? {
          imageUrl: bannerImg,
          linkUrl: bannerLink.trim() || '',
          title: bannerTitle.trim() || '',
        } : null,
      };

      const res = await axios.post(`${apiBase}/api/promote/publish`, payload, { headers });
      if (res.data.success) {
        setPublishStatus(res.data.publishStatus);
        setPlanId(res.data.planId);
        if (res.data.publishStatus === 'published') {
          toast.success('Collaboration published! 🎉');
        } else {
          toast.success('Payment confirmed! Add the bot to your channel.');
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to publish');
    } finally {
      setProcessing(false);
    }
  };

  const handleRecheckAndPublish = async (pid) => {
    setProcessing(true);
    try {
      const res = await axios.post(`${apiBase}/api/promote/recheck-and-publish`, { planId: pid }, { headers });
      if (res.data.success && res.data.publishStatus === 'published') {
        setPublishStatus('published');
        toast.success('Collaboration published! 🎉');
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
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  // ── Render States ──────────────────────────────────────────────────────────
  if (publishStatus === 'published') {
    return (
      <div className="main-content" style={{ paddingTop: '60px' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'var(--success)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(0,200,150,0.3)',
          }}>
            <Check size={40} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '900', marginBottom: '8px' }}>Collaboration Active! 🎉</h2>
          <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '24px' }}>
            Your tasks and banner are live. Our team will reach out to you soon.
          </p>
          <Button onClick={() => navigate('/tasks')} style={{ width: '100%' }}>View Tasks</Button>
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
            4. Add with any permissions<br />
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

  // ── Main Form ──────────────────────────────────────────────────────────────
  return (
    <div className="main-content" style={{ paddingBottom: '40px' }}>
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

      <h2 style={{ fontSize: '1.3rem', fontWeight: '900', marginBottom: '4px' }}>Collaboration</h2>
      <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '20px' }}>2 Tasks + Banner + Collaboration — <img src={TON_LOGO} alt="TON" style={{ width: '14px', height: '14px', verticalAlign: 'middle', marginRight: '2px' }} />{PLAN_PRICE}</p>

      {/* Task Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[1, 2].map((num) => (
          <button
            key={num}
            onClick={() => setActiveTab(num)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
              background: activeTab === num ? 'rgba(147,51,234,0.15)' : 'rgba(255,255,255,0.03)',
              border: activeTab === num ? '1.5px solid #9333ea' : '1px solid transparent',
              color: activeTab === num ? '#9333ea' : 'rgba(255,255,255,0.5)',
              fontWeight: activeTab === num ? '700' : '500',
              fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            <LayoutGrid size={16} />
            Task {num}
          </button>
        ))}
      </div>

      {/* Active Task Form */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 1 ? (
            <TaskForm index={1} data={task1} onChange={setTask1} />
          ) : (
            <TaskForm index={2} data={task2} onChange={setTask2} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Channel Check Statuses */}
      {tasks.map((t, i) => (
        t.taskType === 'channel' && t.channelCheck && (
          <Card key={`chk-${i}`} style={{ padding: '12px', marginTop: '12px' }}>
            <div style={{
              padding: '8px 10px', borderRadius: '8px',
              background: t.channelCheck.ok ? 'rgba(0,200,150,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${t.channelCheck.ok ? 'rgba(0,200,150,0.3)' : 'rgba(239,68,68,0.3)'}`,
              fontSize: '0.7rem', lineHeight: '1.5',
            }}>
              {t.channelCheck.ok ? (
                <div className="flex-row" style={{ gap: '8px', color: '#00c896' }}>
                  <Check size={14} /> Task {i + 1}: Bot has access to @{t.channelCheck.username}
                </div>
              ) : (
                <div style={{ color: '#ef4444' }}>
                  <div className="flex-row" style={{ gap: '8px', marginBottom: '4px' }}>
                    <X size={14} /> Task {i + 1}: {t.channelCheck.error}
                  </div>
                  {t.channelCheck.botUsername && t.channelCheck.channelUsername && (
                    <div style={{ marginTop: '4px', fontSize: '0.65rem' }}>
                      <span style={{ color: '#4a90e2', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => copyToClipboard(t.channelCheck.botUsername)}>
                        {t.channelCheck.botUsername}
                      </span> needs admin access in{' '}
                      <span style={{ color: '#4a90e2', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => window.open(`https://t.me/${t.channelCheck.channelUsername.replace('@', '')}`, '_blank')}>
                        {t.channelCheck.channelUsername}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )
      ))}

      {/* ── Banner Section ──────────────────────────────────────────────────── */}
      <h3 style={{ fontSize: '1rem', fontWeight: '900', marginTop: '24px', marginBottom: '12px' }}>
        Banner Featuring
      </h3>
      <Card style={{ padding: '16px' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '6px', display: 'block', opacity: 0.7 }}>
          Banner Title
        </label>
        <div className="input-container" style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="e.g. Check out our new bot!"
            value={bannerTitle}
            onChange={(e) => setBannerTitle(e.target.value)}
            style={{ flex: 1 }}
            maxLength={80}
          />
        </div>

        <label style={{ fontSize: '0.75rem', fontWeight: '700', marginBottom: '6px', display: 'block', opacity: 0.7 }}>
          Banner Link
        </label>
        <div className="input-container" style={{ marginBottom: '12px' }}>
          <LinkIcon size={16} className="gold-text" />
          <input
            type="text"
            placeholder="https://t.me/yourbot"
            value={bannerLink}
            onChange={(e) => setBannerLink(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        <p style={{ fontWeight: '800', fontSize: '0.7rem', opacity: 0.5, marginBottom: '8px' }}>
          BANNER IMAGE
        </p>
        {bannerImagePreview ? (
          <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden' }}>
            <img src={bannerImagePreview} alt="Banner Preview" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '10px' }} />
            <button
              onClick={() => { setBannerImageFile(null); setBannerImagePreview(null); setBannerImageUrl(''); }}
              style={{
                position: 'absolute', top: '6px', right: '6px',
                width: '26px', height: '26px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => bannerFileInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(255,255,255,0.12)', borderRadius: '10px',
              padding: '24px', textAlign: 'center', cursor: 'pointer',
            }}
          >
            <ImageIcon size={28} style={{ opacity: 0.3, marginBottom: '6px' }} />
            <p style={{ fontSize: '0.7rem', opacity: 0.4 }}>Upload banner image (1200×400 recommended)</p>
          </div>
        )}
        <input ref={bannerFileInputRef} type="file" accept="image/*" onChange={handleBannerImageSelect} style={{ display: 'none' }} />
      </Card>

      {/* ── Manager Note ────────────────────────────────────────────────────── */}
      <Card style={{
        padding: '16px', marginTop: '16px',
        background: 'rgba(147,51,234,0.08)',
        border: '1px solid rgba(147,51,234,0.2)',
      }}>
        <div className="flex-row" style={{ gap: '10px', marginBottom: '8px' }}>
          <Handshake size={20} color="#9333ea" />
          <span style={{ fontWeight: '800', fontSize: '0.85rem', color: '#9333ea' }}>Collaboration Benefits</span>
        </div>
        <p style={{ fontSize: '0.75rem', opacity: 0.8, lineHeight: '1.7' }}>
          ✅ 2 Tasks in the Tasks Page<br />
          ✅ Banner Featuring on Home Page<br />
          ✅ Project Collaboration<br />
          ✅ Social Announcement<br />
          ✅ Bot Notification to all users
        </p>
        <div style={{
          marginTop: '12px', padding: '12px', borderRadius: '10px',
          background: 'rgba(147,51,234,0.1)',
          fontSize: '0.75rem', lineHeight: '1.6', color: '#c084fc',
        }}>
          <MessageSquare size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Our EarnFest manager will reach out to you soon about next steps. 
          <strong> Our team will never ask you for upfront payment.</strong>
        </div>
      </Card>

      {/* ── Payment Section ─────────────────────────────────────────────────── */}
      <Card style={{ padding: '16px', marginTop: '20px', background: 'rgba(0,200,150,0.03)', border: '1px solid rgba(0,200,150,0.15)' }}>
        {!paid ? (
          <>
            {!paymentInit ? (
              <Button
                onClick={handleInitPayment}
                disabled={paymentLoading || !task1.title.trim() || !task2.title.trim()}
                style={{ width: '100%', background: '#0f0f0f', border: '1px solid #0098EA' }}
              >
                {paymentLoading ? (
                  <Loader2 size={18} className="spin" />
                ) : (
                  <><img src={TON_LOGO} alt="TON" style={{ width: '20px', height: '20px' }} /> Pay  {PLAN_PRICE}</>
                )}
              </Button>
            ) : (
              <div>
                <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', color: '#00c896' }}>Payment Ready</p>
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

                {/* Pay via Wallet + Manual Verify (like UpgradePage) */}
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
              disabled={processing}
              style={{ width: '100%', background: 'var(--success)', border: 'none', color: '#000' }}
            >
              {processing ? <Loader2 size={18} className="spin" /> : <Rocket size={18} />}
              {' '}Publish Collaboration
            </Button>
          </div>
        )}
      </Card>

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

      {/* Processing Overlay */}
      <AnimatePresence>
        {processing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Loader2 size={40} className="spin" style={{ color: '#9333ea', marginBottom: '16px' }} />
            <p style={{ fontSize: '0.9rem', fontWeight: '700' }}>Processing...</p>
            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '8px' }}>Please wait while we process your request.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollaborationPage;