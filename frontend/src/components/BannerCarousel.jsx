import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const BANNERS = [
  { image: '/RankBanner.jpg', path: '/leaderboard' },
];

const BannerCarousel = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const intervalRef = useRef(null);

  const total = BANNERS.length;

  const goTo = useCallback((index) => {
    setCurrent((index + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    goTo(current + 1);
  }, [current, goTo]);

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(goNext, 4000);
  }, [goNext]);

  useEffect(() => {
    resetInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [resetInterval]);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      resetInterval();
      return;
    }
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goTo(current + 1);
      } else {
        goTo(current - 1);
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
    resetInterval();
  };

  const handleClick = () => {
    navigate(BANNERS[current].path);
  };

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          cursor: 'pointer',
          lineHeight: 0,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'pan-y',
          border: '2px solid rgb(28, 67, 26)',
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={BANNERS[current].image}
          alt={`Banner ${current + 1}`}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            transition: 'opacity 0.4s ease'
          }}
          draggable={false}
        />
      </div>

      {/* Dots */}
      {total > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '10px'
          }}
        >
          {BANNERS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goTo(i);
                resetInterval();
              }}
              style={{
                width: i === current ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                border: 'none',
                background: i === current
                  ? 'var(--primary-gold, #d4af37)'
                  : 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0
              }}
              aria-label={`Go to banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;