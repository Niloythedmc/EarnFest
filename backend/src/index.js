import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import withdrawRoutes from './routes/withdrawRoutes.js';
import botRoutes from './routes/botRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import promocodeRoutes from './routes/promocodeRoutes.js';
import contestRoutes from './routes/contestRoutes.js';
import streakRoutes from './routes/streakRoutes.js';
import promoteRoutes from './routes/promoteRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import { ensureStatsDocExists } from './utils/stats.js';
import { startPaymentScanner } from './utils/paymentScanner.js';
import contestManager from './utils/contestManager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic CORS configuration
const allowedOrigins = [
  'https://earn-fest.web.app',
  'https://eidfest.web.app',
  'https://earnfest.pages.dev',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.pages.dev');
    if (!isAllowed) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-telegram-init-data', 'x-telegram-id']
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/user', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/walletfather', botRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/promocodes', promocodeRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/user', streakRoutes);
app.use('/api/promote', promoteRoutes);
app.use('/api/partners', partnerRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/tonconnect-manifest.json', (req, res) => {
  res.json({
    "url": "https://eidfest.web.app",
    "name": "EarnFest",
    "iconUrl": "https://eidfest.up.railway.app/Earnfest.webp"
  });
});

app.get('/Earnfest.webp', (req, res) => {
  res.redirect('https://raw.githubusercontent.com/TonFesta/assets/main/Earnfest.webp'); // Fallback to a stable host or local path
});

app.get('/api/health/diagnostics', (req, res) => {
  res.json({
    firebase: !!process.env.FIREBASE_PROJECT_ID,
    nowpayments_api: !!process.env.NOWPAYMENTS_API_KEY,
    nowpayments_public: !!process.env.NOWPAYMENTS_PUBLIC_KEY,
    telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
  });
});

// Check and reward ended contests periodically (every 60 seconds)
const CONTEST_CHECK_INTERVAL = 60 * 1000; // 60 seconds
let contestCheckInterval = null;

function startContestRewardChecker() {
  console.log('Starting contest reward checker...');
  // Run immediately on startup
  contestManager.checkAndRewardContests().then(results => {
    if (results.length > 0) {
      console.log(`Auto-rewarded ${results.length} contest(s) on startup`);
    }
  }).catch(err => {
    console.error('Contest reward check on startup failed:', err.message);
  });

  // Then run periodically
  contestCheckInterval = setInterval(async () => {
    try {
      const results = await contestManager.checkAndRewardContests();
      if (results.length > 0) {
        console.log(`Auto-rewarded ${results.length} contest(s)`);
      }
    } catch (err) {
      console.error('Periodic contest reward check failed:', err.message);
    }
  }, CONTEST_CHECK_INTERVAL);
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  ensureStatsDocExists(); // Initialize AppStats doc if missing
  startPaymentScanner(); // Start background blockchain scanner
  startContestRewardChecker(); // Start contest auto-reward checker
});
