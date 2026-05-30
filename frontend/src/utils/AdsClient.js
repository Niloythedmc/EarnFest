/**
 * AdsClient.js
 * Centralized Adsgram + RichAds integration for Reward and Interstitial ads.
 * Interstitials: Adsgram → immediately RichAds → 30s cooldown → repeat.
 */

const REWARD_BLOCK_IDS = ['32312', '32313', '32314', '32315'];
const TASK_BLOCK_ID = 'task-32316';
const INTERSTITIAL_BLOCK_IDS = [
  'int-32317',
  'int-32318',
  'int-32319',
  'int-32320'
];

const RICHADS_PUB_ID = '1011428';
const RICHADS_APP_ID = '7569';

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

/**
 * Helper to check and record interstitial views with an hourly limit of 20.
 */
const checkAndRecordInterstitial = () => {
  const now = Date.now();
  let interstitialViews = JSON.parse(localStorage.getItem('interstitial_views') || '[]');
  interstitialViews = interstitialViews.filter(timestamp => now - timestamp < 3600000);
  
  if (interstitialViews.length >= 20) {
    return { allowed: false, views: interstitialViews };
  }
  
  interstitialViews.push(now);
  localStorage.setItem('interstitial_views', JSON.stringify(interstitialViews));
  return { allowed: true, views: interstitialViews };
};

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
          if (result?.done) {
            // Immediately show Monetag ad (use rewarded interstitial type: 'end' to avoid popup blocking)
            if (window.show_11071748) {
              try {
                console.log('[AdsClient] Showing Monetag Rewarded Interstitial for user:', tgId);
                await window.show_11071748({ type: 'end', ymid: tgId });
              } catch (monetagErr) {
                console.warn('[AdsClient] Monetag ad failed or was dismissed:', monetagErr);
              }
            } else {
              console.warn('[AdsClient] Monetag SDK not loaded, cannot show second ad.');
            }

            if (onReward) {
              await Promise.resolve(onReward(result));
            }
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
    try {
      const now = Date.now();
      const timeSinceLastAd = now - lastAdViewTime;
      if (timeSinceLastAd < 60000) { // 60s cooldown
        console.log(`[AdsClient] Interstitial rate limited. Only ${Math.round(timeSinceLastAd/1000)}s since last ad.`);
        return;
      }

      if (rewardAdInProgress || interstitialInProgress) {
        return;
      }

      const check = checkAndRecordInterstitial();
      if (!check.allowed) {
        console.log("[AdsClient] Interstitial skipped: hourly limit of 20 reached");
        return;
      }

      interstitialInProgress = true;
      lastAdViewTime = now;

      const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || 'unknown';
      const choices = ['richads', 'monetag', 'adexium', 'adsgram'];
      const choice = choices[Math.floor(Math.random() * choices.length)];
      
      console.log(`[AdsClient] Showing interstitial (${choice}). Count in last hour: ${check.views.length}`);

      let res = null;
      if (choice === 'richads') {
        res = await showRichAdsInterstitial();
      } else if (choice === 'monetag') {
        if (window.show_11071748) {
          try {
            res = await window.show_11071748({ type: 'end', ymid: tgId });
          } catch (err) {
            console.warn('[AdsClient] Monetag interstitial failed, falling back to RichAds:', err);
            res = await showRichAdsInterstitial();
          }
        } else {
          res = await showRichAdsInterstitial();
        }
      } else if (choice === 'adexium') {
        if (window.AdexiumWidget) {
          try {
            const widget = new window.AdexiumWidget({
              wid: '26ae87d5-b62e-4ff4-a518-01da857dffdd',
              adFormat: 'interstitial'
            });
            widget.requestAd('interstitial');
            widget.on('adReceived', (ad) => {
              widget.displayAd(ad);
            });
            res = { done: true };
          } catch (err) {
            console.warn('[AdsClient] Adexium interstitial failed, falling back to RichAds:', err);
            res = await showRichAdsInterstitial();
          }
        } else {
          res = await showRichAdsInterstitial();
        }
      } else if (choice === 'adsgram') {
        if (window.Adsgram) {
          try {
            const blockId = INTERSTITIAL_BLOCK_IDS[Math.floor(Math.random() * INTERSTITIAL_BLOCK_IDS.length)];
            const AdController = window.Adsgram.init({ blockId });
            res = await AdController.show();
          } catch (err) {
            console.warn('[AdsClient] Adsgram interstitial failed, falling back to RichAds:', err);
            res = await showRichAdsInterstitial();
          }
        } else {
          res = await showRichAdsInterstitial();
        }
      }

      interstitialInProgress = false;
      return res;
    } catch (e) {
      console.error("[AdsClient] showInterstitial error:", e);
      interstitialInProgress = false;
    }
  },

  /**
   * Inactivity watcher: triggers Monetag in-app interstitial after idle periods.
   */
  startInactivityWatcher: () => {
    try {
      const now = Date.now();
      let interstitialViews = JSON.parse(localStorage.getItem('interstitial_views') || '[]');
      interstitialViews = interstitialViews.filter(timestamp => now - timestamp < 3600000);
      
      if (interstitialViews.length >= 20) {
        console.log("[AdsClient] Monetag inApp skipped: hourly interstitial limit of 20 reached");
        return;
      }

      if (window.show_11071748) {
        window.show_11071748({
          type: 'inApp',
          inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
          }
        });
        const check = checkAndRecordInterstitial();
        console.log("[AdsClient] Monetag inApp initialized. Interstitial count in last hour:", check.views.length);
      } else {
        const checkAndRun = setInterval(() => {
          if (window.show_11071748) {
            try {
              let currentViews = JSON.parse(localStorage.getItem('interstitial_views') || '[]');
              currentViews = currentViews.filter(timestamp => Date.now() - timestamp < 3600000);
              if (currentViews.length >= 20) {
                console.log("[AdsClient] Monetag inApp skipped: hourly interstitial limit of 20 reached (deferred)");
                clearInterval(checkAndRun);
                return;
              }

              window.show_11071748({
                type: 'inApp',
                inAppSettings: {
                  frequency: 2,
                  capping: 0.1,
                  interval: 30,
                  timeout: 5,
                  everyPage: false
                }
              });
              const check = checkAndRecordInterstitial();
              console.log("[AdsClient] Monetag inApp initialized (deferred). Interstitial count in last hour:", check.views.length);
              clearInterval(checkAndRun);
            } catch (err) {
              console.error("[AdsClient] Failed to initialize Monetag inApp:", err);
              clearInterval(checkAndRun);
            }
          }
        }, 1000);
        setTimeout(() => clearInterval(checkAndRun), 10000);
      }
    } catch (e) {
      console.error("[AdsClient] Error initializing inactivity watcher / inApp:", e);
    }
  }
};
