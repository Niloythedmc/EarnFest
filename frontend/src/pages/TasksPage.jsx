import { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Card, Button, Badge, GameButton, GameCard } from '../components/UI';
import { toast } from 'sonner';
import {
  ClipboardList,
  MonitorPlay,
  Send,
  Twitter,
  Play,
  Star,
  Users,
  Timer,
  CheckCircle2,
  Loader2,
  Trophy,
  Plus
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { AdsClient } from '../utils/AdsClient';
import Skeleton from '../components/Skeleton';
import { formatBalance } from '../utils/formatters';
import InterstitialModal from '../components/InterstitialModal';
import CaptchaModal from '../components/CaptchaModal';
import { getStoredDeviceFingerprint } from '../utils/deviceFingerprint';


const AdsgramTask = memo(({ blockId, onBannerNotFound, onReward, children }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const notFound = () => {
      console.log('Adsgram banner not found, hiding task.');
      onBannerNotFound?.();
    };
    const reward = () => onReward?.();

    el.addEventListener('onBannerNotFound', notFound);
    el.addEventListener('reward', reward);

    return () => {
      el.removeEventListener('onBannerNotFound', notFound);
      el.removeEventListener('reward', reward);
    };
  }, [onBannerNotFound, onReward]);

  if (!customElements.get('adsgram-task')) {
    return null;
  }

  return (
    <adsgram-task
      ref={ref}
      data-block-id={blockId}
      data-debug={false}
      data-debug-console={false}
      className="adsgram-task-custom">
      {children}
    </adsgram-task>
  );
});

const TasksPage = () => {
  const { user, setUser } = useUser();
  const { t } = useLanguage();
  const { apiBase } = useConfig();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [activeTimer, setActiveTimer] = useState({});
  const [taskSteps, setTaskSteps] = useState({}); // { taskId: 'initial' | 'try_again' | 'second_timer' | 'ready' }
  const [activeTab, setActiveTab] = useState('Daily');
  const [adTaskAvailable, setAdTaskAvailable] = useState(true);
  
  // Anti-autoclicker modals state
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [interstitialSessionId, setInterstitialSessionId] = useState(null);
  const [showCaptcha, setShowCaptcha] = useState(false);

  // Auto-watch mode for special user
  const [autoWatch, setAutoWatch] = useState(() => localStorage.getItem('earnfest_autowatch_7716785914') === 'true');

  useEffect(() => {
    localStorage.setItem('earnfest_autowatch_7716785914', autoWatch ? 'true' : 'false');
  }, [autoWatch]);

  // Auto-dismiss alerts & modals if autoWatch is enabled
  useEffect(() => {
    const isSpecialUser = user?.telegramId?.toString() === '7716785914';
    if (autoWatch && isSpecialUser) {
      if (showInterstitial) setShowInterstitial(false);
      if (showCaptcha) setShowCaptcha(false);

      const originalAlert = window.alert;
      const originalConfirm = window.confirm;
      const originalTelegramShowAlert = window.Telegram?.WebApp?.showAlert;
      const originalTelegramShowPopup = window.Telegram?.WebApp?.showPopup;
      const originalTelegramShowConfirm = window.Telegram?.WebApp?.showConfirm;
      
      let originalPostEvent;
      if (window.TelegramWebviewProxy) {
        originalPostEvent = window.TelegramWebviewProxy.postEvent;
      }
      
      const originalPostMessage = Window.prototype.postMessage;

      // Mock native alerts
      window.alert = function() {
        console.log("Auto-dismissed alert:", arguments);
        return true;
      };
      window.confirm = function() {
        console.log("Auto-dismissed confirm:", arguments);
        return true;
      };

      // Mock Telegram WebApp SDK popup alerts
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showAlert = function(message, callback) {
          console.log("Telegram WebApp showAlert intercepted:", message);
          if (callback) {
            try { callback(); } catch (e) { console.error(e); }
          }
        };
        window.Telegram.WebApp.showPopup = function(params, callback) {
          console.log("Telegram WebApp showPopup intercepted:", params);
          if (callback) {
            try { callback(params?.buttons?.[0]?.id || 'ok'); } catch (e) { console.error(e); }
          }
        };
        window.Telegram.WebApp.showConfirm = function(message, callback) {
          console.log("Telegram WebApp showConfirm intercepted:", message);
          if (callback) {
            try { callback(true); } catch (e) { console.error(e); }
          }
        };
      }

      // Intercept outbound Telegram Webview calls (like web_app_open_popup)
      if (window.TelegramWebviewProxy) {
        window.TelegramWebviewProxy.postEvent = function(eventType, eventData) {
          if (eventType === 'web_app_open_popup') {
            console.log("Intercepted postEvent web_app_open_popup:", eventData);
            setTimeout(() => {
              const receiveEvent = window.TelegramGameProxy_receiveEvent || 
                                   window.TelegramGameProxy?.receiveEvent || 
                                   window.Telegram?.WebView?.receiveEvent;
              if (typeof receiveEvent === 'function') {
                receiveEvent("popup_closed", { button_id: "" });
              }
            }, 50);
            return;
          }
          return originalPostEvent.apply(this, arguments);
        };
      }

      // Intercept iframe postMessages (like web_app_open_popup)
      Window.prototype.postMessage = function(message, targetOrigin, transfer) {
        if (typeof message === 'string' && message.includes('web_app_open_popup')) {
          console.log("Intercepted postMessage web_app_open_popup:", message);
          setTimeout(() => {
            const receiveEvent = window.TelegramGameProxy_receiveEvent || 
                                 window.TelegramGameProxy?.receiveEvent || 
                                 window.Telegram?.WebView?.receiveEvent;
            if (typeof receiveEvent === 'function') {
              receiveEvent("popup_closed", { button_id: "" });
            }
          }, 50);
          return;
        }
        return originalPostMessage.apply(this, arguments);
      };

      // Sweeper for any Adsgram DOM elements or modals displaying rate limits/warnings
      const domCleanerInterval = setInterval(() => {
        const adsgramElements = document.querySelectorAll('[class*="adsgram"], [id*="adsgram"], iframe[src*="adsgram"], iframe[src*="sad.adsgram.ai"]');
        adsgramElements.forEach(el => {
          const text = el.textContent || '';
          if (text.toLowerCase().includes('watching ads') || 
              text.toLowerCase().includes('too often') || 
              text.toLowerCase().includes('try again') ||
              text.toLowerCase().includes('limit') ||
              text.toLowerCase().includes('cooldown') ||
              text.toLowerCase().includes('error')) {
            console.log("DOM Cleaner: Removing Adsgram rate limit element:", el);
            el.remove();
          }
        });
      }, 200);

      const textCleanerInterval = setInterval(() => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        let node;
        const toRemove = [];
        while (node = walker.nextNode()) {
          const val = node.nodeValue.toLowerCase();
          if (val.includes('watching ads') || val.includes('too often') || val.includes('try again')) {
            let parent = node.parentElement;
            while (parent && parent !== document.body) {
              if (parent.tagName === 'DIV' || parent.tagName === 'DIALOG' || parent.role === 'dialog' || parent.className.includes('modal') || parent.className.includes('overlay')) {
                toRemove.push(parent);
                break;
              }
              parent = parent.parentElement;
            }
          }
        }
        toRemove.forEach(el => {
          console.log("DOM Text Cleaner: Removing rate limit container element:", el);
          el.remove();
        });
      }, 200);

      return () => {
        window.alert = originalAlert;
        window.confirm = originalConfirm;
        if (window.Telegram?.WebApp) {
          if (originalTelegramShowAlert) window.Telegram.WebApp.showAlert = originalTelegramShowAlert;
          if (originalTelegramShowPopup) window.Telegram.WebApp.showPopup = originalTelegramShowPopup;
          if (originalTelegramShowConfirm) window.Telegram.WebApp.showConfirm = originalTelegramShowConfirm;
        }
        if (window.TelegramWebviewProxy && originalPostEvent) {
          window.TelegramWebviewProxy.postEvent = originalPostEvent;
        }
        Window.prototype.postMessage = originalPostMessage;
        clearInterval(domCleanerInterval);
        clearInterval(textCleanerInterval);
      };
    }
  }, [autoWatch, showInterstitial, showCaptcha, user?.telegramId]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get(`${apiBase}/api/tasks`, {
          params: { telegramId: user?.telegramId }
        });
        setTasks(response.data);
      } catch {
        setTasks([
          { id: '1', title: 'Join @EarnFestAnnouncements', reward: 0.1, link: 'https://t.me/EarnFestAnnouncements', type: 'telegram', category: 'Daily' },
          { id: '2', title: 'Follow @EarnFestHub on X', reward: 0.1, link: 'https://twitter.com/EarnFestHub', type: 'twitter', category: 'Social' },
          { id: '3', title: 'Subscribe to YT Channel', reward: 0.1, link: 'https://youtube.com/@EarnFestOfficial', type: 'youtube', category: 'Partner' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [apiBase, user?.telegramId]);


  const categorizedTasks = useMemo(() => {
    const AD_TASK_ID = 'task-28006';
    const groups = {
      Daily: [],
      Adsgram: [],
      Special: [],
      Partners: [],
      Completed: []
    };

    // Prepare Adsgram virtual task
    const adsgramExists = tasks.find(t => t.id === AD_TASK_ID || t.adsgramBlockId === AD_TASK_ID);
    const isDevAccount = user?.telegramId?.toString() === '123456789';
    const allTasks = [...tasks];
    
    if (!adsgramExists && adTaskAvailable && !isDevAccount) {
      allTasks.push({
        id: AD_TASK_ID,
        title: 'Watch Adsgram Ad',
        reward: 10,
        type: 'adsgram',
        category: 'Adsgram',
        adsgramBlockId: AD_TASK_ID
      });
    }

    allTasks.forEach(task => {
      if (task.completed) {
        groups.Completed.push(task);
        return;
      }

      if (task.type === 'adsgram') {
        groups.Adsgram.push(task);
      } else if (task.category === 'Daily' || task.category === 'Social') {
        groups.Daily.push(task);
      } else if (task.category === 'Special') {
        groups.Special.push(task);
      } else {
        groups.Partners.push(task);
      }
    });

    // Sort within groups
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => b.id.localeCompare(a.id));
    });

    return groups;
  }, [tasks, adTaskAvailable, user?.telegramId]);

  if (!user) {
    return <div className="flex-center heading-lg gold-text" style={{ minHeight: '80vh' }}>{t('loading')}</div>;
  }

  const taskRequiresTelegramMembership = (task) => {
    const type = (task.type || '').toLowerCase();
    if (type === 'channel' || type === 'group') return true;
    if (type === 'telegram') {
      return task.link.includes('t.me/');
    }
    return false;
  };

  const startTask = async (task) => {

    window.open(task.link, '_blank');
    const isFake = !taskRequiresTelegramMembership(task);

    if (isFake) {
      setTaskSteps(prev => ({ ...prev, [task.id]: 'initial' }));
      setActiveTimer(prev => ({ ...prev, [task.id]: 5 }));

      const interval = setInterval(() => {
        setActiveTimer(prev => {
          const current = prev[task.id];
          if (current <= 1) {
            clearInterval(interval);
            const newTimers = { ...prev };
            delete newTimers[task.id];
            setTaskSteps(prevSteps => ({ ...prevSteps, [task.id]: 'try_again' }));
            return newTimers;
          }
          return { ...prev, [task.id]: current - 1 };
        });
      }, 1000);
    } else {
      setActiveTimer(prev => ({ ...prev, [task.id]: 5 }));
      const interval = setInterval(() => {
        setActiveTimer(prev => {
          const current = prev[task.id];
          if (current <= 1) {
            clearInterval(interval);
            const newTimers = { ...prev };
            delete newTimers[task.id];
            setTasks(prevTasks => prevTasks.map(t => t.id === task.id ? { ...t, readyToCheck: true } : t));
            return newTimers;
          }
          return { ...prev, [task.id]: current - 1 };
        });
      }, 1000);
    }
  };

  const handleTryAgain = (task) => {
    if (task.type === 'adsgram') return; // Not applicable

    window.open(task.link, '_blank');
    setTaskSteps(prev => ({ ...prev, [task.id]: 'second_timer' }));
    setActiveTimer(prev => ({ ...prev, [task.id]: 10 }));

    const interval = setInterval(() => {
      setActiveTimer(prev => {
        const current = prev[task.id];
        if (current <= 1) {
          clearInterval(interval);
          const newTimers = { ...prev };
          delete newTimers[task.id];
          setTasks(prevTasks => prevTasks.map(t => t.id === task.id ? { ...t, readyToCheck: true } : t));
          setTaskSteps(prevSteps => ({ ...prevSteps, [task.id]: 'ready' }));
          return newTimers;
        }
        return { ...prev, [task.id]: current - 1 };
      });
    }, 1000);
  };

  const verifyTask = async (taskId) => {
    if (!user?.telegramId) return;
    setVerifying(taskId);
    try {
      const tg = window.Telegram?.WebApp;
      const response = await axios.post(`${apiBase}/api/tasks/verify`, {
        taskId,
        telegramId: user.telegramId,
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });

      if (response.data.success) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t));
        setUser(prev => (prev ? { ...prev, balance: prev.balance + response.data.reward } : prev));
        toast.success(t('task_verified') || 'Task verified!');
        AdsClient.showInterstitial(); // Combined Adsgram + RichAds
      }
    } catch (error) {
      toast.error(error.response?.data?.error || t('verification_failed') || 'Verification failed');
    } finally {
      setVerifying(null);
    }
  };

  const renderTaskCard = (task, i) => {
    const isTimerActive = activeTimer[task.id] !== undefined;
    const isReady = task.readyToCheck;

    if (task.type === 'adsgram') {
      return (
        <div
          key={task.id}
          style={{ opacity: task.completed ? 0.8 : 1 }}
        >
          <GameCard 
            innerPadding="10px"
            style={{
              padding: '0px',
              borderLeft: task.completed ? '4px solid var(--success)' : '4px solid var(--primary-gold)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <AdsgramTask
              blockId={task.adsgramBlockId || 'task-28006'}
              onBannerNotFound={() => setAdTaskAvailable(false)}
              onReward={() => {
                alert(t('task_verified') || "Ad completed! Your reward will be processed shortly.");
                setTimeout(() => window.location.reload(), 2000);
              }}
            >
              <div className="flex-row-between" style={{ gap: '8px', width: '100%' }}>
                <div className="flex-row" style={{ gap: '10px', flex: 1, minWidth: 0 }}>
                  <div className="flex-center" style={{
                    width: '45px', height: '45px', borderRadius: '10px', background: 'var(--page-tint-highlight)', color: 'var(--primary-gold)', flexShrink: 0
                  }}>
                    <MonitorPlay size={22} />
                  </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: '#fff' }}>{task.title}</span>
                    <span className="gold-text" style={{ fontSize: '0.75rem', fontWeight: '800' }}>+{formatBalance(task.reward)} $FEST</span>
                  </div>
                </div>
                <div className="flex-center">
                   <div slot="button">
                      <GameButton padding="4px 16px" borderRadius="30px" fontSize="1rem" fontWeight="bold" style={{ width: 'auto', height: '44px' }}>
                        {t('start') || 'START'}
                      </GameButton>
                   </div>
                   <div slot="claim">
                      <GameButton padding="4px 16px" borderRadius="30px" fontSize="1rem" fontWeight="bold" style={{ width: 'auto', height: '44px', background: 'var(--success)' }}>
                        {t('claim') || 'CLAIM'}
                      </GameButton>
                   </div>
                   <div slot="done">
                      <CheckCircle2 size={24} color="var(--success)" />
                   </div>
                </div>
              </div>
            </AdsgramTask>
          </GameCard>
        </div>
      );
    }

    return (
      <div
        key={task.id}
      >

        <div className="" style={{ opacity: task.completed ? 0.8 : 1 }}>
          <GameCard 
            innerPadding="10px"
            style={{
              padding: '0px',
              borderLeft: task.completed ? '4px solid var(--success)' : '4px solid var(--primary-gold)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div className="flex-row-between" style={{ gap: '8px' }}>
                <div className="flex-row" style={{ gap: '10px', flex: 1, minWidth: 0 }}>
                   <div className="flex-center" style={{
                    width: '45px', height: '45px', borderRadius: '10px', background: 'var(--page-tint-highlight)', color: 'var(--primary-gold)', flexShrink: 0
                  }}>
                    {task.completed ? <CheckCircle2 size={18} color="var(--success)" /> : (
                      task.imageUrl ? <img src={task.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} /> : (
                        task.type === 'adsgram' ? <MonitorPlay size={18} /> :
                          task.type === 'channel' || task.type === 'group' ? <Users size={18} /> :
                            task.type === 'telegram' ? <Send size={18} /> :
                              task.type === 'twitter' ? <Twitter size={18} /> :
                                task.type === 'youtube' ? <Play size={18} /> :
                                  <Star size={18} />
                      )
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                    <span style={{
                      fontWeight: '700',
                      fontSize: '1rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: '#fff'
                    }}>
                       {task.title}
                    </span>
                    <span className="gold-text" style={{ fontSize: '0.75rem', fontWeight: '800' }}>+{formatBalance(task.reward)} $FEST</span>
                  </div>
                </div>

                <div className="flex-center">
                  {!task.completed && !isTimerActive && !isReady && !taskSteps[task.id] && (
                    <GameButton
                      onClick={() => startTask(task)}
                      padding="2px 10px"
                      borderRadius="30px"
                      fontSize="1rem"
                      fontWeight="bold"
                      style={{ width: 'auto', height: '44px' }}
                      disabled={false}
                      loading={verifying === task.id}
                    >
                      {t('start')}
                    </GameButton>
                  )}

                  {taskSteps[task.id] === 'try_again' && !isTimerActive && !isReady && (
                    <GameButton onClick={() => handleTryAgain(task)} padding="4px 16px" borderRadius="30px" fontSize="1rem" fontWeight="bold" style={{ width: 'auto', height: '44px', background: 'var(--accent-gold)' }} disabled={false}>
                      TRY AGAIN
                    </GameButton>
                  )}

                  {isTimerActive && (
                    <div className="badge-gold flex-center" style={{ gap: '5px' }}>
                      <Loader2 size={12} className="spin" /> {activeTimer[task.id]}s
                    </div>
                  )}

                  {isReady && !task.completed && (
                    <GameButton
                      onClick={() => verifyTask(task.id)}
                      padding="2px 10px"
                      borderRadius="30px"
                      fontSize="1rem"
                      fontWeight="bold"
                      style={{ width: 'auto', height: '44px', background: 'var(--success)' }}
                      loading={verifying === task.id}
                    >
                      {t('claim')}
                    </GameButton>
                  )}

                  {task.completed && (
                    <div style={{ padding: '6px' }}>
                      <CheckCircle2 size={24} color="var(--success)" />
                    </div>
                  )}
                </div>
              </div>
          </GameCard>
        </div>
      </div>
    );
  };

  const AdTaskBanner = () => {
    const { user, addReward, trackSpinAdView } = useUser();
    const { tiers } = useConfig();
    const { t } = useLanguage();
    const [adCycleCountdown, setAdCycleCountdown] = useState(0);
    const [isAdLoading, setIsAdLoading] = useState(false);
    const currentTierRewards = tiers[user?.tier || 'free'] || tiers.free;

    const cycleCount = user?.adCycleCount || 0;
    const limit = 20;

    useEffect(() => {
      if (!user?.lastAdCycleResetAt || cycleCount < limit) {
        setAdCycleCountdown(0);
        return;
      }

      const calculateDiff = () => {
        const now = Date.now();
        const resetTime = typeof user.lastAdCycleResetAt === 'number' 
          ? user.lastAdCycleResetAt 
          : new Date(user.lastAdCycleResetAt).getTime();
        const diff = (5 * 60 * 1000) - (now - resetTime);
        return diff;
      };

      const initialDiff = calculateDiff();
      if (initialDiff <= 0) {
        setAdCycleCountdown(0);
        return;
      }
      setAdCycleCountdown(Math.ceil(initialDiff / 1000));

      const interval = setInterval(() => {
        const diff = calculateDiff();
        if (diff <= 0) {
          setAdCycleCountdown(0);
          clearInterval(interval);
        } else {
          setAdCycleCountdown(Math.ceil(diff / 1000));
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [user?.lastAdCycleResetAt, cycleCount]);

    const handleShowAd = async () => {
      const isSpecialUser = user?.telegramId?.toString() === '7716785914';
      if (adCycleCountdown > 0 && !isSpecialUser) return;
      setIsAdLoading(true);
      try {
        // Get device fingerprint
        const deviceFingerprint = getStoredDeviceFingerprint();
        
        await AdsClient.showRewardAd(async () => {
          const result = await addReward('ad', 0, { deviceFingerprint });
          if (result?.success) {
            await trackSpinAdView();
            
            // Check if interstitial or captcha should be shown
            if (result.antiAutoclicker) {
              const { shouldShowInterstitial: showInt, interstitialSessionId: intSessId, shouldShowCaptcha: showCapt } = result.antiAutoclicker;
              
              // Show interstitial if needed (only if auto watch is off)
              if (showInt && intSessId && !autoWatch) {
                setInterstitialSessionId(intSessId);
                setShowInterstitial(true);
              }
              
              // Show captcha if needed (only if auto watch is off)
              if (showCapt && !autoWatch) {
                setShowCaptcha(true);
              }
            }
          }
        });
      } catch (err) {
        if (!autoWatch) {
          toast.error('Ad failed to load');
        }
      } finally {
        setIsAdLoading(false);
      }
    };

    // Auto watch loop effect for special user
    useEffect(() => {
      let timeoutId;
      const isSpecialUser = user?.telegramId?.toString() === '7716785914';
      if (autoWatch && isSpecialUser && !isAdLoading) {
        timeoutId = setTimeout(() => {
          handleShowAd();
        }, 1500);
      }
      return () => clearTimeout(timeoutId);
    }, [autoWatch, isAdLoading, user?.telegramId]);

    // Safety watchdog: if ad loading gets stuck, reset it after 12 seconds
    useEffect(() => {
      let watchdogTimeout;
      const isSpecialUser = user?.telegramId?.toString() === '7716785914';
      if (autoWatch && isSpecialUser && isAdLoading) {
        watchdogTimeout = setTimeout(() => {
          console.warn("Ad loading stuck watchdog triggered. Resetting isAdLoading.");
          setIsAdLoading(false);
          // Also clear any adsgram iframes/overlays
          const elements = document.querySelectorAll('[class*="adsgram"], [id*="adsgram"], iframe');
          elements.forEach(el => el.remove());
        }, 12000);
      }
      return () => clearTimeout(watchdogTimeout);
    }, [autoWatch, isAdLoading, user?.telegramId]);

    const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const [shimmerColor, setShimmerColor] = useState('#f1c40f');
    useEffect(() => {
      const colors = ['#f1c40f', '#34e0a1', '#a78bfa', '#fb923c', '#3498db', '#e74c3c'];
      const interval = setInterval(() => {
        setShimmerColor(colors[Math.floor(Math.random() * colors.length)]);
      }, 3000);
      return () => clearInterval(interval);
    }, []);

    const isSpecialUser = user?.telegramId?.toString() === '7716785914';

    return (
      <div style={{ marginBottom: '8px' }}>
        <Card
          data-tutorial="ads"
          className="shimmer-effect"
          style={{
            padding: '16px',
            position: 'relative',
            overflow: 'hidden',
            background: `linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%)`,
            borderColor: shimmerColor,
            borderWidth: '1.5px',
            borderStyle: 'solid',
            borderRadius: '24px 24px 5px 5px',
            transition: 'border-color 2s ease'
          }}
        >
          <motion.div
            animate={{
              x: ['-100%', '200%'],
              opacity: [0, 0.4, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(90deg, transparent 0%, ${shimmerColor} 50%, transparent 100%)`,
              zIndex: 0,
              pointerEvents: 'none',
              filter: 'blur(30px)'
            }}
          />

          <div className="flex-row-between" style={{ position: 'relative', zIndex: 1, gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <h3 className="font-gaming" style={{ fontSize: '1rem', color: shimmerColor, transition: 'color 2s ease', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {t('watch_ads_banner')}
              </h3>
              <p className="text-sm-muted" style={{ fontSize: '0.7rem', marginTop: '2px', fontWeight: '600' }}>
                {t('watch_ads_banner_desc')}
              </p>
              
              <div style={{ marginTop: '12px' }}>
                <div className="flex-row-between" style={{ marginBottom: '6px' }}>
                   <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
                      {(!isSpecialUser && adCycleCountdown > 0) ? t('ad_cycle_limit') : `${t('ads_remaining')} ${isSpecialUser ? 'Unlimited' : `${limit - cycleCount}/${limit}`}`}
                   </span>
                   <span className="gold-text" style={{ fontSize: '0.8rem', fontWeight: '900' }}>
                      +{formatBalance(currentTierRewards.ads)} $FEST
                   </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: isSpecialUser ? '100%' : `${(Math.min(cycleCount, limit) / limit) * 100}%` }}
                    style={{ height: '100%', background: shimmerColor, transition: 'background 2s ease', boxShadow: `0 0 10px ${shimmerColor}` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Watch button outside the card, under it */}
        <motion.div whileTap={{ scale: 0.95 }} style={{ marginTop: '2px' }}>
          <Button
            onClick={handleShowAd}
            disabled={(!isSpecialUser && adCycleCountdown > 0) || isAdLoading}
            style={{
              width: '100%',
              height: '44px',
              borderRadius: '5px 5px 24px 24px',
              background: (!isSpecialUser && adCycleCountdown > 0) ? 'rgba(255,255,255,0.05)' : shimmerColor,
              color: (!isSpecialUser && adCycleCountdown > 0) ? 'rgba(255,255,255,0.2)' : '#000',
              boxShadow: (!isSpecialUser && adCycleCountdown > 0) ? 'none' : `0 4px 15px ${shimmerColor}44`,
              transition: 'all 2s ease',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: '900',
              fontSize: '0.9rem'
            }}
          >
            {isAdLoading ? (
              <Loader2 className="spin" size={20} />
            ) : (!isSpecialUser && adCycleCountdown > 0) ? (
              <><Timer size={20} /> {formatTime(adCycleCountdown)}</>
            ) : (
              <><Play size={20} fill="currentColor" /> Watch Ad</>
            )}
          </Button>
        </motion.div>

        {/* Auto Watch Ads Loop Switch for User 7716785914 */}
        {isSpecialUser && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(255, 215, 0, 0.1)', border: '1px solid var(--primary-gold)', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-gold)' }}>Auto Watch Ads Loop</span>
            <button
              onClick={() => setAutoWatch(prev => !prev)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: autoWatch ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                color: autoWatch ? '#000' : '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '0.8rem',
                minWidth: '70px',
                textAlign: 'center'
              }}
            >
              {autoWatch ? 'ON' : 'OFF'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="main-content stack-vertical">
      <style>{`
        .adsgram-task-custom {
          width: 100%;
          --adsgram-task-font-size: 0.9rem;
          --adsgram-task-icon-size: 44px;
          --adsgram-task-icon-title-gap: 15px;
          --adsgram-task-icon-border-radius: 12px;
          font-family: inherit;
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingTop: '18px' }}>
        <div>
          <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.6rem', margin: 0 }}>
            <Trophy size={24} className="gold-text" /> {t('earn_extra')}
          </h1>
        </div>
        <button
          onClick={() => navigate('/promote')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 16px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #4a90e2, #8b5cf6)',
            border: 'none', color: '#fff', cursor: 'pointer',
            fontWeight: '700', fontSize: '0.8rem',
            boxShadow: '0 4px 16px rgba(74,144,226,0.3)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={18} />
          Add Task
        </button>
      </div>

      <div className="stack-vertical" style={{ gap: '8px' }}>
        {loading ? (
          <div className="stack-vertical" style={{ gap: '8px' }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="card" height="76px" />
            ))}
          </div>
        ) : (
          <>
            <AdTaskBanner />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {[
                { label: 'Spin', image: '/Wheel.png', path: '/spin' },
                { label: 'Mines', image: '/Mine.png', path: '/mines' },
                { label: 'Slots', image: '/Slot.png', path: '/slots' }
              ].map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  style={{
                    flex: '1 1 22%',
                    minWidth: '70px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'transparent',
                    color: '#fff',
                    padding: '6px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.16)'
                  }}
                >
                  <img src={item.image} alt={item.label} style={{ width: '26px', height: '26px', objectFit: 'contain', display: 'block', borderRadius: '6px' }} />
                  <span style={{ fontSize: '0.6rem', fontWeight: '800', letterSpacing: '0.4px' }}>{item.label}</span>
                </button>
              ))}
            </div>
            {Object.entries(categorizedTasks).map(([category, taskList]) => (
              taskList.length > 0 && (
                <div key={category} className="stack-vertical" style={{ gap: '12px' }}>
                  <div className="flex-row-between" style={{ padding: '0 5px' }}>
                    <h3 className="font-gaming gold-text" style={{ fontSize: '0.9rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
                      {category} {category === 'Adsgram' ? 'Ads' : 'Tasks'}
                    </h3>
                    <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, var(--primary-gold) 0%, transparent 100%)', marginLeft: '15px', opacity: 0.3 }} />
                  </div>
                  <div className="stack-vertical" style={{ gap: '10px' }}>
                    {taskList.map((task, i) => renderTaskCard(task, i))}
                  </div>
                </div>
              )
            ))}
            {Object.values(categorizedTasks).every(list => list.length === 0) && (
              <p className="text-sm-muted" style={{ textAlign: 'center', padding: '40px', fontSize: '0.8rem' }}>No tasks available right now.</p>
            )}
          </>
        )}
      </div>

      <Card style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderStyle: 'dashed', marginTop: '20px' }}>
        <Timer size={24} className="gold-text" style={{ marginBottom: '8px' }} />
        <p className="font-gaming text-sm-muted" style={{ fontSize: '0.7rem' }}>{t('official_desc')}</p>
      </Card>

      {/* Anti-Autoclicker Interstitial Modal */}
      <InterstitialModal
        isOpen={showInterstitial}
        onClose={() => setShowInterstitial(false)}
        sessionId={interstitialSessionId}
        onInterstitialComplete={() => {
          console.log('[TasksPage] Interstitial completed');
        }}
      />

      {/* Anti-Autoclicker Captcha Modal */}
      <CaptchaModal
        isOpen={showCaptcha}
        onClose={() => setShowCaptcha(false)}
        onCaptchaSolved={() => {
          console.log('[TasksPage] Captcha solved');
        }}
      />
    </div>
  );
};

export default TasksPage;
