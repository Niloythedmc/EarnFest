import express from 'express';
import admin, { db } from '../config/firebase.js';
import { validateINITData } from '../middleware/auth.js';
import axios from 'axios';
import { checkChatMember } from '../utils/bot.js';
import { parsePublicUsernameFromTelegramLink } from '../utils/telegramChats.js';
import { incrementTaskCompletions, adjustTotalBalance } from '../utils/stats.js';
import { processReferralCommission, checkAndRewardActiveReferral } from '../utils/referralLogic.js';
import { REWARD_TYPES } from '../config/tiers.js';

const router = express.Router();

function taskRequiresTelegramMembership(taskData) {
  const t = (taskData.type || '').toLowerCase();
  if (t === 'channel' || t === 'group') return true;
  if (t === 'telegram') {
    return !!parsePublicUsernameFromTelegramLink(taskData.link);
  }
  return false;
}

// Get available tasks
router.get('/', async (req, res) => {
  try {
    const telegramId = req.query.telegramId;
    const tasksSnapshot = await db.collection('tasks').get();
    let tasks = tasksSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(task => task.status !== 'paused'); // Hide paused tasks from users

    if (telegramId) {
      const userRef = db.collection('users').doc(telegramId.toString());
      const userDoc = await userRef.get();
      const userData = userDoc.data();

      const completedTaskIds = new Set((userData?.taskHistory || []).map((t) => t.taskId));

      tasks = tasks.map((task) => ({
        ...task,
        completed: completedTaskIds.has(task.id),
      }));
    }

    res.json(tasks);
  } catch (error) {
    console.error('Fetch Tasks Error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Helper function to complete a task for a user
async function completeTask(telegramId, taskId) {
  const userRef = db.collection('users').doc(telegramId.toString());
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { ok: false, error: 'User not found', status: 404 };
  
  const userData = userSnap.data();
  const isAlreadyDone = (userData.taskHistory || []).some((t) => t.taskId === taskId);
  if (isAlreadyDone) return { ok: false, error: 'Task already completed', status: 400 };

  let finalReward = 0;
  const timestamp = new Date().toISOString();

  if (taskId === 'task-31743') {
    finalReward = 0;
    try {
      const taskDoc = await db.collection('tasks').doc(taskId).get();
      if (taskDoc.exists) {
        await db.collection('tasks').doc(taskId).update({
          completionCount: admin.firestore.FieldValue.increment(1),
          lastCompletedAt: timestamp,
        });
      }
    } catch (e) {
      console.warn('Failed to update task doc completions counter for task-31743:', e);
    }
  } else {
    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) return { ok: false, error: 'Task not found', status: 404 };
    const taskData = taskDoc.data();

    if (taskData.status === 'paused') {
      return { ok: false, error: 'Task is paused', status: 403 };
    }

    finalReward = taskData.reward !== undefined ? parseFloat(taskData.reward) : 0.1;

    await db.collection('tasks').doc(taskId).update({
      completionCount: admin.firestore.FieldValue.increment(1),
      lastCompletedAt: timestamp,
    });
  }

  await userRef.update({
    balance: admin.firestore.FieldValue.increment(finalReward),
    totalEarned: admin.firestore.FieldValue.increment(finalReward),
    taskHistory: admin.firestore.FieldValue.arrayUnion({
      taskId,
      reward: finalReward,
      completedAt: timestamp,
    }),
    activities: admin.firestore.FieldValue.arrayUnion({
      type: 'task_completion',
      taskId,
      amount: finalReward,
      timestamp,
    }),
  });

  incrementTaskCompletions();
  adjustTotalBalance(finalReward);

  if (userData.referredBy) {
    await processReferralCommission(telegramId, finalReward, REWARD_TYPES.TASK, userData.referredBy);
    await checkAndRewardActiveReferral(telegramId);
  }

  return { ok: true, reward: finalReward };
}

// Adsgram callback URL (GET)
// Format: /api/tasks/callback/adsgram?userid=[userId]&taskid=[taskId]&token=SECRET
router.get('/callback/adsgram', async (req, res) => {
  try {
    const expected = process.env.ADSGRAM_REWARD_SECRET;
    if (!expected || expected.length < 8) {
      console.error('ADSGRAM_REWARD_SECRET missing or too weak — refusing AdsGram task callback');
      return res.status(503).send('Not configured');
    }

    const provided = req.query.token || req.query.secret || req.query.key;
    if (provided !== expected) {
      console.warn(`Invalid token provided in Adsgram task callback: ${provided}`);
      return res.status(403).send('Forbidden');
    }

    const telegramId = req.query.userid || req.query.userId || req.query.telegramId;
    const taskId = req.query.taskid || req.query.taskId;

    if (!telegramId || !taskId) {
      return res.status(400).send('Missing userid or taskid');
    }

    const result = await completeTask(telegramId, taskId);
    if (!result.ok) {
      // Adsgram expects 200 OK often to avoid retries, but we can return appropriate status
      return res.status(result.status).send(result.error);
    }

    res.send('OK');
  } catch (error) {
    console.error('Adsgram Task Callback Error:', error);
    res.status(500).send('Error');
  }
});

// Verify and complete task (Mini App Frontend call)
router.post('/verify', validateINITData, async (req, res) => {
  try {
    const { taskId } = req.body;
    const sessionUserId = req.telegramUser?.id;
    const bodyTelegramId = req.body.telegramId;

    if (sessionUserId == null) {
      return res.status(401).json({ error: 'Telegram session required' });
    }
    if (String(sessionUserId) !== String(bodyTelegramId)) {
      return res.status(403).json({ error: 'User mismatch' });
    }

    const taskDoc = await db.collection('tasks').doc(taskId).get();
    if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });
    const taskData = taskDoc.data();

    // Check membership only for standard verify calls
    if (taskRequiresTelegramMembership(taskData)) {
      const username = parsePublicUsernameFromTelegramLink(taskData.link);
      if (!username) {
        return res.status(400).json({ error: 'Task requires public telegram username link.' });
      }

      const isMember = await checkChatMember(sessionUserId, username);
      if (!isMember) {
        return res.status(400).json({
          error: 'Please join the channel or group first.',
          code: 'not_member',
          username,
        });
      }
    }

    // Call the external API if configured and task type is not channel/group
    if (taskData.api && taskData.type !== 'channel' && taskData.type !== 'group') {
      let apiUrl = taskData.api;
      const placeholderRegex = /\{userId\}|\{\{userId\}\}|:userId/g;
      if (placeholderRegex.test(apiUrl)) {
        apiUrl = apiUrl.replace(placeholderRegex, sessionUserId.toString());
      } else {
        const separator = apiUrl.includes('?') ? '&' : '?';
        apiUrl = `${apiUrl}${separator}userId=${sessionUserId}`;
      }

      try {
        const apiResponse = await axios.get(apiUrl, { timeout: 10000 });
        const dataStr = String(apiResponse.data).trim().toLowerCase();
        const isCompleted = dataStr === 'true' || (typeof apiResponse.data === 'object' && apiResponse.data?.success === true);
        if (!isCompleted) {
          return res.status(400).json({ error: 'API verification failed. Task requirements not met.' });
        }
      } catch (err) {
        console.error('Task API Verification Error:', err.message);
        return res.status(400).json({ error: 'Failed to verify task status via API. Please try again later.' });
      }
    }

    const result = await completeTask(sessionUserId, taskId);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ success: true, reward: result.reward });
  } catch (error) {
    console.error('Task Verify Error:', error);
    res.status(500).json({ error: 'Internal Error' });
  }
});

// Verification API endpoint
router.get('/verify-user', async (req, res) => {
  try {
    const { userId, type, target, tier } = req.query;
    if (!userId) {
      return res.json(false);
    }

    const userDoc = await db.collection('users').doc(userId.toString()).get();
    if (!userDoc.exists) {
      return res.json(false);
    }

    const userData = userDoc.data();
    const targetVal = Number(target) || 0;

    let result = false;

    switch (type) {
      case 'task': {
        const count = (userData.taskHistory || []).length;
        result = count >= targetVal;
        break;
      }
      case 'invite': {
        const count = Array.isArray(userData.referrals) 
          ? userData.referrals.length 
          : (Number(userData.referralCount) || 0);
        result = count >= targetVal;
        break;
      }
      case 'earn': {
        const amount = Number(userData.totalEarned) || 0;
        result = amount >= targetVal;
        break;
      }
      case 'ads': {
        const count = Number(userData.totalAdViews) || 0;
        result = count >= targetVal;
        break;
      }
      case 'game': {
        const gameCount = (Number(userData.spinCount) || 0) + 
                          (Number(userData.slotCount) || 0) + 
                          (userData.activities || []).filter(a => a.type === 'spin_game' || a.type === 'slot_game').length;
        result = gameCount >= targetVal;
        break;
      }
      case 'coupon': {
        const promoCount = (userData.activities || []).filter(a => a.type === 'promocode_reward').length;
        result = promoCount >= targetVal;
        break;
      }
      case 'deposit': {
        const deposits = (userData.activities || [])
          .filter(a => a.type === 'deposit')
          .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
        result = deposits >= targetVal;
        break;
      }
      case 'tier': {
        const tierRanks = {
          free: 0,
          cash: 1,
          reward: 2,
          bonus: 3,
          profit: 4
        };
        const userTierRank = tierRanks[userData.tier || 'free'] || 0;
        const targetTierRank = tierRanks[tier || 'free'] || 0;
        result = userTierRank >= targetTierRank;
        break;
      }
      case 'streak': {
        const streak = Number(userData.dailyStreak) || 0;
        result = streak >= targetVal;
        break;
      }
      default:
        result = false;
        break;
    }

    return res.json(result);
  } catch (error) {
    console.error('Verify User Error:', error);
    return res.json(false);
  }
});

export default router;
