import { useState, useEffect, useCallback, useRef } from 'react';

const TUTORIAL_KEY = 'earn_fest_tutorial_done';

const STEPS = [
  {
    title: 'Welcome to Earn Fest!',
    description: 'Complete tasks, play games, and earn $FEST tokens. Let\'s take a quick tour!',
    selector: null,
    position: 'center',
  },
  {
    title: 'Navigation Bar',
    description: 'Use the bottom nav to quickly jump between Home, Tasks, Games, Rank, and Refer pages.',
    selector: '.navbar',
    position: 'above',
  },
  {
    title: 'Profile Menu',
    description: 'Tap your profile picture to access Profile, Language, Upgrade, and Wallet options.',
    selector: '[data-tutorial="profile-pic"]',
    position: 'below',
  },
  {
    title: 'Earn $FEST',
    description: 'Complete tasks and watch ads to earn $FEST tokens. Check the Tasks page for available tasks.',
    selector: '[data-tutorial="tasks"]',
    position: 'above',
  },
  {
    title: 'Watch Ads',
    description: 'Watch rewarded ads to earn bonus $FEST. Ads appear periodically on the Tasks page.',
    selector: '[data-tutorial="ads"]',
    position: 'above',
  },
  {
    title: 'Play Games',
    description: 'Try Spin Wheel, Mines, and Slots to win big prizes from the prize pool!',
    selector: '[data-tutorial="games"]',
    position: 'above',
  },
  {
    title: 'Leaderboard & Referrals',
    description: 'Compete on the leaderboard and invite friends to earn referral commissions.',
    selector: '[data-tutorial="rank-refer"]',
    position: 'above',
  },
  {
    title: 'Upgrade Your Tier',
    description: 'Upgrade your tier for better rewards, higher withdrawal limits, and exclusive perks.',
    selector: '[data-tutorial="upgrade"]',
    position: 'below',
  },
  {
    title: 'Withdraw Earnings',
    description: 'Once you\'ve earned enough, withdraw your $FEST tokens to your wallet.',
    selector: '[data-tutorial="wallet"]',
    position: 'below',
  },
  {
    title: 'You\'re All Set!',
    description: 'Start earning now. Good luck! 🎉',
    selector: null,
    position: 'center',
  },
];

const AppTutorial = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [highlightRect, setHighlightRect] = useState(null);
  const cardRef = useRef(null);

  const current = STEPS[step];

  const getElementRect = useCallback((selector) => {
    if (!selector) return null;
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return rect;
  }, []);

  useEffect(() => {
    // Small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      const rect = getElementRect(current.selector);
      setHighlightRect(rect);
    }, 100);
    return () => clearTimeout(timer);
  }, [step, current.selector, getElementRect]);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleSkip();
    }
  }, [step]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setVisible(false);
    onComplete();
  }, [onComplete]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  if (!visible) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  // Calculate card position based on highlighted element
  const getCardStyle = () => {
    if (current.position === 'center' || !highlightRect) {
      return {
        position: 'fixed',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }

    if (current.position === 'above') {
      // Position above the highlighted element
      const top = highlightRect.top - 20;
      const left = Math.max(10, Math.min(window.innerWidth - 380, highlightRect.left + highlightRect.width / 2 - 180));
      return {
        position: 'fixed',
        top: `${Math.max(10, top - 280)}px`,
        left: `${left}px`,
      };
    }

    if (current.position === 'below') {
      // Position below the highlighted element
      const top = highlightRect.bottom + 16;
      const left = Math.max(10, Math.min(window.innerWidth - 380, highlightRect.left + highlightRect.width / 2 - 180));
      return {
        position: 'fixed',
        top: `${Math.min(window.innerHeight - 310, top)}px`,
        left: `${left}px`,
      };
    }

    return {
      position: 'fixed',
      bottom: '120px',
      left: '50%',
      transform: 'translateX(-50%)',
    };
  };

  return (
    <>
      {/* Overlay with highlight cutout */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          pointerEvents: 'none',
        }}
      >
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              {highlightRect && (
                <rect
                  x={highlightRect.left}
                  y={highlightRect.top}
                  width={highlightRect.width}
                  height={highlightRect.height}
                  fill="black"
                  rx="12"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.75)"
            mask="url(#tutorial-mask)"
          />
        </svg>
      </div>

      {/* Highlighted element glow ring */}
      {highlightRect && (
        <div
          style={{
            position: 'fixed',
            top: highlightRect.top - 4,
            left: highlightRect.left - 4,
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
            borderRadius: '16px',
            border: '2px solid var(--primary-gold, #d4af37)',
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.4), 0 0 40px rgba(212, 175, 55, 0.15)',
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'tutorialGlow 1.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Tutorial Card */}
      <div
        ref={cardRef}
        style={{
          ...getCardStyle(),
          width: '88%',
          maxWidth: '360px',
          background: 'rgba(10, 25, 18, 0.98)',
          border: '1px solid rgba(255, 215, 0, 0.25)',
          borderRadius: '24px',
          padding: '24px 20px 18px',
          zIndex: 9999,
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          textAlign: 'center',
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '14px' }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? '24px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === step ? 'var(--primary-gold, #d4af37)' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255, 215, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
            fontSize: '1.2rem',
          }}
        >
          {step === 0 ? '👋' :
           step === 1 ? '🧭' :
           step === 2 ? '👤' :
           step === 3 ? '💰' :
           step === 4 ? '📺' :
           step === 5 ? '🎮' :
           step === 6 ? '🏆' :
           step === 7 ? '⬆️' :
           step === 8 ? '💳' : '🎉'}
        </div>

        {/* Title */}
        <h3
          className="game-title"
          style={{
            fontSize: '1.1rem',
            color: 'var(--primary-gold, #d4af37)',
            marginBottom: '6px',
          }}
        >
          {current.title}
        </h3>

        {/* Description */}
        <p
          className="font-gaming"
          style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: '1.5',
            marginBottom: '16px',
          }}
        >
          {current.description}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isFirst && (
            <button
              onClick={handlePrev}
              style={{
                flex: 1,
                height: '40px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={isLast ? handleSkip : handleNext}
            style={{
              flex: 1,
              height: '40px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--primary-gold, #d4af37)',
              color: '#000',
              fontSize: '0.75rem',
              fontWeight: '900',
              cursor: 'pointer',
            }}
          >
            {isLast ? 'Finish' : isFirst ? 'Start Tour' : 'Next'}
          </button>
        </div>

        {/* Skip link */}
        {!isFirst && !isLast && (
          <button
            onClick={handleSkip}
            style={{
              marginTop: '10px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.65rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Skip Tutorial
          </button>
        )}
      </div>

      <style>{`
        @keyframes tutorialGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.4), 0 0 40px rgba(212, 175, 55, 0.15); }
          50% { box-shadow: 0 0 30px rgba(212, 175, 55, 0.6), 0 0 60px rgba(212, 175, 55, 0.25); }
        }
      `}</style>
    </>
  );
};

export default AppTutorial;
export { TUTORIAL_KEY };