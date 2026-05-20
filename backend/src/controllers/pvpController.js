import admin, { db } from '../config/firebase.js';
import { checkMultiAccountOnDevice } from '../utils/deviceFingerprint.js';
import { incrementGamePlays, recordGameActiveUser } from '../utils/stats.js';

/**
 * Join the current active PvP game
 */
export const joinGame = async (req, res) => {
  try {
    const { amount, deviceFingerprint } = req.body;
    const telegramId = req.telegramUser?.id;

    if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });
    if (!amount || isNaN(amount) || amount < 1000) return res.status(400).json({ error: 'Minimum join amount is 1000 $FEST' });

    // ANTI-MULTI-ACCOUNT: Check if user has multiple accounts on same IP/device
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    const isMultiAccount = await checkMultiAccountOnDevice(telegramId, ipAddress, deviceFingerprint);
    
    if (isMultiAccount) {
      console.warn(`[PVP] Multi-account detected: User ${telegramId} attempted to bid from account with multiple registrations`);
      return res.status(403).json({ 
        error: 'Multi-account detected', 
        message: 'Users with multiple accounts cannot participate in PVP bidding',
        code: 'multi_account_forbidden'
      });
    }

    const userRef = db.collection('users').doc(telegramId.toString());
    const activeRef = db.collection('pvp').doc('active');

    const result = await db.runTransaction(async (transaction) => {
      // 1. Find active game ID
      const activeSnap = await transaction.get(activeRef);
      if (!activeSnap.exists) throw new Error('PVP not initialized');
      const currentGameId = activeSnap.data().currentGameId;

      // 2. Load User for balance check
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error('User not found');
      const currentBalance = userSnap.data().balance || 0;
      if (currentBalance < amount) throw new Error('Insufficient balance');

      // 3. Load Active Game doc
      const gameRef = db.collection('pvp').doc(currentGameId.toString());
      const gameSnap = await transaction.get(gameRef);
      if (!gameSnap.exists) throw new Error(`Game #${currentGameId} not found`);
      
      const gameData = gameSnap.data();
      if (gameData.status === 'rolling' || gameData.status === 'finished') {
        throw new Error('Game is rolling or finished. Wait for the next one.');
      }

      // 4. Update Players Array
      const players = [...(gameData.players || [])];
      const playerIndex = players.findIndex(p => p.telegramId === telegramId.toString());

      if (playerIndex > -1) {
        players[playerIndex].amount += amount;
      } else {
        players.push({
          telegramId: telegramId.toString(),
          username: userSnap.data().username || 'User',
          firstName: userSnap.data().firstName || 'User',
          photoUrl: userSnap.data().photoUrl || '',
          tier: userSnap.data().tier || 'free',
          amount: amount,
          color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`
        });
      }

      const newTotalPool = (gameData.totalPool || 0) + amount;

      // 5. Recalculate Angles for All Players (Source of Truth)
      let cumulative = 0;
      const updatedPlayers = players.map(p => {
        const startAngle = cumulative;
        const size = (p.amount / newTotalPool) * 360;
        cumulative += size;
        return { 
          ...p, 
          startAngle: Number(startAngle.toFixed(4)), 
          size: Number(size.toFixed(4)) 
        };
      });

      // 6. Update All (Pruning activities to prevent 1MB document limit)
      const activities = [...(userSnap.data().activities || [])];
      activities.unshift({
        type: 'pvp_join',
        amount: amount,
        gameId: currentGameId,
        timestamp: new Date().toISOString()
      });
      // Keep only last 30 activities in the main doc to avoid size limit
      const prunedActivities = activities.slice(0, 30);

      transaction.update(userRef, {
        balance: admin.firestore.FieldValue.increment(-amount),
        activities: prunedActivities
      });

      const updateData = {
        players: updatedPlayers,
        totalPool: newTotalPool,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      if (updatedPlayers.length >= 2 && gameData.status === 'waiting') {
        updateData.status = 'pending';
        updateData.startTime = Date.now() + 10000; // 10s countdown
      }

      transaction.update(gameRef, updateData);

      return { success: true, newBalance: currentBalance - amount, gameId: currentGameId };
    });

    incrementGamePlays('pvp');
    recordGameActiveUser('pvp', telegramId.toString());

    res.json(result);
  } catch (error) {
    console.error('PVP Join Error:', error.message);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get current active PvP game status
 */
export const getStatus = async (req, res) => {
  try {
    const activeRef = db.collection('pvp').doc('active');
    const globalRef = db.collection('pvp').doc('global');
    
    // Perform reads
    const [activeSnap, globalSnap] = await Promise.all([
        activeRef.get(),
        globalRef.get()
    ]);

    if (!activeSnap.exists) {
        return res.json({ id: 1, status: 'waiting', players: [], totalPool: 0 });
    }

    const currentGameId = activeSnap.data().currentGameId || 1;
    const gameSnap = await db.collection('pvp').doc(currentGameId.toString()).get();
    
    const gameData = gameSnap.exists ? gameSnap.data() : { id: currentGameId, status: 'waiting', players: [], totalPool: 0 };
    const globalData = globalSnap.exists ? globalSnap.data() : { luckiest: null, activeUsers: 24, lastGame: null };

    res.json({
      ...gameData,
      gameId: currentGameId,
      luckiest: globalData.luckiest,
      activeUsers: globalData.activeUsers || 24,
      lastGame: globalData.lastGame
    });
  } catch (error) {
    console.error('Fetch status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
};

/**
 * Get paginated PvP history
 */
export const getHistory = async (req, res) => {
  try {
    const { lastTimestamp } = req.query;
    let query = db.collection('pvp_history')
      .orderBy('timestamp', 'desc')
      .limit(10);

    if (lastTimestamp) {
      // Use the provided timestamp to start after for pagination
      query = query.startAfter(new Date(lastTimestamp));
    }

    const snap = await query.get();
    const history = snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
      };
    });

    res.json(history);
  } catch (error) {
    console.error('PVP History Error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};
