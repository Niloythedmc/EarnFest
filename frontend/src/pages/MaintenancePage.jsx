import { motion } from 'framer-motion';
import { Hammer, Sparkles, Clock } from 'lucide-react';

const MaintenancePage = () => {
  return (
    <div className="flex-center stack-vertical" style={{ 
      minHeight: '100vh', 
      padding: '40px 20px', 
      textAlign: 'center',
      background: 'radial-gradient(circle at top right, #1a2e25 0%, #001f11 100%)',
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {/* Colorful Background Circles */}
      {/* Colorful Background Circles */}
      <div 
        style={{ 
          position: 'absolute', top: '-10%', right: '-10%', 
          width: '300px', height: '300px', borderRadius: '50%', 
          background: '#d4af37', filter: 'blur(80px)',
          opacity: 0.2
        }} 
      />
      <div 
        style={{ 
          position: 'absolute', bottom: '-10%', left: '-10%', 
          width: '400px', height: '400px', borderRadius: '50%', 
          background: '#00ff88', filter: 'blur(100px)',
          opacity: 0.1
        }} 
      />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '400px', width: '100%' }}>
        <div
          style={{ 
            width: '120px', height: '120px', borderRadius: '40px', 
            background: 'linear-gradient(135deg, #d4af37 0%, #fcc201 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 40px',
            color: '#001f11'
          }}
        >
          <Hammer size={60} strokeWidth={2.5} />
        </div>

        <div style={{ opacity: 1 }}>
          <h1 className="game-title" style={{ fontSize: '3rem', marginBottom: '20px' }}>
            SYSTEMS<br />UPGRADING
          </h1>
          
          <p className="font-gaming" style={{ 
            fontSize: '0.8rem', 
            color: 'rgba(255,255,255,0.7)', 
            marginBottom: '40px',
            lineHeight: '1.6',
            fontWeight: '600',
            letterSpacing: '2px'
          }}>
            MAINTENANCE IS RUNNING • BACK SOON
          </p>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            padding: '24px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div className="flex-row" style={{ gap: '12px', color: '#00ff88' }}>
              <Sparkles size={20} />
              <span className="font-gaming" style={{ fontWeight: '800', fontSize: '0.7rem', letterSpacing: '1px' }}>VIBRANT NEW FEATURES</span>
            </div>
            <div className="flex-row" style={{ gap: '12px', color: '#fcc201' }}>
              <Clock size={20} />
              <span className="font-gaming" style={{ fontWeight: '800', fontSize: '0.7rem', letterSpacing: '1px' }}>BACK ONLINE SOON</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern floating elements */}

    </div>
  );
};

export default MaintenancePage;
