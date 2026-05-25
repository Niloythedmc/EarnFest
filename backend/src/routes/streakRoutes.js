import express from 'express';
import admin, { db } from '../config/db.js';
import { validateINITData } from '../middleware/auth.js';

const router = express.Router();

// Milestone definitions: day -> reward amount
const MILESTONES = {
  1: 10,
  3: 50,
  7: 200,
  15: 750
};
const MAX_STREAK = 15;

/**
 * GET /api/user/streak/:telegramId
 * Returns current streak status for the user
 */
router.get('/streak/:telegramId', validateINITData, async (req, res) => {
  try {
    const { telegramId } = req.params;
    const userRef = db.collection('users').doc(telegramId.toString());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const streak = userData.dailyStreak || 0;
    const lastStreakDate = userData.lastStreakDate || null;
    const claimedMilestones = userData.streakClaimedMilestones || [];

    // Determine if today is already booked
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let alreadyBookedToday = false;
    if (lastStreakDate) {
      const lastDate = new Date(lastStreakDate);
      lastDate.setHours(0, 0, 0, 0);
      const lastStr = lastDate.toISOString().split('T')[0];
      alreadyBookedToday = lastStr === todayStr;
    }

    // Determine which milestones are reachable (streak >= milestone day)
    const availableMilestones = Object.keys(MILESTONES).map(Number).filter(day => streak >= day);
    
    // Determine which milestones are claimable (reached but not yet claimed)
    const claimableMilestones = availableMilestones.filter(day => !claimedMilestones.includes(day));

    // Check if today is a milestone day
    const isMilestoneToday = MILESTONES[streak] !== undefined && !claimedMilestones.includes(streak);

    res.json({
      streak,
      lastStreakDate,
      alreadyBookedToday,
      claimedMilestones,
      availableMilestones,
      claimableMilestones,
      isMilestoneToday,
      milestones: MILESTONES,
      maxStreak: MAX_STREAK
    });
  } catch (error) {
    console.error('Streak status error:', error);
    res.status(500).json({ error: 'Failed to get streak status' });
  }
});

/**
 * POST /api/user/streak/continue
 * Continue today's streak (called after interstitial ads)
 * Body: { telegramId }
 */
router.post('/streak/continue', validateINITData, async (req, res) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    const userRef = db.collection('users').doc(telegramId.toString());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Check if already booked today
    const lastStreakDate = userData.lastStreakDate || null;
    if (lastStreakDate) {
      const lastDate = new Date(lastStreakDate);
      lastDate.setHours(0, 0, 0, 0);
      const lastStr = lastDate.toISOString().split('T')[0];
      if (lastStr === todayStr) {
        return res.json({ 
          streak: userData.dailyStreak || 0, 
          alreadyBookedToday: true,
          message: 'Already booked today' 
        });
      }
    }

    let newStreak = (userData.dailyStreak || 0);

    if (lastStreakDate) {
      const lastDate = new Date(lastStreakDate);
      lastDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day - increment streak
        newStreak += 1;
      } else if (diffDays > 1) {
        // Streak broken - reset to day 1
        newStreak = 1;
      }
      // diffDays === 0 is handled above (already booked)
    } else {
      // First time - start at day 1
      newStreak = 1;
    }

    // If streak exceeds max, reset
    if (newStreak > MAX_STREAK) {
      newStreak = 1;
    }

    // Update user
    await userRef.update({
      dailyStreak: newStreak,
      lastStreakDate: today.toISOString(),
      activities: admin.firestore.FieldValue.arrayUnion({
        type: 'daily_streak',
        streak: newStreak,
        timestamp: new Date().toISOString()
      })
    });

    // Check if this is a milestone day
    const milestoneReward = MILESTONES[newStreak] || null;
    const claimedMilestones = userData.streakClaimedMilestones || [];
    const isMilestoneToday = milestoneReward !== null && !claimedMilestones.includes(newStreak);

    res.json({
      success: true,
      streak: newStreak,
      isMilestoneToday,
      milestoneReward,
      message: isMilestoneToday 
        ? `Congratulations! You've reached day ${newStreak}! Claim your ${milestoneReward} $FEST reward!` 
        : `Day ${newStreak} streak continued!`
    });
  } catch (error) {
    console.error('Streak continue error:', error);
    res.status(500).json({ error: 'Failed to continue streak' });
  }
});

/**
 * POST /api/user/streak/claim
 * Claim milestone reward
 * Body: { telegramId }
 */
router.post('/streak/claim', validateINITData, async (req, res) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    const userRef = db.collection('users').doc(telegramId.toString());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const streak = userData.dailyStreak || 0;
    const claimedMilestones = userData.streakClaimedMilestones || [];

    // Check if this streak day is a milestone
    const reward = MILESTONES[streak];
    if (!reward) {
      return res.status(400).json({ error: 'No reward available for current streak day' });
    }

    // Check if already claimed
    if (claimedMilestones.includes(streak)) {
      return res.status(400).json({ error: 'Milestone already claimed' });
    }

    // Award the reward
    await userRef.update({
      balance: admin.firestore.FieldValue.increment(reward),
      totalEarned: admin.firestore.FieldValue.increment(reward),
      streakClaimedMilestones: admin.firestore.FieldValue.arrayUnion(streak),
      activities: admin.firestore.FieldValue.arrayUnion({
        type: 'streak_reward',
        amount: reward,
        streak: streak,
        timestamp: new Date().toISOString()
      }),
      rewardHistory: admin.firestore.FieldValue.arrayUnion({
        type: 'streak_reward',
        amount: reward,
        streak: streak,
        timestamp: new Date().toISOString()
      })
    });

    res.json({
      success: true,
      reward,
      streak,
      message: `Claimed ${reward} $FEST for reaching day ${streak}!`
    });
  } catch (error) {
    console.error('Streak claim error:', error);
    res.status(500).json({ error: 'Failed to claim streak reward' });
  }
});

export default router;