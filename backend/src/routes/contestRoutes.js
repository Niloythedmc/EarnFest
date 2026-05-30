import express from 'express';
import { validateINITData, verifyAdmin } from '../middleware/auth.js';
import contestManager from '../utils/contestManager.js';

const router = express.Router();

// Public routes (require auth but not admin)
router.use(validateINITData);

/**
 * GET /api/contests/active
 * Get the currently active contest with its leaderboard
 */
router.get('/active', async (req, res) => {
  try {
    const { type } = req.query;
    let activeContest;
    if (type) {
      activeContest = await contestManager.getActiveContestByType(type);
    } else {
      activeContest = await contestManager.getActiveContest();
    }

    if (!activeContest) {
      return res.json({ contest: null, leaderboard: [] });
    }

    const leaderboard = await contestManager.getContestLeaderboard(activeContest.type, activeContest.winners);
    
    // Get user's position
    const telegramId = req.telegramUser?.id?.toString();
    let myPosition = null;
    if (telegramId) {
      myPosition = await contestManager.getUserPosition(activeContest.type, telegramId);
    }

    res.json({
      contest: activeContest,
      leaderboard,
      myPosition,
    });
  } catch (error) {
    console.error('Error fetching active contest:', error);
    res.status(500).json({ error: 'Failed to fetch active contest' });
  }
});

/**
 * GET /api/contests/leaderboard/:type
 * Get leaderboard for a specific type (refer/earning) - lifetime
 */
router.get('/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    // Normalize: accept 'refers' as alias for 'refer'
    const normalizedType = type === 'refers' ? 'refer' : type;
    if (!['refer', 'earning', 'chest'].includes(normalizedType)) {
      return res.status(400).json({ error: 'Invalid type. Must be "refer", "earning" or "chest"' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const leaderboard = await contestManager.getContestLeaderboard(normalizedType, limit);

    // Get user's position
    const telegramId = req.telegramUser?.id?.toString();
    let myPosition = null;
    if (telegramId) {
      myPosition = await contestManager.getUserPosition(normalizedType, telegramId);
    }

    res.json({ leaderboard, myPosition });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/contests/my-position/:type
 * Get the current user's position in a leaderboard type
 */
router.get('/my-position/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const normalizedType = type === 'refers' ? 'refer' : type;
    if (!['refer', 'earning', 'chest'].includes(normalizedType)) {
      return res.status(400).json({ error: 'Invalid type. Must be "refer", "earning" or "chest"' });
    }

    const telegramId = req.telegramUser?.id?.toString();
    if (!telegramId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const position = await contestManager.getUserPosition(normalizedType, telegramId);
    res.json({ position });
  } catch (error) {
    console.error('Error fetching user position:', error);
    res.status(500).json({ error: 'Failed to fetch user position' });
  }
});

// ===================== ADMIN ROUTES =====================

// All admin routes require admin verification
router.use(verifyAdmin);

/**
 * POST /api/contests
 * Create a new contest (admin only)
 */
router.post('/', async (req, res) => {
  try {
    const { type, title, startTime, endTime, winners, prizeType, prizes } = req.body;

    // Validation
    if (!type || !['refer', 'earning', 'chest'].includes(type)) {
      return res.status(400).json({ error: 'Invalid or missing type. Must be "refer", "earning" or "chest"' });
    }
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }
    if (new Date(endTime).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'End time must be in the future' });
    }
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }
    if (!winners || winners < 1) {
      return res.status(400).json({ error: 'At least 1 winner is required' });
    }
    if (!prizeType || !['tier', 'fest'].includes(prizeType)) {
      return res.status(400).json({ error: 'Invalid or missing prize type. Must be "tier" or "fest"' });
    }
    if (!prizes || prizes.length !== winners) {
      return res.status(400).json({ error: `Exactly ${winners} prize entries are required` });
    }

    // Validate prizes
    for (const prize of prizes) {
      if (!prize.rank || prize.rank < 1 || prize.rank > winners) {
        return res.status(400).json({ error: `Invalid rank in prizes` });
      }
      if (prizeType === 'tier' && !prize.tier) {
        return res.status(400).json({ error: `Tier is required for prize rank ${prize.rank}` });
      }
      if (prizeType === 'fest' && (!prize.festAmount || prize.festAmount < 1)) {
        return res.status(400).json({ error: `Fest amount is required for prize rank ${prize.rank}` });
      }
    }

    const contest = await contestManager.createContest({
      type,
      title,
      startTime,
      endTime,
      winners,
      prizeType,
      prizes,
    });

    res.status(201).json({ success: true, contest });
  } catch (error) {
    console.error('Error creating contest:', error);
    res.status(500).json({ error: 'Failed to create contest' });
  }
});

/**
 * PUT /api/contests/:id
 * Update an existing contest (admin only)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await contestManager.updateContest(id, updateData);
    res.json({ success: true, contest: updated });
  } catch (error) {
    console.error('Error updating contest:', error);
    if (error.message === 'Contest not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Cannot edit a contest that has already been rewarded') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update contest' });
  }
});

/**
 * DELETE /api/contests/:id
 * Delete a contest (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await contestManager.deleteContest(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting contest:', error);
    if (error.message === 'Contest not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete contest' });
  }
});

/**
 * GET /api/contests
 * Get all contests (admin only)
 */
router.get('/', async (req, res) => {
  try {
    const contests = await contestManager.getAllContests();
    res.json({ contests });
  } catch (error) {
    console.error('Error fetching contests:', error);
    res.status(500).json({ error: 'Failed to fetch contests' });
  }
});

/**
 * POST /api/contests/reward/:id
 * Manually trigger reward for a contest (admin only)
 */
router.post('/reward/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await contestManager.rewardContest(id);
    res.json(result);
  } catch (error) {
    console.error('Error rewarding contest:', error);
    if (error.message === 'Contest not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Contest already rewarded') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Contest has not ended yet') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to reward contest' });
  }
});

export default router;