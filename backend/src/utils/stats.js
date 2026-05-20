import admin, { db } from '../config/firebase.js';

const STATS_REF = () => db.collection('users').doc('AppStats');
const USER_INDEX_REF = () => db.collection('appdata').doc('users');

/**
 * Fire-and-forget wrapper — never throws, never blocks the caller.
 */
const safeUpdate = async (updateFn) => {
  try {
    await updateFn();
  } catch (err) {
    if (err.code === 8 && err.details?.includes('Quota exceeded')) {
      return;
    }
    console.error('[AppStats] Update failed silently:', err.message);
  }
};

/**
 * Called when a brand new user registers for the first time.
 */
export const recordNewUser = (userId) => {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return safeUpdate(() =>
    STATS_REF().update({
      totalUsers: admin.firestore.FieldValue.increment(1),
      [`dailyNewUsers_${dateKey}`]: admin.firestore.FieldValue.increment(1),
      lastUpdated: new Date().toISOString()
    })
  );
};

/**
 * Called on every app open.
 */
export const recordActiveUser = (userId) => {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return safeUpdate(() =>
    STATS_REF().update({
      [`dailyActiveUsers_${dateKey}`]: admin.firestore.FieldValue.increment(1),
      lastUpdated: new Date().toISOString()
    })
  );
};

/**
 * Called when a reward ad is completed.
 */
export const incrementRewardAds = () => {
  return safeUpdate(() =>
    STATS_REF().update({
      totalRewardAds: admin.firestore.FieldValue.increment(1),
      lastUpdated: new Date().toISOString()
    })
  );
};

/**
 * Called when an interstitial ad is shown.
 */
export const incrementInterstitials = () => {
  return safeUpdate(() =>
    STATS_REF().update({
      totalInterstitials: admin.firestore.FieldValue.increment(1),
      lastUpdated: new Date().toISOString()
    })
  );
};

/**
 * Called when user spins the wheel.
 */
export const incrementSpins = () => safeUpdate(() =>
  STATS_REF().update({
    totalSpins: admin.firestore.FieldValue.increment(1),
    lastUpdated: new Date().toISOString()
  })
);

/**
 * Called when a tier upgrade is verified and applied.
 */
export const recordTierPurchase = (tier, amountUsd) => safeUpdate(() =>
  STATS_REF().update({
    totalRevenue: admin.firestore.FieldValue.increment(Number(amountUsd) || 0),
    [`tierSales.${tier}`]: admin.firestore.FieldValue.increment(1),
    lastUpdated: new Date().toISOString()
  })
);

export const adjustTotalBalance = (amount) => {
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount === 0) return;
  return safeUpdate(() =>
    STATS_REF().update({
      totalBalance: admin.firestore.FieldValue.increment(amount),
      lastUpdated: new Date().toISOString()
    })
  );
};

/**
 * Called when a withdrawal request is submitted.
 */
export const incrementWithdrawals = (amount) => safeUpdate(() =>
  STATS_REF().update({
    totalWithdrawals: admin.firestore.FieldValue.increment(1),
    pendingWithdrawals: admin.firestore.FieldValue.increment(1),
    totalWithdrawalAmount: admin.firestore.FieldValue.increment(Number(amount) || 0),
    lastUpdated: new Date().toISOString()
  })
);

/**
 * Called when a withdrawal is completed or refunded (to reduce pending count).
 */
export const decrementPendingWithdrawals = () => safeUpdate(() =>
  STATS_REF().update({
    pendingWithdrawals: admin.firestore.FieldValue.increment(-1),
    lastUpdated: new Date().toISOString()
  })
);

/**
 * Called when a promo code is successfully claimed.
 */
export const incrementPromos = () => safeUpdate(() =>
  STATS_REF().update({
    totalPromosClaimed: admin.firestore.FieldValue.increment(1),
    lastUpdated: new Date().toISOString()
  })
);

/**
 * Called when a task is verified and reward issued.
 */
export const incrementTaskCompletions = () => safeUpdate(() =>
  STATS_REF().update({
    totalTasksCompleted: admin.firestore.FieldValue.increment(1),
    lastUpdated: new Date().toISOString()
  })
);

/**
 * Game names used across the app:
 *   'spin_wheel', 'mines', 'slots', 'pvp'
 */

/**
 * Increment total plays for a specific game.
 * @param {'spin_wheel'|'mines'|'slots'|'pvp'} gameName
 */
export const incrementGamePlays = (gameName) => safeUpdate(() =>
  STATS_REF().update({
    [`gamePlays.${gameName}`]: admin.firestore.FieldValue.increment(1),
    lastUpdated: new Date().toISOString()
  })
);

/**
 * Record an active user for a specific game today.
 * Uses a daily key so we can see "active today" per game.
 * @param {'spin_wheel'|'mines'|'slots'|'pvp'} gameName
 * @param {string} userId
 */
export const recordGameActiveUser = (gameName, userId) => {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return safeUpdate(() =>
    STATS_REF().update({
      [`gameActiveUsers.${gameName}.${dateKey}`]: admin.firestore.FieldValue.increment(1),
      lastUpdated: new Date().toISOString()
    })
  );
};

/**
 * Initialize and cleanup the AppStats document.
 */
export const ensureStatsDocExists = async () => {
  try {
    const doc = await STATS_REF().get();
    if (!doc.exists) {
      await STATS_REF().set({
        totalUsers: 0,
        totalRewardAds: 0,
        totalInterstitials: 0,
        totalSpins: 0,
        totalRevenue: 0,
        totalWithdrawals: 0,
        pendingWithdrawals: 0,
        totalWithdrawalAmount: 0,
        tierSales: { free: 0, silver: 0, gold: 0, diamond: 0 },
        totalPromosClaimed: 0,
        totalTasksCompleted: 0,
        totalBalance: 0,
        gamePlays: { spin_wheel: 0, mines: 0, slots: 0, pvp: 0 },
        gameActiveUsers: { spin_wheel: {}, mines: {}, slots: {}, pvp: {} },
        lastUpdated: new Date().toISOString()
      });
      console.log('[AppStats] Initialized AppStats document.');
    } else {
      // PROACTIVE CLEANUP: Remove bloated fields that cause index errors
      const data = doc.data();
      const fieldsToDelete = {};
      if (data.usersJoined) fieldsToDelete.usersJoined = admin.firestore.FieldValue.delete();
      if (data.activeUsers) fieldsToDelete.activeUsers = admin.firestore.FieldValue.delete();
      if (data.rewardAdEvents) fieldsToDelete.rewardAdEvents = admin.firestore.FieldValue.delete();
      if (data.interstitialEvents) fieldsToDelete.interstitialEvents = admin.firestore.FieldValue.delete();

      if (Object.keys(fieldsToDelete).length > 0) {
        console.log('[AppStats] Pruning bloated historical fields...');
        await STATS_REF().update(fieldsToDelete);
      }
    }
  } catch (err) {
    if (err.code === 8 && err.details?.includes('Quota exceeded')) {
      console.error('[AppStats] Quota exceeded.');
    } else {
      console.error('[AppStats] Could not initialize/prune:', err.message);
    }
  }
};

/**
 * Updates the centralized search index in appdata/users.
 * Stores basic info (ID, lowercase username, lowercase name, pic) for instant admin search.
 */
export const updateUserSearchIndex = (userData) => {
  const tid = userData.telegramId?.toString() || userData.id?.toString();
  if (!tid) return;

  const username = (userData.username || '').toLowerCase();
  const name = (userData.firstName || '').toLowerCase();
  const pic = userData.photoUrl || '';

  return safeUpdate(() =>
    USER_INDEX_REF().set({
      [tid]: {
        u: username,
        n: name,
        p: pic,
        id: tid
      }
    }, { merge: true })
  );
};
