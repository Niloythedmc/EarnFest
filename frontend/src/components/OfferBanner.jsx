import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OfferBanner = ({ offer }) => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!offer?.endTime) return;

    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(offer.endTime).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeLeft('Expired');
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [offer]);

  if (!offer) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{ 
        width: '100%', 
        height: '70px', 
        margin: '0 auto 20px auto', 
        background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(212, 175, 55, 0.05) 100%)',
        border: '1px solid rgba(212, 175, 55, 0.5)', 
        borderRadius: '16px', 
        display: 'flex', 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 20px',
        boxShadow: 'none',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer'
      }}
      onClick={() => navigate('/withdraw')}
    >
      <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '80px', height: '80px', background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)', filter: 'blur(10px)' }}></div>
      <div style={{ position: 'absolute', top: '10px', right: '40%', opacity: 0.5 }}><Zap size={14} className="gold-text" /></div>
      <div style={{ position: 'absolute', bottom: '15px', left: '40%', opacity: 0.3 }}><Zap size={18} className="gold-text" /></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-gold)', fontWeight: '900', fontSize: '0.9rem', letterSpacing: '0.5px', textShadow: 'none', zIndex: 1, textAlign: 'left' }}>
        <Zap size={20} fill="var(--primary-gold)" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>HOT OFFER!</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '-2px' }}>Lower withdrawals</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.35)', padding: '6px 12px', borderRadius: '14px', border: '1px solid rgba(212,175,55,0.25)', zIndex: 1, backdropFilter: 'blur(5px)' }}>
        <Clock size={14} className="gold-text" />
        <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#fff', letterSpacing: '1px' }}>
          {timeLeft}
        </span>
      </div>
    </motion.div>
  );
};

export default OfferBanner;
