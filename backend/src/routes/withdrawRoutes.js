import express from 'express';
import admin, { db } from '../config/db.js';
import { TIERS } from '../config/tiers.js';
import { incrementWithdrawals } from '../utils/stats.js';
import { sendTelegramMessage } from '../utils/bot.js';
import { getTonPrice } from '../utils/price.js';
import { validateINITData } from '../middleware/auth.js';

const router = express.Router();
const WALLET_FATHER_API_BASE = 'https://walletfather.up.railway.app/api/projects/api';
const WALLET_FATHER_PRIVATE_KEY = process.env.WALLETFATHER_PRIVATE_KEY;
const WALLET_FATHER_ALLOWED_CURRENCIES = new Set(['FEST']);

const getMinLimitForUser = async (userData) => {
  const settingsDoc = await db.collection('admin').doc('settings').get();
  const userTier = userData.tier || 'free';
  const tierConfig = TIERS[userTier] || TIERS.free;
  let minLimit = tierConfig.minWithdraw || 10000;

  if (settingsDoc.exists) {
    const tierLimits = settingsDoc.data().tierLimits;
    if (tierLimits && tierLimits[userTier]) {
      minLimit = Number(tierLimits[userTier]);
    }
  }

  const offerDoc = await db.collection('admin').doc('offer').get();
  if (offerDoc.exists) {
    const offerData = offerDoc.data();
    if (new Date(offerData.endTime) > new Date() && offerData.isActive) {
      const offerLimit = offerData.limits?.[userTier];
      if (offerLimit !== undefined) {
        minLimit = Number(offerLimit);
      }
    }
  }

  return minLimit;
};

router.get('/config', async (req, res) => {
  try {
    const price = await getTonPrice();
    res.json({ tonPrice: price, tiers: TIERS });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/offer', async (req, res) => {
  try {
    const offerDoc = await db.collection('admin').doc('offer').get();
    if (!offerDoc.exists) return res.json({ active: false });
    const data = offerDoc.data();
    if (new Date(data.endTime) < new Date()) {
      return res.json({ active: false });
    }
    return res.json({ active: true, ...data });
  } catch (error) {
    console.error('Fetch Offer Error:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

router.get('/offchain/status/:telegramId', validateINITData, async (req, res) => {
  try {
    const sessionUserId = String(req.telegramUser?.id || '');
    const requestedUserId = String(req.params.telegramId || '');
    if (!requestedUserId || sessionUserId !== requestedUserId) {
      return res.status(403).json({ error: 'Forbidden: user mismatch' });
    }

    if (!WALLET_FATHER_PRIVATE_KEY) {
      return res.status(503).json({ error: 'WalletFather is not configured on server' });
    }

    const response = await fetch(
      `${WALLET_FATHER_API_BASE}/is-connected/${WALLET_FATHER_PRIVATE_KEY}-${requestedUserId}`
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error || data?.message || 'Failed to check WalletFather connection',
      });
    }

    return res.json({ connected: !!data.connected });
  } catch (error) {
    console.error('WalletFather connection check failed:', error);
    return res.status(500).json({ error: 'Failed to check WalletFather status' });
  }
});

router.post('/offchain/withdraw', validateINITData, async (req, res) => {
  try {
    const sessionUserId = String(req.telegramUser?.id || '');
    const { amount } = req.body || {};

    if (!sessionUserId) return res.status(401).json({ error: 'Unauthorized' });

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const userRef = db.collection('users').doc(sessionUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    const userData = userDoc.data();
    const minWithdraw = await getMinLimitForUser(userData);
    if (parsedAmount < minWithdraw) {
      return res.status(400).json({ error: `Minimum withdrawal for your tier is ${minWithdraw} $FEST.` });
    }

    if ((userData.balance || 0) < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check withdrawal requirements
    const taskCount = (userData.taskHistory || []).length;
    const activities = userData.activities || [];
    const miniGameCount = activities.filter(a =>
      a.type === 'spin' || a.type === 'spin_game' || a.type === 'slot_game' || a.type === 'mines_game' || a.type === 'pvp_join'
    ).length;
    const streak = userData.dailyStreak || 0;

    if (taskCount < 10) {
      return res.status(400).json({ error: `Minimum 10 tasks required for withdrawal. You have completed ${taskCount} tasks.` });
    }
    if (miniGameCount < 10) {
      return res.status(400).json({ error: `Minimum 10 mini-games required for withdrawal. You have played ${miniGameCount} mini-games.` });
    }
    if (streak < 3) {
      return res.status(400).json({ error: `Minimum 3-day streak required for withdrawal. Your current streak is ${streak} day(s).` });
    }

    // Check for multi-account on same IP/device (Removed based on request)
    // const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    // const deviceFingerprint = userData.deviceFingerprint || null;
    // const isMultiAccount = await checkMultiAccountOnDevice(sessionUserId, ipAddress, deviceFingerprint);
    // if (isMultiAccount) {
    //   return res.status(403).json({ error: 'Withdrawal blocked: Multiple accounts detected on the same device or IP address. Please contact support.' });
    // }

    const timestamp = new Date().toISOString();

    // Deduct balance and log activity
    await userRef.update({
      balance: admin.firestore.FieldValue.increment(-parsedAmount),
      activities: admin.firestore.FieldValue.arrayUnion({
        type: 'withdrawal_request',
        amount: -parsedAmount,
        currency: 'FEST',
        timestamp,
      }),
      rewardHistory: admin.firestore.FieldValue.arrayUnion({
        type: 'withdrawal',
        amount: parsedAmount,
        currency: 'FEST',
        timestamp
      })
    });

    // Create withdrawal request
    const withdrawRef = await db.collection('withdrawals').add({
      userId: sessionUserId,
      amount: parsedAmount,
      currency: 'FEST',
      status: 'PENDING',
      requestDate: timestamp,
      type: 'offchain'
    });

    console.log(`[WITHDRAWAL_REQUEST] User ${sessionUserId} requested withdrawal of ${parsedAmount} FEST. Status: PENDING, ReqId: ${withdrawRef.id}`);

    // Notify Admin group
    try {
      const displayName = userData.firstName || userData.username || 'User';
      const userLink = `tg://user?id=${sessionUserId}`;
      const msgText = `🔔 <b>New Withdrawal Request</b>\n\n👤 <b>User:</b> <a href="${userLink}">${displayName}</a> (ID: <code>${sessionUserId}</code>)\n💰 <b>Amount:</b> ${parsedAmount.toFixed(0)} $FEST\n\nUse WalletFather to pay.`;
      await sendTelegramMessage('-1003750183466', msgText, {
        inline_keyboard: [[
          { text: '🟢 Confirm Withdrawal', callback_data: `confirm_offchain_withdraw_${withdrawRef.id}` }
        ]]
      });
    } catch (msgErr) {
      console.error('Failed to send admin notification:', msgErr);
    }

    // Track in AppStats
    incrementWithdrawals(parsedAmount);

    res.json({ success: true, message: 'Withdrawal request submitted successfully' });
  } catch (error) {
    console.error('WalletFather offchain withdraw error:', error);
    return res.status(500).json({ error: 'Offchain withdrawal failed' });
  }
});

export default router;
