import crypto from 'crypto';
import { trackActivity } from '../utils/activityTracker.js';

export const validateINITData = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!initData) {
    if (process.env.NODE_ENV === 'production') {
       return res.status(401).json({ error: 'Unauthorized: Missing Telegram data' });
    }
    // Fallback for dev testing
    req.telegramUser = { id: '123456789', username: 'DevUser', first_name: 'Dev', last_name: 'User' };
    
    // Track dev user activity
    try {
      let action = 'Online';
      const path = req.originalUrl || '';
      const method = req.method;
      if (path.includes('/coinflip') && method === 'POST') action = 'Playing Coin Flip';
      else if (path.includes('/slots') && method === 'POST') action = 'Playing Slots';
      else if (path.includes('/wheel') && method === 'POST') action = 'Spinning Wheel';
      else if (path.includes('/ad-watch/start') && method === 'POST') action = 'Watching Ad';
      else if (path.includes('/tasks/claim') && method === 'POST') action = 'Claiming Task';
      else if (path.includes('/sync')) action = 'Viewing Dashboard';
      else if (path.includes('/leaderboard')) action = 'Checking Leaderboard';
      else if (path.includes('/contests')) action = 'Browsing Contests';
      else if (path.includes('/withdraw')) action = 'Processing Withdrawal';
      
      trackActivity(req.telegramUser, action);
    } catch (e) {}

    return next(); // Allow in dev if missing
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    // Sort keys alphabetically
    const dataItems = [];
    urlParams.forEach((value, key) => {
      if (key !== 'hash') {
        dataItems.push(`${key}=${value}`);
      }
    });
    dataItems.sort();
    const dataCheckString = dataItems.join('\n');

    // Create secret key using bot token
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    
    // Calculate hash
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Unauthorized: Invalid data signature' });
      }
      console.warn('HMAC validation failed, but continuing in dev mode.');
    }

    // Attach user data to request
    const userRaw = JSON.parse(urlParams.get('user'));
    req.telegramUser = userRaw;
    
    // Track activity
    try {
      let action = 'Online';
      const path = req.originalUrl || '';
      const method = req.method;
      if (path.includes('/coinflip') && method === 'POST') action = 'Playing Coin Flip';
      else if (path.includes('/slots') && method === 'POST') action = 'Playing Slots';
      else if (path.includes('/wheel') && method === 'POST') action = 'Spinning Wheel';
      else if (path.includes('/ad-watch/start') && method === 'POST') action = 'Watching Ad';
      else if (path.includes('/tasks/claim') && method === 'POST') action = 'Claiming Task';
      else if (path.includes('/sync')) action = 'Viewing Dashboard';
      else if (path.includes('/leaderboard')) action = 'Checking Leaderboard';
      else if (path.includes('/contests')) action = 'Browsing Contests';
      else if (path.includes('/withdraw')) action = 'Processing Withdrawal';
      
      trackActivity(req.telegramUser, action);
    } catch (e) {}
    
    next();
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized: Data corruption' });
    }
    next();
  }
};

// [NEW] Admin Verification Middleware
const ADMIN_IDS = ['5968063026', '6686954447', '1678112785', '123456789'];

export const verifyAdmin = (req, res, next) => {
  // First ensure initData was validated
  if (!req.telegramUser) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
  }

  const userId = req.telegramUser.id.toString();
  
  if (!ADMIN_IDS.includes(userId)) {
    console.warn(`Unauthorized admin access attempt by ${userId}`);
    return res.status(403).json({ error: 'Forbidden: Admin access only' });
  }

  next();
};
