import express from 'express';
import admin, { db } from '../config/firebase.js';
import { validateINITData } from '../middleware/auth.js';
import { verifyTonTransaction } from '../utils/ton.js';
import { getTonPrice } from '../utils/price.js';
import { sendTelegramMessage } from '../utils/bot.js';
import { parsePublicUsernameFromTelegramLink } from '../utils/telegramChats.js';

const router = express.Router();

const PLATFORM_TON_WALLET = process.env.TON_DESTINATION_WALLET || 'UQD9IooF-EBlvryx2G8TIZNtDwM_KR3I8lAIW5ID-drfcgnw';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || process.env.OWNER_CHAT_ID || '';

// ── Plan Definitions ─────────────────────────────────────────────────────────
const PLANS = {
  only_task: {
    key: 'only_task',
    label: 'Only Tasks',
    priceTon: 10,
    priceUsd: 10,
    features: ['1 lifetime task in Tasks page'],
    taskSlots: 1,
    bannerSlots: 0,
    collaboration: false,
  },
  featured: {
    key: 'featured',
    label: 'Featured Task',
    priceTon: 20,
    priceUsd: 20,
    features: ['2 lifetime tasks in Tasks page', 'Banner featuring in Home page'],
    taskSlots: 2,
    bannerSlots: 1,
    collaboration: false,
  },
  collaboration: {
    key: 'collaboration',
    label: 'Collaboration',
    priceTon: 50,
    priceUsd: 50,
    features: ['2 lifetime tasks in Tasks page', 'Banner featuring in Home page', 'Project collaboration', 'Social announcement', 'Bot notification'],
    taskSlots: 2,
    bannerSlots: 1,
    collaboration: true,
  },
};

// ── 1. Get payment details for a plan ────────────────────────────────────────
router.post('/init-payment', validateINITData, async (req, res) => {
  try {
    const { planKey } = req.body;
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });
    if (!planKey || !PLANS[planKey]) return res.status(400).json({ error: 'Invalid plan' });

    const plan = PLANS[planKey];
    const livePrice = await getTonPrice();
    const amountTon = (plan.priceUsd / livePrice).toFixed(4);
    const memo = `${telegramId}|${planKey}|${Date.now()}`;

    res.json({
      success: true,
      address: PLATFORM_TON_WALLET,
      amountTon,
      amountUsd: plan.priceUsd,
      memo,
      livePrice,
      plan: planKey,
    });
  } catch (error) {
    console.error('Promote init payment error:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// ── 2. Verify payment ────────────────────────────────────────────────────────
router.post('/verify-payment', validateINITData, async (req, res) => {
  try {
    const { planKey, memo } = req.body;
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });
    if (!planKey || !PLANS[planKey]) return res.status(400).json({ error: 'Invalid plan' });

    const plan = PLANS[planKey];
    const livePrice = await getTonPrice();

    const verification = await verifyTonTransaction(PLATFORM_TON_WALLET, plan.priceUsd, memo, livePrice);

    if (verification.success) {
      // Mark the memo as processed to prevent double-use
      const txRef = db.collection('processedTransactions').doc(verification.txHash);
      const txDoc = await txRef.get();
      if (txDoc.exists) {
        return res.status(400).json({ success: false, error: 'Transaction already processed' });
      }
      await txRef.set({
        memo,
        planKey,
        telegramId: telegramId.toString(),
        txHash: verification.txHash,
        processedAt: new Date().toISOString(),
      });

      return res.json({ success: true, txHash: verification.txHash });
    }

    return res.status(400).json({ success: false, error: verification.error || 'Payment not found yet' });
  } catch (error) {
    console.error('Promote verify payment error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── 3. Check Telegram channel/group bot access ───────────────────────────────
router.post('/check-channel', validateINITData, async (req, res) => {
  try {
    const { link } = req.body;
    if (!link) return res.status(400).json({ error: 'Link required' });

    const username = parsePublicUsernameFromTelegramLink(link);
    if (!username) {
      return res.json({ ok: false, error: 'Invalid Telegram link. Use format: https://t.me/username' });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return res.json({ ok: false, error: 'Bot not configured' });

    // First check if the chat exists and is accessible
    let chatInfo;
    try {
      const chatRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChat`, {
        params: { chat_id: `@${username}` },
        timeout: 8000,
      });
      chatInfo = chatRes.data?.result;
      if (!chatInfo) {
        return res.json({ ok: false, error: `Channel/group @${username} not found or is private.` });
      }
    } catch (chatErr) {
      const errData = chatErr.response?.data;
      if (errData?.error_code === 400) {
        return res.json({ ok: false, error: `Channel/group @${username} not found or is private.` });
      }
      return res.json({ ok: false, error: 'Could not verify channel. Please try again.' });
    }

    // Check if bot is an admin in the chat
    const botUsername = process.env.BOT_USERNAME || 'EarnFestBot';
    let botMemberStatus;
    try {
      const botRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMember`, {
        params: { chat_id: `@${username}`, user_id: (await getBotId(botToken)) },
        timeout: 8000,
      });
      botMemberStatus = botRes.data?.result?.status;
    } catch (memberErr) {
      // Bot is not a member at all
      return res.json({
        ok: false,
        error: `@${botUsername} doesn't have access to @${username}. Add the bot as an admin.`,
        botUsername: `@${botUsername}`,
        channelUsername: `@${username}`,
        code: 'bot_not_member',
      });
    }

    if (botMemberStatus === 'administrator' || botMemberStatus === 'creator') {
      return res.json({ ok: true, username, title: chatInfo.title });
    }

    // Bot is a member but not admin
    return res.json({
      ok: false,
      error: `@${botUsername} is not an admin in @${username}. Please add @${botUsername} as an administrator.`,
      botUsername: `@${botUsername}`,
      channelUsername: `@${username}`,
      code: 'bot_not_admin',
    });
  } catch (error) {
    console.error('Check channel error:', error);
    res.status(500).json({ error: 'Failed to check channel' });
  }
});

// ── 4. Create/Publish a promotion plan ───────────────────────────────────────
router.post('/publish', validateINITData, async (req, res) => {
  try {
    const { planKey, txHash, tasks, banner, channelCheck } = req.body;
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });
    if (!planKey || !PLANS[planKey]) return res.status(400).json({ error: 'Invalid plan' });
    if (!txHash) return res.status(400).json({ error: 'Missing transaction hash' });

    const plan = PLANS[planKey];

    // Verify txHash was processed
    const txRef = db.collection('processedTransactions').doc(txHash);
    const txDoc = await txRef.get();
    if (!txDoc.exists) {
      return res.status(400).json({ error: 'Transaction not verified. Please complete payment first.' });
    }

    const txData = txDoc.data();
    if (txData.telegramId !== telegramId.toString()) {
      return res.status(403).json({ error: 'Transaction does not belong to this user' });
    }

    // Create the plan document
    const planRef = db.collection('promotionPlans').doc();
    const planData = {
      userId: telegramId.toString(),
      planKey,
      txHash,
      status: 'paid',
      publishStatus: channelCheck?.required && !channelCheck?.passed ? 'pending_access' : 'published',
      tasks: tasks || [],
      banner: banner || null,
      channelCheck: channelCheck || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await planRef.set(planData);

    // If publishStatus is 'published', create the actual tasks in the tasks collection
    if (planData.publishStatus === 'published' && tasks?.length > 0) {
      for (const task of tasks) {
        const taskRef = db.collection('tasks').doc();
        await taskRef.set({
          title: task.title,
          link: task.link,
          type: task.type || 'partner',
          category: 'Partner',
          reward: 0,
          status: 'active',
          partnerPlanId: planRef.id,
          partnerUserId: telegramId.toString(),
          imageUrl: task.imageUrl || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // If banner exists and published, create banner entry
    if (planData.publishStatus === 'published' && banner) {
      const bannerRef = db.collection('promotionBanners').doc();
      await bannerRef.set({
        planId: planRef.id,
        userId: telegramId.toString(),
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        title: banner.title || '',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // For collaboration plans, notify admins
    if (planKey === 'collaboration') {
      const userDoc = await db.collection('users').doc(telegramId.toString()).get();
      const userData = userDoc.data() || {};
      const notifyText = `🤝 <b>New Collaboration Request</b>\n\nUser: <a href="tg://user?id=${telegramId}">${userData.firstName || 'User'}</a>\nID: <code>${telegramId}</code>\nPlan: Collaboration (50 TON)\n\nCheck the admin panel Plans tab for details.`;

      if (ADMIN_CHAT_ID) {
        sendTelegramMessage(ADMIN_CHAT_ID, notifyText).catch(e => console.error('Admin notify error:', e));
      }
    }

    res.json({
      success: true,
      planId: planRef.id,
      publishStatus: planData.publishStatus,
    });
  } catch (error) {
    console.error('Promote publish error:', error);
    res.status(500).json({ error: 'Failed to publish promotion' });
  }
});

// ── 5. Re-check channel access and publish pending tasks ─────────────────────
router.post('/recheck-and-publish', validateINITData, async (req, res) => {
  try {
    const { planId } = req.body;
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });

    const planRef = db.collection('promotionPlans').doc(planId);
    const planDoc = await planRef.get();
    if (!planDoc.exists) return res.status(404).json({ error: 'Plan not found' });

    const planData = planDoc.data();
    if (planData.userId !== telegramId.toString()) {
      return res.status(403).json({ error: 'Not your plan' });
    }

    if (planData.publishStatus !== 'pending_access') {
      return res.json({ success: true, publishStatus: planData.publishStatus, message: 'Already published' });
    }

    const channelCheck = planData.channelCheck;
    if (!channelCheck?.username) {
      return res.status(400).json({ error: 'No channel to check' });
    }

    // Re-check bot access
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return res.json({ ok: false, error: 'Bot not configured' });

    try {
      const botRes = await axios.get(`https://api.telegram.org/bot${botToken}/getChatMember`, {
        params: { chat_id: `@${channelCheck.username}`, user_id: (await getBotId(botToken)) },
        timeout: 8000,
      });
      const status = botRes.data?.result?.status;
      if (status !== 'administrator' && status !== 'creator') {
        return res.json({
          ok: false,
          error: `Bot still doesn't have admin access to @${channelCheck.username}.`,
          code: 'bot_not_admin',
        });
      }
    } catch {
      return res.json({
        ok: false,
        error: `Bot still doesn't have access to @${channelCheck.username}.`,
        code: 'bot_not_member',
      });
    }

    // Publish tasks
    const tasks = planData.tasks || [];
    for (const task of tasks) {
      const taskRef = db.collection('tasks').doc();
      await taskRef.set({
        title: task.title,
        link: task.link,
        type: task.type || 'partner',
        category: 'Partner',
        reward: 0,
        status: 'active',
        partnerPlanId: planId,
        partnerUserId: telegramId.toString(),
        imageUrl: task.imageUrl || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Publish banner if exists
    const banner = planData.banner;
    if (banner) {
      const bannerRef = db.collection('promotionBanners').doc();
      await bannerRef.set({
        planId,
        userId: telegramId.toString(),
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        title: banner.title || '',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await planRef.update({
      publishStatus: 'published',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, publishStatus: 'published' });
  } catch (error) {
    console.error('Recheck and publish error:', error);
    res.status(500).json({ error: 'Failed to publish' });
  }
});

// ── 6. Get user's promotion plans ────────────────────────────────────────────
router.get('/my-plans', validateINITData, async (req, res) => {
  try {
    const telegramId = req.telegramUser?.id;
    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });

    const snapshot = await db.collection('promotionPlans')
      .where('userId', '==', telegramId.toString())
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(plans);
  } catch (error) {
    console.error('My plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ── Admin: Get all promotion plans ───────────────────────────────────────────
router.get('/admin/all-plans', validateINITData, async (req, res) => {
  try {
    const snapshot = await db.collection('promotionPlans')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const plans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(plans);
  } catch (error) {
    console.error('Admin all plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ── Admin: Update plan status ────────────────────────────────────────────────
router.put('/admin/update-plan', validateINITData, async (req, res) => {
  try {
    const { planId, publishStatus } = req.body;
    if (!planId || !publishStatus) return res.status(400).json({ error: 'Missing fields' });

    await db.collection('promotionPlans').doc(planId).update({
      publishStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ── Admin: Get all promotion banners ─────────────────────────────────────────
router.get('/admin/banners', validateINITData, async (req, res) => {
  try {
    const snapshot = await db.collection('promotionBanners')
      .where('active', '==', true)
      .get();
    const banners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(banners);
  } catch (error) {
    console.error('Admin banners error:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// ── Public: Get active banners for Home page ─────────────────────────────────
router.get('/banners', async (req, res) => {
  try {
    const snapshot = await db.collection('promotionBanners')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    const banners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(banners);
  } catch (error) {
    console.error('Banners error:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// ── Helper: Get bot user ID ──────────────────────────────────────────────────
let cachedBotId = null;
async function getBotId(botToken) {
  if (cachedBotId) return cachedBotId;
  try {
    const res = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
    cachedBotId = res.data?.result?.id;
    return cachedBotId;
  } catch {
    return null;
  }
}

export default router;