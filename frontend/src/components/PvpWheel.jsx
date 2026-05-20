import { useMemo, memo } from 'react';

const PvpWheel = ({ players, totalPool, status, winningAngle, countdown }) => {
  const segments = useMemo(() => {
    if (totalPool === 0) return [{ start: 0, size: 360, color: 'rgba(255,255,255,0.05)' }];
    
    // Check if backend provides angles
    const hasBackendAngles = players.length > 0 && players[0].startAngle !== undefined;
    
    if (hasBackendAngles) {
      return players.map(p => ({
        ...p,
        start: p.startAngle,
        size: p.size
      }));
    }

    // Fallback: local calculation if backend hasn't updated yet
    let cumulative = 0;
    return players.map(p => {
      const start = cumulative;
      const size = (p.amount / totalPool) * 360;
      cumulative += size;
      return { ...p, start, size };
    });
  }, [players, totalPool]);

  // Generate SVG path for a segment
  const getPath = (startAngle, size) => {
    if (size >= 360) {
      return `M 50 50 m -50 0 a 50 50 0 1 0 100 0 a 50 50 0 1 0 -100 0`;
    }
    const x1 = 50 + 50 * Math.cos((Math.PI * (startAngle - 90)) / 180);
    const y1 = 50 + 50 * Math.sin((Math.PI * (startAngle - 90)) / 180);
    const x2 = 50 + 50 * Math.cos((Math.PI * (startAngle + size - 90)) / 180);
    const y2 = 50 + 50 * Math.sin((Math.PI * (startAngle + size - 90)) / 180);
    const largeArcFlag = size > 180 ? 1 : 0;
    return `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  const getStatusText = () => {
    if (status === 'rolling') return 'ROLL';
    if (status === 'pending') return `${countdown}S`;
    if (status === 'finished') return 'WIN!';
    if (players.length === 0) return 'JOIN';
    return 'WAIT';
  };

  return (
    <div className="wheel-outer-frame">
      <div className="wheel-ticker-absolute" />
      <div className="wheel-container">
        <div 
          className="wheel-inner"
          style={{ 
            transform: status === 'rolling' || status === 'finished' 
              ? `rotate(${winningAngle}deg)` 
              : 'rotate(0deg)',
            transition: status === 'rolling' ? 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)' : 'none',
            border: '8px solid #001a0a'
          }}
        >
          <svg viewBox="0 0 100 100" style={{ transform: 'rotate(0deg)', display: 'block' }}>
            {segments.map((s, i) => (
              <path
                key={i}
                d={getPath(s.start, s.size)}
                fill={s.color}
                stroke="#001a0a"
                strokeWidth="0.8"
              />
            ))}
            {/* Center piece with status text */}
            <circle cx="50" cy="50" r="16" fill="#000" stroke="var(--primary-gold)" strokeWidth="1" />
            <text 
                x="50" 
                y="52" 
                textAnchor="middle" 
                fill="var(--primary-gold)" 
                fontSize="10" 
                fontWeight="900"
                style={{ dominantBaseline: 'middle' }}
            >
                {getStatusText()}
            </text>
          </svg>
          
          {/* Avatars on segments */}
          {segments.map((s, i) => {
            if (!s.photoUrl) return null;
            const midAngle = s.start + s.size / 2;
            const x = 50 + 34 * Math.cos((Math.PI * (midAngle - 90)) / 180);
            const y = 50 + 34 * Math.sin((Math.PI * (midAngle - 90)) / 180);
            
            if (s.size < 5) return null;

            return (
              <div
                key={`avatar-${i}`}
                className="wheel-avatar-container"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%) rotate(${midAngle}deg)`
                }}
              >
                <img
                  src={s.photoUrl}
                  className="player-avatar-on-wheel"
                  alt={s.username}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(PvpWheel);
