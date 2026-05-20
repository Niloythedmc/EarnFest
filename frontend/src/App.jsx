import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './components/Navbar';
import { useEffect, useState, lazy, Suspense, useCallback } from 'react';
import { AdsClient } from './utils/AdsClient';
import { getPageTheme } from './theme/pageThemes';
import { useConfig } from './context/ConfigContext';
import { useUser } from './context/UserContext';
import { ShieldAlert, MessageSquare } from 'lucide-react';
import AppTutorial, { TUTORIAL_KEY } from './components/AppTutorial';
import DailyStreakModal from './components/DailyStreakModal';
import LoadingPage from './components/LoadingPage';

// Lazy load pages for better performance on low-end devices
const Home = lazy(() => import('./pages/Home'));
const SpinWheel = lazy(() => import('./pages/SpinWheel'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const UpgradePage = lazy(() => import('./pages/UpgradePage'));
const WithdrawPage = lazy(() => import('./pages/WithdrawPage'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PvpPage = lazy(() => import('./pages/PvpPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const GamesPage = lazy(() => import('./pages/GamesPage'));
const MinesPage = lazy(() => import('./pages/MinesPage'));
const SlotPage = lazy(() => import('./pages/SlotPage'));
const PromotePage = lazy(() => import('./pages/PromotePage'));
const OnlyTaskPage = lazy(() => import('./pages/OnlyTaskPage'));
const FeaturedTaskPage = lazy(() => import('./pages/FeaturedTaskPage'));
const CollaborationPage = lazy(() => import('./pages/CollaborationPage'));

// Lightweight loading component
const PageLoader = () => (
  <div style={{
    height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: '20px'
  }}>
    <div className="skeleton-base" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
    <div className="font-gaming" style={{ fontSize: '0.8rem', opacity: 0.5, letterSpacing: '2px' }}>LOADING...</div>
  </div>
);

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { background, cssVars } = getPageTheme(location.pathname);
  const { apiBase, maintenanceMode, adminIds } = useConfig();
  const { user, writeAccessGranted, loading } = useUser();
  const tg = window.Telegram?.WebApp;
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDailyStreak, setShowDailyStreak] = useState(false);
  const [showLoading, setShowLoading] = useState(() => {
    // Only show loading on initial app entry, not on page changes
    return !sessionStorage.getItem('earn_fest_loaded');
  });

  const handleLoadingFinish = useCallback(() => {
    sessionStorage.setItem('earn_fest_loaded', 'true');
    setShowLoading(false);
  }, []);

  const isAdmin = user && adminIds.includes(user.telegramId.toString());
  const isMaintenance = maintenanceMode && !isAdmin;

  useEffect(() => {
    AdsClient.startInactivityWatcher();
  }, []);

  // Show tutorial on first visit (after user is loaded and write access granted)
  useEffect(() => {
    if (user && writeAccessGranted && !loading) {
      const tutorialDone = localStorage.getItem(TUTORIAL_KEY);
      if (!tutorialDone) {
        // Small delay to let UI render first
        const timer = setTimeout(() => setShowTutorial(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, writeAccessGranted, loading]);

  // Show daily streak modal after tutorial (or immediately if tutorial already done)
  useEffect(() => {
    if (user && writeAccessGranted && !loading) {
      const tutorialDone = localStorage.getItem(TUTORIAL_KEY);
      // Only show streak modal if tutorial is done (or was already done)
      if (tutorialDone) {
        // Check if user already booked today
        const checkStreak = async () => {
          try {
            const headers = {};
            if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'https://eidfest.up.railway.app'}/api/user/streak/${user.telegramId}`, { headers });
            if (!res.data.alreadyBookedToday) {
              // Small delay to let UI render first
              setTimeout(() => setShowDailyStreak(true), 800);
            }
          } catch (e) {
            console.error('Streak check error:', e);
          }
        };
        checkStreak();
      }
    }
  }, [user, writeAccessGranted, loading]);

  // Telegram Deep Linking (startapp)
  useEffect(() => {
    if (user && tg?.initDataUnsafe?.start_param) {
      if (sessionStorage.getItem('startParamProcessed')) return;
      sessionStorage.setItem('startParamProcessed', 'true');

      const param = tg.initDataUnsafe.start_param.toLowerCase();
      switch (param) {
        case 'tasks': navigate('/tasks'); break;
        case 'ranks': navigate('/leaderboard'); break;
        case 'tiers': navigate('/upgrade'); break;
        case 'spin': navigate('/spin'); break;
        case 'mines': navigate('/mines'); break;
        case 'games': navigate('/games'); break;
        case 'watch': navigate('/tasks'); break;
        case 'pvp': navigate('/pvp'); break;
        case 'profile': navigate('/profile'); break;
        case 'slots': navigate('/slots'); break;
        case 'withdraw': navigate('/withdraw?tab=withdraw'); break;
        case 'deposit': navigate('/withdraw?tab=deposit'); break;
        default: break;
      }
    }
  }, [user, navigate, tg]);

  // Standardized Telegram Back Button Logic
  useEffect(() => {
    if (!tg) return;

    if (location.pathname === '/' || location.pathname === '/admin') {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
    }

    const handleBack = () => {
      // Small delay to prevent double-navigation in some environments
      navigate(-1);
    };

    tg.BackButton.onClick(handleBack);
    return () => tg.BackButton.offClick(handleBack);
  }, [location.pathname, navigate, tg]);

  const hideNavbarRoutes = ['/spin', '/withdraw', '/upgrade', '/mines'];
  const showNavbar = !hideNavbarRoutes.includes(location.pathname) && !isMaintenance;

  // --- Ban System Interceptor ---
  const [banRemaining, setBanRemaining] = useState('');
  const isBanned = user?.ban?.isBanned;

  useEffect(() => {
    if (!isBanned || user.ban.until === 'lifetime') return;

    const interval = setInterval(() => {
      const diff = new Date(user.ban.until) - new Date();
      if (diff <= 0) {
        setBanRemaining('Ban Expired! Please refresh.');
        clearInterval(interval);
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setBanRemaining(`${d}d ${h}h ${m}m ${s}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isBanned, user?.ban?.until]);

  if (isBanned) {
    const isLifetime = user.ban.until === 'lifetime';
    const hasExpired = !isLifetime && new Date(user.ban.until) <= new Date();

    if (!hasExpired) {
      return (
        <div style={{ height: '100vh', width: '100vw', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '50%', padding: '20px', marginBottom: '24px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
          </div>
          <h1 style={{ color: '#e74c3c', fontSize: '2rem', fontWeight: '900', marginBottom: '16px', fontFamily: 'var(--font-gaming)' }}>ACCOUNT BANNED</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', marginBottom: '32px', maxWidth: '300px', lineHeight: '1.5' }}>
            Your access to Earn Fest has been revoked.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '350px', marginBottom: '24px' }}>
            <div style={{ opacity: 0.5, fontSize: '0.8rem', marginBottom: '8px' }}>REASON</div>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '20px' }}>{user.ban.reason || 'Violation of Terms of Service'}</div>

            <div style={{ opacity: 0.5, fontSize: '0.8rem', marginBottom: '8px' }}>DURATION</div>
            {isLifetime ? (
              <div style={{ color: '#e74c3c', fontWeight: '900', fontSize: '1.2rem', letterSpacing: '2px' }}>PERMANENT</div>
            ) : (
              <div style={{ color: '#f1c40f', fontWeight: '900', fontSize: '1.2rem', fontFamily: 'monospace' }}>{banRemaining || 'Calculating...'}</div>
            )}
          </div>

          <button onClick={() => window.Telegram?.WebApp?.close()} style={{ background: '#e74c3c', border: 'none', color: 'white', fontWeight: '900', padding: '16px 32px', borderRadius: '12px', fontSize: '1rem', width: '100%', maxWidth: '350px' }}>
            Close App
          </button>
        </div>
      );
    }
  }

  if (isMaintenance) {
    return <Suspense fallback={<PageLoader />}><MaintenancePage /></Suspense>;
  }

  // --- Mandatory Permission Guard (check localStorage first) ---
  const hasStoredAccess = localStorage.getItem('earn_fest_write_access') === 'true';
  if (!writeAccessGranted && !hasStoredAccess && !loading && user) {
    return (
      <div style={{ 
        height: '100vh', width: '100vw', background: '#001a10', 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        padding: '30px', textAlign: 'center', position: 'relative', overflow: 'hidden' 
      }}>
        <div className="star-field" />
        <div style={{ 
          background: 'rgba(241, 196, 15, 0.1)', border: '1px solid var(--primary-gold)', 
          borderRadius: '24px', padding: '24px', marginBottom: '24px', zIndex: 1,
          boxShadow: '0 0 30px rgba(241, 196, 15, 0.1)'
        }}>
          <ShieldAlert width="48" height="48" color="var(--primary-gold)" />
        </div>
        
        <h1 className="game-title" style={{ color: 'var(--primary-gold)', fontSize: '1.8rem', marginBottom: '16px', zIndex: 1 }}>
          PERMISSION REQUIRED
        </h1>
        
        <p className="font-gaming" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '32px', maxWidth: '300px', lineHeight: '1.6', zIndex: 1 }}>
          To ensure you receive important rewards and updates, we need your permission to send messages to your Telegram account.
        </p>

        <div style={{ 
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '350px', marginBottom: '32px', zIndex: 1 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
            <div style={{ background: 'rgba(0,212,255,0.1)', borderRadius: '10px', padding: '8px' }}>
              <MessageSquare size={20} color="#00d4ff" />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>Messaging Access</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>Required for rewards notifications</div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => window.Telegram?.WebApp?.requestWriteAccess()} 
          style={{ 
            background: 'linear-gradient(135deg, var(--primary-gold), #d4af37)', 
            border: 'none', color: '#000', fontWeight: '900', 
            padding: '18px 32px', borderRadius: '16px', fontSize: '1rem', 
            width: '100%', maxWidth: '350px', cursor: 'pointer',
            boxShadow: '0 10px 20px rgba(0,0,0,0.3)', zIndex: 1,
            textTransform: 'uppercase', letterSpacing: '1px'
          }}
        >
          Grant Permission
        </button>
        
        <p 
          onClick={() => window.Telegram?.WebApp?.close()}
          style={{ marginTop: '20px', fontSize: '0.75rem', opacity: 0.4, cursor: 'pointer', textDecoration: 'underline', zIndex: 1 }}
        >
          Exit Application
        </p>
      </div>
    );
  }

  // Show loading page on initial entry (min 5s, then network-dependent)
  if (showLoading) {
    return <LoadingPage onFinish={handleLoadingFinish} apiBase={apiBase} />;
  }

  return (
    <div
      className="app-container page-themed"
      style={{
        ...cssVars,
        background,
        backgroundColor: '#001f11',
      }}
    >
      <div className="star-field" />
      <main className="main-content">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/mines" element={<MinesPage />} />
            <Route path="/spin" element={<SpinWheel />} />
            <Route path="/slots" element={<SlotPage />} />
            <Route path="/refer" element={<ReferralPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/upgrade" element={<UpgradePage />} />
            <Route path="/withdraw" element={<WithdrawPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/pvp" element={<PvpPage />} />
            <Route path="/promote" element={<PromotePage />} />
            <Route path="/promote/only-task" element={<OnlyTaskPage />} />
            <Route path="/promote/featured" element={<FeaturedTaskPage />} />
            <Route path="/promote/collaboration" element={<CollaborationPage />} />
          </Routes>
        </Suspense>
      </main>
      {showNavbar && <Navbar />}
      {showTutorial && (
        <AppTutorial onComplete={() => {
          setShowTutorial(false);
          // After tutorial completes, check and show daily streak
          const checkStreakAfterTutorial = async () => {
            try {
              const headers = {};
              if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
              const res = await axios.get(`${import.meta.env.VITE_API_URL || 'https://eidfest.up.railway.app'}/api/user/streak/${user.telegramId}`, { headers });
              if (!res.data.alreadyBookedToday) {
                setTimeout(() => setShowDailyStreak(true), 500);
              }
            } catch (e) {
              console.error('Streak check error:', e);
            }
          };
          checkStreakAfterTutorial();
        }} />
      )}
      {showDailyStreak && (
        <DailyStreakModal onClose={() => setShowDailyStreak(false)} />
      )}
    </div>
  );
}

import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';

function App() {
  return (
    <Router>
      <Toaster
        theme="dark"
        position="top-center"
        expand={true}
        richColors
        duration={3000}
        toastOptions={{
          style: {
            background: 'rgba(0, 46, 26, 0.9)',
            border: '1px solid var(--primary-gold)',
            color: '#fff',
            fontFamily: 'var(--font-gaming)'
          }
        }}
      />
      <MotionConfig transition={{ duration: 0 }}>
        <AppShell />
      </MotionConfig>
    </Router>
  );
}

export default App;
