import admin, { db } from '../config/db.js';
import { TIERS, REWARD_TYPES } from '../config/tiers.js';
import { incrementRewardAds, adjustTotalBalance } from './stats.js';
import { checkAdRewardMembership } from './telegramChats.js';
import { processReferralCommission, checkAndRewardActiveReferral } from './referralLogic.js';
import { shouldShowInterstitial, recordInterstitialView, isSuspectedAutoClicker } from './antiAutoClickerManager.js';
import { checkMultiAccountOnDevice, updateUserDeviceInfo } from './deviceFingerprint.js';
import { isSpecialUser } from './specialUsers.js';

/** Minimum milliseconds between ad rewards per user (client API + AdsGram S2S share this). */
export const MIN_AD_REWARD_INTERVAL_MS = Number(process.env.AD_REWARD_COOLDOWN_MS) || 28000;

export const AD_CYCLE_LIMIT = 20;
export const AD_CYCLE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Credits one rewarded ad (balance, counters, referral bump). Uses a transaction + cooldown
 * so concurrent S2S + client calls cannot double-pay.
 * Also checks for anti-autoclicker measures (interstitials, captchas).
 */
export async function creditAdRewardForTelegramId(telegramIdRaw, deviceInfo = {}) {
  const telegramIdStr = String(telegramIdRaw);
  const userRef = db.collection('users').doc(telegramIdStr);
  const now = Date.now();
  const specialUser = isSpecialUser(telegramIdRaw);

  try {
    // Check for suspected autoclicker
    if (!specialUser) {
      const isAutoClicker = await isSuspectedAutoClicker(telegramIdRaw);
      if (isAutoClicker) {
        console.warn(`[AdReward] Suspected autoclicker: ${telegramIdRaw}`);
        return {
          ok: false,
          code: 'suspected_autoclicker',
          status: 429,
          message: 'Unusual activity detected',
        };
      }
    }

    // Block suspicious scripts using spoofed fingerprints
    if (deviceInfo.deviceFingerprint && deviceInfo.deviceFingerprint.startsWith('fp_share_')) {
      console.warn(`[AdReward] Blocked script/bot fingerprint for user ${telegramIdRaw}`);
      return {
        ok: false,
        code: 'blocked_script',
        status: 400,
        message: 'Access denied: Automated script detected.',
      };
    }

    // Update device info if provided
    if (deviceInfo.ipAddress || deviceInfo.deviceFingerprint) {
      await updateUserDeviceInfo(telegramIdStr, deviceInfo.ipAddress, deviceInfo.deviceFingerprint, deviceInfo.userAgent);
    }

    if (!specialUser) {
      const membership = await checkAdRewardMembership(telegramIdRaw);
      if (!membership.ok) {
        console.log(`[AdReward] Membership check failed for ${telegramIdRaw}:`, membership.missing);
        return {
          ok: false,
          code: 'membership_required',
          status: 403,
          message: 'Join required channels to earn ad rewards',
          missing: membership.missing,
        };
      }
    }

    const outcome = await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) {
        return { code: 'not_found', status: 404 };
      }

      const userData = userDoc.data();
      
      // 1. Basic Cooldown (30s)
      if (!specialUser) {
        const last = userData.lastAdRewardAt;
        if (last != null) {
          const lastMs =
            typeof last === 'number'
              ? last
              : typeof last?.toMillis === 'function'
                ? last.toMillis()
                : new Date(last).getTime();
          if (now - lastMs < MIN_AD_REWARD_INTERVAL_MS) {
            return {
              code: 'cooldown',
              status: 429,
              retryAfterSec: Math.ceil((MIN_AD_REWARD_INTERVAL_MS - (now - lastMs)) / 1000),
            };
          }
        }
      }

      // 2. Cycle Logic (20 ads / 15 min)
      let cycleCount = userData.adCycleCount || 0;
      let cycleResetAt = userData.lastAdCycleResetAt || 0;

      if (!specialUser) {
        if (cycleCount >= AD_CYCLE_LIMIT) {
          const timeSinceReset = now - cycleResetAt;
          if (timeSinceReset < AD_CYCLE_COOLDOWN_MS) {
            return {
              code: 'cycle_limit',
              status: 429,
              retryAfterSec: Math.ceil((AD_CYCLE_COOLDOWN_MS - timeSinceReset) / 1000),
            };
          } else {
            // Reset cycle
            cycleCount = 0;
          }
        }
      }

      const tierConfig = TIERS[userData.tier] || TIERS.free;
      const rewardAmount = tierConfig.ads;
      const timestamp = new Date().toISOString();

      const activities = [...(userData.activities || [])];
      activities.unshift({
        type: REWARD_TYPES.AD,
        amount: rewardAmount,
        timestamp,
      });

      const rewardHistory = [...(userData.rewardHistory || [])];
      rewardHistory.unshift({
        type: 'ad_reward',
        amount: rewardAmount,
        timestamp,
      });

      const newCycleCount = cycleCount + 1;
      const updateData = {
        balance: admin.firestore.FieldValue.increment(rewardAmount),
        adsCountToday: admin.firestore.FieldValue.increment(1),
        spinAdViews: admin.firestore.FieldValue.increment(1),
        adCycleCount: newCycleCount,
        lastAdCycleResetAt: newCycleCount >= AD_CYCLE_LIMIT ? now : (cycleCount === 0 ? now : cycleResetAt),
        totalAdViews: admin.firestore.FieldValue.increment(1),
        totalAdEarnings: admin.firestore.FieldValue.increment(rewardAmount),
        totalEarned: admin.firestore.FieldValue.increment(rewardAmount),
        lastAdRewardAt: now,
        activities: activities.slice(0, 30),
        rewardHistory: rewardHistory.slice(0, 30),
      };

      tx.update(userRef, updateData);

      return {
        code: 'ok',
        prevBalance: userData.balance || 0,
        rewardAmount,
        referredBy: userData.referredBy || null,
        joinedViaLink: userData.joinedViaLink || null,
        timestamp,
        telegramIdStr,
        adCycleCount: newCycleCount,
        lastAdCycleResetAt: updateData.lastAdCycleResetAt,
      };
    });

    if (outcome.code === 'not_found') {
      return { ok: false, code: 'not_found', status: 404, message: 'User not found' };
    }
    if (outcome.code === 'cooldown') {
      return {
        ok: false,
        code: 'cooldown',
        status: 429,
        retryAfterSec: outcome.retryAfterSec,
        message: 'Ad reward cooldown',
      };
    }
    if (outcome.code === 'cycle_limit') {
      return {
        ok: false,
        code: 'cycle_limit',
        status: 429,
        retryAfterSec: outcome.retryAfterSec,
        message: 'Ad cycle limit reached',
      };
    }

    // Anti-autoclicker measures
    const { shouldShowInterstitial: showInterstitial, sessionId } = shouldShowInterstitial(telegramIdRaw);

    if (showInterstitial) {
      await recordInterstitialView(telegramIdRaw, sessionId);
    }

    incrementRewardAds(outcome.rewardAmount);
    adjustTotalBalance(outcome.rewardAmount);

    if (outcome.referredBy) {
      // 20% Continuous Commission
      await processReferralCommission(outcome.telegramIdStr, outcome.rewardAmount, REWARD_TYPES.AD, outcome.referredBy);
      
      // Check if user just became "Active" (1st ad + tasks + joins)
      await checkAndRewardActiveReferral(outcome.telegramIdStr);
    }

    if (outcome.joinedViaLink && outcome.joinedViaLink.linkId) {
      const linkRef = db.collection('referralLinks').doc(outcome.joinedViaLink.linkId);
      await linkRef.update({
        adViews: admin.firestore.FieldValue.increment(1),
        adEarnings: admin.firestore.FieldValue.increment(outcome.rewardAmount),
      });
    }

    console.log(`[AD_REWARD] Credited Ad Reward to User: ${telegramIdRaw}, Amount: ${outcome.rewardAmount} FEST. New Balance: ${outcome.prevBalance + outcome.rewardAmount}`);

    return {
      ok: true,
      newBalance: outcome.prevBalance + outcome.rewardAmount,
      rewardAmount: outcome.rewardAmount,
      adCycleCount: outcome.adCycleCount,
      lastAdCycleResetAt: outcome.lastAdCycleResetAt,
      antiAutoclicker: {
        shouldShowInterstitial: showInterstitial,
        interstitialSessionId: sessionId,
      },
    };
  } catch (e) {
    console.error('creditAdRewardForTelegramId:', e);
    return { ok: false, code: 'error', status: 500, message: 'Reward failed' };
  }
}
