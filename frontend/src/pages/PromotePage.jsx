import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Star, Rocket, ArrowRight, Check, Zap } from 'lucide-react';

const TON_LOGO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><path fill="#0098EA" d="M14 0C6.27 0 0 6.27 0 14s6.27 14 14 14 14-6.27 14-14S21.73 0 14 0zm0 2.33c6.44 0 11.67 5.23 11.67 11.67S20.44 25.67 14 25.67 2.33 20.44 2.33 14 7.56 2.33 14 2.33zm-1.17 5.83v9.34L8.46 8.16h4.37zm2.34 0h4.37l-4.37 9.34V8.16zM7.33 7.16l6.67 14 6.67-14v-.01H7.33z"/></svg>');
import { Card, Button, Stack } from '../components/UI';
import { useUser } from '../context/UserContext';
import { useConfig } from '../context/ConfigContext';

const PLANS = [
  {
    key: 'only_task',
    title: 'Only Tasks',
    subtitle: 'Single Task Promotion',
    priceTon: 10,
    icon: <Sparkles size={28} />,
    color: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))',
    borderColor: 'rgba(139,92,246,0.3)',
    features: ['1 lifetime task in Tasks page'],
    path: '/promote/only-task',
  },
  {
    key: 'featured',
    title: 'Featured Task',
    subtitle: 'Best Value Bundle',
    priceTon: 20,
    icon: <Star size={28} />,
    color: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
    borderColor: 'rgba(245,158,11,0.3)',
    features: [
      '2 lifetime tasks in Tasks page',
      'Banner featuring in Home page',
    ],
    path: '/promote/featured',
  },
  {
    key: 'collaboration',
    title: 'Collaboration',
    subtitle: 'Full Partnership',
    priceTon: 50,
    icon: <Rocket size={28} />,
    color: '#ef4444',
    bgGradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
    borderColor: 'rgba(239,68,68,0.3)',
    features: [
      '2 lifetime tasks in Tasks page',
      'Banner featuring in Home page',
      'Project collaboration',
      'Social announcement',
      'Bot notification',
    ],
    path: '/promote/collaboration',
  },
];

const PromotePage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { apiBase } = useConfig();

  return (
    <div className="main-content" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: '28px', paddingTop: '20px' }}
      >
        <div style={{
          width: '60px', height: '60px', borderRadius: '20px',
          background: 'linear-gradient(135deg, var(--page-accent), #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 32px rgba(139,92,246,0.3)',
        }}>
          <Zap size={30} color="#fff" />
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '900', marginBottom: '6px' }}>
          Promote Your Project
        </h1>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, maxWidth: '300px', margin: '0 auto', lineHeight: '1.5' }}>
          Get your bot, channel, or link in front of thousands of active users
        </p>
      </motion.div>

      {/* Plan Cards */}
      <Stack gap={16}>
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.key}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              style={{
                padding: '20px',
                background: plan.bgGradient,
                border: `1px solid ${plan.borderColor}`,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => navigate(plan.path)}
            >
              {/* Badge */}
              {plan.key === 'featured' && (
                <div style={{
                  position: 'absolute', top: '10px', right: '10px',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#000', fontSize: '0.55rem', fontWeight: '900',
                  padding: '3px 10px', borderRadius: '20px',
                  letterSpacing: '0.5px',
                }}>
                  BEST VALUE
                </div>
              )}
              {plan.key === 'collaboration' && (
                <div style={{
                  position: 'absolute', top: '10px', right: '10px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff', fontSize: '0.55rem', fontWeight: '900',
                  padding: '3px 10px', borderRadius: '20px',
                  letterSpacing: '0.5px',
                }}>
                  FULL PACKAGE
                </div>
              )}

              <div className="flex-row" style={{ gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '14px',
                  background: `${plan.color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: plan.color, flexShrink: 0,
                }}>
                  {plan.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '900', fontSize: '1.1rem' }}>{plan.title}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>{plan.subtitle}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: '900', fontSize: '1.3rem', color: plan.color, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <img src={TON_LOGO} alt="TON" style={{ width: '18px', height: '18px' }} />
                    {plan.priceTon}
                  </div>
                </div>
              </div>

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {plan.features.map((feat, fi) => (
                  <div key={fi} className="flex-row" style={{ gap: '8px', alignItems: 'flex-start' }}>
                    <Check size={12} color={plan.color} style={{ marginTop: '3px', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{feat}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{ marginTop: '16px' }}>
                <Button
                  style={{
                    width: '100%',
                    background: plan.color,
                    color: plan.key === 'featured' ? '#000' : '#fff',
                    border: 'none',
                  }}
                >
                  <span className="flex-row" style={{ gap: '8px', justifyContent: 'center' }}>
                    Select Plan <ArrowRight size={16} />
                  </span>
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </Stack>

      {/* Footer */}
      <p style={{
        textAlign: 'center', fontSize: '0.65rem', opacity: 0.4,
        marginTop: '24px', lineHeight: '1.6',
      }}>
        All payments are processed on-chain via TON blockchain.<br />
        Your tasks will be published after payment confirmation.
      </p>
    </div>
  );
};

export default PromotePage;