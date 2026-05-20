import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const TIPS = [
  { type: '💡 Tip', text: 'Complete daily tasks to earn bonus $FEST rewards!' },
  { type: '🔍 Hidden Feature', text: 'You can boost your earnings by upgrading your mining level in the Upgrade page.' },
  { type: '🎯 Tip', text: 'Refer friends to earn 10% of their earnings forever!' },
  { type: '⚡ Hidden Feature', text: 'Spin the wheel daily for a chance to win big $FEST prizes.' },
  { type: '📌 Tip', text: 'Check the Leaderboard to see top earners and compete for rewards.' },
  { type: '🃏 Trick', text: 'Complete tasks faster by keeping the task link open in the background.' },
  { type: '💎 Hidden Feature', text: 'PVP mode lets you battle other players and win their $FEST!' },
  { type: '🎮 Tip', text: 'Play Mines and Slots to multiply your $FEST earnings.' },
  { type: '🔐 Clue', text: 'Some special tasks appear only during events — stay tuned!' },
  { type: '🚀 Tip', text: 'Use the Promote page to feature your own task and earn more.' },
  { type: '⭐ Hidden Feature', text: 'Daily Streak rewards increase the more consecutive days you check in.' },
  { type: '🎲 Trick', text: 'In Mines, start with small bets to learn the pattern before going big.' },
  { type: '📢 Tip', text: 'Join the official Telegram channel for exclusive task drops.' },
  { type: '🏆 Hidden Feature', text: 'Top leaderboard rankers get special bonuses and recognition.' },
  { type: '💡 Clue', text: 'The more you engage, the more hidden features unlock over time.' },
  { type: '⚙️ Trick', text: 'You can withdraw your $FEST earnings once you reach the minimum threshold.' },
  { type: '🎯 Hidden Feature', text: 'Watch ad rewards can be claimed multiple times per day.' },
  { type: '🔮 Tip', text: 'Keep an eye on the banner carousel for limited-time promotions.' },
  { type: '💪 Clue', text: 'Team up with friends in Collaboration tasks for bigger rewards.' },
  { type: '🌟 Tip', text: 'Stay active — inactivity may pause your earning opportunities.' },
];

const LoadingPage = ({ onFinish, isAdmin, apiBase }) => {
  const [currentTip, setCurrentTip] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'ready'
  const [partners, setPartners] = useState([]);

  // Pick a random starting tip
  const startIndex = useMemo(() => Math.floor(Math.random() * TIPS.length), []);

  useEffect(() => {
    setCurrentTip(startIndex);
  }, [startIndex]);

  // Cycle tips every 3 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % TIPS.length);
    }, 3000);
    return () => clearInterval(tipInterval);
  }, []);

  // Progress bar animation (5 seconds minimum)
  useEffect(() => {
    const duration = 5000; // 5 seconds minimum
    const interval = 50; // update every 50ms
    const steps = duration / interval;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const newProgress = Math.min((step / steps) * 100, 100);
      setProgress(newProgress);

      if (step >= steps) {
        clearInterval(timer);
        setPhase('ready');
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  // Fetch partners on mount - use /all endpoint with auth for admins
  useEffect(() => {
    if (!apiBase) return;
    const tg = window.Telegram?.WebApp;
    const partnersUrl = isAdmin ? `${apiBase}/api/partners/all` : `${apiBase}/api/partners`;
    const partnersConfig = isAdmin ? { headers: { 'x-telegram-init-data': tg?.initData } } : {};
    axios.get(partnersUrl, partnersConfig)
      .then(res => {
        if (res.data?.partners) {
          setPartners(res.data.partners);
        }
      })
      .catch(() => {});
  }, [apiBase, isAdmin]);

  // When ready, wait a small extra moment then finish
  useEffect(() => {
    if (phase === 'ready') {
      const finishTimer = setTimeout(() => {
        onFinish();
      }, 500);
      return () => clearTimeout(finishTimer);
    }
  }, [phase, onFinish]);

  const tip = TIPS[currentTip];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(180deg, #001a11 0%, #002618 50%, #001a11 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      {/* Star field background */}
      <div className="star-field" />

      {/* Content container */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '400px',
        padding: '20px',
        flex: 1,
      }}>
        {/* Logo */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid var(--primary-gold)',
          boxShadow: '0 0 40px rgba(212, 175, 55, 0.3), 0 0 80px rgba(212, 175, 55, 0.1)',
          marginBottom: '24px',
          animation: 'pulse-glow 2s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.3)',
        }}>
          <img
            src="/Earnfest.webp"
            alt="EarnFest"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-gaming)',
          fontSize: '2.2rem',
          fontWeight: '900',
          color: 'var(--primary-gold)',
          textAlign: 'center',
          letterSpacing: '3px',
          marginBottom: '8px',
          textShadow: '0 0 20px rgba(212, 175, 55, 0.3)',
        }}>
          EARN $FEST
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: 'var(--font-gaming)',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          marginBottom: '40px',
        }}>
          Loading Experience
        </p>

        {/* Tip Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(212, 175, 55, 0.15)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '32px',
          width: '100%',
          maxWidth: '340px',
          minHeight: '100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transition: 'opacity 0.3s ease',
        }}>
          <div style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            color: 'var(--primary-gold)',
            letterSpacing: '2px',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}>
            {tip.type}
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: '1.5',
            fontFamily: 'var(--font-main)',
          }}>
            {tip.text}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          maxWidth: '340px',
          height: '4px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--primary-gold), #fcc201)',
            borderRadius: '2px',
            transition: 'width 0.05s linear',
            boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)',
          }} />
        </div>

        <p style={{
          fontSize: '0.65rem',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '1px',
        }}>
          {phase === 'ready' ? 'ALMOST THERE...' : 'LOADING...'}
        </p>
      </div>

      {/* Partners Section */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '400px',
        padding: '16px 20px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          textAlign: 'center',
          marginBottom: '12px',
          fontFamily: 'var(--font-gaming)',
        }}>
          Our Partners & Supporters
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}>
          {partners.length > 0 ? (
            partners.map(partner => (
              <div
                key={partner.id}
                onClick={() => window.open(partner.link, '_blank')}
                style={{
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 0 12px rgba(241,196,15,0.15)'
                }}>
                  <img
                    src={partner.imageUrl}
                    alt={partner.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
              Loading partners...
            </p>
          )}
        </div>
      </div>

      {/* Keyframes for pulse animation */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 40px rgba(212, 175, 55, 0.3), 0 0 80px rgba(212, 175, 55, 0.1);
          }
          50% {
            box-shadow: 0 0 60px rgba(212, 175, 55, 0.5), 0 0 100px rgba(212, 175, 55, 0.2);
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingPage;