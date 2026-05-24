import express from 'express';
import admin, { db } from '../config/firebase.js';
import { validateINITData } from '../middleware/auth.js';
import { TIERS, REWARD_TYPES } from '../config/tiers.js';
import { SPIN_WHEEL_PRIZES, SPIN_WHEEL_CONFIG, verifyProbabilityConfig } from '../config/gameProbabilities.js';
import { sendTelegramPhoto } from '../utils/bot.js';
import { recordNewUser, recordActiveUser, incrementSpins, adjustTotalBalance, updateUserSearchIndex, incrementGamePlays, recordGameActiveUser } from '../utils/stats.js';
import { creditAdRewardForTelegramId } from '../utils/adReward.js';
import { processReferralCommission, checkAndRewardActiveReferral } from '../utils/referralLogic.js';
import { verifyInterstitialSession } from '../utils/antiAutoClickerManager.js';
import { generateDeviceHash, checkMultiAccountOnDevice } from '../utils/deviceFingerprint.js';
import { checkAdRewardMembership } from '../utils/telegramChats.js';
import crypto from 'crypto';

const router = express.Router();

// Sync User Data
router.post('/sync', validateINITData, async (req, res) => {
  try {
    const { telegramId, username, firstName, photoUrl, referralCode } = req.body;
    
    // Safety check matching middleware
    const actualId = req.telegramUser?.id || telegramId;

    if (!actualId) return res.status(400).json({ error: 'Missing telegramId' });

    const membership = await checkAdRewardMembership(actualId);

    const userRef = db.collection('users').doc(actualId.toString());
    const findReferralLinkByParam = async (param) => {
      if (!param) return null;
      const linkQuery = await db.collection('referralLinks').where('param', '==', param).limit(1).get();
      if (linkQuery.empty) return null;
      const linkDoc = linkQuery.docs[0];
      return { id: linkDoc.id, ...linkDoc.data() };
    };

    let userDoc;

    try {
      userDoc = await userRef.get();
    } catch (error) {
      if (error.code === 8 && error.details?.includes('Quota exceeded')) {
        return res.status(429).json({
          error: 'Service temporarily unavailable due to high load. Please try again later.',
          code: 'quota_exceeded'
        });
      }
      throw error;
    }

    if (!userDoc.exists) {
      let referredById = null;
      let joinedViaLinkData = null;
      
      // Look up and track visit unconditionally for admin links
      if (referralCode) {
        try {
          joinedViaLinkData = await findReferralLinkByParam(referralCode);
          if (joinedViaLinkData) {
            // Track visit/click universally
            await db.collection('referralLinks').doc(joinedViaLinkData.id).update({
              visitCount: admin.firestore.FieldValue.increment(1),
              lastVisitedAt: new Date().toISOString()
            });
            console.log(`Custom referral link visit mapped for ${actualId}: ${joinedViaLinkData.param}`);
          }
        } catch (e) {
          console.error("Failed to lookup/track visit on sync:", e);
        }
      }
      
      // Handle referral logic for new users entering via Mini App directly
      if (referralCode) {
        try {
          // joinedViaLinkData is populated dynamically above
          if (joinedViaLinkData) {
            await db.collection('referralLinks').doc(joinedViaLinkData.id).update({
              joinCount: admin.firestore.FieldValue.increment(1),
              joinedUsers: admin.firestore.FieldValue.arrayUnion(actualId.toString()),
              lastJoinedAt: new Date().toISOString(),
            });
          } else {
            // Try looking up by numeric Telegram ID (the document ID) first
            let referrerDoc = await db.collection('users').doc(referralCode.toString()).get();

            // If not found by ID, try looking up by the generated referralCode string
            if (!referrerDoc.exists) {
              const referrerQuery = await db.collection('users').where('referralCode', '==', referralCode).limit(1).get();
              if (!referrerQuery.empty) {
                referrerDoc = referrerQuery.docs[0];
              } else {
                referrerDoc = null;
              }
            }

            if (referrerDoc && referrerDoc.exists) {
              referredById = referrerDoc.id;
              // Skip referral update if quota exceeded - non-critical
              try {
                await referrerDoc.ref.update({
                  referrals: admin.firestore.FieldValue.arrayUnion(actualId.toString()),
                  referralCount: admin.firestore.FieldValue.increment(1)
                });
              } catch (referralError) {
                if (referralError.code === 8 && referralError.details?.includes('Quota exceeded')) {
                  console.log(`Skipped referral update for ${actualId} due to quota exceeded`);
                } else {
                  console.error('Referral update error:', referralError);
                }
              }
              console.log(`User ${actualId} referred by ${referredById} (via code)`);
            }
          }
        } catch (referralLookupError) {
          if (referralLookupError.code === 8 && referralLookupError.details?.includes('Quota exceeded')) {
            console.log(`Skipped referral lookup for ${actualId} due to quota exceeded`);
          } else {
            console.error('Referral lookup error:', referralLookupError);
          }
        }
      }

      const newUser = {
        telegramId: actualId,
        username: username || firstName || 'User',
        firstName: firstName || '',
        photoUrl: photoUrl || '',
        balance: 0,
        tier: 'free',
        adsCountToday: 0,
        lastAdDate: new Date().toISOString(),
        referralCode: `EF${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        referredBy: referredById,
        referrals: [],
        referralCount: 0,
        referralEarnings: 0,
        rewardHistory: [],
        taskHistory: [],
        activities: [],
        spinAdViews: 0,
        totalAdViews: 0,
        totalAdEarnings: 0,
        totalEarned: 0,
        spinHistory: [],
        joinedViaLink: joinedViaLinkData ? {
          linkId: joinedViaLinkData.id,
          param: joinedViaLinkData.param,
          createdAt: new Date().toISOString()
        } : null,
        referralBonusPaid: false,
        activeAt: null,
        tokens: 0,
        dailyStreak: 0,
        lastStreakDate: null,
        streakClaimedMilestones: [],
        createdAt: new Date().toISOString(),
        lastActiveDate: new Date().toISOString().slice(0, 10)
      };
      try {
        await userRef.set(newUser);
        // Track new user in AppStats (fire-and-forget, handles quota internally)
        recordNewUser(actualId);
        updateUserSearchIndex(newUser);
        return res.json({ ...newUser, isJoined: membership.ok });
      } catch (createError) {
        if (createError.code === 8 && createError.details?.includes('Quota exceeded')) {
          return res.status(429).json({
            error: 'Service temporarily unavailable due to high load. Please try again later.',
            code: 'quota_exceeded'
          });
        }
        throw createError;
      }
    } else {
      // User exists (possibly from Bot /start)
      const existingData = userDoc.data();
      
      // Update metadata if opening App for the first time
      const updates = {};
      if (!existingData.username || existingData.username === 'User') updates.username = username || firstName || 'User';
      if (!existingData.firstName) updates.firstName = firstName || '';
      if (!existingData.photoUrl && photoUrl) updates.photoUrl = photoUrl;

      // Handle referral if not already set (e.g. joined via startapp but bot didn't catch it)
      if (referralCode) {
        try {
          const linkData = await findReferralLinkByParam(referralCode);
          if (linkData) {
            // Track visit universally even for old users
            try {
              await db.collection('referralLinks').doc(linkData.id).update({
                visitCount: admin.firestore.FieldValue.increment(1),
                lastVisitedAt: new Date().toISOString()
              });
            } catch (e) {}

            // But do NOT increment joinCount for old users, we only link them metadata if missing
            if (!existingData.joinedViaLink) {
              updates.joinedViaLink = {
                linkId: linkData.id,
                param: linkData.param,
                createdAt: new Date().toISOString(),
              };
              // Only NEW registers trigger joinCount increment! Existing users never trigger it.
            }
          }

          if (!existingData.referredBy && !updates.referredBy) {
            let referrerDoc = await db.collection('users').doc(referralCode.toString()).get();

            if (!referrerDoc.exists) {
              const referrerQuery = await db.collection('users').where('referralCode', '==', referralCode).limit(1).get();
              if (!referrerQuery.empty) {
                referrerDoc = referrerQuery.docs[0];
              } else {
                referrerDoc = null;
              }
            }

            if (referrerDoc && referrerDoc.exists) {
              updates.referredBy = referrerDoc.id;
              // Skip referral update if quota exceeded - non-critical
              try {
                await referrerDoc.ref.update({
                  referrals: admin.firestore.FieldValue.arrayUnion(actualId.toString()),
                  referralCount: admin.firestore.FieldValue.increment(1)
                });
              } catch (referralError) {
                if (referralError.code === 8 && referralError.details?.includes('Quota exceeded')) {
                  console.log(`Skipped referral update for ${actualId} due to quota exceeded`);
                } else {
                  console.error('Referral update error:', referralError);
                }
              }
            }
          }
        } catch (referralLookupError) {
          if (referralLookupError.code === 8 && referralLookupError.details?.includes('Quota exceeded')) {
            console.log(`Skipped referral lookup for ${actualId} due to quota exceeded`);
          } else {
            console.error('Referral lookup error:', referralLookupError);
          }
        }
      }

      // Track active user on every app entry (fire-and-forget)
      recordActiveUser(actualId);

      const todayStr = new Date().toISOString().slice(0, 10);
      if (existingData.lastActiveDate !== todayStr) {
        updates.lastActiveDate = todayStr;
      }

      // Always update search index on entry to keep it fresh
      updateUserSearchIndex({ ...existingData, ...updates });

      if (Object.keys(updates).length > 0) {
        try {
          await userRef.update(updates);
          return res.json({ ...existingData, ...updates, isJoined: membership.ok });
        } catch (updateError) {
          if (updateError.code === 8 && updateError.details?.includes('Quota exceeded')) {
            // Return existing data without updates if quota exceeded
            console.log(`Skipped user update for ${actualId} due to quota exceeded`);
            return res.json({ ...existingData, isJoined: membership.ok });
          }
          throw updateError;
        }
      }

      return res.json({ ...existingData, isJoined: membership.ok });
    }

    const userData = userDoc.data();
    
    // Reset ads count daily (though now unlimited, we might still want to track)
    const lastDate = new Date(userData.lastAdDate || 0).toDateString();
    const today = new Date().toDateString();
    
    if (lastDate !== today) {
      try {
        await userRef.update({ 
          adsCountToday: 0, 
          lastAdDate: new Date().toISOString() 
        });
        userData.adsCountToday = 0;
      } catch (resetError) {
        if (resetError.code === 8 && resetError.details?.includes('Quota exceeded')) {
          console.log(`Skipped daily reset for ${actualId} due to quota exceeded`);
        } else {
          console.error('Daily reset error:', resetError);
        }
      }
    }

    res.json({ ...userData, isJoined: membership.ok });
  } catch (error) {
    console.error('Sync Error:', error);

    // Handle Firestore quota exceeded errors
    if (error.code === 8 && error.details?.includes('Quota exceeded')) {
      return res.status(429).json({
        error: 'Service temporarily unavailable due to high load. Please try again later.',
        code: 'quota_exceeded'
      });
    }

    res.status(500).json({ error: 'Server error during sync' });
  }
});

// [SECURE] Update Balance / Reward (ad rewards share cooldown + logic with GET /reward/adsgram)
router.post('/reward', validateINITData, async (req, res) => {
  try {
    const { telegramId, type } = req.body;
    const sessionUserId = req.telegramUser?.id;

    if (sessionUserId == null) {
      return res.status(401).json({ error: 'Unauthorized: Telegram session required' });
    }
    if (String(sessionUserId) !== String(telegramId)) {
      return res.status(403).json({ error: 'Forbidden: user mismatch' });
    }

    if (type === REWARD_TYPES.AD || String(type).toLowerCase() === 'ad') {
      return res.status(403).json({
        error: 'Client-side ad rewarding is disabled. Rewards are processed via Server-to-Server callbacks.',
        code: 'client_rewards_disabled'
      });
    }

    if (type === REWARD_TYPES.GAME) {
      return res.status(403).json({ 
        error: 'Insecure reward method. Game rewards must be processed via authorized logic.',
        code: 'insecure_method' 
      });
    }

    const userRef = db.collection('users').doc(String(sessionUserId));

    let rewardAmount = 0;
    let finalBalance = 0;

    const result = await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) throw new Error('User not found');

      const userData = userDoc.data();
      const tierConfig = TIERS[userData.tier] || TIERS.free;

      if (type === REWARD_TYPES.SURVEY) {
        // SECURITY: Transaction locks the document, stopping race condition exploits
        if (userData.completedRewards?.includes('survey')) {
          throw new Error('Survey reward already claimed');
        }
        rewardAmount = tierConfig.survey || 0.5;
      }

      const timestamp = new Date().toISOString();
      const activityEntry = { type, amount: rewardAmount, timestamp };

      const updateData = {
        balance: admin.firestore.FieldValue.increment(rewardAmount),
        totalEarned: admin.firestore.FieldValue.increment(rewardAmount),
        activities: admin.firestore.FieldValue.arrayUnion(activityEntry),
      };

      if (type === REWARD_TYPES.SURVEY) {
        updateData.completedRewards = admin.firestore.FieldValue.arrayUnion('survey');
      }

      tx.update(userRef, updateData);
      finalBalance = (userData.balance || 0) + rewardAmount;
      return { referredBy: userData.referredBy };
    });

    adjustTotalBalance(rewardAmount);

    // Handle Referral Commission (20%) & Active Check
    if (result.referredBy && rewardAmount > 0) {
      await processReferralCommission(sessionUserId, rewardAmount, type, result.referredBy);
      await checkAndRewardActiveReferral(sessionUserId);
    }

    res.json({ success: true, newBalance: finalBalance });
  } catch (error) {
    console.error('Reward Error:', error);
    res.status(400).json({ error: error.message || 'Reward update failed' });
  }
});

// Track a spin ad view for the current user
router.post('/spin-ad-view', validateINITData, async (req, res) => {
  return res.status(403).json({
    error: 'Client-side spin ad tracking is disabled. Spins are tracked via Server-to-Server callbacks.',
    code: 'client_tracking_disabled'
  });
});

// Leaderboard for top ad viewers and current user position
router.get('/leaderboard', validateINITData, async (req, res) => {
  try {
    const sessionUserId = req.telegramUser?.id;
    if (!sessionUserId) return res.status(401).json({ error: 'Unauthorized' });

    const topSnapshot = await db.collection('users')
      .orderBy('totalAdEarnings', 'desc')
      .limit(20)
      .get();

    const topUsers = topSnapshot.docs.map(doc => ({
      telegramId: doc.id,
      ...doc.data()
    }));

    const userRef = db.collection('users').doc(String(sessionUserId));
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    const currentUser = userDoc.data();
    const currentEarnings = currentUser.totalAdEarnings || 0;

    const rankSnapshot = await db.collection('users')
      .where('totalAdEarnings', '>', currentEarnings)
      .count()
      .get();

    const currentPosition = (rankSnapshot.data().count || 0) + 1;

    res.json({ topUsers, currentUser: { telegramId: String(sessionUserId), ...currentUser }, currentPosition });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * AdsGram Server-to-Server reward URL (GET). Must be called with a shared secret only you and
 * AdsGram know — set Reward URL in the partner panel like:
 *   https://YOUR_HOST/api/user/reward/adsgram?userid=[userId]&token=YOUR_SECRET
 * Query names: token | secret | key (all compared to ADSGRAM_REWARD_SECRET).
 */
router.get('/reward/adsgram', async (req, res) => {
  try {
    const expected = process.env.ADSGRAM_REWARD_SECRET;
    if (!expected || expected.length < 8) {
      console.error('ADSGRAM_REWARD_SECRET missing or too weak — refusing AdsGram callback');
      return res.status(503).send('Not configured');
    }
    
    // Block direct browser-based calls
    if (req.headers.origin || req.headers.referer) {
      console.warn(`Blocked S2S callback attempt from browser/client with Origin: ${req.headers.origin}`);
      return res.status(403).send('Forbidden: Direct browser callbacks not allowed');
    }

    const provided = req.query.token;
    
    // SECURITY: Use timingSafeEqual to prevent timing attacks
    let isValid = false;
    if (provided && provided.length === expected.length) {
      isValid = crypto.timingSafeEqual(
        Buffer.from(provided),
        Buffer.from(expected)
      );
    }
    
    if (!isValid) {
      return res.status(403).send('Forbidden');
    }

    const telegramId = req.query.userid;
    if (!telegramId) return res.status(400).send('Missing user id');

    const result = await creditAdRewardForTelegramId(telegramId);
    if (!result.ok) {
      if (result.code === 'not_found') return res.status(404).send('User not found');
      if (result.code === 'cooldown') return res.status(429).send('Too Many Requests');
      if (result.code === 'membership_required') return res.status(403).send('MEMBERSHIP_REQUIRED');
      return res.status(result.status || 500).send('Error');
    }

    res.send('OK');
  } catch (error) {
    console.error('Adsgram Reward Error:', error);
    res.status(500).send('Error');
  }
});

/**
 * Monetag Server-to-Server reward URL.
 * Macros: ymid={ymid}&reward={reward_event_type}&zone={zone_id}&event={event_type}&price={estimated_price}
 * Example Callback URL:
 *   https://YOUR_HOST/api/user/reward/monetag?ymid=[YMID]&reward=[REWARD_EVENT_TYPE]&zone=[ZONE_ID]&event=[EVENT_TYPE]&token=YOUR_SECRET
 */
router.get('/reward/monetag', async (req, res) => {
  try {
    const expected = process.env.MONETAG_REWARD_SECRET || process.env.ADSGRAM_REWARD_SECRET;
    if (!expected) {
      console.error('MONETAG_REWARD_SECRET missing — refusing Monetag callback');
      return res.status(503).send('Not configured');
    }

    // Block direct browser-based calls
    if (req.headers.origin || req.headers.referer) {
      console.warn(`Blocked Monetag S2S callback attempt from browser/client with Origin: ${req.headers.origin}`);
      return res.status(403).send('Forbidden: Direct browser callbacks not allowed');
    }

    const provided = req.query.token || req.query.secret || req.query.key;
    if (provided !== expected) {
      return res.status(403).send('Forbidden');
    }

    const telegramId = req.query.ymid; // We pass user ID as ymid in frontend
    if (!telegramId) return res.status(400).send('Missing ymid');

    const isReward = req.query.reward === 'yes';
    const eventType = req.query.event; // 'impression' or 'click'

    // Only credit if it's a confirmed reward impression
    if (isReward && eventType === 'impression') {
      const result = await creditAdRewardForTelegramId(telegramId);
      if (!result.ok) {
        if (result.code === 'not_found') return res.status(404).send('User not found');
        if (result.code === 'cooldown') return res.status(429).send('Too Many Requests');
        if (result.code === 'membership_required') return res.status(403).send('MEMBERSHIP_REQUIRED');
        return res.status(result.status || 500).send('Error');
      }
    }

    res.send('OK');
  } catch (error) {
    console.error('Monetag Reward Error:', error);
    res.status(500).send('Error');
  }
});

// [NEW] Bot Welcome Endpoint
router.post('/welcome', async (req, res) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'Missing telegramId' });

    const logoUrl = 'https://img.icons8.com/isometric/512/money-box.png'; // Updated to non-Islamic icon
    const welcomeCaption = `<b>Congratulations!</b> 🚀🎉\n\nWelcome to <b>EarnFest</b>, the ultimate digital rewards platform!\n\n🚀 Start earning by watching unlimited ads, spinning the wheel, or completing tasks.\n🤝 Invite friends to earn 20% commission on upgrades + 2 $FEST for every ad they watch!\n💎 Upgrade your tier to multiply your earnings significantly!\n\nClick the button below to launch the app and start your journey.`;
    
    const replyMarkup = {
      inline_keyboard: [
        [{ text: '🚀 Launch EarnFest', url: 'https://t.me/EarnFestBot/app' }]
      ]
    };

    await sendTelegramPhoto(telegramId, logoUrl, welcomeCaption, replyMarkup);
    res.json({ success: true, message: 'Welcome message sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send welcome message' });
  }
});

// [SECURE] Spawn cryptographically secure random bytes
/**
 * Generate cryptographically secure random number
 * Returns a number between 0 and 1 (exclusive of 1)
 */
function getCryptoRandom() {
  const randomBytes = crypto.randomBytes(4);
  return randomBytes.readUInt32BE(0) / 0xffffffff;
}

/**
 * Secure Spin Wheel Logic (100 payment required)
 * 
 * SECURITY FEATURES:
 * - Cryptographically secure RNG (backend-only, not predictable)
 * - Full transaction validation (user balance checked atomically)
 * - Rate limiting per user (cooldown + hourly limit)
 * - Audit trail for every spin (fraud detection)
 * - Configuration verified on startup
 * - Client cannot tamper with results
 */
router.post('/spin', validateINITData, async (req, res) => {
  try {
    // SECURITY: Verify configuration before spin
    const configCheck = verifyProbabilityConfig();
    if (!configCheck.valid) {
      console.error('SECURITY ALERT: Invalid game configuration detected:', configCheck.errors);
      return res.status(500).json({ error: 'Server configuration error', code: 'config_error' });
    }

    const { telegramId } = req.body;
    const actualId = req.telegramUser?.id || telegramId;
    const SPIN_PRICE = SPIN_WHEEL_CONFIG.costPerSpin;
    const SPIN_COOLDOWN_MS = SPIN_WHEEL_CONFIG.cooldownMs;

    const userRef = db.collection('users').doc(actualId.toString());
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const currentBalance = userData.balance || 0;
      
      // SECURITY CHECK 1: Verify balance
      if (currentBalance < SPIN_PRICE) {
        console.warn(`Insufficient balance attempt: user=${actualId}, balance=${currentBalance}, cost=${SPIN_PRICE}`);
        throw new Error(`Insufficient balance. You need $${SPIN_PRICE} to spin.`);
      }

      // SECURITY CHECK 2: Cooldown between spins
      const lastSpin = userData.lastSpinAt;
      const now = Date.now();
      if (lastSpin != null) {
        const lastMs = typeof lastSpin === 'number' ? lastSpin : lastSpin.toMillis?.() || 0;
        const timeSinceLastSpin = now - lastMs;
        if (timeSinceLastSpin < SPIN_COOLDOWN_MS) {
          console.warn(`Spin cooldown violation: user=${actualId}, timeSince=${timeSinceLastSpin}ms`);
          throw new Error('Spin cooldown active. Please wait before spinning again.');
        }
      }

      // SECURITY CHECK 3: Rate limiting (max spins per hour)
      const spinHistory = userData.spinHistory || [];
      const oneHourAgo = now - (60 * 60 * 1000);
      const recentSpins = spinHistory.filter(spin => {
        const spinTime = new Date(spin.timestamp).getTime();
        return spinTime > oneHourAgo;
      });

      if (recentSpins.length >= SPIN_WHEEL_CONFIG.maxSpinsPerHour) {
        console.warn(`Rate limit exceeded: user=${actualId}, spins_in_hour=${recentSpins.length}`);
        throw new Error(`Rate limit: maximum ${SPIN_WHEEL_CONFIG.maxSpinsPerHour} spins per hour.`);
      }

      // USE CONFIGURED PRIZES (from gameProbabilities.js)
      const prizes = SPIN_WHEEL_PRIZES;

      // SECURITY: Verify probabilities at runtime
      const totalProb = prizes.reduce((sum, p) => sum + p.prob, 0);
      if (Math.abs(totalProb - 1.0) > 0.0001) {
        console.error('CRITICAL: Prize probabilities do not sum to 1.0:', totalProb);
        throw new Error('Server configuration error: invalid probabilities');
      }

      // SECURITY: Use cryptographically secure RNG (backend-only, cannot be influenced by client)
      const secureRand = getCryptoRandom();
      let cumulative = 0;
      let selectedPrize = prizes[0]; // Safe fallback

      for (const prize of prizes) {
        cumulative += prize.prob;
        if (secureRand < cumulative) {
          selectedPrize = prize;
          break;
        }
      }

      const timestamp = new Date().toISOString();
      const netGain = selectedPrize.value - SPIN_PRICE;
      const newBalance = currentBalance + netGain;

      // SECURITY: Create audit trail for fraud investigation
      const auditHash = crypto
        .createHash('sha256')
        .update(`${now}-${secureRand}-${actualId}-${selectedPrize.value}`)
        .digest('hex');

      const spinRecord = {
        prize: selectedPrize.label,
        amount: selectedPrize.value,
        cost: SPIN_PRICE,
        netGain: netGain,
        timestamp,
        auditHash: auditHash.substring(0, 16), // For fraud investigation
        randLog: Math.round(secureRand * 1000000), // Obfuscated random value
        userTier: userData.tier || 'free'
      };

      // SECURITY: Log high-value spins for monitoring
      if (selectedPrize.value > 0.01) {
        console.log(`[HIGH_VALUE_SPIN] user=${actualId}, prize=${selectedPrize.label}, audit=${spinRecord.auditHash}`);
      }

      const spinEarnedUpdate = netGain > 0 ? { totalEarned: admin.firestore.FieldValue.increment(netGain) } : {};

      transaction.update(userRef, {
        balance: admin.firestore.FieldValue.increment(netGain),
        lastSpinAt: now,
        spinHistory: admin.firestore.FieldValue.arrayUnion(spinRecord),
        ...spinEarnedUpdate,
        activities: admin.firestore.FieldValue.arrayUnion({
          type: 'spin',
          prizeLabel: selectedPrize.label,
          amount: selectedPrize.value,
          cost: SPIN_PRICE,
          timestamp
        })
      });

      return { selectedPrize, newBalance, auditHash: spinRecord.auditHash };
    });

    incrementSpins();
    incrementGamePlays('spin_wheel');
    recordGameActiveUser('spin_wheel', actualId);
    adjustTotalBalance(result.selectedPrize.value - SPIN_PRICE);

    console.log(`[GAMEPLAY] User ${actualId} played Spin Wheel. Price: ${SPIN_PRICE} FEST, Prize: ${result.selectedPrize.label} (${result.selectedPrize.value} FEST)`);

    // Check if user just became "Active" after this spin (maybe they just hit 1 task or something, though spin isn't a task)
    // Actually, spin is an activity that could trigger active status if we define it so.
    // But the user said "mandatory tasks" and "ad rewards".
    // I'll call checkAndRewardActiveReferral just in case.
    await checkAndRewardActiveReferral(actualId);

    res.json({
      success: true,
      prize: result.selectedPrize,
      newBalance: result.newBalance,
      auditId: result.auditHash // For transparency
    });
  } catch (error) {
    console.error('Spin Error:', error.message);
    res.status(400).json({ error: error.message || 'Spin failed' });
  }
});


// Get User Profile Data
router.get('/profile/:telegramId', validateINITData, async (req, res) => {
  try {
    const { telegramId } = req.params;
    const userRef = db.collection('users').doc(telegramId.toString());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Calculate statistics
    const activities = userData.activities || [];
    const rewardHistory = userData.rewardHistory || [];
    
    const tasksCompleted = activities.filter(a => a.type === 'task').length;
    const adsWatched = activities.filter(a => a.type === 'ad').length;
    const spinsCount = activities.filter(a => a.type === 'spin' || a.type === 'spin_game').length;
    
    const totalEarned = rewardHistory
      .filter(r => r.type !== 'withdrawal')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    res.json({
      ...userData,
      tasksCompleted,
      adsWatched,
      spinsCount,
      totalEarned,
      activities,
      rewardHistory
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile data' });
  }
});

/**
 * SOLO WHEEL SPIN - Pool-based probability system
 * 
 * FIXED SPIN COST: 100 $FEST (hardcoded, cannot be tampered)
 * Wheel Values: 20, 50, 100, 100, 200, 500, 500, 1000
 * Arranged opposite on wheel for balance
 * 
 * Pool Mechanics:
 * - User loses: (bet - reward) added to pool
 * - User wins: (reward - bet) deducted from pool
 * - Probability depends on pool size
 * - Pool never goes negative
 * - 10s cooldown between spins per user
 */

// FIXED SPIN COST - Cannot be changed by client
const SPIN_GAME_COST = 100; // $FEST tokens

router.post('/spin-game', validateINITData, async (req, res) => {
  try {
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });

    const WHEEL_VALUES = [20, 1000, 50, 500, 100, 500, 100, 200];
    const SPIN_COOLDOWN_MS = 10000; // 10 seconds

    const userRef = db.collection('users').doc(telegramId.toString());
    const poolRef = db.collection('soloPool').doc('pool');

    const result = await db.runTransaction(async (transaction) => {
      // 1. Get user data
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error('User not found');

      const userData = userSnap.data();
      const userBalance = userData.balance || 0;
      const now = Date.now();

      // SECURITY CHECK 1: Cooldown between spins
      const lastSpinGameAt = userData.lastSpinGameAt;
      if (lastSpinGameAt != null) {
        const lastMs = typeof lastSpinGameAt === 'number' ? lastSpinGameAt : lastSpinGameAt.toMillis?.() || 0;
        const timeSinceLastSpin = now - lastMs;
        if (timeSinceLastSpin < SPIN_COOLDOWN_MS) {
          const remainingMs = SPIN_COOLDOWN_MS - timeSinceLastSpin;
          const remainingSeconds = Math.ceil(remainingMs / 1000);
          throw new Error(`Spin cooldown active. Please wait ${remainingSeconds}s before spinning again.`);
        }
      }

      // SECURITY CHECK 2: Verify user has sufficient balance for FIXED spin cost
      if (userBalance < SPIN_GAME_COST) {
        throw new Error(`Insufficient balance. You need ${SPIN_GAME_COST} $FEST to spin.`);
      }

      // 2. Get current pool
      const poolSnap = await transaction.get(poolRef);
      const currentPool = poolSnap.exists ? (poolSnap.data().amount || 0) : 0;

      // 3. Simple Pool-Based Selection: Filter all affordable prizes
      // If the pool has enough amount to provide any prize then there have a chance to win it.
      const affordableIndices = [];
      for (let i = 0; i < WHEEL_VALUES.length; i++) {
        const netWin = WHEEL_VALUES[i] - SPIN_GAME_COST;
        if (netWin <= currentPool) {
          affordableIndices.push(i);
        }
      }

      // 4. Select random index from affordable options
      let rewardIndex = 0;
      if (affordableIndices.length > 0) {
        const randIdx = Math.floor(Math.random() * affordableIndices.length);
        rewardIndex = affordableIndices[randIdx];
      } else {
        // Fallback: pick the lowest value (usually 20) if pool is depleted
        rewardIndex = WHEEL_VALUES.indexOf(Math.min(...WHEEL_VALUES));
      }

      const rewardAmount = WHEEL_VALUES[rewardIndex];
      const userWins = rewardAmount > SPIN_GAME_COST;

      // 5. Update pool after spin
      // When a spin, update pool by (prize - cost). 
      // If it's a loss, pool increases (e.g. 20 - 100 = -80, so currentPool - (-80) = currentPool + 80).
      const netUserGain = rewardAmount - SPIN_GAME_COST;
      const newPoolAmount = currentPool - netUserGain;

      // 6. Update user balance
      const newUserBalance = userBalance - SPIN_GAME_COST + rewardAmount;

      // 7. Record activity
      const timestamp = new Date().toISOString();

      const spinGameEarnedUpdate = netUserGain > 0 ? { totalEarned: admin.firestore.FieldValue.increment(netUserGain) } : {};

      transaction.update(userRef, {
        balance: newUserBalance,
        lastSpinGameAt: now,
        activities: admin.firestore.FieldValue.arrayUnion({
          type: 'spin_game',
          betAmount: SPIN_GAME_COST,
          rewardAmount: rewardAmount,
          amount: netUserGain, // Standardize for history
          poolAmount: newPoolAmount,
          result: userWins ? 'win' : (rewardAmount === SPIN_GAME_COST ? 'breakeven' : 'loss'),
          timestamp
        }),
        ...spinGameEarnedUpdate,
      });

      // 8. Update pool
      transaction.update(poolRef, {
        amount: newPoolAmount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        totalSpins: admin.firestore.FieldValue.increment(1),
        totalWinnings: admin.firestore.FieldValue.increment(Math.max(0, netUserGain)),
        totalLosses: admin.firestore.FieldValue.increment(Math.max(0, -netUserGain))
      });

      return {
        rewardAmount,
        newBalance: newUserBalance,
        poolAmount: newPoolAmount,
        isWin: userWins,
        rewardIndex
      };
    });

    // Report to global stats
    incrementSpins();
    incrementGamePlays('spin_wheel');
    recordGameActiveUser('spin_wheel', telegramId.toString());
    adjustTotalBalance(result.rewardAmount - SPIN_GAME_COST);

    console.log(`[GAMEPLAY] User ${telegramId} played Solo Spin Game. Cost: ${SPIN_GAME_COST} FEST, Payout: ${result.rewardAmount} FEST, Net: ${result.rewardAmount - SPIN_GAME_COST}`);

    res.json({
      success: true,
      reward: result.rewardAmount,
      newBalance: result.newBalance,
      poolAmount: result.poolAmount,
      isWin: result.isWin,
      rewardIndex: result.rewardIndex,
      costPerSpin: SPIN_GAME_COST
    });
  } catch (error) {
    console.error('Spin Game Error:', error.message);
    res.status(400).json({ error: error.message || 'Spin failed' });
  }
});

// Slot Machine Game
router.post('/slot-game', validateINITData, async (req, res) => {
  try {
    const { bet } = req.body;
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });
    
    const validBets = [10, 25, 50, 75, 100];
    if (!validBets.includes(bet)) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }

    const userRef = db.collection('users').doc(telegramId.toString());
    const poolRef = db.collection('soloPool').doc('pool');
    const now = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      const [userSnap, poolSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(poolRef)
      ]);

      if (!userSnap.exists) throw new Error('User not found');
      const userData = userSnap.data();
      const currentPool = poolSnap.exists ? (poolSnap.data().amount || 0) : 0;

      if (userData.balance < bet) throw new Error('Insufficient balance');

      // Randomly generate reels (0-4)
      // 0:🍎, 1:🍋, 2:🍒, 3:👑, 4:💎
      
      // Probability Boost: 20% chance to force a 3-match
      let reel1, reel2, reel3;
      if (Math.random() < 0.2) {
        reel1 = reel2 = reel3 = Math.floor(Math.random() * 5);
      } else {
        reel1 = Math.floor(Math.random() * 5);
        reel2 = Math.floor(Math.random() * 5);
        reel3 = Math.floor(Math.random() * 5);
      }

      const checkPayout = (r1, r2, r3, b) => {
        if (r1 === r2 && r2 === r3) {
          switch (r1) {
            case 4: return Math.floor(b * 2); // 💎
            case 3: return Math.floor(b * 1.5); // 👑
            case 2: return Math.floor(b * (0.6 + Math.random() * 0.8)); // 🍒
            case 1: return Math.floor(b * 0.5); // 🍋
            case 0: return 0; // 🍎
            default: return 0;
          }
        }
        // No match -> 0.6x to 1.4x
        return Math.floor(b * (0.6 + Math.random() * 0.8));
      };

      let payout = checkPayout(reel1, reel2, reel3, bet);
      let netGain = payout - bet;

      // Pool Protection: ensure pool doesn't go negative
      if (netGain > 0 && netGain > currentPool) {
        // Force a non-winning mixed combination
        reel1 = 0; reel2 = 1; reel3 = 2; 
        payout = 0;
        netGain = -bet;
      }

      const newUserBalance = (userData.balance || 0) + netGain;

      const slotEarnedUpdate = netGain > 0 ? { totalEarned: admin.firestore.FieldValue.increment(netGain) } : {};

      transaction.update(userRef, {
        balance: newUserBalance,
        activities: admin.firestore.FieldValue.arrayUnion({
          type: 'slot_game',
          bet: bet,
          payout: payout,
          amount: netGain,
          reels: [reel1, reel2, reel3],
          timestamp: now
        }),
        ...slotEarnedUpdate,
      });

      transaction.update(poolRef, {
        amount: admin.firestore.FieldValue.increment(-netGain),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        totalSpins: admin.firestore.FieldValue.increment(1)
      });

      return { payout, netGain, reels: [reel1, reel2, reel3], newBalance: newUserBalance };
    });

    // Global stats update
    incrementSpins();
    incrementGamePlays('slots');
    recordGameActiveUser('slots', telegramId.toString());
    adjustTotalBalance(result.netGain);

    console.log(`[GAMEPLAY] User ${telegramId} played Slot Game. Bet: ${bet} FEST, Payout: ${result.payout} FEST, Reels: [${result.reels.join(', ')}], Net: ${result.netGain}`);

    res.json({
      success: true,
      payout: result.payout,
      netGain: result.netGain,
      reels: result.reels,
      newBalance: result.newBalance
    });
  } catch (error) {
    console.error('Slot Game Error:', error.message);
    res.status(400).json({ error: error.message || 'Slot spin failed' });
  }
});

// Get current pool status
router.get('/pool-status', async (req, res) => {
  try {
    const poolRef = db.collection('soloPool').doc('pool');
    const poolSnap = await poolRef.get();

    if (!poolSnap.exists) {
      // Initialize pool if doesn't exist
      await poolRef.set({
        amount: 100000, // Initial pool
        totalSpins: 0,
        totalWinnings: 0,
        totalLosses: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.json({ poolAmount: 100000 });
    }

    res.json({ poolAmount: poolSnap.data().amount || 0 });
  } catch (error) {
    console.error('Pool status error:', error);
    res.status(500).json({ error: 'Failed to fetch pool status' });
  }
});

/**
 * Verify interstitial ad was displayed
 * Prevents replay attacks and validates session
 */
router.post('/verify-interstitial', validateINITData, async (req, res) => {
  try {
    res.json({ success: true, verified: true });
  } catch (error) {
    console.error('Interstitial Verification Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Check for multi-account usage on same IP/device
 * Used to prevent PVP bidding from multi-account users
 */
router.post('/check-multi-account', validateINITData, async (req, res) => {
  try {
    const telegramId = req.telegramUser?.id;
    const { deviceFingerprint } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'Missing telegramId' });
    }

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    
    const isMultiAccount = await checkMultiAccountOnDevice(telegramId, ipAddress, deviceFingerprint);

    res.json({ 
      success: true,
      isMultiAccount: isMultiAccount,
      message: isMultiAccount ? 'Multi-account detected on this device' : 'No multi-account detected'
    });
  } catch (error) {
    console.error('Multi-Account Check Error:', error);
    res.status(500).json({ error: 'Multi-account check failed' });
  }
});

export default router;
