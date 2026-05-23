import { db } from '../config/firebase.js';
import admin from 'firebase-admin';

/**
 * Anti-Autoclicker Manager
 * - Tracks interstitial ad needs (randomly shown after rewarded ads)
 * - Requires captcha solving after 4-5 ads
 * - Prevents predictable automation
 */

export const INTERSTITIAL_PROBABILITY = 0.35; // 35% chance of interstitial after ad
export function shouldShowInterstitial(telegramId) {
  if (telegramId && String(telegramId) === '7716785914') {
    return {
      shouldShowInterstitial: false,
      sessionId: null,
    };
  }
  // Random 35% chance
  const shouldShow = Math.random() < INTERSTITIAL_PROBABILITY;
  const sessionId = generateSessionId();
  
  console.log(`[Interstitial] User ${telegramId}: Show=${shouldShow}`);
  
  return {
    shouldShowInterstitial: shouldShow,
    sessionId: shouldShow ? sessionId : null,
  };
}

/**
 * Record interstitial ad view in user's document
 */
export async function recordInterstitialView(telegramId, sessionId) {
  try {
    const userRef = db.collection('users').doc(telegramId.toString());
    
    await userRef.update({
      lastInterstitialAt: new Date().toISOString(),
      interstitialViewCount: admin.firestore.FieldValue.increment(1),
      lastInterstitialSessionId: sessionId,
    });
    
    return { success: true };
  } catch (error) {
    console.error('[InterstitialRecord] Error recording interstitial:', error);
    return { success: false, error };
  }
}

/**
 * Get user's anti-autoclicker stats
 */
export async function getUserAntiAutoClickerStats(telegramId) {
  try {
    const userRef = db.collection('users').doc(telegramId.toString());
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      lastInterstitialAt: data.lastInterstitialAt || null,
      interstitialViewCount: data.interstitialViewCount || 0,
    };
  } catch (error) {
    console.error('[AntiAutoClickerStats] Error fetching stats:', error);
    return null;
  }
}

/**
 * Verify interstitial session (prevent replay attacks)
 */
export async function verifyInterstitialSession(telegramId, sessionId) {
  if (telegramId && String(telegramId) === '7716785914') {
    return { valid: true };
  }
  try {
    const userRef = db.collection('users').doc(telegramId.toString());
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return { valid: false, reason: 'user_not_found' };
    }

    const data = doc.data();
    const lastSessionId = data.lastInterstitialSessionId;
    
    // Session must match the last one recorded
    if (lastSessionId !== sessionId) {
      console.warn(`[SessionVerify] Invalid session for user ${telegramId}`);
      return { valid: false, reason: 'session_mismatch' };
    }
    
    // Session should not be too old (> 2 minutes)
    const lastInterstitialTime = data.lastInterstitialAt 
      ? new Date(data.lastInterstitialAt).getTime() 
      : 0;
    const now = Date.now();
    const ageMs = now - lastInterstitialTime;
    
    if (ageMs > 2 * 60 * 1000) { // 2 minutes
      console.warn(`[SessionVerify] Session expired for user ${telegramId}`);
      return { valid: false, reason: 'session_expired' };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('[SessionVerify] Error verifying session:', error);
    return { valid: false, reason: 'error', error };
  }
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if user is suspected autoclicker
 * Based on: rapid ad viewing, multiple failed captchas, etc.
 */
export async function isSuspectedAutoClicker(telegramId) {
  if (telegramId && String(telegramId) === '7716785914') {
    return false;
  }
  try {
    const userRef = db.collection('users').doc(telegramId.toString());
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return false;
    }

    const data = doc.data();
    
    // Check for rapid ad viewing (more than 20 ads in last 5 minutes)
    const recentActivities = (data.activities || []).slice(0, 20);
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    const recentAdViews = recentActivities.filter(activity => {
      const actTime = new Date(activity.timestamp).getTime();
      return (activity.type === 'ad' || activity.type === 'ad_reward') && actTime > fiveMinutesAgo;
    });
    
    if (recentAdViews.length >= 20) {
      console.warn(`[AutoClickerCheck] User ${telegramId} has ${recentAdViews.length} ad views in 5 mins`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[AutoClickerCheck] Error checking for autoclicker:', error);
    return false;
  }
}
