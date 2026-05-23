import admin, { db } from '../config/firebase.js';
import { checkAdRewardMembership } from './telegramChats.js';

/**
 * Checks if a user meets the "Active Friend" criteria.
 * Criteria: 1+ ad views, joined mandatory channels, completed at least 1 task.
 */
export async function isUserActive(userData) {
  // 1. Must have viewed at least 1 ad
  if ((userData.totalAdViews || 0) < 1) return false;

  // 2. Must have joined required channels (mandatory for ad watching)
  // Note: We use the telegramId which is the document ID as well
  const membership = await checkAdRewardMembership(userData.telegramId);
  if (!membership.ok) return false;

  // 3. Must have completed at least one task
  const taskHistory = userData.taskHistory || [];
  if (taskHistory.length === 0) return false;

  return true;
}

/**
 * Credits 20% commission to a referrer.
 * Can be used within an existing transaction or standalone.
 */
export async function processReferralCommission(friendId, amount, type, referrerId, tx = null) {
  if (!referrerId || !amount || amount <= 0) return;

  const commission = amount * 0.2;
  const timestamp = new Date().toISOString();
  const referrerRef = db.collection('users').doc(String(referrerId));

  console.log(`[REFERRAL_COMMISSION] Credited ${commission} FEST (20% of ${amount} for ${type}) to Referrer ${referrerId} from Friend ${friendId}`);

  const commissionEntry = {
    type: 'referral_commission',
    subType: type,
    fromUser: String(friendId),
    amount: commission,
    timestamp,
  };

  const updateData = {
    balance: admin.firestore.FieldValue.increment(commission),
    referralEarnings: admin.firestore.FieldValue.increment(commission),
    totalEarned: admin.firestore.FieldValue.increment(commission),
  };

  if (tx) {
    tx.update(referrerRef, {
      ...updateData,
      activities: admin.firestore.FieldValue.arrayUnion(commissionEntry),
    });
  } else {
    try {
      const snap = await referrerRef.get();
      if (snap.exists) {
        const activities = [...(snap.data().activities || [])];
        activities.unshift(commissionEntry);
        await referrerRef.update({
          ...updateData,
          activities: activities.slice(0, 30)
        });
      }
    } catch (e) {
      console.error(`Failed to credit referral commission to ${referrerId}:`, e.message);
    }
  }
}

/**
 * Checks and rewards the referrer with 40 if the user just became active.
 * Uses a transaction to ensure the bonus is paid exactly once.
 */
export async function checkAndRewardActiveReferral(userId) {
  const userRef = db.collection('users').doc(String(userId));
  
  try {
    return await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) return { success: false, error: 'User not found' };

      const userData = userDoc.data();
      
      // Early exit if already paid or no referrer
      if (userData.referralBonusPaid || !userData.referredBy) {
        return { success: false, reason: 'Already paid or no referrer' };
      }

      const active = await isUserActive(userData);
      if (!active) {
        return { success: false, reason: 'Not yet active' };
      }

      // Credit 40 bonus to referrer
      const bonus = 40;
      const timestamp = new Date().toISOString();
      const referrerRef = db.collection('users').doc(String(userData.referredBy));

      const referrerSnap = await tx.get(referrerRef);
      if (referrerSnap.exists) {
        const activities = [...(referrerSnap.data().activities || [])];
        activities.unshift({
          type: 'referral_active_bonus',
          fromUser: String(userId),
          amount: bonus,
          timestamp,
        });

        tx.update(referrerRef, {
          balance: admin.firestore.FieldValue.increment(bonus),
          referralEarnings: admin.firestore.FieldValue.increment(bonus),
          totalEarned: admin.firestore.FieldValue.increment(bonus),
          activities: activities.slice(0, 30),
        });
      }

      tx.update(userRef, {
        referralBonusPaid: true,
        activeAt: timestamp
      });

      console.log(`[Referral] User ${userId} became active. Referrer ${userData.referredBy} rewarded with $${bonus}`);
      return { success: true, bonus };
    });
  } catch (error) {
    console.error(`Error in checkAndRewardActiveReferral for ${userId}:`, error.message);
    return { success: false, error: error.message };
  }
}
