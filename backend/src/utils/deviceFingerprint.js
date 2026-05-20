import { db } from '../config/firebase.js';
import crypto from 'crypto';

/**
 * Generate a device fingerprint based on device/browser characteristics
 * Includes: UserAgent, language, timezone, screen resolution, etc.
 */
export function generateDeviceHash(userAgent = '', language = '', timezone = '') {
  const fingerprintData = `${userAgent}::${language}::${timezone}`;
  return crypto.createHash('sha256').update(fingerprintData).digest('hex');
}

/**
 * Check if multiple accounts exist on the same IP/device
 * Returns true if user has more than 1 account on this IP/device
 */
export async function checkMultiAccountOnDevice(telegramId, ipAddress, deviceFingerprint) {
  try {
    // Block exploit script fingerprint format
    if (deviceFingerprint && deviceFingerprint.startsWith('fp_share_')) {
      console.warn(`[MultiAccount] Blocked script/bot fingerprint for user ${telegramId}`);
      return true;
    }

    // Require device fingerprint to participate
    if (!deviceFingerprint) {
      console.warn(`[MultiAccount] Missing device fingerprint for user ${telegramId}`);
      return true;
    }

    // Query by device fingerprint
    const deviceQuery = await db.collection('users')
      .where('deviceFingerprint', '==', deviceFingerprint)
      .limit(10)
      .get();

    const usersOnDevice = deviceQuery.docs
      .map(doc => doc.id)
      .filter(id => id !== telegramId.toString());

    if (usersOnDevice.length > 0) {
      console.log(`[MultiAccount] Telegram ID ${telegramId} has ${usersOnDevice.length} other account(s) on device ${deviceFingerprint}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[MultiAccount] Error checking for multi-accounts:', error);
    return false;
  }
}

/**
 * Register/update device info for a user
 */
export async function updateUserDeviceInfo(telegramId, ipAddress, deviceFingerprint, userAgent = '') {
  try {
    const userRef = db.collection('users').doc(telegramId.toString());
    await userRef.update({
      lastIpAddress: ipAddress,
      deviceFingerprint: deviceFingerprint,
      userAgent: userAgent,
      lastDeviceUpdateAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('[DeviceInfo] Error updating device info:', error);
    return false;
  }
}

/**
 * Get user's device history (for admin review)
 */
export async function getUserDeviceHistory(telegramId) {
  try {
    const userRef = db.collection('users').doc(telegramId.toString());
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      lastIpAddress: data.lastIpAddress || null,
      deviceFingerprint: data.deviceFingerprint || null,
      userAgent: data.userAgent || null,
      lastDeviceUpdateAt: data.lastDeviceUpdateAt || null,
      lastAdRewardAt: data.lastAdRewardAt || null,
      isMultiAccountDetected: await checkMultiAccountOnDevice(telegramId, data.lastIpAddress, data.deviceFingerprint),
    };
  } catch (error) {
    console.error('[DeviceHistory] Error fetching device history:', error);
    return null;
  }
}

/**
 * Get all linked accounts on the same IP/device
 */
export async function getLinkedAccountsOnIP(ipAddress) {
  try {
    const query = await db.collection('users')
      .where('lastIpAddress', '==', ipAddress)
      .select('username', 'tier', 'balance', 'lastAdRewardAt')
      .get();

    return query.docs.map(doc => ({
      telegramId: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('[LinkedAccounts] Error fetching linked accounts:', error);
    return [];
  }
}
