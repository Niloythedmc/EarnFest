import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';

const WinnerModal = ({ isOpen, winner, winAmount, isMe, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      const canvas = document.getElementById('winner-confetti-canvas');
      if (!canvas) return;

      const myConfetti = confetti.create(canvas, {
        resize: true,
        useWorker: true
      });

      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        myConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        myConfetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  return (
    <>
      {isOpen && (
        <div 
          className="winner-modal-backdrop"
          style={{ opacity: 1 }}
        >
          {/* Dedicated Confetti Canvas */}
          <canvas id="winner-confetti-canvas" className="winner-confetti-canvas" />

          <div 
            className="winner-card"
          >
            <div className="modal-handle" />
            
            <div className="winner-crown">
              <Trophy size={64} strokeWidth={2.5} />
            </div>
            
            <h2 className="winner-title">
              {isMe ? 'YOU WON!' : 'WINNER!'}
            </h2>

            <img 
              src={winner?.photoUrl || 'https://img.icons8.com/isometric/512/user-male-circle.png'} 
              alt="Winner" 
              className="winner-pic-large"
            />

            <div className="winner-name-large">
              {winner?.username}
            </div>

            <div className="win-amount-badge">
              +{(winAmount || 0).toFixed(0)} $FEST
            </div>

            <div className="winner-stats-grid">
               <div className="win-stat-item">
                  <span className="win-stat-label">Investment</span>
                  <span className="win-stat-value">{(winner?.amount || 0).toFixed(0)} $FEST</span>
               </div>
               <div className="win-stat-item">
                  <span className="win-stat-label">Win Chance</span>
                  <span className="win-stat-value">
                    {winAmount > 0 
                      ? ((winner?.amount / (winAmount / 0.95)) * 100).toFixed(0) 
                      : '0.00'}%
                  </span>
               </div>
            </div>

            <p className="text-sm-muted" style={{ marginTop: '15px' }}>
              {isMe ? 'The rewards have been added to your balance.' : 'A new round will start shortly.'}
            </p>

            <button className="btn-primary" onClick={onClose} style={{ marginTop: '15px', height: '48px', width: '100%' }}>
              Awesome!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default WinnerModal;
