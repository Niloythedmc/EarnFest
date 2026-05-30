import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useConfig } from '../context/ConfigContext';
import { useUser } from '../context/UserContext';

const GamesPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { adminIds } = useConfig();
  const { user } = useUser();

  const isAdmin = user && adminIds.includes(user.telegramId.toString());

  const games = [
    {
      id: 'spin-wheel',
      title: 'Lucky Spin',
      labelKey: 'spin_wheel',
      path: '/spin',
      image: '/Wheel.png'
    },
    {
      id: 'slots',
      title: 'Slot Machine',
      labelKey: 'slots',
      path: '/slots',
      image: '/Slot.png'
    },
    {
      id: 'coinflip',
      title: 'Coin Flip',
      labelKey: 'coinflip',
      path: '/coinflip',
      image: '/CoinFlip.png'
    },
  ];

  return (
    <div className="main-content stack-vertical">
      <header style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 className="game-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '2.5rem' }}>
          <Trophy size={32} className="gold-text" /> {t('games') || 'Mini Games'}
        </h1>
        <p className="text-sm-muted font-gaming" style={{ fontSize: '0.75rem', marginTop: '4px' }}>PLAY & WIN EXCLUSIVE REWARDS</p>
      </header>

      <div className="grid-cols-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {games.map((game) => (
          <motion.div
            key={game.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(game.path)}
          >
            <div
              style={{
                background: 'rgba(255, 215, 0, 0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 215, 0, 0.25)',
                boxShadow: '0 0 20px rgba(255, 215, 0, 0.08), inset 0 0 20px rgba(255, 215, 0, 0.03)',
                padding: '10px',
                overflow: 'hidden',
                lineHeight: 0
              }}
            >
              <img
                src={game.image}
                alt={game.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: '10px'
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {games.length === 0 && (
        <p className="text-sm-muted" style={{ textAlign: 'center', padding: '40px' }}>More games coming soon!</p>
      )}
    </div>
  );
};

export default GamesPage;
