import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Zap, Activity } from 'lucide-react';

const GPUAnimation = ({ isActive, tph }) => {
  const rotationSpeed = isActive ? Math.max(0.2, 3 - ((tph || 0) * 5)) : 0;
  
  const particles = React.useMemo(() => {
    // Static values to satisfy purity rules, but slightly varied by index
    return [...Array(6)].map((_, i) => ({
      id: i,
      y: -150 - (i * 10),
      x: (i % 2 === 0 ? 1 : -1) * (i * 15),
      rotate: i * 60,
      duration: 2 + (i * 0.1),
      delay: i * 0.3
    }));
  }, []);

  return (
    <div className="gpu-mega-wrapper">
      <style>{`
        .gpu-mega-wrapper {
          position: relative;
          width: 100%;
          padding: 40px 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .gpu-base {
          width: 320px;
          height: 180px;
          background: #111;
          border-radius: 20px;
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 20px 50px rgba(0,0,0,0.8),
            inset 0 0 20px rgba(6, 182, 212, 0.1);
          overflow: hidden;
          z-index: 2;
        }

        .gpu-shroud {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 15px;
        }

        .heatsink-fins {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          justify-content: center;
          gap: 4px;
          opacity: 0.3;
          pointer-events: none;
        }

        .fin {
          width: 2px;
          height: 100%;
          background: linear-gradient(to bottom, transparent, #333, transparent);
        }

        .fan-module {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: #050505;
          border: 4px solid #1a1a1a;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 0 20px rgba(0,0,0,0.5),
            inset 0 0 10px rgba(34, 211, 238, 0.1);
        }

        .fan-blade-hub {
          width: 100%;
          height: 100%;
          position: relative;
          transition: transform 0.5s ease-out;
        }

        .blade {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 12px;
          height: 40px;
          background: linear-gradient(to bottom, #222, #000);
          border-radius: 6px;
          transform-origin: 50% 0%;
          clip-path: polygon(0% 0%, 100% 0%, 80% 100%, 20% 100%);
        }

        .hub-center {
          position: absolute;
          width: 24px;
          height: 24px;
          background: radial-gradient(circle, #333 0%, #111 100%);
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hub-center::after {
          content: '';
          width: 8px;
          height: 8px;
          background: ${isActive ? '#22d3ee' : '#333'};
          border-radius: 50%;
          box-shadow: ${isActive ? '0 0 10px #22d3ee' : 'none'};
        }

        .glowing-circuits {
          position: absolute;
          top: 10px;
          right: 20px;
          display: flex;
          gap: 6px;
        }

        .circuit-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: ${isActive ? '#22d3ee' : '#333'};
          box-shadow: ${isActive ? '0 0 5px #22d3ee' : 'none'};
        }

        .gpu-badge {
          position: absolute;
          bottom: 15px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.6);
          padding: 4px 12px;
          border-radius: 99px;
          border: 1px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: #22d3ee;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .power-line {
          position: absolute;
          width: 100px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22d3ee, transparent);
          top: 50%;
          left: -50px;
          filter: blur(1px);
        }

        @keyframes fanSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .spinning {
          animation: fanSpin var(--speed) linear infinite;
        }

        .back-glow {
          position: absolute;
          width: 400px;
          height: 250px;
          background: radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, transparent 70%);
          z-index: 1;
        }

        .particle-mega {
          position: absolute;
          font-size: 16px;
          font-weight: 900;
          color: #22d3ee;
          pointer-events: none;
          z-index: 3;
          text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
        }
      `}</style>

      {/* Glow Effect */}
      <div className="back-glow" />

      {/* Glow Effect */}
      <div className="back-glow" />

      <div className="gpu-base">
        <div className="heatsink-fins">
          {[...Array(30)].map((_, i) => <div key={i} className="fin" />)}
        </div>
        
        <div className="gpu-shroud">
          {/* Fan 1 */}
          <div className="fan-module">
            <div className={`fan-blade-hub ${isActive ? 'spinning' : ''}`} style={{ '--speed': `${rotationSpeed}s` }}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <div key={deg} className="blade" style={{ transform: `rotate(${deg}deg)` }} />
              ))}
            </div>
            <div className="hub-center" />
          </div>

          {/* Fan 2 */}
          <div className="fan-module">
            <div className={`fan-blade-hub ${isActive ? 'spinning' : ''}`} style={{ '--speed': `${rotationSpeed}s` }}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <div key={deg} className="blade" style={{ transform: `rotate(${deg}deg)` }} />
              ))}
            </div>
            <div className="hub-center" />
          </div>
        </div>

        <div className="glowing-circuits">
          {[...Array(3)].map((_, i) => (
            <div 
              key={i} 
              className="circuit-dot"
              style={{ opacity: isActive ? 1 : 0.2 }}
            />
          ))}
        </div>

        <div className="gpu-badge">
          <Activity size={10} />
          {isActive ? 'SYSTEM ACTIVE' : 'SYSTEM READY'}
        </div>
        

      </div>
    </div>
  );
};

export default GPUAnimation;
