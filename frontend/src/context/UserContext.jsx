/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useConfig } from './ConfigContext';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [writeAccessGranted, setWriteAccessGranted] = useState(() => {
    // Check localStorage first to avoid re-asking
    return localStorage.getItem('earn_fest_write_access') === 'true';
  });
  const { apiBase } = useConfig();

  useEffect(() => {
    const initApp = async () => {
      console.log('Initializing App...');
      try {
        const tg = window.Telegram?.WebApp;
        if (tg && tg.initData) {
          console.log('Telegram WebApp detected');
          tg.ready();
          tg.expand();
          if (tg.requestFullscreen) {
            try {
              tg.requestFullscreen();
            } catch (e) {
              console.warn('Fullscreen request failed:', e);
            }
          }
          
          const initData = tg.initData;
          const userRaw = tg.initDataUnsafe?.user;

          if (userRaw) {
            console.log('Syncing user:', userRaw.id);
            const response = await axios.post(`${apiBase}/api/user/sync`, {
              telegramId: userRaw.id,
              username: userRaw.username,
              firstName: userRaw.first_name,
              photoUrl: userRaw.photo_url,
              referralCode: tg.initDataUnsafe.start_param
            }, {
              headers: { 'x-telegram-init-data': initData }
            });

            setUser(response.data);
            console.log('User synced successfully');

            // --- Mandatory Message Permission Check ---
            const storedAccess = localStorage.getItem('earn_fest_write_access');
            if (storedAccess === 'true') {
              setWriteAccessGranted(true);
            } else if (!userRaw.allows_write_to_pm) {
              console.log('Write access missing, requesting...');
              setWriteAccessGranted(false);
              tg.requestWriteAccess((allowed) => {
                console.log('Write access request result:', allowed);
                setWriteAccessGranted(allowed);
                if (allowed) {
                  localStorage.setItem('earn_fest_write_access', 'true');
                }
              });
            } else {
              setWriteAccessGranted(true);
              localStorage.setItem('earn_fest_write_access', 'true');
            }
          }
        } else {
          console.log('No Telegram WebApp, using dev fallback');
          if (import.meta.env.PROD) {
            throw new Error('Telegram environment missing in production');
          }
          // Fallback for dev - Ensure this ALWAYS sets a user
          setUser({
            telegramId: '123456789',
            username: 'DevUser',
            firstName: 'Eid',
            balance: 10.50,
            tier: 'gold',
            adsCountToday: 5,
            referralCode: 'EIDTEST',
            photoUrl: ''
          });
        }
      } catch (error) {
        console.error('Initialization failed:', error.message);
        
        // In production, we should show a real error to the user via UI, 
        // but for now we set a guest user that lacks full functionality 
        // to prevent white screen, while logging the error.
        if (import.meta.env.PROD) {
          // In production, we MUST NOT set a guest user on sync failure 
          // because it prevents the user from retrying a real login.
          // Instead, we let it fall through to setLoading(false) with user=null
          // and the App.jsx should handle the unauthorized state.
          console.error('Critical: Sync failed in production');
        } else {
          setUser({
            telegramId: 'err_fallback',
            username: 'Guest',
            firstName: 'Guest',
            balance: 0,
            tier: 'basic'
          });
        }
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, [apiBase]);

  const refreshUser = async () => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !user) return;
    
    try {
      const response = await axios.post(`${apiBase}/api/user/sync`, {
        telegramId: user.telegramId
      }, {
        headers: { 'x-telegram-init-data': tg.initData }
      });
      setUser(response.data);
    } catch (refreshError) {
       console.error('Refresh failed', refreshError);
    }
  };

  const trackSpinAdView = async () => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !user) return;

    try {
      const response = await axios.post(`${apiBase}/api/user/spin-ad-view`, {
        telegramId: user.telegramId
      }, {
        headers: { 'x-telegram-init-data': tg.initData }
      });

      if (response.data?.success) {
        setUser((prev) => prev ? { ...prev, spinAdViews: response.data.spinAdViews } : prev);
      }
    } catch (error) {
      console.error('Spin ad view tracking failed', error.response?.data || error.message);
    }
  };

  const addReward = async (type, amountFallback = 0, deviceInfo = null) => {
    const tg = window.Telegram?.WebApp;
    if (!user) return { success: false };

    try {
      const payload = {
        telegramId: user.telegramId,
        type,
      };

      // Add device fingerprint if provided
      if (deviceInfo && deviceInfo.deviceFingerprint) {
        payload.deviceFingerprint = deviceInfo.deviceFingerprint;
      }

      const response = await axios.post(`${apiBase}/api/user/reward`, payload, {
        headers: { 'x-telegram-init-data': tg?.initData },
      });

      if (response.data.success) {
        setUser((prev) => ({
          ...prev,
          balance: response.data.newBalance,
          adsCountToday: type === 'ad' ? prev.adsCountToday + 1 : prev.adsCountToday,
          adCycleCount: type === 'ad' ? response.data.adCycleCount : prev.adCycleCount,
          lastAdCycleResetAt: type === 'ad' ? response.data.lastAdCycleResetAt : prev.lastAdCycleResetAt,
        }));
        
        // Return anti-autoclicker info if available
        return { 
          success: true,
          antiAutoclicker: response.data.antiAutoclicker
        };
      }
      return { success: false };
    } catch (error) {
      console.error('Reward failed', error.response?.data || error.message);
      const data = error.response?.data;
      const status = error.response?.status;
      const isMembershipRequired =
        data?.code === 'membership_required' ||
        data === 'MEMBERSHIP_REQUIRED' ||
        data?.error === 'MEMBERSHIP_REQUIRED';

      if (status === 403 && isMembershipRequired) {
        return {
          success: false,
          membershipRequired: true,
          missing: Array.isArray(data?.missing) ? data.missing : [],
        };
      }
      if (!import.meta.env.PROD && amountFallback) {
        setUser((prev) => ({ ...prev, balance: prev.balance + amountFallback }));
        return { success: true };
      }
      return { success: false };
    }
  };

  const playSpin = async () => {
    const tg = window.Telegram?.WebApp;
    if (!user) return { success: false, error: 'User not found' };

    try {
      const response = await axios.post(`${apiBase}/api/user/spin`, {
        telegramId: user.telegramId
      }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });
      
      if (response.data.success) {
        setUser(prev => ({ 
          ...prev, 
          balance: response.data.newBalance
        }));
        return { success: true, prize: response.data.prize };
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Spin failed';
      return { success: false, error: errorMsg };
    }
  };

  // Pool-based spin game (fixed 100 $FEST cost)
  const playSpinGame = async () => {
    const tg = window.Telegram?.WebApp;
    if (!user) return { success: false, error: 'User not found' };

    try {
      const response = await axios.post(`${apiBase}/api/user/spin-game`, {}, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });
      
      if (response.data.success) {
        setUser(prev => ({ 
          ...prev, 
          balance: response.data.newBalance
        }));
        return {
          success: true,
          reward: response.data.reward,
          poolAmount: response.data.poolAmount,
          isWin: response.data.isWin,
          winningSegmentAngle: response.data.winningSegmentAngle,
          rewardIndex: response.data.rewardIndex,
          costPerSpin: response.data.costPerSpin
        };
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Spin failed';
      return { success: false, error: errorMsg };
    }
  };

  const playSlotGame = async (bet) => {
    const tg = window.Telegram?.WebApp;
    if (!user) return { success: false, error: 'User not found' };

    try {
      const response = await axios.post(`${apiBase}/api/user/slot-game`, { bet }, {
        headers: { 'x-telegram-init-data': tg?.initData }
      });
      
      if (response.data.success) {
        setUser(prev => ({ 
          ...prev, 
          balance: response.data.newBalance
        }));
        return {
          success: true,
          payout: response.data.payout,
          netGain: response.data.netGain,
          reels: response.data.reels
        };
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Slot failed';
      return { success: false, error: errorMsg };
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, setUser, loading, writeAccessGranted, refreshUser, addReward, playSpin, playSpinGame, playSlotGame, trackSpinAdView
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
