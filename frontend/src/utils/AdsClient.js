/**
 * AdsClient.js
 * Centralized Adsgram + RichAds integration for Reward and Interstitial ads.
 * Interstitials: Adsgram → immediately RichAds → 30s cooldown → repeat.
 */

const REWARD_BLOCK_IDS = ['31738', '31739', '31740', '31742'];
const TASK_BLOCK_ID = 'task-31743';
const INTERSTITIAL_BLOCK_IDS = [
  'int-31734',
  'int-31735',
  'int-31736',
  'int-31737'
];

const RICHADS_PUB_ID = '1011428';
const RICHADS_APP_ID = '7391';

/** Last time we counted "user saw an ad" for inactivity-based interstitial logic. */
let lastAdViewTime = Date.now();
let timerStarted = false;

/** True while rewarded ad is active (from open until SDK settles). Blocks interstitial. */
let rewardAdInProgress = false;

/**
 * Interstitial is allowed only if user hasn't started reward ad within this window.
 */
const REWARD_NOT_OPENED_WINDOW_MS = 20000; // 20s

/** Delay before actually showing interstitial (re-check at show-time). */
const INTERSTITIAL_SCHEDULE_DELAY_MS = 800;

let lastRewardStartedAt = Date.now();
let lastInterstitialTime = 0;
const MIN_INTERSTITIAL_INTERVAL_MS = 30000; // 30s cooldown (2 per min)
let interstitialInProgress = false;
let pendingInterstitialTimeout = null;

/** Track whether RichAds has been initialized globally */
let richAdsInitialized = false;

/**
 * Initialize RichAds SDK once.
 */
function initRichAds() {
  if (richAdsInitialized) return;
  try {
    if (window.TelegramAdsController) {
      window.TelegramAdsController = new window.TelegramAdsController();
      window.TelegramAdsController.initialize({
        pubId: RICHADS_PUB_ID,
        appId: RICHADS_APP_ID,
      });
      richAdsInitialized = true;
    }
  } catch (err) {
    console.warn('RichAds init failed:', err);
  }
}

/**
 * Show a RichAds interstitial ad.
 * Tries multiple API methods to ensure compatibility.
 */
async function showRichAdsInterstitial() {
  initRichAds();

  try {
    if (window.TelegramAdsController) {
      // Try showAd with type interstitial first (most common for RichAds)
      if (typeof window.TelegramAdsController.showAd === 'function') {
        return await window.TelegramAdsController.showAd({
          type: 'interstitial',
        });
      }
      // Fallback: showInterstitial
      if (typeof window.TelegramAdsController.showInterstitial === 'function') {
        return await window.TelegramAdsController.showInterstitial();
      }
      // Fallback: renderWidget with interstitial type
      if (typeof window.TelegramAdsController.renderWidget === 'function') {
        return await window.TelegramAdsController.renderWidget({
          widgetType: 'interstitial',
        });
      }
      console.warn('RichAds: No interstitial method found');
      return null;
    }
    console.warn('RichAds: TelegramAdsController not available');
    return null;
  } catch (err) {
    console.warn('RichAds interstitial failed:', err);
    return null;
  }
}

/**
 * Show a RichAds push ad.
 */
async function showRichAdsPush() {
  initRichAds();

  try {
    if (window.TelegramAdsController) {
      if (typeof window.TelegramAdsController.showAd === 'function') {
        return await window.TelegramAdsController.showAd({
          type: 'push',
        });
      }
      if (typeof window.TelegramAdsController.showPush === 'function') {
        return await window.TelegramAdsController.showPush();
      }
      console.warn('RichAds: No push method found');
      return null;
    }
    return null;
  } catch (err) {
    console.warn('RichAds push failed:', err);
    return null;
  }
}

export const AdsClient = {
  /**
   * Reward ad: bumps activity timers and cancels pending interstitial scheduling immediately.
   */
  showRewardAd: async (onReward, customBlockId = null) => {
    const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost || tgId === '123456789') {
      console.log('Dev account or Localhost detected, skipping ad and granting mock reward.');
      if (onReward) await Promise.resolve(onReward({ done: true }));
      return { done: true };
    }

    rewardAdInProgress = true;
    lastAdViewTime = Date.now();
    lastRewardStartedAt = Date.now();
    if (pendingInterstitialTimeout) {
      clearTimeout(pendingInterstitialTimeout);
      pendingInterstitialTimeout = null;
    }

    const blockId = customBlockId || REWARD_BLOCK_IDS[Math.floor(Math.random() * REWARD_BLOCK_IDS.length)];

    try {
      if (window.Adsgram) {
        try {
          const AdController = window.Adsgram.init({ blockId });
          const result = await AdController.show();
          lastAdViewTime = Date.now();
          // ONLY call onReward if ad was actually finished
          if (onReward && result?.done) {
            await Promise.resolve(onReward(result));
          }
          return result;
        } catch (err) {
          console.warn('Reward Ad failed:', err);
          throw err;
        }
      }

      console.warn('Adsgram not loaded. Ad rewards disabled.');
    } finally {
      rewardAdInProgress = false;
    }
  },

  showInterstitial: async () => {
    // No-op - Interstitials disabled
  },

  /**
   * Inactivity watcher: triggers interstitials after idle periods.
   */
  startInactivityWatcher: () => {
    // No-op - Interstitials disabled
  },
};
