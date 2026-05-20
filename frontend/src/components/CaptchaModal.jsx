import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import './CaptchaModal.css';

/**
 * CaptchaModal Component
 * Displays a swappable captcha (puzzle verification) after 4-5 ad views
 * Prevents automated bot abuse by requiring human interaction
 */
const CaptchaModal = ({ isOpen, onClose, onCaptchaSolved }) => {
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [correctTiles, setCorrectTiles] = useState([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');
  const [captchaType, setCaptchaType] = useState('puzzle');

  // Generate random puzzle on mount or when refreshing
  useEffect(() => {
    if (isOpen && !isComplete) {
      generateNewPuzzle();
      setError('');
    }
  }, [isOpen, isComplete]);

  const generateNewPuzzle = () => {
    // Generate random correct tiles (3-4 tiles out of 9)
    const count = Math.floor(Math.random() * 2) + 3; // 3 or 4
    const tiles = Array.from({ length: 9 }, (_, i) => i);
    const shuffled = tiles.sort(() => Math.random() - 0.5);
    const correct = shuffled.slice(0, count);
    setCorrectTiles(correct);
    setSelectedTiles([]);
    setIsComplete(false);
  };

  const handleTileClick = (index) => {
    if (isComplete) return;

    setSelectedTiles((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
    setError('');
  };

  const handleRefresh = () => {
    generateNewPuzzle();
  };

  const handleVerify = async () => {
    // Verify if selected tiles match the correct ones
    if (selectedTiles.length !== correctTiles.length) {
      setError(`Please select exactly ${correctTiles.length} tiles`);
      return;
    }

    const isCorrect = 
      selectedTiles.every((i) => correctTiles.includes(i)) &&
      correctTiles.every((i) => selectedTiles.includes(i));

    if (!isCorrect) {
      setError('Incorrect selection. Please try again.');
      generateNewPuzzle();
      return;
    }

    // Correct answer - verify on backend
    setIsVerifying(true);
    try {
      const response = await fetch('/api/user/verify-captcha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({
          captchaToken: generateCaptchaToken(),
          captchaType: captchaType,
        }),
      });

      if (response.ok) {
        console.log('[Captcha] Verified successfully');
        setIsComplete(true);
        setTimeout(() => {
          onCaptchaSolved?.();
          onClose();
        }, 1000);
      } else {
        setError('Verification failed. Please try again.');
        generateNewPuzzle();
      }
    } catch (error) {
      console.error('[Captcha] Verification error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const generateCaptchaToken = () => {
    return `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="captcha-overlay">
      <motion.div
        className="captcha-modal"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
      >
        <button
          className="captcha-close"
          onClick={() => !isComplete && onClose()}
          disabled={isComplete}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="captcha-header">
          <div className="captcha-icon-wrapper">
            <Lock size={40} className="captcha-icon" />
          </div>
          <h2 className="captcha-title">Security Verification</h2>
          <p className="captcha-subtitle">Select all matching tiles to continue</p>
        </div>

        {!isComplete ? (
          <div className="captcha-content">
            <div className="captcha-instruction">
              <AlertCircle size={20} className="instruction-icon" />
              <span>Click all tiles matching the highlighted pattern</span>
            </div>

            <div className="puzzle-grid">
              {Array.from({ length: 9 }).map((_, index) => (
                <motion.button
                  key={index}
                  className={`puzzle-tile ${selectedTiles.includes(index) ? 'selected' : ''}`}
                  onClick={() => handleTileClick(index)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isVerifying}
                >
                  <motion.div
                    className="tile-content"
                    animate={selectedTiles.includes(index) ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  >
                    {selectedTiles.includes(index) && <CheckCircle size={24} />}
                  </motion.div>
                </motion.button>
              ))}
            </div>

            {error && (
              <motion.div
                className="captcha-error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                ⚠️ {error}
              </motion.div>
            )}

            <div className="selected-count">
              Selected: <strong>{selectedTiles.length}</strong> / <strong>{correctTiles.length}</strong> tiles
            </div>

            <div className="captcha-actions">
              <motion.button
                className="captcha-refresh-btn"
                onClick={handleRefresh}
                disabled={isVerifying}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw size={18} />
                Refresh
              </motion.button>

              <motion.button
                className="captcha-verify-btn"
                onClick={handleVerify}
                disabled={isVerifying || selectedTiles.length === 0}
                whileTap={{ scale: 0.95 }}
              >
                {isVerifying ? (
                  <>
                    <motion.div className="spinner" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Verify
                  </>
                )}
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="captcha-success">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <CheckCircle size={64} className="success-icon" />
            </motion.div>
            <h3 className="success-message">Verified!</h3>
            <p className="success-subtitle">You can now continue watching ads</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CaptchaModal;
