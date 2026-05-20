import express from 'express';
import admin from 'firebase-admin';
import { incrementGamePlays, recordGameActiveUser } from '../utils/stats.js';

const router = express.Router();
const db = admin.firestore();

// Helpers
const getMinesMultiplier = (safeOpenedCount) => {
  if (safeOpenedCount === 0) return 0.5;
  return Number((0.5 + (safeOpenedCount * 0.3)).toFixed(1));
};

// Start a new game
router.post('/start', async (req, res) => {
  try {
    const { bet } = req.body;
    const telegramId = req.headers['x-telegram-id'] || req.body.telegramId;

    if (!telegramId) return res.status(400).json({ error: 'Telegram ID required' });
    if (!bet || bet < 100 || bet > 10000) return res.status(400).json({ error: 'Invalid bet amount (100-10000)' });

    const userRef = db.collection('users').doc(telegramId.toString());

    const result = await db.runTransaction(async (transaction) => {
      // 1. Get user data
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error('User not found');
      
      const userData = userSnap.data();
      if (userData.balance < bet) throw new Error('Insufficient balance');

      // 2. Update user balance (Deduct bet)
      transaction.update(userRef, {
        balance: admin.firestore.FieldValue.increment(-bet)
      });

      // 3. Create game doc - No pre-decided bomb positions
      const gameRef = db.collection('mines_games').doc();
      transaction.set(gameRef, {
        userId: telegramId.toString(),
        bet: Number(bet),
        openedBoxes: [],
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { gameId: gameRef.id };
    });

    incrementGamePlays('mines');
    recordGameActiveUser('mines', telegramId.toString());

    res.json({ success: true, gameId: result.gameId });
  } catch (error) {
    console.error('Mines Start Error:', error.message);
    res.status(400).json({ error: error.message || 'Mines failed' });
  }
});

// Open a box
router.post('/open', async (req, res) => {
  try {
    const { gameId, boxIndex } = req.body;
    const telegramId = req.headers['x-telegram-id'] || req.body.telegramId;

    if (!gameId || boxIndex === undefined) return res.status(400).json({ error: 'Missing parameters' });

    const gameRef = db.collection('mines_games').doc(gameId);
    const poolRef = db.collection('soloPool').doc('pool');

    const result = await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      if (!gameDoc.exists) throw new Error('Game not found');
      
      const gameData = gameDoc.data();
      if (gameData.userId !== telegramId.toString() || gameData.status !== 'active') {
        throw new Error('Invalid game session');
      }

      if (gameData.openedBoxes.includes(boxIndex)) {
        throw new Error('Box already opened');
      }

      const poolSnap = await transaction.get(poolRef);
      const currentPool = poolSnap.exists ? (poolSnap.data().amount || 0) : 0;

      const nextMultiplier = getMinesMultiplier(gameData.openedBoxes.length + 1);
      const potentialPrize = Math.floor(gameData.bet * nextMultiplier);
      const potentialProfit = potentialPrize - gameData.bet;

      // Dynamic Bomb Logic
      let isBomb = false;

      // 1. Pool Protection: If pool cannot afford the prize, it MUST be a bomb
      if (potentialProfit > currentPool) {
        isBomb = true;
      } else {
        // 2. Risk Calculation: Chance increases with more boxes opened
        const boxesRemaining = 9 - gameData.openedBoxes.length;
        const baseRisk = 3 / boxesRemaining; 
        const poolFactor = currentPool < 50000 ? 1.1 : 0.9;
        const dynamicChance = baseRisk * poolFactor;

        if (Math.random() < dynamicChance) {
          isBomb = true;
        }
      }

      if (isBomb) {
        // Generate 3 bomb positions including this one
        const bombPositions = [boxIndex];
        while (bombPositions.length < 3) {
          const r = Math.floor(Math.random() * 9);
          if (!bombPositions.includes(r)) bombPositions.push(r);
        }

        transaction.update(gameRef, {
          status: 'lost',
          bombPositions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update pool: "When bombed then add the whole bet amount to the pool"
        transaction.update(poolRef, {
          amount: admin.firestore.FieldValue.increment(gameData.bet),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });

        return { bomb: true, allBombs: bombPositions };
      }

      const newOpenedBoxes = [...gameData.openedBoxes, boxIndex];
      transaction.update(gameRef, {
        openedBoxes: newOpenedBoxes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { bomb: false, multiplier: nextMultiplier };
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Mines Open Error:', error.message);
    res.status(400).json({ error: error.message || 'Action failed' });
  }
});

// Claim prize
router.post('/claim', async (req, res) => {
  try {
    const { gameId } = req.body;
    const telegramId = req.headers['x-telegram-id'] || req.body.telegramId;

    const gameRef = db.collection('mines_games').doc(gameId);
    const poolRef = db.collection('soloPool').doc('pool');

    const result = await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      if (!gameDoc.exists) throw new Error('Game not found');
      
      const gameData = gameDoc.data();
      if (gameData.userId !== telegramId.toString() || gameData.status !== 'active') {
        throw new Error('Invalid game session');
      }

      if (gameData.openedBoxes.length === 0) {
        throw new Error('Open at least one box before claiming');
      }

      const multiplier = getMinesMultiplier(gameData.openedBoxes.length);
      const prize = Math.floor(gameData.bet * multiplier);
      const profit = prize - gameData.bet;

      const userRef = db.collection('users').doc(telegramId.toString());
      
      const minesProfit = prize - gameData.bet;
      const minesEarnedUpdate = minesProfit > 0 ? { totalEarned: admin.firestore.FieldValue.increment(minesProfit) } : {};

      transaction.update(userRef, {
        balance: admin.firestore.FieldValue.increment(prize),
        ...minesEarnedUpdate,
      });
      transaction.update(gameRef, {
        status: 'claimed',
        prize,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update pool: "if claimed then the amount won (claimed - bet)"
      transaction.update(poolRef, {
        amount: admin.firestore.FieldValue.increment(-profit),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });

      return { prize };
    });

    res.json({ success: true, prize: result.prize });
  } catch (error) {
    console.error('Mines Claim Error:', error.message);
    res.status(400).json({ error: error.message || 'Claim failed' });
  }
});

export default router;
