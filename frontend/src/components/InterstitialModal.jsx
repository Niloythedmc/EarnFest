import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
import './InterstitialModal.css';

/**
 * InterstitialModal Component
 * Displays a non-skippable ad interstitial that appears randomly after rewarded ads
 * Prevents autoclicker abuse by introducing unpredictability
 */
const InterstitialModal = ({ isOpen, onClose, sessionId, onInterstitialComplete }) => {
  const [showCountdown, setShowCountdown] = useState(true);
  const [countdownTime, setCountdownTime] = useState(3);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowCountdown(true);
      setCountdownTime(3);
      setIsCompleted(false);
      return;
    }

    const interval = setInterval(() => {
      setCountdownTime((prev) => {
        if (prev <= 1) {
          setShowCountdown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleComplete = async () => {
    setIsCompleted(true);
    
    // Verify interstitial session on backend
    try {
      const response = await fetch('/api/user/verify-interstitial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (response.ok) {
        console.log('[Interstitial] Verified successfully');
        setTimeout(() => {
          onInterstitialComplete?.();
          onClose();
        }, 800);
      } else {
        console.warn('[Interstitial] Verification failed');
        onClose();
      }
    } catch (error) {
      console.error('[Interstitial] Verification error:', error);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="interstitial-overlay">
      <motion.div
        className="interstitial-modal"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
      >
        <div className="interstitial-header">
          <div className="interstitial-icon-wrapper">
            <AlertCircle size={48} className="interstitial-icon" />
          </div>
          <h2 className="interstitial-title">Verification Required</h2>
          <p className="interstitial-subtitle">
            Please wait a moment while we verify your activity
          </p>
        </div>

        <div className="interstitial-content">
          {showCountdown ? (
            <div className="countdown-container">
              <motion.div
                className="countdown-circle"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <span className="countdown-number">{countdownTime}</span>
              </motion.div>
              <p className="countdown-text">Loading verification...</p>
            </div>
          ) : (
            <div className="verification-complete">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <CheckCircle size={64} className="success-icon" />
              </motion.div>
              <p className="verification-message">
                You can now continue watching ads
              </p>
            </div>
          )}
        </div>

        <div className="interstitial-footer">
          {!showCountdown && !isCompleted && (
            <motion.button
              className="interstitial-button"
              onClick={handleComplete}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Continue
            </motion.button>
          )}
          {isCompleted && (
            <motion.div
              className="interstitial-success"
              animate={{ opacity: [0.5, 1] }}
              transition={{ duration: 0.5 }}
            >
              <CheckCircle size={24} />
              <span>Verified</span>
            </motion.div>
          )}
        </div>

        {/* Cannot close during countdown or completion */}
        {showCountdown && (
          <div className="interstitial-warning">
            ⚠️ This window cannot be closed. Please wait.
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default InterstitialModal;
