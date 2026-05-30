import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, Button, Badge, Stack } from '../components/UI';
import {
  Users, CheckSquare, Gift, Search, Plus, Trash2,
  ChevronRight, Save, X, Calendar, DollarSign,
  Type, Link as LinkIcon, Palette, Loader2,
  TrendingUp, Zap, BarChart2, RefreshCw, ArrowDownToLine, Coins,
  MessageSquare, Image as ImageIcon, Send, UserCheck, Copy, Settings,
  Ban, ShieldCheck, Clock, MonitorPlay, Crosshair, Dices, Crown, Trophy,
  LayoutList, Handshake, Eye, EyeOff, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useConfig } from '../context/ConfigContext';
import { copyTextToClipboard } from '../utils/clipboard';
import Skeleton from '../components/Skeleton';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import TelegramPostRenderer from '../components/TelegramPostRenderer';
import { formatBalance, formatCompactNumber } from '../utils/formatters';


const AdminPanel = () => {
  const { apiBase } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'platform';
  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId });
  };
  
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState('7d');


  // Bot message states
  const [botMsgType, setBotMsgType] = useState('write'); // 'write' or 'send'
  const [messageText, setMessageText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [buttons, setButtons] = useState([{ title: '', link: '' }]);
  const [filterType, setFilterType] = useState('all');
  const [targetIds, setTargetIds] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [sending, setSending] = useState(false);
  const [forceSend, setForceSend] = useState(false);
  const [forwardedMessage, setForwardedMessage] = useState(null);
  const [sendSummary, setSendSummary] = useState(null);
  const [currentBroadcastId, setCurrentBroadcastId] = useState(null);
  const [broadcastProgress, setBroadcastProgress] = useState(null);
  const [gameAnalytics, setGameAnalytics] = useState(null);
  const [gameAnalyticsLoading, setGameAnalyticsLoading] = useState(false);
  const [liveUsers, setLiveUsers] = useState([]);
  const [liveUsersLoading, setLiveUsersLoading] = useState(false);

  // Ban Modal States
  const [showBanModal, setShowBanModal] = useState(false);
  const [banDuration, setBanDuration] = useState('lifetime'); // '1d', '7d', 'lifetime'
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);

  // Data states
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskSubTab, setTaskSubTab] = useState('active'); // 'top', 'active', 'paused', 'low'
  const [promos, setPromos] = useState([]);
  const [referralLinks, setReferralLinks] = useState([]);
  const [linkSubTab, setLinkSubTab] = useState('top'); // 'top', 'low'
  const [referralLoading, setReferralLoading] = useState(false);

  const processedTasks = useMemo(() => {
    let list = [...tasks];
    if (taskSubTab === 'active') {
      list = list.filter(t => t.status !== 'paused');
    } else if (taskSubTab === 'paused') {
      list = list.filter(t => t.status === 'paused');
    } else if (taskSubTab === 'top') {
      list.sort((a, b) => (b.completionCount || 0) - (a.completionCount || 0));
    } else if (taskSubTab === 'low') {
      list.sort((a, b) => (a.completionCount || 0) - (b.completionCount || 0));
    }
    return list;
  }, [tasks, taskSubTab]);

  const processedLinks = useMemo(() => {
    let list = [...referralLinks];
    if (linkSubTab === 'top') {
      list.sort((a, b) => (b.joinCount || 0) - (a.joinCount || 0));
    } else if (linkSubTab === 'low') {
      list.sort((a, b) => (a.joinCount || 0) - (b.joinCount || 0));
    }
    return list;
  }, [referralLinks, linkSubTab]);
  const [offerData, setOfferData] = useState(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerFormData, setOfferFormData] = useState({
    free: 10000, cash: 8000, reward: 6000, bonus: 4000, profit: 2000, endTime: ''
  });


  const [globalSettings, setGlobalSettings] = useState({ 
    tierLimits: {
      free: 10000, cash: 8000, reward: 6000, bonus: 4000, profit: 2000
    }
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Partners state
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(false);

  // Task-specific image states
  const [taskImageFile, setTaskImageFile] = useState(null);
  const [taskImagePreview, setTaskImagePreview] = useState(null);

  // Leaderboard states
  const [leaderboardType, setLeaderboardType] = useState('current'); // 'current' or 'lifetime'
  const [leaderboardUsers, setLeaderboardUsers] = useState([]);
  const [leaderboardOffset, setLeaderboardOffset] = useState(0);
  const [hasMoreLeaderboard, setHasMoreLeaderboard] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Contest states
  const [contests, setContests] = useState([]);
  const [contestLoading, setContestLoading] = useState(false);
  const [showContestForm, setShowContestForm] = useState(false);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [contestFormData, setContestFormData] = useState({
    type: 'refer',
    title: '',
    startTime: '',
    endTime: '',
    winners: 3,
    prizeType: 'fest',
    prizes: [],
  });
  const [editingContestId, setEditingContestId] = useState(null);

  const tg = window.Telegram?.WebApp;
  const headers = useMemo(() => ({ 'x-telegram-init-data': tg?.initData }), [tg?.initData]);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${apiBase}/api/admin/tasks`, { headers });
      setTasks(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchPromos = async () => {
    try {
      const res = await axios.get(`${apiBase}/api/admin/promocodes`, { headers });
      setPromos(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchReferralLinks = async () => {
    setReferralLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/referral-links`, { headers });
      setReferralLinks(res.data);
    } catch (e) {
      console.error('Referral links fetch error:', e);
    } finally {
      setReferralLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/stats`, { headers });
      setStats(res.data);
    } catch { console.error('Stats fetch error'); }
    finally { setStatsLoading(false); }
  };

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const headers = { 'x-telegram-init-data': tg?.initData };
      const res = await axios.get(`${apiBase}/api/promote/admin/all-plans`, { headers });
      setPlans(Array.isArray(res.data) ? res.data : res.data.plans || []);
    } catch (e) {
      console.error('Failed to fetch plans:', e);
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchGameAnalytics = async () => {
    setGameAnalyticsLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/game-analytics`, { headers });
      setGameAnalytics(res.data.games);
    } catch { console.error('Game analytics fetch error'); }
    finally { setGameAnalyticsLoading(false); }
  };

  const fetchLiveActivity = async () => {
    setLiveUsersLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/live-activity`, { headers });
      setLiveUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to fetch live activity:', e);
      setLiveUsers([]);
    } finally {
      setLiveUsersLoading(false);
    }
  };



  const fetchOffer = async () => {
    setOfferLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/offer`, { headers });
      setOfferData(res.data);
    } catch (e) {
      console.error('Fetch Offer Error:', e);
    } finally {
      setOfferLoading(false);
    }
  };

  const fetchGlobalSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/settings`, { headers });
      setGlobalSettings(res.data);
    } catch (e) { console.error('Settings Error', e); }
    finally { setSettingsLoading(false); }
  };

  const fetchPartners = async () => {
    setPartnersLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/partners/all`, { headers });
      if (res.data?.partners) setPartners(res.data.partners);
    } catch (e) { console.error('Partners Error', e); }
    finally { setPartnersLoading(false); }
  };

  const handlePartnerSave = async (partner) => {
    setLoading(true);
    try {
      if (partner.id) {
        await axios.put(`${apiBase}/api/partners/${partner.id}`, partner, { headers });
      } else {
        await axios.post(`${apiBase}/api/partners`, partner, { headers });
      }
      await fetchPartners();
      setShowForm(false);
      setEditingItem(null);
      toast.success('Partner saved');
    } catch (e) {
      console.error('Partner Save Error', e);
      toast.error('Failed to save partner');
    } finally { setLoading(false); }
  };

  const handlePartnerDelete = async (partnerId) => {
    if (!confirm('Delete this partner?')) return;
    setLoading(true);
    try {
      await axios.delete(`${apiBase}/api/partners/${partnerId}`, { headers });
      await fetchPartners();
      toast.success('Partner deleted');
    } catch (e) {
      console.error('Partner Delete Error', e);
      toast.error('Failed to delete partner');
    } finally { setLoading(false); }
  };

  const fetchLeaderboard = async (isNew = false) => {
    setLeaderboardLoading(true);
    const newOffset = isNew ? 0 : leaderboardOffset;
    try {
      const res = await axios.get(`${apiBase}/api/admin/users/leaderboard?type=${leaderboardType}&offset=${newOffset}&limit=20`, { headers });
      if (isNew) {
        setLeaderboardUsers(res.data);
        setLeaderboardOffset(20);
      } else {
        setLeaderboardUsers([...leaderboardUsers, ...res.data]);
        setLeaderboardOffset(newOffset + res.data.length);
      }
      setHasMoreLeaderboard(res.data.length === 20);
    } catch (e) {
      console.error('Leaderboard error:', e);
    } finally {
      setLeaderboardLoading(false);
    }
  };



  // Contest functions
  const fetchContests = async () => {
    setContestLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/contests`, { headers });
      setContests(res.data.contests || []);
    } catch (e) {
      console.error('Contest fetch error:', e);
    } finally {
      setContestLoading(false);
    }
  };

  const handleCreateContest = async () => {
    setLoading(true);
    try {
      const payload = {
        type: contestFormData.type,
        title: contestFormData.title,
        startTime: contestFormData.startTime,
        endTime: contestFormData.endTime,
        winners: parseInt(contestFormData.winners),
        prizeType: contestFormData.prizeType,
        prizes: contestFormData.prizes,
      };

      if (editingContestId) {
        await axios.put(`${apiBase}/api/contests/${editingContestId}`, payload, { headers });
      } else {
        await axios.post(`${apiBase}/api/contests`, payload, { headers });
      }

      setShowContestForm(false);
      setEditingContestId(null);
      setContestFormData({
        type: 'refer',
        title: '',
        startTime: '',
        endTime: '',
        winners: 3,
        prizeType: 'fest',
        prizes: [],
      });
      fetchContests();
    } catch (e) {
      console.error('Contest save error:', e);
      alert(e.response?.data?.error || 'Failed to save contest');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContest = async (contestId) => {
    if (!window.confirm('Delete this contest? This cannot be undone.')) return;
    try {
      await axios.delete(`${apiBase}/api/contests/${contestId}`, { headers });
      fetchContests();
    } catch (e) {
      console.error('Contest delete error:', e);
      alert(e.response?.data?.error || 'Failed to delete contest');
    }
  };

  const handleRewardContest = async (contestId) => {
    if (!window.confirm('Manually trigger reward for this contest? Winners will be notified via bot.')) return;
    try {
      const res = await axios.post(`${apiBase}/api/contests/reward/${contestId}`, {}, { headers });
      alert(`Rewarded ${res.data.winners?.length || 0} winner(s)!`);
      fetchContests();
    } catch (e) {
      console.error('Contest reward error:', e);
      alert(e.response?.data?.error || 'Failed to reward contest');
    }
  };

  const openContestForm = (contest = null) => {
    if (contest) {
      setEditingContestId(contest.id);
      setContestFormData({
        type: contest.type,
        title: contest.title || '',
        startTime: new Date(contest.startTime).toISOString().slice(0, 16),
        endTime: new Date(contest.endTime).toISOString().slice(0, 16),
        winners: contest.winners,
        prizeType: contest.prizeType,
        prizes: contest.prizes || [],
      });
    } else {
      setEditingContestId(null);
      setContestFormData({
        type: 'refer',
        title: '',
        startTime: '',
        endTime: '',
        winners: 3,
        prizeType: 'fest',
        prizes: [],
      });
    }
    setShowContestForm(true);
  };

  // Update prizes array when winners count changes
  useEffect(() => {
    const currentWinners = parseInt(contestFormData.winners) || 0;
    const currentPrizes = contestFormData.prizes || [];
    
    if (currentWinners > currentPrizes.length) {
      const newPrizes = [...currentPrizes];
      for (let i = currentPrizes.length + 1; i <= currentWinners; i++) {
        newPrizes.push({
          rank: i,
          tier: 'free',
          festAmount: 1000,
        });
      }
      setContestFormData(prev => ({ ...prev, prizes: newPrizes }));
    } else if (currentWinners < currentPrizes.length) {
      setContestFormData(prev => ({ ...prev, prizes: currentPrizes.slice(0, currentWinners) }));
    }
  }, [contestFormData.winners]);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    // Fetch active broadcast once on mount to resume UI tracking
    const fetchActiveBroadcast = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/admin/bot/active-broadcast`, { headers });
        if (res.data && res.data.broadcastId) {
          setCurrentBroadcastId(res.data.broadcastId);
          setBroadcastProgress(res.data);
        }
      } catch { /* ignore */ }
    };
    fetchActiveBroadcast();
  }, []);

  useEffect(() => {
    if (activeTab === 'tasks') fetchTasks();
    if (activeTab === 'promos') fetchPromos();
    if (activeTab === 'referralLinks') fetchReferralLinks();
    if (activeTab === 'users') { /* no-op: user index removed */ }
    if (activeTab === 'leaderboard') fetchLeaderboard(true);
    if (activeTab === 'contests') fetchContests();
    if (activeTab === 'plans') {
      fetchPlans();
    }
    if (activeTab === 'platform') {
      fetchOffer();
      fetchGlobalSettings();
    }
    if (activeTab === 'bot' && botMsgType === 'send') fetchForwardedMessage();

    if (activeTab === 'stats') {
      fetchGameAnalytics();
      fetchLiveActivity();
    }
  }, [activeTab, botMsgType, leaderboardType]);

  useEffect(() => {
    if (activeTab !== 'stats') return;
    const interval = setInterval(fetchLiveActivity, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Bot message handlers
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAddButton = () => setButtons([...buttons, { title: '', link: '' }]);

  const handleRemoveButton = (index) => {
    const newButtons = buttons.filter((_, i) => i !== index);
    setButtons(newButtons.length ? newButtons : [{ title: '', link: '' }]);
  };

  const handleUpdateButton = (index, field, value) => {
    const newButtons = [...buttons];
    newButtons[index][field] = value;
    setButtons(newButtons);
  };

  // Poll for broadcast status
  useEffect(() => {
    let interval;
    if (currentBroadcastId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${apiBase}/api/admin/bot/status/${currentBroadcastId}`, { headers });
          setBroadcastProgress(res.data);
          if (res.data.status === 'completed') {
            setCurrentBroadcastId(null);
            clearInterval(interval);
          }
        } catch (e) {
          console.error('Polling error:', e);
          setCurrentBroadcastId(null);
          clearInterval(interval);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentBroadcastId, apiBase, headers]);

  const handleSendBotMessage = async () => {
    // Basic validation
    if (botMsgType === 'write' && !messageText && !imageFile) {
      alert('Please provide a message or image');
      return;
    }

    if (botMsgType === 'send' && !forwardedMessage) {
      alert('No forwarded message available');
      return;
    }

    setSending(true);

    try {
      const formData = new FormData();
      formData.append('mode', botMsgType);

      // === ALWAYS append image if one is selected ===
      if (imageFile) {
        formData.append('image', imageFile);
      }

      // Handle message content based on mode
      if (botMsgType === 'write') {
        formData.append('message', messageText || '');  // Allow empty text if image is present
      }
      else if (botMsgType === 'send' && forwardedMessage) {
        const forwardedText = forwardedMessage?.message?.text ||
          forwardedMessage?.message?.caption || '';
        const forwardedEntities = forwardedMessage?.message?.entities || [];

        formData.append('message', forwardedText);
        formData.append('entities', JSON.stringify(forwardedEntities));

        // Preserve caption entities if any
        const captionEntities = forwardedMessage?.message?.caption_entities || [];
        if (captionEntities.length > 0) {
          formData.append('captionEntities', JSON.stringify(captionEntities));
        }

        // Preserve original reply_markup if exists
        if (forwardedMessage?.message?.reply_markup) {
          formData.append('replyMarkup', JSON.stringify(forwardedMessage.message.reply_markup));
        }
      }

      // Common fields
      formData.append('filterType', filterType);
      formData.append('buttons', JSON.stringify(buttons));
      formData.append('force', forceSend ? 'true' : 'false');

      // Filter-specific fields
      if (filterType === 'balance') formData.append('balanceAmount', balanceFilter);
      if (filterType === 'inactive') formData.append('daysAgo', daysFilter);
      if (filterType === 'plan') formData.append('planType', planFilter);
      if (filterType === 'targeted') formData.append('targetIds', targetIds);

      const res = await axios.post(`${apiBase}/api/admin/bot/send`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.broadcastId) {
        setCurrentBroadcastId(res.data.broadcastId);
        setBroadcastProgress({
            status: res.data.status || 'initializing',
            total: res.data.total || 0,
            sentCount: 0,
            failedCount: 0,
            failedIds: []
        });
        alert('Broadcast started in background!');
      }

      // Small reset
      setMessageText('');
      setImageFile(null);
      setImagePreview(null);
      setButtons([{ title: '', link: '' }]);

    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      setSendSummary({ error: errorMsg });
      alert('Failed to send message: ' + errorMsg);
    } finally {
      setSending(false);
    }
  };


  const fetchForwardedMessage = async () => {
    try {
      const res = await axios.get(`${apiBase}/api/admin/bot/lastMessage`, { headers });
      setForwardedMessage(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelBroadcast = async () => {
    if (!currentBroadcastId) return;
    if (!window.confirm('Are you sure you want to cancel this broadcast? This will stop tracking and hide the progress.')) return;
    
    try {
        await axios.delete(`${apiBase}/api/admin/bot/broadcast/${currentBroadcastId}`, { headers });
        setCurrentBroadcastId(null);
        setBroadcastProgress(null);
        alert('Broadcast cancelled and cleared.');
    } catch {
        alert('Failed to cancel broadcast');
    }
  };

  const handleUserSearch = async (id = null) => {
    const targetQuery = id || searchQuery;
    if (!targetQuery) return;
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/api/admin/users/search?query=${targetQuery}`, { headers });
      if (id && res.data.length > 0) {
         setEditingItem(res.data[0]);
         setShowForm(true);
      } else {
         setUsers(res.data);
      }
    } catch (error) {
      alert('Search failed');
      console.error('User search error:', error);
    } finally { setLoading(false); }
  };

  const handleBanUser = async (isBanning) => {
    if (!window.confirm(`Are you sure you want to ${isBanning ? 'ban' : 'unban'} this user?`)) return;
    setBanLoading(true);
    try {
      let until = 'lifetime';
      if (isBanning && banDuration !== 'lifetime') {
        const days = banDuration === '1d' ? 1 : 7;
        until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }
      
      const payload = isBanning ? { isBanned: true, until, reason: banReason } : { isBanned: false };
      
      await axios.post(`${apiBase}/api/admin/users/${editingItem.telegramId || editingItem.id}/ban`, payload, { headers });
      
      // Update local state to reflect changes instantly
      setEditingItem(prev => ({
        ...prev,
        ban: isBanning ? { isBanned: true, until, reason: banReason } : { isBanned: false }
      }));
      
      if (isBanning) setShowBanModal(false);
      alert(`User successfully ${isBanning ? 'banned' : 'unbanned'}!`);
    } catch (e) {
      console.error(e);
      alert('Failed to update ban status');
    } finally {
      setBanLoading(false);
    }
  };

  const handleDelete = async (collection, id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    try {
      await axios.delete(`${apiBase}/api/admin/${collection}/${id}`, { headers });
      if (collection === 'tasks') fetchTasks();
      if (collection === 'promocodes') fetchPromos();
      if (collection === 'referral-links') fetchReferralLinks();
    } catch (error) {
      alert('Delete failed');
      console.error('Delete error:', error);
    }
  };

  const handleSave = async (collection, data) => {
    setLoading(true);
    let payload = { ...data };
    try {
      if (collection === 'users') {
        // Only send necessary fields for update to avoid 413 errors and save bandwidth
        payload = {
          id: data.id,
          telegramId: data.telegramId,
          balance: data.balance,
          tier: data.tier
        };
        await axios.post(`${apiBase}/api/admin/${collection}`, payload, { headers });
      } else if (collection === 'tasks' && (taskImageFile || data.imageUrl)) {
        // Use FormData for task image upload
        const formData = new FormData();
        Object.keys(data).forEach(key => {
          if (key === 'task' && typeof data[key] === 'object') {
             formData.append(key, JSON.stringify(data[key]));
          } else {
             formData.append(key, data[key]);
          }
        });
        if (taskImageFile) formData.append('image', taskImageFile);
        
        await axios.post(`${apiBase}/api/admin/${collection}`, formData, { 
          headers: { ...headers, 'Content-Type': 'multipart/form-data' } 
        });
      } else {
        if (payload.reward) payload.reward = parseFloat(payload.reward);
        if (payload.supply) payload.supply = parseInt(payload.supply);
        if (collection === 'referral-links' && payload.param) payload.param = payload.param.trim();
        await axios.post(`${apiBase}/api/admin/${collection}`, payload, { headers });
      }

      setShowForm(false);
      setEditingItem(null);
      setTaskImageFile(null);
      setTaskImagePreview(null);
      if (collection === 'tasks') fetchTasks();
      if (collection === 'promocodes') fetchPromos();
      if (collection === 'referral-links') fetchReferralLinks();
      if (collection === 'users' && searchQuery) handleUserSearch();
    } catch (error) {
      alert('Save failed');
      console.error('Save error:', error);
    } finally { setLoading(false); }
  };

  const renderUserTab = () => (
    <Stack gap={16}>
      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '4px 4px 4px 12px', border: '1px solid var(--glass-border)' }}>
        <Search size={18} opacity={0.5} />
        <input
          type="text"
          placeholder="Search by ID, Name or Username"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleUserSearch()}
          style={{ flex: 1, background: 'none', border: 'none', color: 'white', padding: '10px', fontSize: '0.9rem' }}
        />
        <div className="flex-row" style={{ gap: '8px', paddingRight: '4px' }}>
          <Button onClick={() => handleUserSearch()} style={{ width: 'auto', padding: '0 15px', height: '36px', fontSize: '0.8rem' }}>
            {loading ? <Loader2 className="spin" size={16} /> : 'Search'}
          </Button>
        </div>
      </div>

      <div className="stack-vertical" style={{ gap: '10px' }}>


        {/* Full Data Results (from backend search) */}
        {users.length > 0 && (
          <>
            <div className="text-sm-muted" style={{ fontSize: '0.7rem', padding: '0 5px' }}>Full Results ({users.length})</div>
            {users.map(user => (
              <Card key={user.telegramId} style={{ padding: '15px', cursor: 'pointer' }} onClick={() => { setEditingItem(user); setShowForm(true); }}>
                <div className="flex-row-between">
                  <div>
                    <div className="flex-row" style={{ gap: '8px' }}>
                      <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{user.firstName} (@{user.username})</div>
                      {user.ban?.isBanned && (
                        <div style={{ background: '#e74c3c', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>BANNED</div>
                      )}
                    </div>
                    <div className="text-sm-muted" style={{ fontSize: '0.7rem' }}>ID: {user.telegramId} • Rank: {user.rank || 'Novice'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="gold-text" style={{ fontWeight: '900' }}>{formatBalance(user.balance)} $FEST</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{user.tier || 'free'} Tier</div>
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
        
        {searchQuery && users.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
            <Search size={40} style={{ marginBottom: '10px' }} />
            <p>No users found matching "{searchQuery}"</p>
          </div>
        )}
      </div>
    </Stack>
  );

  const renderTaskTab = () => (
    <Stack gap={16}>
      <Button onClick={() => { setEditingItem({}); setShowForm(true); }} className="flex-center" style={{ gap: '8px' }}>
        <Plus size={18} /> Add New Task
      </Button>

      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '4px', gap: '4px' }}>
        {[
          { id: 'top', label: 'Top' },
          { id: 'active', label: 'Active' },
          { id: 'paused', label: 'Paused' },
          { id: 'low', label: 'Low' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTaskSubTab(t.id)}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              background: taskSubTab === t.id ? 'var(--page-tint-highlight)' : 'transparent',
              color: taskSubTab === t.id ? 'var(--primary-gold)' : 'rgba(255,255,255,0.5)',
              fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {processedTasks.map(task => (
        <Card key={task.id} style={{ padding: '15px' }}>
          <div className="flex-row-between">
            <div style={{ flex: 1 }}>
              <div className="flex-row" style={{ gap: '8px', alignItems: 'center' }}>
                <div style={{ fontWeight: '800' }}>{task.title}</div>
                {task.status === 'paused' ? (
                  <Badge style={{ background: 'var(--danger)', color: 'white', fontSize: '0.6rem' }}>PAUSED</Badge>
                ) : (
                  <Badge style={{ background: 'var(--success)', color: 'white', fontSize: '0.6rem' }}>ACTIVE</Badge>
                )}
              </div>
              <Badge style={{ fontSize: '0.6rem', marginTop: '4px' }}>{task.category}</Badge>
              <div style={{ fontSize: '0.7rem', opacity: 0.65, marginTop: '4px' }}>Completed {task.completionCount || 0} times</div>
            </div>
            <div className="flex-center" style={{ gap: '12px' }}>
              <div style={{ textAlign: 'right', marginRight: '8px' }}>
                <p className="gold-text" style={{ fontWeight: '800' }}>{formatBalance(task.reward)} $FEST</p>
              </div>

              
              {/* Quick Toggle Button */}
              <Button 
                onClick={() => handleSave('tasks', { ...task, status: task.status === 'paused' ? 'active' : 'paused' })}
                style={{ 
                  width: 'auto', 
                  padding: '0 12px', 
                  height: '32px', 
                  fontSize: '0.7rem',
                  background: task.status === 'paused' ? 'var(--success)' : 'rgba(255,255,255,0.05)',
                  color: task.status === 'paused' ? '#000' : 'white',
                  border: 'none'
                }}
              >
                {task.status === 'paused' ? 'Resume' : 'Pause'}
              </Button>

              <div onClick={() => { setEditingItem(task); setShowForm(true); }} style={{ color: 'var(--primary-gold)', cursor: 'pointer' }}><ChevronRight size={20} /></div>
              <div onClick={() => handleDelete('tasks', task.id)} style={{ color: '#ff4d4d', cursor: 'pointer' }}><Trash2 size={18} /></div>
            </div>
          </div>
        </Card>
      ))}
    </Stack>
  );

  const renderPromoTab = () => (
    <Stack gap={16}>
      <Button onClick={() => { setEditingItem({}); setShowForm(true); }} className="flex-center" style={{ gap: '8px' }}>
        <Plus size={18} /> Create Promo Code
      </Button>

      {promos.map(promo => (
        <Card key={promo.id} style={{ padding: '15px', borderLeft: `4px solid ${promo.themeColor || 'var(--primary-gold)'}` }}>
          <div className="flex-row-between">
            <div>
              <div style={{ fontWeight: '800' }}>{promo.code}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Supply: {promo.supply} left</div>
            </div>
            <div className="flex-center" style={{ gap: '10px' }}>
              <p className="gold-text" style={{ fontWeight: '800' }}>{formatBalance(promo.reward)} $FEST</p>
              <div onClick={() => { setEditingItem(promo); setShowForm(true); }} style={{ color: 'var(--primary-gold)', cursor: 'pointer' }}><ChevronRight size={20} /></div>

              <div onClick={() => handleDelete('promocodes', promo.id)} style={{ color: '#ff4d4d', cursor: 'pointer' }}><Trash2 size={18} /></div>
            </div>
          </div>
        </Card>
      ))}
    </Stack>
  );

  const renderReferralTab = () => (
    <Stack gap={16}>
      <Button onClick={() => { setEditingItem({}); setShowForm(true); }} className="flex-center" style={{ gap: '8px' }}>
        <Plus size={18} /> Create Referral Link
      </Button>

      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '4px', gap: '4px' }}>
        {[
          { id: 'top', label: 'Top' },
          { id: 'low', label: 'Low' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setLinkSubTab(t.id)}
            style={{
              flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
              background: linkSubTab === t.id ? 'var(--page-tint-highlight)' : 'transparent',
              color: linkSubTab === t.id ? 'var(--primary-gold)' : 'rgba(255,255,255,0.5)',
              fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {referralLoading ? (
        <div className="stack-vertical" style={{ gap: '12px' }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="card" height="88px" />
          ))}
        </div>
      ) : processedLinks.length === 0 ? (
        <Card style={{ padding: '20px', textAlign: 'center' }}>No referral links created yet.</Card>
      ) : (
        processedLinks.map(link => (
          <Card key={link.id} style={{ padding: '15px', borderLeft: '4px solid var(--page-accent)' }}>
            <div className="flex-row-between" style={{ gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800' }}>{link.title || link.param}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.65, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Join: {link.joinCount || 0}</span>
                  <span>•</span>
                  <span>Ads: {link.adViews || 0}</span>
                  <span>•</span>
                  <span className="gold-text" style={{ fontWeight: '800' }}>{formatBalance(link.adEarnings)} $FEST</span>
                </div>

                {link.targetUrl && <div style={{ fontSize: '0.75rem', opacity: 0.55, marginTop: '4px' }}>{link.targetUrl}</div>}
              </div>
              <div className="flex-center" style={{ gap: '10px' }}>
                <div onClick={() => {
                  copyTextToClipboard(`https://t.me/EarnFestBot/Earn?startapp=${link.param}`, 'Referral link copied!');
                }} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <Copy size={18} />
                </div>
                <div onClick={() => { setEditingItem(link); setShowForm(true); }} style={{ color: 'var(--primary-gold)', cursor: 'pointer' }}><ChevronRight size={20} /></div>
                <div onClick={() => handleDelete('referral-links', link.id)} style={{ color: '#ff4d4d', cursor: 'pointer' }}><Trash2 size={18} /></div>
              </div>
            </div>
          </Card>
        ))
      )}
    </Stack>
  );

  // ── Derived chart data ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!stats) return [];
    const now = Date.now();
    const dayMs = 86400000;
    const days = chartTimeframe === 'today' ? 1 : chartTimeframe === '7d' ? 7 : chartTimeframe === '30d' ? 30 : 90;
    const buckets = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * dayMs);
      const key = d.toISOString().slice(0, 10).replace(/-/g, '');
      const label = d.toISOString().slice(5, 10).replace('-', '/');
      
      buckets.push({
        date: label,
        newUsers: stats[`dailyNewUsers_${key}`] || 0,
        activeUsers: stats[`dailyActiveUsers_${key}`] || 0
      });
    }
    return buckets;
  }, [stats, chartTimeframe]);

  const todayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayJoined = stats?.[`dailyNewUsers_${todayKey}`] || 0;
  const todayActive = stats?.[`dailyActiveUsers_${todayKey}`] || 0;
  const todayAdEarnings = stats?.[`dailyAdEarnings_${todayKey}`] || 0;

  const handleCreateOffer = async () => {
    try {
      const payload = {
        limits: {
          free: Number(offerFormData.free),
          cash: Number(offerFormData.cash),
          reward: Number(offerFormData.reward),
          bonus: Number(offerFormData.bonus),
          profit: Number(offerFormData.profit),
        },
        endTime: new Date(offerFormData.endTime).toISOString()
      };
      await axios.post(`${apiBase}/api/admin/offer`, payload, { headers });
      setShowOfferForm(false);
      fetchOffer();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create offer');
    }
  };

  const handleEndOffer = async () => {
    try {
      if(!window.confirm('Are you sure you want to end this offer immediately?')) return;
      await axios.delete(`${apiBase}/api/admin/offer`, { headers });
      fetchOffer();
    } catch {
      alert('Failed to end offer');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.post(`${apiBase}/api/admin/settings`, globalSettings, { headers });
      alert('Global limits saved!');
      fetchGlobalSettings();
    } catch {
      alert('Failed to save settings');
    }
  };

  const renderOffersTab = () => {
    const isOfferActive = offerData?.active;
    
    return (
      <Stack gap={20}>
        <div className="flex-row-between">
          <h3 style={{ fontWeight: '800', fontSize: '0.9rem', opacity: 0.7, letterSpacing: '1px' }}>WITHDRAWAL OFFERS</h3>
          <Button 
            disabled={isOfferActive} 
            onClick={() => {
              setOfferFormData({
                free: 0.5, cash: 0.4, reward: 0.3, bonus: 0.2, profit: 0.1,
                endTime: ''
              });
              setShowOfferForm(true);
            }} 
            style={{ width: 'auto', padding: '0 16px', height: '36px' }}
          >
            <Plus size={16} style={{ marginRight: '6px' }} />
            Create
          </Button>
        </div>

        {offerLoading ? (
          <div className="flex-center" style={{ padding: '40px' }}><Loader2 className="spinner" /></div>
        ) : isOfferActive ? (
          <Card className="glitter-border">
            <div className="flex-row-between" style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Coins size={24} className="gold-text" />
                <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>Active Limit Offer</span>
              </div>
              <Badge style={{ background: 'var(--success)', color: '#000' }}>Running</Badge>
            </div>
            
            <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '20px' }}>
              Ends at: <span style={{color: 'var(--primary-gold)'}}>{new Date(offerData.endTime).toLocaleString()}</span>
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
               {['free', 'cash', 'reward', 'bonus', 'profit'].map((tier) => (
                  <div key={tier} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                     <span style={{ textTransform: 'capitalize', fontWeight: 'bold', fontSize: '0.8rem' }}>{tier}:</span>
                     <span className="gold-text" style={{ fontWeight: '900' }}>{formatBalance(offerData.limits?.[tier])} $FEST</span>
                  </div>
               ))}
            </div>

            <div className="flex-row-between" style={{ gap: '10px' }}>
               <Button onClick={() => handleEndOffer()} style={{ background: 'var(--danger)', flex: 1, height: '40px' }}>End Offer</Button>
               <Button 
                 onClick={() => {
                   setOfferFormData({
                     free: offerData.limits?.free || 10000,
                     cash: offerData.limits?.cash || 8000,
                     reward: offerData.limits?.reward || 6000,
                     bonus: offerData.limits?.bonus || 4000,
                     profit: offerData.limits?.profit || 2000,
                     endTime: offerData.endTime ? new Date(offerData.endTime).toISOString().slice(0, 16) : ''
                   });
                   setShowOfferForm(true);
                 }} 
                 style={{ flex: 1, height: '40px' }}
               >Edit</Button>
            </div>
          </Card>
        ) : (
          <div className="flex-center" style={{ padding: '40px', background: 'var(--glass-bg)', borderRadius: '16px', border: '1px dashed var(--glass-border)' }}>
            <p className="text-sm-muted" style={{textAlign: 'center'}}>No active offers running.<br/>Create one to dynamically adjust limits!</p>
          </div>
        )}

        <h3 style={{ fontWeight: '800', fontSize: '0.9rem', opacity: 0.7, letterSpacing: '1px', marginTop: '10px' }}>GLOBAL LIMITS</h3>
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px', marginBottom: '15px' }}>
            {['free', 'cash', 'reward', 'bonus', 'profit'].map(tier => (
              <div className="stack-vertical" style={{ gap: '6px' }} key={tier}>
                <label className="text-sm-muted" style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'capitalize' }}>{tier} Min ($FEST)</label>
                <input
                  type="number"
                  value={globalSettings.tierLimits?.[tier] || ''}
                  onChange={(e) => setGlobalSettings(prev => ({ 
                    ...prev, 
                    tierLimits: { ...prev.tierLimits, [tier]: Number(e.target.value) } 
                  }))}
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '12px', fontSize: '0.9rem' }}
                />
              </div>
            ))}
          </div>
          <Button onClick={handleSaveSettings} disabled={settingsLoading} style={{ background: 'var(--success)', color: '#000', height: '44px' }}>
            {settingsLoading ? <Loader2 className="spin" size={18} /> : 'Save Global Limits'}
          </Button>
        </Card>
      </Stack>
    );
  };

  const renderStatsTab = () => (
    <Stack gap={20}>
      <div className="flex-row-between">
        <h3 style={{ fontWeight: '800', fontSize: '0.9rem', opacity: 0.7, letterSpacing: '1px' }}>APP ANALYTICS</h3>
        <Button onClick={fetchStats} style={{ width: 'auto', padding: '0 16px', height: '34px', fontSize: '0.75rem', gap: '6px' }}>
          <RefreshCw size={14} /> {statsLoading ? '...' : 'Refresh'}
        </Button>
      </div>

      {statsLoading && !stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} variant="card" height="100px" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Total Users', value: formatCompactNumber(stats.totalUsers || 0), icon: <Users size={16} />, color: '#4a90e2' },
              { label: "Joined Today", value: formatCompactNumber(todayJoined), icon: <Users size={16} />, color: '#00c896' },
              { label: 'Active Today', value: formatCompactNumber(todayActive), icon: <Zap size={16} />, color: '#f5a623' },
              { label: 'Reward Ads', value: formatCompactNumber(stats.totalRewardAds || 0), icon: <BarChart2 size={16} />, color: '#b27cf7' },
              { label: "Today's Ad Earnings", value: `${formatCompactNumber(todayAdEarnings)} $FEST`, icon: <Coins size={16} />, color: '#00c896' },
              { label: 'Total Spins', value: formatCompactNumber(stats.totalSpins || 0), icon: <Coins size={16} />, color: '#f5a623' },
              { label: 'Pending W/D', value: formatCompactNumber(stats.pendingWithdrawals || 0), icon: <ArrowDownToLine size={16} />, color: '#ff4d4d' },
              { label: 'Total Revenue', value: `$${formatCompactNumber(stats.totalRevenue || 0)}`, icon: <DollarSign size={16} />, color: 'var(--page-accent)' },
              { label: 'Promos Claimed', value: formatCompactNumber(stats.totalPromosClaimed || 0), icon: <Gift size={16} />, color: '#00c896' },
              { label: 'Tasks Done', value: formatCompactNumber(stats.totalTasksCompleted || 0), icon: <CheckSquare size={16} />, color: '#4a90e2' },
              { label: 'Total Balance', value: `${formatBalance(stats.totalBalance)} $FEST`, icon: <DollarSign size={16} />, color: '#f5a623' },
            ].map(kpi => (
              <Card key={kpi.label} style={{ padding: '14px', background: 'rgba(255,255,255,0.015)' }}>
                <div style={{ color: kpi.color, marginBottom: '6px' }}>{kpi.icon}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '900', color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: '700', letterSpacing: '0.5px', marginTop: '2px' }}>{kpi.label.toUpperCase()}</div>
              </Card>
            ))}
          </div>

          {/* Live Players & Actions */}
          <Card style={{ padding: '16px' }}>
            <div className="flex-row-between" style={{ marginBottom: '12px' }}>
              <div className="flex-row" style={{ gap: '8px' }}>
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00c896', boxShadow: '0 0 8px #00c896' }}
                />
                <p style={{ fontWeight: '800', fontSize: '0.8rem', opacity: 0.7 }}>LIVE PLAYERS ONLINE</p>
              </div>
              <Badge variant="tint" style={{ color: '#00c896', borderColor: 'rgba(0, 200, 150, 0.2)', fontSize: '0.7rem' }}>
                {liveUsers.length} Active
              </Badge>
            </div>
            {liveUsersLoading && liveUsers.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} variant="card" height="40px" />
                ))}
              </div>
            ) : liveUsers.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {liveUsers.map((user) => {
                  const minutesAgo = Math.floor((Date.now() - user.timestamp) / 1000 / 60);
                  const timeText = minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`;
                  return (
                    <div
                      key={user.userId}
                      className="flex-row-between"
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '12px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <div className="flex-row" style={{ gap: '8px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{user.name}</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.4 }}>({user.userId})</div>
                      </div>
                      <div className="flex-row" style={{ gap: '10px' }}>
                        <Badge variant="outline" style={{ fontSize: '0.65rem', padding: '2px 8px', color: 'var(--primary-gold)', borderColor: 'rgba(245, 166, 35, 0.2)' }}>
                          {user.action}
                        </Badge>
                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{timeText}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.75rem', opacity: 0.5 }}>
                No active players in the last 5 minutes.
              </p>
            )}
          </Card>

          {/* Game Analytics */}
          <Card style={{ padding: '16px' }}>
            <div className="flex-row-between" style={{ marginBottom: '12px' }}>
              <p style={{ fontWeight: '800', fontSize: '0.8rem', opacity: 0.7 }}>GAME ANALYTICS</p>
              <Button onClick={fetchGameAnalytics} style={{ width: 'auto', padding: '0 12px', height: '30px', fontSize: '0.7rem', gap: '4px' }}>
                <RefreshCw size={12} /> {gameAnalyticsLoading ? '...' : 'Refresh'}
              </Button>
            </div>
            {gameAnalyticsLoading && !gameAnalytics ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} variant="card" height="80px" />
                ))}
              </div>
            ) : gameAnalytics ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {Object.entries(gameAnalytics).map(([key, game]) => {
                  const icons = {
                    spin_wheel: <Coins size={16} />,
                    slots: <Dices size={16} />,
                    coinflip: <TrendingUp size={16} />
                  };
                  const colors = {
                    spin_wheel: '#f5a623',
                    slots: '#b27cf7',
                    coinflip: '#00d4ff'
                  };
                  return (
                    <Card key={key} style={{ padding: '14px', background: 'rgba(255,255,255,0.015)' }}>
                      <div className="flex-row" style={{ gap: '10px', marginBottom: '10px' }}>
                        <div style={{ color: colors[key] }}>{icons[key]}</div>
                        <div style={{ fontWeight: '800', fontSize: '0.8rem' }}>{game.label}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 4px' }}>
                          <div style={{ fontWeight: '900', fontSize: '1rem', color: colors[key] }}>{formatCompactNumber(game.totalPlays || 0)}</div>
                          <div style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '2px' }}>TOTAL PLAYS</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 4px' }}>
                          <div style={{ fontWeight: '900', fontSize: '1rem', color: '#00c896' }}>{formatCompactNumber(game.activeToday || 0)}</div>
                          <div style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '2px' }}>ACTIVE TODAY</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 4px' }}>
                          <div style={{ fontWeight: '900', fontSize: '1rem', color: '#4a90e2' }}>{formatCompactNumber(game.active7d || 0)}</div>
                          <div style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '2px' }}>ACTIVE 7D</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm-muted" style={{ textAlign: 'center', padding: '10px', fontSize: '0.7rem', opacity: 0.5 }}>
                No game data yet. Play some games to see analytics.
              </p>
            )}
          </Card>

          {/* Tier Sales */}
          {stats.tierSales && (
            <Card style={{ padding: '16px' }}>
              <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', opacity: 0.7 }}>TIER SALES</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
                {Object.entries(stats.tierSales || {}).map(([tier, count]) => (
                  <div key={tier} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 4px' }}>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', color: 'var(--primary-gold)' }}>{count}</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '2px' }}>{tier.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Dual-line Chart */}
          <Card style={{ padding: '16px' }}>
            <div className="flex-row-between" style={{ marginBottom: '14px' }}>
              <p style={{ fontWeight: '800', fontSize: '0.8rem', opacity: 0.7 }}>USER TRENDS</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['today', '7d', '30d', '90d'].map(tf => (
                  <div
                    key={tf}
                    onClick={() => setChartTimeframe(tf)}
                    style={{
                      padding: '4px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '800',
                      background: chartTimeframe === tf ? 'var(--page-tint-medium)' : 'rgba(255,255,255,0.03)',
                      color: chartTimeframe === tf ? 'var(--primary-gold)' : 'var(--text-secondary)',
                      border: chartTimeframe === tf ? '1px solid var(--page-accent-border)' : '1px solid transparent'
                    }}
                  >
                    {tf.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.75rem' }}
                  labelStyle={{ color: 'white' }}
                />
                <Legend wrapperStyle={{ fontSize: '0.7rem', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="newUsers" name="New Users" stroke="#4a90e2" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="activeUsers" name="Active Users" stroke="var(--page-accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <p style={{ textAlign: 'center', fontSize: '0.6rem', opacity: 0.3 }}>Last updated: {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'N/A'}</p>
        </>
      ) : (
        <p className="text-sm-muted" style={{ textAlign: 'center', padding: '20px' }}>No stats available yet.</p>
      )}
    </Stack>
  );

  // API Generator states
  const [apiGenType, setApiGenType] = useState('task');
  const [apiGenTarget, setApiGenTarget] = useState(1);
  const [apiGenTier, setApiGenTier] = useState('free');
  const [generatedApiUrl, setGeneratedApiUrl] = useState('');

  const renderApiGeneratorTab = () => {
    const handleGenerate = () => {
      const url = `${apiBase}/api/tasks/verify-user?type=${apiGenType}&target=${apiGenTarget}${apiGenType === 'tier' ? `&tier=${apiGenTier}` : ''}`;
      setGeneratedApiUrl(url);
    };

    return (
      <Stack gap={20}>
        <div className="flex-row-between">
          <h3 style={{ fontWeight: '800', fontSize: '1rem', opacity: 0.8, letterSpacing: '1px' }}>VERIFICATION API GENERATOR</h3>
        </div>

        <Card style={{ padding: '24px' }}>
          <Stack gap={16}>
            <div className="stack-vertical" style={{ gap: '6px' }}>
              <label className="input-label" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Requirement Type</label>
              <select
                value={apiGenType}
                onChange={(e) => setApiGenType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--glass-border)',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.9rem'
                }}
              >
                <option value="task">Tasks Completed</option>
                <option value="invite">Invited Users (Referrals)</option>
                <option value="earn">Total Earned ($FEST)</option>
                <option value="ads">Ads Viewed</option>
                <option value="game">Games Played (Lucky Spin/Slots)</option>
                <option value="coupon">Coupons (Promo Codes) Claimed</option>
                <option value="deposit">Deposited Amount ($FEST)</option>
                <option value="tier">Subscription Tier Level</option>
                <option value="streak">Daily Streak Days</option>
              </select>
            </div>

            {apiGenType === 'tier' ? (
              <div className="stack-vertical" style={{ gap: '6px' }}>
                <label className="input-label" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Target Tier</label>
                <select
                  value={apiGenTier}
                  onChange={(e) => setApiGenTier(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--glass-border)',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="free">Free Fest</option>
                  <option value="cash">Cash Fest</option>
                  <option value="reward">Reward Fest</option>
                  <option value="bonus">Bonus Fest</option>
                  <option value="profit">Profit Fest</option>
                </select>
              </div>
            ) : (
              <div className="stack-vertical" style={{ gap: '6px' }}>
                <label className="input-label" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                  Target {apiGenType === 'earn' || apiGenType === 'deposit' ? 'Amount ($FEST)' : 'Count'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={apiGenTarget}
                  onChange={(e) => setApiGenTarget(Number(e.target.value) || 1)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--glass-border)',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            )}

            <Button
              onClick={handleGenerate}
              style={{
                background: 'linear-gradient(135deg, var(--primary-gold), #d4af37)',
                color: '#000',
                fontWeight: '900',
                height: '44px',
                marginTop: '10px'
              }}
            >
              Generate Verification API
            </Button>
          </Stack>
        </Card>

        {generatedApiUrl && (
          <Card style={{ padding: '20px', border: '1px solid var(--primary-gold)' }} className="glitter-border">
            <div style={{ fontWeight: '800', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--primary-gold)' }}>GENERATED VERIFICATION API URL:</div>
            <div style={{
              background: 'rgba(0,0,0,0.4)',
              padding: '14px',
              borderRadius: '12px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              wordBreak: 'break-all',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <span>{generatedApiUrl}</span>
              <button
                onClick={() => {
                  copyTextToClipboard(generatedApiUrl, 'API URL copied to clipboard!');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-gold)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="text-sm-muted" style={{ fontSize: '0.7rem', marginTop: '10px', lineHeight: '1.4' }}>
              💡 <b>How to use:</b> Copy this URL and paste it into the <b>Verification API</b> field when creating or editing a task. 
              The system will automatically substitute <code>{"{userId}"}</code> placeholder or append <code>userId=YOUR_ID</code> to verify completion status.
            </p>
          </Card>
        )}
      </Stack>
    );
  };
  const renderBotMessageTab = () => (
    <Stack gap={16}>
      {/* Message Type Selection */}
      <Card style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', opacity: 0.7 }}>MESSAGE MODE</p>
        <div className="flex-row" style={{ gap: '12px' }}>
          <Button
            onClick={() => setBotMsgType('write')}
            style={{
              flex: 1,
              height: '44px',
              background: botMsgType === 'write' ? 'var(--page-tint-medium)' : 'rgba(255,255,255,0.03)',
              color: botMsgType === 'write' ? 'var(--primary-gold)' : 'var(--text-secondary)',
              border: botMsgType === 'write' ? '1px solid var(--page-accent-border)' : '1px solid transparent'
            }}
          >
            <MessageSquare size={18} style={{ marginRight: '8px' }} />
            Write Message
          </Button>
          <Button
            onClick={() => setBotMsgType('send')}
            style={{
              flex: 1,
              height: '44px',
              background: botMsgType === 'send' ? 'var(--page-tint-medium)' : 'rgba(255,255,255,0.03)',
              color: botMsgType === 'send' ? 'var(--primary-gold)' : 'var(--text-secondary)',
              border: botMsgType === 'send' ? '1px solid var(--page-accent-border)' : '1px solid transparent'
            }}
          >
            <Send size={18} style={{ marginRight: '8px' }} />
            Send Bot Message
          </Button>
        </div>
      </Card>

      {/* Image Upload */}
      <Card style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', opacity: 0.7 }}>IMAGE (OPTIONAL)</p>
        <div className="flex-row" style={{ gap: '12px', alignItems: 'center' }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            id="image-upload"
            style={{ display: 'none' }}
          />
          <label htmlFor="image-upload">
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <ImageIcon size={24} color="var(--primary-gold)" />
            </div>
          </label>
          {imagePreview && (
            <div style={{ position: 'relative' }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  border: '2px solid var(--primary-gold)'
                }}
              />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#ff4d4d',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={14} color="white" />
              </button>
            </div>
          )}
          <span className="text-sm-muted" style={{ fontSize: '0.75rem' }}>
            {imageFile ? imageFile.name : 'Upload image (optional)'}
          </span>
        </div>
      </Card>

      {/* Message Input or Waiting Section */}
      {botMsgType === 'write' ? (
        <Card style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', opacity: 0.7 }}>WRITE MESSAGE</p>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Write your message here... Support HTML tags like <b>, <i>, <u>, <code>, <a>"
            style={{
              width: '100%',
              minHeight: '150px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '14px',
              color: 'white',
              fontSize: '0.9rem',
              resize: 'vertical'
            }}
          />
          <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '8px' }}>
            💡 Tip: Use HTML formatting for better presentation
          </p>
        </Card>
      ) : (
        <Card style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-row-between" style={{ marginBottom: '12px' }}>
            <p style={{ fontWeight: '800', fontSize: '0.8rem', opacity: 0.7 }}>SEND BOT MESSAGE</p>
            <Button onClick={fetchForwardedMessage} style={{ width: 'auto', padding: '0 12px', height: '32px', gap: '6px' }}>
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
          {forwardedMessage ? (
            <div style={{
              padding: '20px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.2)',
              minHeight: '150px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <p style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                {forwardedMessage.message.text}
              </p>
              <p className="text-sm-muted" style={{ fontSize: '0.7rem', marginTop: 'auto' }}>
                Received at {new Date(forwardedMessage.timestamp).toLocaleString()}
              </p>
            </div>
          ) : (
            <div style={{
              padding: '20px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              border: '1px dashed rgba(255,255,255,0.2)',
              minHeight: '150px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <MessageSquare size={40} opacity={0.3} />
              <p className="text-sm-muted" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                Send a message to the bot<br />
                It will appear here
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Buttons Builder */}
      <Card style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex-row-between" style={{ marginBottom: '12px' }}>
          <p style={{ fontWeight: '800', fontSize: '0.8rem', opacity: 0.7 }}>INLINE BUTTONS</p>
          <Button onClick={handleAddButton} style={{ width: 'auto', padding: '0 12px', height: '32px', gap: '6px' }}>
            <Plus size={16} /> Add Button
          </Button>
        </div>
        <Stack gap={10}>
          {buttons.map((btn, idx) => (
            <div key={idx} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  placeholder="Button Title"
                  value={btn.title}
                  onChange={(e) => handleUpdateButton(idx, 'title', e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '0.85rem',
                    minWidth: 0
                  }}
                />
                <button
                  onClick={() => handleRemoveButton(idx)}
                  disabled={buttons.length === 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: buttons.length === 1 ? 'rgba(255,77,77,0.3)' : 'rgba(255,77,77,0.2)',
                    border: 'none',
                    cursor: buttons.length === 1 ? 'not-allowed' : 'pointer',
                    opacity: buttons.length === 1 ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Trash2 size={16} color="#ff4d4d" />
                </button>
              </div>
              <input
                placeholder="https://..."
                value={btn.link}
                onChange={(e) => handleUpdateButton(idx, 'link', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: 'white',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          ))}
        </Stack>
      </Card>

      {/* User Filter */}
      <Card style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', opacity: 0.7 }}>RECIPIENT FILTER</p>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.3)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '12px'
          }}
        >
          <option value="all">All Users</option>
          <option value="balance">Balance Less Than X</option>
          <option value="inactive">Inactive (Last joined X days ago)</option>
          <option value="plan">Specific Plan/Tier</option>
          <option value="targeted">Targeted User IDs</option>
        </select>

        {filterType === 'balance' && (
          <input
            type="number"
            placeholder="Balance amount (e.g., 10)"
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px',
              color: 'white'
            }}
          />
        )}

        {filterType === 'inactive' && (
          <input
            type="number"
            placeholder="Days ago (e.g., 7)"
            value={daysFilter}
            onChange={(e) => setDaysFilter(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px',
              color: 'white'
            }}
          />
        )}

        {filterType === 'plan' && (
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '12px',
              borderRadius: '8px'
            }}
          >
            <option value="">Select Plan</option>
            <option value="free">Free</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>
        )}

        {filterType === 'targeted' && (
          <textarea
            placeholder="Enter user IDs or usernames separated by commas (e.g., 123456, @username, john_doe)"
            value={targetIds}
            onChange={(e) => setTargetIds(e.target.value)}
            style={{
              width: '100%',
              minHeight: '80px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '12px',
              color: 'white',
              fontSize: '0.85rem'
            }}
          />
        )}

        <div className="flex-row" style={{ marginTop: '16px', gap: '8px', alignItems: 'center' }}>
          <input
            id="forceSendCheckbox"
            type="checkbox"
            checked={forceSend}
            onChange={(e) => setForceSend(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="forceSendCheckbox" style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={14} className={forceSend ? "spin" : ""} /> Force Broadcast (Ignore Blocklist / Retry all users)
          </label>
        </div>
      </Card>

      {/* Preview & Send */}
      {((messageText || imagePreview) && botMsgType === 'write') || (botMsgType === 'send' && forwardedMessage) && (
        <Card style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--primary-gold)' }}>
          <p style={{ fontWeight: '800', fontSize: '0.8rem', marginBottom: '12px', opacity: 0.7 }}>MESSAGE PREVIEW</p>
          <div style={{
            padding: '14px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Message"
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  border: '1px solid var(--primary-gold)'
                }}
              />
            )}
            {botMsgType === 'write' ? (
              <div style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                {messageText.split('\n').map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>
            ) : (
              <TelegramPostRenderer
                text={forwardedMessage?.message?.text || ''}
                entities={forwardedMessage?.message?.entities || []}
                style={{ fontSize: '0.85rem', lineHeight: '1.5' }}
              />
            )}
            {buttons.filter(b => b.title).length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {buttons.filter(b => b.title).map((btn, idx) => (
                  <button
                    key={idx}
                    disabled
                    style={{
                      padding: '10px',
                      background: 'rgba(74,144,226,0.2)',
                      border: '1px solid rgba(74,144,226,0.3)',
                      borderRadius: '8px',
                      color: '#4a90e2',
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'default'
                    }}
                  >
                    {btn.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <Button
        onClick={handleSendBotMessage}
        disabled={sending || currentBroadcastId || ((botMsgType === 'write' && !messageText && !imageFile) || (botMsgType === 'send' && !forwardedMessage))}
        style={{ height: '52px', marginTop: '10px' }}
      >
        {sending ? (
          <Loader2 className="spin" size={20} />
        ) : (
          <div className="flex-center" style={{ gap: '8px' }}>
            <Send size={20} /> {currentBroadcastId ? 'Sending in Progress...' : 'Send Message to Users'}
          </div>
        )}
      </Button>

      {broadcastProgress && (
          <Card style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', marginTop: '12px' }}>
              <div className="flex-row-between" style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {broadcastProgress.status === 'processing' || broadcastProgress.status === 'initializing' ? <Loader2 className="spin" size={16} color="var(--primary-gold)" /> : <CheckSquare size={16} color="var(--success)" />}
                      <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>
                          {broadcastProgress.status === 'completed' ? 'DISPATCH COMPLETED' : broadcastProgress.status === 'initializing' ? 'DISCOVERING TARGET USERS...' : 'DISPATCHING MESSAGE...'}
                      </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>
                          {broadcastProgress.status === 'initializing' ? '0%' : `${Math.round(((broadcastProgress.sentCount + broadcastProgress.failedCount) / Math.max(broadcastProgress.total, 1)) * 100)}%`}
                      </span>
                      {(broadcastProgress.status === 'processing' || broadcastProgress.status === 'initializing') && (
                          <button 
                            onClick={handleCancelBroadcast}
                            style={{ 
                                background: 'rgba(255,77,77,0.1)', 
                                border: '1px solid rgba(255,77,77,0.2)', 
                                color: '#ff4d4d',
                                borderRadius: '6px',
                                padding: '2px 8px',
                                fontSize: '0.65rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                          >
                            CANCEL
                          </button>
                      )}
                  </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                  <div style={{
                      width: broadcastProgress.status === 'initializing' ? '0%' : `${((broadcastProgress.sentCount + broadcastProgress.failedCount) / Math.max(broadcastProgress.total, 1)) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--primary-gold), #fff)',
                      transition: 'width 0.5s ease'
                  }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ opacity: 0.5, fontSize: '0.6rem', marginBottom: '4px' }}>TOTAL</div>
                      <div style={{ fontWeight: '900' }}>{broadcastProgress.status === 'initializing' ? '...' : broadcastProgress.total}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ opacity: 0.5, fontSize: '0.6rem', marginBottom: '4px' }}>SENT</div>
                      <div style={{ fontWeight: '900', color: 'var(--success)' }}>{broadcastProgress.sentCount}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                      <div style={{ opacity: 0.5, fontSize: '0.6rem', marginBottom: '4px' }}>FAILED</div>
                      <div style={{ fontWeight: '900', color: '#ff4d4d' }}>{broadcastProgress.failedCount}</div>
                  </div>
              </div>

              {broadcastProgress.failedIds && broadcastProgress.failedIds.length > 0 && (
                  <Button
                      onClick={() => {
                          const list = broadcastProgress.failedIds.join(', ');
                          copyTextToClipboard(list, 'Copied failed IDs to clipboard');
                      }}
                      style={{ marginTop: '16px', background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', height: '40px', fontSize: '0.75rem', border: '1px solid rgba(255,77,77,0.2)' }}
                  >
                      <Copy size={16} /> Copy Failed IDs for Retry
                  </Button>
              )}
          </Card>
      )}

      {sendSummary && !broadcastProgress && (
        <Card style={{ padding: '16px', marginTop: '12px', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-row-between" style={{ marginBottom: '8px' }}>
            <strong>Dispatch Summary</strong>
            <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>{new Date().toLocaleString()}</span>
          </div>
          {'error' in sendSummary ? (
            <p style={{ color: '#ff4d4d' }}>Error: {sendSummary.error}</p>
          ) : (
            <>
              <p>Total targets: {sendSummary.total}</p>
              <p>Sent successfully: {sendSummary.sentTo}</p>
              <p>Failed: {sendSummary.failed.length}</p>
              {sendSummary.failed.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
                  {sendSummary.failed.map((item, index) => (
                    <div key={index} style={{ background: 'rgba(255,255,255,0.06)', padding: '8px', borderRadius: '8px', marginBottom: '6px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>ID: {item.userId}</div>
                      <div style={{ fontSize: '0.75rem', opacity: '0.85' }}>{item.error?.description || item.error?.message || JSON.stringify(item.error)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </Stack>
  );

  const renderLeaderboardTab = () => (
    <Stack gap={16}>
      <div className="flex-row-between" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '4px' }}>
        <div className="flex-row" style={{ flex: 1, gap: '4px' }}>
          {['current', 'lifetime'].map(t => (
            <button
              key={t}
              onClick={() => { setLeaderboardType(t); setLeaderboardUsers([]); setLeaderboardOffset(0); }}
              style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: leaderboardType === t ? 'var(--page-tint-highlight)' : 'transparent',
                color: leaderboardType === t ? 'var(--primary-gold)' : 'rgba(255,255,255,0.5)',
                fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.3s'
              }}
            >
              {t === 'current' ? 'Current' : 'Lifetime'}
            </button>
          ))}
        </div>
        <Button 
          onClick={async () => {
            if(!window.confirm('Recalculate all users lifetime earnings?')) return;
            setLeaderboardLoading(true);
            try {
              await axios.get(`${apiBase}/api/admin/users/rebuild-leaderboard`, { headers });
              fetchLeaderboard(true);
              alert('Stats synchronized!');
            } catch { alert('Sync failed'); }
            finally { setLeaderboardLoading(false); }
          }}
          style={{ width: '44px', height: '44px', padding: 0, background: 'none', border: 'none' }}
          title="Sync Leaderboard Stats"
        >
          <RefreshCw size={18} opacity={0.5} />
        </Button>
      </div>

      <div className="stack-vertical" style={{ gap: '12px' }}>
        {leaderboardUsers.map((user, index) => (
          <Card key={user.id} style={{ padding: '16px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }} onClick={() => handleUserSearch(user.id)}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: index < 3 ? 'var(--primary-gold)' : 'rgba(255,255,255,0.1)' }} />
            <div className="flex-row-between">
              <div className="flex-row" style={{ gap: '16px', minWidth: 0 }}>
                <div style={{ fontSize: '1.2rem', fontWeight: '900', opacity: 0.2, minWidth: '35px' }}>#{index + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                    {user.firstName || 'User'} {user.username ? `(@${user.username})` : ''}
                  </div>
                  <div className="text-sm-muted" style={{ fontSize: '0.7rem' }}>ID: {user.id}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="gold-text" style={{ fontWeight: '900', fontSize: '1.1rem' }}>
                   {formatBalance(leaderboardType === 'lifetime' ? (user.lifetimeEarnings || 0) : (user.balance || 0))}
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{leaderboardType === 'lifetime' ? 'Total Earned' : 'Balance'}</div>
              </div>
            </div>
          </Card>
        ))}

        {leaderboardLoading && (
          <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 className="spin" size={24} color="var(--primary-gold)" /></div>
        )}

        {hasMoreLeaderboard && !leaderboardLoading && (
          <Button onClick={() => fetchLeaderboard()} style={{ background: 'rgba(255,255,255,0.03)', height: '45px', fontSize: '0.85rem', marginTop: '10px' }}>
            Load More Users
          </Button>
        )}

        {!hasMoreLeaderboard && leaderboardUsers.length > 0 && (
          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.3, fontSize: '0.75rem' }}>No more users to load</div>
        )}
      </div>
    </Stack>
  );

  const renderContestTab = () => (
    <Stack gap={16}>
      <div className="flex-row-between" style={{ marginBottom: '8px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={20} className="gold-text" /> Contests
        </h3>
        <Button onClick={() => openContestForm()} style={{ height: '40px', padding: '0 18px', fontSize: '0.8rem' }}>
          + New Contest
        </Button>
      </div>

      {contestLoading ? (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <Loader2 className="spin" size={24} color="var(--primary-gold)" />
        </div>
      ) : contests.length === 0 ? (
        <Card style={{ padding: '30px', textAlign: 'center', opacity: 0.6 }}>
          <Trophy size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p style={{ fontSize: '0.85rem' }}>No contests created yet. Click "+ New Contest" to start one.</p>
        </Card>
      ) : (
        <div className="stack-vertical" style={{ gap: '12px' }}>
          {contests.map(contest => {
            const statusColors = {
              upcoming: '#3498db',
              ongoing: '#2ecc71',
              ended: '#e74c3c',
            };
            const statusColor = statusColors[contest.status] || '#888';
            const now = Date.now();
            const isEnded = contest.endTime <= now;

            return (
              <Card key={contest.id} style={{ padding: '16px', borderLeft: `4px solid ${statusColor}` }}>
                <div className="flex-row-between" style={{ marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>
                      {contest.title || (contest.type === 'refer' ? 'Referral Contest' : 'Earning Contest')}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '4px' }}>
                      {contest.type === 'refer' ? '👥 Referral' : '💰 Earning'} · {contest.winners} winner(s) · {contest.prizeType === 'tier' ? '🏆 Tier' : '🪙 $FEST'} prizes
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      background: `${statusColor}22`,
                      color: statusColor,
                      textTransform: 'uppercase',
                    }}>
                      {contest.status}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '10px' }}>
                  📅 {new Date(contest.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {new Date(contest.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {contest.rewarded && <span style={{ color: '#2ecc71', marginLeft: '8px' }}>✅ Rewarded</span>}
                </div>

                {/* Prize preview */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {(contest.prizes || []).slice(0, 5).map((prize, i) => (
                    <div key={i} style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255,215,0,0.1)',
                      border: '1px solid rgba(255,215,0,0.2)',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                    }}>
                      #{prize.rank}: {contest.prizeType === 'tier'
                        ? (prize.tier?.charAt(0).toUpperCase() + prize.tier?.slice(1) || 'Free') + ' Tier'
                        : `${formatBalance(prize.festAmount || 0)} $FEST`}
                    </div>
                  ))}
                  {(contest.prizes || []).length > 5 && (
                    <div style={{ fontSize: '0.7rem', opacity: 0.5, padding: '4px' }}>
                      +{contest.prizes.length - 5} more
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex-row" style={{ gap: '8px' }}>
                  {(contest.status === 'upcoming' || contest.status === 'ongoing') && !contest.rewarded && (
                    <>
                      <Button
                        onClick={() => openContestForm(contest)}
                        style={{ flex: 1, height: '36px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)' }}
                      >
                        <Settings size={14} style={{ marginRight: '6px' }} /> Edit
                      </Button>
                      <Button
                        onClick={() => handleDeleteContest(contest.id)}
                        style={{ flex: 1, height: '36px', fontSize: '0.75rem', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.3)' }}
                      >
                        <Trash2 size={14} style={{ marginRight: '6px' }} /> Delete
                      </Button>
                    </>
                  )}
                  {isEnded && !contest.rewarded && (
                    <Button
                      onClick={() => handleRewardContest(contest.id)}
                      style={{ flex: 1, height: '36px', fontSize: '0.75rem', background: 'rgba(46,204,113,0.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.3)' }}
                    >
                      <Crown size={14} style={{ marginRight: '6px' }} /> Reward Now
                    </Button>
                  )}
                  {contest.rewarded && (
                    <div style={{ fontSize: '0.75rem', opacity: 0.5, padding: '8px 0' }}>
                      Rewarded at: {contest.rewardedAt ? new Date(contest.rewardedAt).toLocaleString() : 'N/A'}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Contest Form Modal */}
      {showContestForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={() => { setShowContestForm(false); setEditingContestId(null); }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }} />
          <div style={{ width: '100%', background: '#0a0a0a', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px 24px', position: 'relative', borderTop: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-row-between" style={{ marginBottom: '24px' }}>
              <h3 className="heading-lg">{editingContestId ? 'Edit Contest' : 'Create Contest'}</h3>
              <X style={{ opacity: 0.5, cursor: 'pointer' }} onClick={() => { setShowContestForm(false); setEditingContestId(null); }} />
            </div>

            <Stack gap={16}>
              {/* Contest Type */}
              <div className="input-field">
                <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Leaderboard Type</label>
                <select
                  value={contestFormData.type}
                  onChange={e => setContestFormData(prev => ({ ...prev, type: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white' }}
                >
                  <option value="refer">Referral Contest</option>
                  <option value="earning">Earning Contest</option>
                </select>
              </div>

              {/* Title */}
              <div className="input-field">
                <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Title (Optional)</label>
                <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                  <Type size={16} opacity={0.3} />
                  <input
                    value={contestFormData.title}
                    onChange={e => setContestFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Spring Referral Contest"
                    style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }}
                  />
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-row" style={{ gap: '12px' }}>
                <div className="input-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Start Time</label>
                  <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                    <Calendar size={16} opacity={0.3} />
                    <input
                      type="datetime-local"
                      value={contestFormData.startTime}
                      onChange={e => setContestFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
                <div className="input-field" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>End Time</label>
                  <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                    <Calendar size={16} opacity={0.3} />
                    <input
                      type="datetime-local"
                      value={contestFormData.endTime}
                      onChange={e => setContestFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white', fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Winners Count */}
              <div className="input-field">
                <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Number of Winners</label>
                <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                  <Users size={16} opacity={0.3} />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={contestFormData.winners}
                    onChange={e => setContestFormData(prev => ({ ...prev, winners: e.target.value }))}
                    style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }}
                  />
                </div>
              </div>

              {/* Prize Type */}
              <div className="input-field">
                <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Prize Type</label>
                <select
                  value={contestFormData.prizeType}
                  onChange={e => setContestFormData(prev => ({ ...prev, prizeType: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white' }}
                >
                  <option value="fest">$FEST Amount</option>
                  <option value="tier">Tier Upgrade</option>
                </select>
              </div>

              {/* Prize Rows */}
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '16px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', marginBottom: '12px', display: 'block' }}>Prize Distribution</label>
                <div className="stack-vertical" style={{ gap: '10px' }}>
                  {(contestFormData.prizes || []).map((prize, index) => (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '12px',
                      background: index < 3 ? `rgba(255,215,0,${0.1 - index * 0.03})` : 'rgba(255,255,255,0.02)',
                      border: index < 3 ? `1px solid rgba(255,215,0,${0.3 - index * 0.08})` : '1px solid rgba(255,255,255,0.05)',
                      alignItems: 'center',
                    }}>
                      <div style={{
                        fontWeight: '900',
                        fontSize: '0.9rem',
                        color: index === 0 ? '#FFD700' : index === 1 ? '#B9F2FF' : index === 2 ? '#C0C0C0' : 'rgba(255,255,255,0.3)',
                        minWidth: '40px',
                      }}>
                        #{prize.rank}
                      </div>
                      {contestFormData.prizeType === 'tier' ? (
                        <select
                          value={prize.tier || 'free'}
                          onChange={e => {
                            const newPrizes = [...contestFormData.prizes];
                            newPrizes[index] = { ...newPrizes[index], tier: e.target.value };
                            setContestFormData(prev => ({ ...prev, prizes: newPrizes }));
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px', color: 'white' }}
                        >
                          <option value="free">Free Fest</option>
                          <option value="cash">Cash Fest</option>
                          <option value="reward">Reward Fest</option>
                          <option value="bonus">Bonus Fest</option>
                          <option value="profit">Profit Fest (Elite)</option>
                        </select>
                      ) : (
                        <div className="flex-row" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0 10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <DollarSign size={14} opacity={0.3} />
                          <input
                            type="number"
                            min="1"
                            value={prize.festAmount || ''}
                            onChange={e => {
                              const newPrizes = [...contestFormData.prizes];
                              newPrizes[index] = { ...newPrizes[index], festAmount: parseInt(e.target.value) || 0 };
                              setContestFormData(prev => ({ ...prev, prizes: newPrizes }));
                            }}
                            placeholder="Amount in $FEST"
                            style={{ flex: 1, background: 'none', border: 'none', padding: '10px', color: 'white', fontSize: '0.8rem' }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreateContest}
                disabled={loading}
                style={{ height: '52px', marginTop: '10px' }}
              >
                {loading ? <Loader2 className="spin" size={20} /> : (
                  <div className="flex-center" style={{ gap: '8px' }}>
                    <Crown size={20} /> {editingContestId ? 'Update Contest' : 'Launch Contest'}
                  </div>
                )}
              </Button>
            </Stack>
          </div>
        </div>
      )}
    </Stack>
  );

  const renderPlansTab = () => (
    <Stack gap={16}>
      <div className="flex-row-between" style={{ marginBottom: '8px' }}>
        <h3 className="heading-md">Promotion Plans</h3>
        <Button onClick={fetchPlans} disabled={plansLoading} style={{ padding: '8px 14px', fontSize: '0.75rem' }}>
          <RefreshCw size={14} className={plansLoading ? 'spin' : ''} /> Refresh
        </Button>
      </div>

      {plansLoading ? (
        <div className="stack-vertical" style={{ gap: '10px' }}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} variant="card" height="100px" />)}
        </div>
      ) : plans.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <LayoutList size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
          <p style={{ fontSize: '0.85rem', opacity: 0.5 }}>No promotion plans yet.</p>
        </Card>
      ) : (
        <div className="stack-vertical" style={{ gap: '10px' }}>
          {plans.map((plan) => {
            const statusColor =
              plan.publishStatus === 'published' ? '#00c896' :
              plan.publishStatus === 'pending_access' ? '#f59e0b' :
              plan.publishStatus === 'paid' ? '#4a90e2' : '#6b7280';

            return (
              <Card key={plan.id} style={{
                padding: '14px',
                borderLeft: `4px solid ${statusColor}`,
                background: 'rgba(255,255,255,0.015)',
              }}>
                <div className="flex-row-between" style={{ marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: '800', fontSize: '0.85rem' }}>
                      {plan.planKey === 'only_task' ? 'Only Task' :
                       plan.planKey === 'featured' ? 'Featured Task' :
                       plan.planKey === 'collaboration' ? 'Collaboration' : plan.planKey}
                    </span>
                    <span style={{
                      marginLeft: '8px', fontSize: '0.6rem', padding: '2px 8px',
                      borderRadius: '6px', background: `${statusColor}20`, color: statusColor,
                      fontWeight: '700', textTransform: 'uppercase',
                    }}>
                      {plan.publishStatus === 'pending_access' ? 'Pending Access' : plan.publishStatus}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>
                    {plan.createdAt ? new Date(plan.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                  </span>
                </div>

                <div style={{ fontSize: '0.7rem', opacity: 0.6, lineHeight: '1.6' }}>
                  <div>User ID: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '4px' }}>{plan.userId}</code></div>
                  {plan.txHash && <div>Tx: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '4px' }}>{plan.txHash.slice(0, 16)}...</code></div>}
                  {plan.tasks?.length > 0 && <div>Tasks: {plan.tasks.map(t => t.title).join(', ')}</div>}
                  {plan.banner && <div>Banner: {plan.banner.title || 'Yes'}</div>}
                  {plan.channelCheck?.username && (
                    <div>Channel: @{plan.channelCheck.username} {plan.channelCheck.passed ? '✅' : '❌'}</div>
                  )}
                </div>

                {plan.publishStatus === 'pending_access' && (
                  <div style={{ marginTop: '10px' }}>
                    <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>⏳ Waiting for bot admin access</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </Stack>
  );

  const renderPartnersTab = () => (
    <Stack gap={16}>
      <div className="flex-row-between">
        <p style={{ fontWeight: '800', fontSize: '0.8rem', opacity: 0.7 }}>PARTNERS</p>
        <div className="flex-row" style={{ gap: '8px' }}>
          <Button onClick={fetchPartners} style={{ width: 'auto', padding: '0 12px', height: '30px', fontSize: '0.7rem', gap: '4px' }}>
            <RefreshCw size={12} /> {partnersLoading ? '...' : 'Refresh'}
          </Button>
          <Button onClick={() => {
            setEditingItem({ name: '', imageUrl: '', link: '', isPublic: true, order: partners.length });
            setShowForm(true);
          }} style={{ width: 'auto', padding: '0 12px', height: '30px', fontSize: '0.7rem', gap: '4px' }}>
            <Plus size={12} /> Add Partner
          </Button>
        </div>
      </div>

      {partnersLoading && partners.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} variant="card" height="80px" />)}
        </div>
      ) : partners.length === 0 ? (
        <Card style={{ padding: '40px', textAlign: 'center' }}>
          <Handshake size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
          <p style={{ fontSize: '0.85rem', opacity: 0.5 }}>No partners yet. Add your first partner!</p>
        </Card>
      ) : (
        <div className="stack-vertical" style={{ gap: '10px' }}>
          {partners.map(partner => (
            <Card key={partner.id} style={{ padding: '14px', background: 'rgba(255,255,255,0.015)' }}>
              <div className="flex-row-between">
                <div className="flex-row" style={{ gap: '12px', alignItems: 'center' }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden',
                    border: '2px solid rgba(255,255,255,0.1)', flexShrink: 0
                  }}>
                    <img src={partner.imageUrl} alt={partner.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{partner.name}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: '2px' }}>
                      Order: {partner.order} &middot; {partner.isPublic ? <span style={{ color: '#00c896' }}>Public</span> : <span style={{ color: '#f5a623' }}>Admin Only</span>}
                    </div>
                  </div>
                </div>
                <div className="flex-row" style={{ gap: '6px' }}>
                  <Button
                    onClick={() => {
                      setEditingItem({ ...partner });
                      setShowForm(true);
                    }}
                    style={{ width: 'auto', padding: '0 10px', height: '30px', fontSize: '0.7rem' }}
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handlePartnerDelete(partner.id)}
                    disabled={loading}
                    style={{ width: 'auto', padding: '0 10px', height: '30px', fontSize: '0.7rem', background: 'rgba(255,77,77,0.1)', color: '#ff4d4d', border: '1px solid rgba(255,77,77,0.2)' }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Stack>
  );

  return (
    <div className="main-content" style={{ paddingBottom: '120px' }}>
      <header style={{ marginBottom: '25px', textAlign: 'center' }}>
        <h1 className="heading-xl gold-text">Control Center 🛠️</h1>
        <p className="text-sm-muted">Secure Administrative Dashboard</p>
      </header>

      {/* Tabs — single horizontal row, equal flex; icon-only on very narrow viewports (see index.css) */}
      {!isDesktop && (
        <div className="admin-tab-bar" role="tablist" aria-label="Admin sections">
          {[
            { id: 'platform', Icon: Settings, label: 'Platform' },
            { id: 'tasks', Icon: CheckSquare, label: 'Tasks' },
            { id: 'apiGenerator', Icon: Globe, label: 'API Gen' },
            { id: 'promos', Icon: Gift, label: 'Promos' },
            { id: 'referralLinks', Icon: LinkIcon, label: 'Referral Links' },
            { id: 'leaderboard', Icon: TrendingUp, label: 'Leaderboard' },
            { id: 'contests', Icon: Trophy, label: 'Contests' },
            { id: 'plans', Icon: LayoutList, label: 'Plans' },
            { id: 'stats', Icon: BarChart2, label: 'Stats' },
            { id: 'partners', Icon: Handshake, label: 'Partners' },
            { id: 'bot', Icon: MessageSquare, label: 'Bot Msg' },
          ].map(({ id, Icon, label }) => {
            const isOn = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isOn}
                id={`admin-tab-${id}`}
                title={label}
                className={`admin-tab${isOn ? ' admin-tab--active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <span className="admin-tab-inner">
                  <span className="admin-tab-icon" aria-hidden>
                    <Icon size={18} strokeWidth={isOn ? 2.25 : 2} />
                  </span>
                  <span className="admin-tab-label">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}


      {activeTab === 'platform' && (
        <Stack gap={40}>
          {renderUserTab()}
          <div style={{ padding: '30px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {renderOffersTab()}
          </div>
        </Stack>
      )}
      {activeTab === 'tasks' && renderTaskTab()}
      {activeTab === 'apiGenerator' && renderApiGeneratorTab()}
      {activeTab === 'promos' && renderPromoTab()}
      {activeTab === 'referralLinks' && renderReferralTab()}
      {activeTab === 'leaderboard' && renderLeaderboardTab()}
      {activeTab === 'contests' && renderContestTab()}
      {activeTab === 'plans' && renderPlansTab()}
      {activeTab === 'stats' && renderStatsTab()}
      {activeTab === 'partners' && renderPartnersTab()}
      {activeTab === 'bot' && renderBotMessageTab()}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={() => setShowForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }} />
          <div
            style={{ width: '100%', background: '#0a0a0a', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px 24px', position: 'relative', borderTop: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}
          >
              <div className="flex-row-between" style={{ marginBottom: '24px' }}>
                <h3 className="heading-lg">Manage {activeTab === 'tasks' ? 'Task' : activeTab === 'promos' ? 'Promo' : activeTab === 'referralLinks' ? 'Referral Link' : (activeTab === 'users' || activeTab === 'leaderboard') ? 'User' : 'Item'}</h3>
                <X style={{ opacity: 0.5 }} onClick={() => setShowForm(false)} />
              </div>

              <Stack gap={16}>
                {(activeTab === 'users' || activeTab === 'leaderboard' || (activeTab === 'platform' && editingItem.telegramId)) && (
                  <>
                    <div className="flex-row" style={{ gap: '16px', marginBottom: '8px' }}>
                      {editingItem.photoUrl ? (
                         <img src={editingItem.photoUrl} alt="User Profile" style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--primary-gold)', objectFit: 'cover' }} crossOrigin="anonymous" />
                      ) : (
                         <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--page-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserCheck size={28} />
                         </div>
                      )}
                      <div>
                         <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{editingItem.firstName || 'User'}</div>
                         <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{editingItem.telegramId || editingItem.id} {editingItem.username ? `(@${editingItem.username})` : ''}</div>
                      </div>
                    </div>

                    {/* Redesigned Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                       {/* Ads */}
                       <div className="flex-row" style={{ background: 'rgba(52, 152, 219, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(52, 152, 219, 0.2)' }}>
                           <div style={{ background: 'rgba(52, 152, 219, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><MonitorPlay size={20} color="#3498db" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#3498db' }}>Ads Viewed</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.totalAdViews || 0}</strong>
                           </div>
                       </div>
                       
                       {/* Refers */}
                       <div className="flex-row" style={{ background: 'rgba(155, 89, 182, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(155, 89, 182, 0.2)' }}>
                           <div style={{ background: 'rgba(155, 89, 182, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><Users size={20} color="#9b59b6" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#9b59b6' }}>Referrals</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.referrals?.length || 0}</strong>
                           </div>
                       </div>

                       {/* Tasks */}
                       <div className="flex-row" style={{ background: 'rgba(46, 204, 113, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
                           <div style={{ background: 'rgba(46, 204, 113, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><CheckSquare size={20} color="#2ecc71" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#2ecc71' }}>Tasks Done</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.taskHistory?.length || 0}</strong>
                           </div>
                       </div>

                       {/* Promos */}
                       <div className="flex-row" style={{ background: 'rgba(230, 126, 34, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(230, 126, 34, 0.2)' }}>
                           <div style={{ background: 'rgba(230, 126, 34, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><Gift size={20} color="#e67e22" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#e67e22' }}>Promos Used</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.promosUsed !== undefined ? editingItem.promosUsed : (editingItem.activities?.filter(a => a.type === 'promocode_reward').length || 0)}</strong>
                           </div>
                       </div>

                       {/* PvP */}
                       <div className="flex-row" style={{ background: 'rgba(231, 76, 60, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
                           <div style={{ background: 'rgba(231, 76, 60, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><Crosshair size={20} color="#e74c3c" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#e74c3c' }}>PvP Joined</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.pvpParticipation || 0}</strong>
                               <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>Streak: {editingItem.consecutivePvp || 0}</div>
                           </div>
                       </div>

                       {/* Spins */}
                       <div className="flex-row" style={{ background: 'rgba(241, 196, 15, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(241, 196, 15, 0.2)' }}>
                           <div style={{ background: 'rgba(241, 196, 15, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><Crown size={20} color="#f1c40f" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#f1c40f' }}>Spin Played</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.spinCount || 0}</strong>
                               <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>Streak: {editingItem.consecutiveSpin || 0}</div>
                           </div>
                       </div>

                       {/* Slots */}
                       <div className="flex-row" style={{ background: 'rgba(52, 152, 219, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(52, 152, 219, 0.2)' }}>
                           <div style={{ background: 'rgba(52, 152, 219, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><Dices size={20} color="#3498db" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#3498db' }}>Slots Played</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.slotCount || 0}</strong>
                               <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>Streak: {editingItem.consecutiveSlot || 0}</div>
                           </div>
                       </div>

                       {/* Mines */}
                       <div className="flex-row" style={{ background: 'rgba(46, 204, 113, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
                           <div style={{ background: 'rgba(46, 204, 113, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><MonitorPlay size={20} color="#2ecc71" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#2ecc71' }}>Mines Played</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.minesCount || 0}</strong>
                               <div style={{ fontSize: '0.7rem', opacity: 0.65 }}>Recent mines games</div>
                           </div>
                       </div>

                       {/* Withdrawals */}
                       <div className="flex-row" style={{ background: 'rgba(26, 188, 156, 0.1)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(26, 188, 156, 0.2)' }}>
                           <div style={{ background: 'rgba(26, 188, 156, 0.2)', padding: '10px', borderRadius: '10px', marginRight: '12px' }}><ArrowDownToLine size={20} color="#1abc9c" /></div>
                           <div>
                               <div style={{ opacity: 0.7, fontSize: '0.7rem', color: '#1abc9c' }}>Withdrawals</div>
                               <strong style={{ fontSize: '1.1rem', color: 'white' }}>{editingItem.activities?.filter(a => a.type === 'withdrawal_request').length || 0}</strong>
                           </div>
                       </div>

                       {/* Financials (Full Width) */}
                       <div className="flex-row-between" style={{ gridColumn: 'span 2', background: 'rgba(241, 196, 15, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(241, 196, 15, 0.2)' }}>
                           <div className="flex-row" style={{ gap: '12px' }}>
                               <div style={{ background: 'rgba(241, 196, 15, 0.15)', padding: '12px', borderRadius: '10px' }}><Coins size={24} color="#f1c40f" /></div>
                               <div>
                                   <div style={{ opacity: 0.7, fontSize: '0.75rem', color: '#f1c40f' }}>Current Balance</div>
                                   <strong style={{ fontSize: '1.2rem', color: 'white' }}>{formatBalance(editingItem.balance || 0)}</strong>
                               </div>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                               <div style={{ opacity: 0.7, fontSize: '0.75rem', color: '#f1c40f' }}>Lifetime Earned</div>
                               <strong style={{ fontSize: '1.2rem', color: 'white' }}>{formatBalance(editingItem.lifetimeEarnings || 0)}</strong>
                           </div>
                       </div>
                    </div>
                    <div className="flex-row" style={{ gap: '12px' }}>
                      <div className="input-field" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Balance ($)</label>
                        <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                          <DollarSign size={16} opacity={0.3} />
                          <input type="number" step="0.0001" value={editingItem.balance !== undefined ? editingItem.balance : ''} onChange={e => setEditingItem({ ...editingItem, balance: e.target.value })} style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                        </div>
                      </div>
                      <div className="input-field" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Tier</label>
                        <select value={editingItem.tier || 'free'} onChange={e => setEditingItem({ ...editingItem, tier: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white', appearance: 'none' }}>
                          <option value="free">Free Fest</option>
                          <option value="cash">Cash Fest</option>
                          <option value="reward">Reward Fest</option>
                          <option value="bonus">Bonus Fest</option>
                          <option value="profit">Profit Fest (Elite)</option>
                        </select>
                      </div>
                    </div>

                    {/* Ban / Unban Button */}
                    <div className="flex-row" style={{ marginTop: '20px' }}>
                      {editingItem.ban?.isBanned ? (
                        <Button 
                          onClick={() => handleBanUser(false)} 
                          disabled={banLoading}
                          style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', color: '#2ecc71', width: '100%' }}
                        >
                          {banLoading ? <Loader2 className="spin" size={20} /> : <><ShieldCheck size={18} style={{ marginRight: '8px' }} /> Unban User</>}
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => setShowBanModal(true)}
                          style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', color: '#e74c3c', width: '100%' }}
                        >
                          <Ban size={18} style={{ marginRight: '8px' }} /> Ban User
                        </Button>
                      )}
                    </div>

                    {/* Nested Ban Modal */}
                    <AnimatePresence>
                      {showBanModal && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBanModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }} />
                          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ position: 'relative', width: '90%', maxWidth: '400px', background: '#111', borderRadius: '24px', padding: '24px', border: '1px solid #e74c3c', zIndex: 10002 }}>
                             <div className="flex-row-between" style={{ marginBottom: '20px' }}>
                               <h4 style={{ color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem', fontWeight: '900' }}><Ban size={24} /> Ban User</h4>
                               <X onClick={() => setShowBanModal(false)} opacity={0.5} style={{ cursor: 'pointer' }} color="white" />
                             </div>
                             
                             <label style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px', display: 'block', color: 'white' }}>Ban Duration</label>
                             <div className="flex-row" style={{ gap: '8px', marginBottom: '20px' }}>
                               {['1d', '7d', 'lifetime'].map(dur => (
                                 <button key={dur} onClick={() => setBanDuration(dur)} style={{ flex: 1, padding: '12px 0', borderRadius: '12px', border: banDuration === dur ? '1px solid #e74c3c' : '1px solid rgba(255,255,255,0.1)', background: banDuration === dur ? 'rgba(231, 76, 60, 0.2)' : 'transparent', color: banDuration === dur ? '#e74c3c' : 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                                   {dur === '1d' ? '24 Hours' : dur === '7d' ? '7 Days' : 'Lifetime'}
                                 </button>
                               ))}
                             </div>

                             <label style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '8px', display: 'block', color: 'white' }}>Reason (Optional)</label>
                             <input type="text" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="e.g. Exploiting tasks" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', color: 'white', marginBottom: '24px' }} />

                             <Button onClick={() => handleBanUser(true)} disabled={banLoading} style={{ background: '#e74c3c', color: 'white', height: '50px', width: '100%', border: 'none' }}>
                               {banLoading ? <Loader2 className="spin" size={20} /> : 'Confirm Ban'}
                             </Button>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {activeTab === 'referralLinks' && (
                  <div className="input-field">
                    <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Referral Parameter</label>
                    <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                      <LinkIcon size={16} opacity={0.3} />
                      <input value={editingItem.param || ''} onChange={e => setEditingItem({ ...editingItem, param: e.target.value })} placeholder="E.g. SPRING2025" style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                    </div>
                  </div>
                )}

                {['tasks', 'promos'].includes(activeTab) && (
                  <>
                    <div className="input-field">
                      <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Title</label>
                      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                        <Type size={16} opacity={0.3} />
                        <input value={editingItem.title || ''} onChange={e => setEditingItem({ ...editingItem, title: e.target.value })} placeholder="Display Title" style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                      </div>
                    </div>

                    {activeTab === 'tasks' && (
                      <div className="input-field">
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Task Status</label>
                        <select 
                          value={editingItem.status || 'active'} 
                          onChange={e => setEditingItem({ ...editingItem, status: e.target.value })} 
                          style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white' }}
                        >
                          <option value="active">Active (Visible to users)</option>
                          <option value="paused">Paused (Hidden and disabled)</option>
                        </select>
                      </div>
                    )}

                    {activeTab === 'promos' && (
                      <div className="input-field">
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Promo Code</label>
                        <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                          <Gift size={16} opacity={0.3} />
                          <input value={editingItem.code || ''} onChange={e => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })} placeholder="E.G. WELCOME100" style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                        </div>
                      </div>
                    )}

                    <div className="input-field">
                      <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Description</label>
                      <textarea value={editingItem.description || ''} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white', minHeight: '80px' }} />
                    </div>

                    <div className="flex-row" style={{ gap: '12px' }}>
                      <div className="input-field" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Reward Amount ($)</label>
                        <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                          <DollarSign size={16} opacity={0.3} />
                          <input type="number" step="0.01" value={editingItem.reward || ''} onChange={e => setEditingItem({ ...editingItem, reward: e.target.value })} style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                        </div>
                      </div>
                      {activeTab === 'promos' && (
                        <div className="input-field" style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Supply Count</label>
                          <input type="number" value={editingItem.supply || ''} onChange={e => setEditingItem({ ...editingItem, supply: e.target.value })} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white' }} />
                        </div>
                      )}
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '16px' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: '800', marginBottom: '10px' }}>
                        {activeTab === 'tasks' ? 'Task Configuration' : 'Task Requirements (Optional)'}
                      </p>
                      <Stack gap={10}>
                        <select
                          value={activeTab === 'promos' ? (editingItem.task?.type || 'none') : (editingItem.type || 'none')}
                          onChange={e => setEditingItem(activeTab === 'promos' ? { ...editingItem, task: { ...(editingItem.task || {}), type: e.target.value } } : { ...editingItem, type: e.target.value })}
                          style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' }}
                        >
                          <option value="none">No verification needed / Generic</option>
                          <option value="channel">Telegram Channel</option>
                          <option value="group">Telegram Group</option>
                          <option value="bot">Telegram Bot</option>
                        </select>
                        {((activeTab === 'promos' && editingItem.task?.type && editingItem.task?.type !== 'none') ||
                          (activeTab === 'tasks' && editingItem.type && editingItem.type !== 'none')) && (
                            <>
                              {activeTab === 'promos' && (
                                <input placeholder="Requirement Title (e.g. Join EarnFest)" value={editingItem.task?.title || ''} onChange={e => setEditingItem({ ...editingItem, task: { ...editingItem.task, title: e.target.value } })} style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' }} />
                              )}
                              <div className="flex-row" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '0 10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <LinkIcon size={14} opacity={0.3} />
                                <input
                                  placeholder="https://t.me/yourlink"
                                  value={activeTab === 'promos' ? (editingItem.task?.link || '') : (editingItem.link || '')}
                                  onChange={e => setEditingItem(activeTab === 'promos' ? { ...editingItem, task: { ...editingItem.task, link: e.target.value } } : { ...editingItem, link: e.target.value })}
                                  style={{ flex: 1, background: 'none', border: 'none', padding: '10px', color: 'white', fontSize: '0.8rem' }}
                                />
                              </div>
                            </>
                          )}
                        {activeTab === 'tasks' && editingItem.type !== 'channel' && editingItem.type !== 'group' && (
                          <div className="stack-vertical" style={{ gap: '6px', marginTop: '10px' }}>
                            <label style={{ fontSize: '0.7rem', opacity: 0.5 }}>Verification API (Optional)</label>
                            <input 
                              placeholder="https://yourdomain.com/verify?userId={userId}" 
                              value={editingItem.api || ''} 
                              onChange={e => setEditingItem({ ...editingItem, api: e.target.value })} 
                              style={{ background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.8rem' }} 
                            />
                          </div>
                        )}
                      </Stack>
                    </div>

                    <div className="flex-row" style={{ gap: '12px' }}>
                      <div className="input-field" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>{activeTab === 'promos' ? 'Valid Link Color' : 'Category'}</label>
                        <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                          <Palette size={16} opacity={0.3} />
                          <input
                            value={activeTab === 'promos' ? (editingItem.themeColor || '') : (editingItem.category || '')}
                            onChange={e => setEditingItem(activeTab === 'promos' ? { ...editingItem, themeColor: e.target.value } : { ...editingItem, category: e.target.value })}
                            placeholder={activeTab === 'promos' ? "#D4AF37" : "Social / Daily"}
                            style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }}
                          />
                        </div>
                      </div>
                      {activeTab === 'promos' && (
                        <div className="input-field" style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Expiry Date</label>
                          <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                            <Calendar size={16} opacity={0.3} />
                            <input type="date" value={editingItem.validUntil || ''} onChange={e => setEditingItem({ ...editingItem, validUntil: e.target.value })} style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white', fontSize: '0.8rem' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {activeTab === 'tasks' && (
                       <Card style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '800', marginBottom: '10px', display: 'block' }}>TASK IMAGE (OPTIONAL)</label>
                          <div className="flex-row" style={{ gap: '15px' }}>
                             <div 
                                style={{ 
                                   width: '100px', height: '60px', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', 
                                   display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                   border: '1px solid rgba(255,255,255,0.1)' 
                                }}
                             >
                                {(taskImagePreview || editingItem.imageUrl) ? (
                                   <img src={taskImagePreview || editingItem.imageUrl} alt="Task" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                   <ImageIcon size={24} opacity={0.2} />
                                )}
                             </div>
                             <div style={{ flex: 1 }}>
                                <input 
                                   type="file" 
                                   id="task-image-upload" 
                                   hidden 
                                   accept="image/*"
                                   onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                         setTaskImageFile(file);
                                         setTaskImagePreview(URL.createObjectURL(file));
                                      }
                                   }}
                                />
                                <label htmlFor="task-image-upload" style={{ cursor: 'pointer' }}>
                                   <div className="flex-center" style={{ background: 'rgba(255,255,255,0.05)', height: '40px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '700' }}>
                                      {taskImageFile ? 'Change Image' : 'Add Image'}
                                   </div>
                                </label>
                                {(taskImageFile || editingItem.imageUrl) && (
                                   <div 
                                      onClick={() => {
                                         setTaskImageFile(null);
                                         setTaskImagePreview(null);
                                         setEditingItem({ ...editingItem, imageUrl: null });
                                      }}
                                      style={{ fontSize: '0.7rem', color: '#ff4d4d', marginTop: '8px', cursor: 'pointer', textAlign: 'center' }}
                                   >
                                      Remove Image
                                   </div>
                                )}
                             </div>
                          </div>
                       </Card>
                    )}
                  </>
                )}

                {activeTab === 'partners' && (
                  <>
                    <div className="input-field">
                      <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Partner Name</label>
                      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                        <Type size={16} opacity={0.3} />
                        <input value={editingItem.name || ''} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} placeholder="Partner Name" style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                      </div>
                    </div>

                    <div className="input-field">
                      <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Image URL</label>
                      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                        <ImageIcon size={16} opacity={0.3} />
                        <input value={editingItem.imageUrl || ''} onChange={e => setEditingItem({ ...editingItem, imageUrl: e.target.value })} placeholder="https://example.com/logo.png" style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                      </div>
                    </div>

                    <div className="input-field">
                      <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Link URL</label>
                      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                        <LinkIcon size={16} opacity={0.3} />
                        <input value={editingItem.link || ''} onChange={e => setEditingItem({ ...editingItem, link: e.target.value })} placeholder="https://t.me/partner" style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                      </div>
                    </div>

                    <div className="flex-row" style={{ gap: '12px' }}>
                      <div className="input-field" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Display Order</label>
                        <input type="number" value={editingItem.order || 0} onChange={e => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 0 })} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white' }} />
                      </div>
                      <div className="input-field" style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Visibility</label>
                        <select value={editingItem.isPublic ? 'public' : 'admin'} onChange={e => setEditingItem({ ...editingItem, isPublic: e.target.value === 'public' })} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: '12px', padding: '14px', color: 'white' }}>
                          <option value="public">Public (Visible to all)</option>
                          <option value="admin">Admin Only</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <Button
                  onClick={() => {
                    if (activeTab === 'partners') {
                      handlePartnerSave(editingItem);
                      return;
                    }
                    let collection = activeTab === 'referralLinks' ? 'referral-links' :
                                    activeTab === 'tasks' ? 'tasks' :
                                    activeTab === 'promos' ? 'promocodes' : 'users';
                    // Override for platform tab since it holds multiple types
                    if (activeTab === 'platform') {
                       if (editingItem.telegramId) collection = 'users';
                    }
                    handleSave(collection, editingItem);
                  }}
                  disabled={loading}
                  style={{ height: '52px', marginTop: '10px' }}
                >
                  {loading ? <Loader2 className="spin" size={20} /> : <div className="flex-center" style={{ gap: '8px' }}><Save size={20} /> Save Changes</div>}
                </Button>
              </Stack>
          </div>
        </div>
      )}

      {/* Offer Form Modal */}
      {showOfferForm && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end' }}>
            <div onClick={() => setShowOfferForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }} />
            <div
              style={{ width: '100%', background: '#0a0a0a', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '30px 24px', position: 'relative', borderTop: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <div className="flex-row-between" style={{ marginBottom: '24px' }}>
                <h3 className="heading-lg">Dynamic Limit Offer</h3>
                <X style={{ opacity: 0.5 }} onClick={() => setShowOfferForm(false)} />
              </div>

              <Stack gap={16}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {['free', 'cash', 'reward', 'bonus', 'profit'].map(tier => (
                    <div className="input-field" key={tier}>
                      <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block', textTransform: 'capitalize' }}>{tier} Min ($FEST)</label>
                      <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                        <DollarSign size={16} opacity={0.3} />
                        <input type="number" step="0.01" value={offerFormData[tier]} onChange={e => setOfferFormData({...offerFormData, [tier]: e.target.value})} style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white' }} />
                      </div>
                    </div>
                  ))}
                  
                  <div className="input-field">
                    <label style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '6px', display: 'block' }}>Expiry Date & Time</label>
                    <div className="flex-row" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0 12px' }}>
                      <Calendar size={16} opacity={0.3} />
                      <input type="datetime-local" value={offerFormData.endTime} onChange={e => setOfferFormData({...offerFormData, endTime: e.target.value})} style={{ flex: 1, background: 'none', border: 'none', padding: '14px', color: 'white', fontSize: '0.8rem' }} />
                    </div>
                  </div>
                </div>

                <Button onClick={handleCreateOffer} style={{ height: '52px', marginTop: '10px', background: 'var(--success)' }}>
                  <div className="flex-center" style={{ gap: '8px', color: '#000' }}><Save size={20} /> Save Offer Rules</div>
                </Button>
              </Stack>
            </div>
          </div>
        )}
    </div>
  );
};

export default AdminPanel;
