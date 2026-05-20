import admin, { db } from '../config/firebase.js';

/**
 * PvpManager handles the game loop with a Flat Document Architecture.
 * Game data is stored directly in docs named by their ID in the 'pvp' collection.
 * Example: pvp/1, pvp/2, pvp/3...
 * Metadata is stored in pvp/active.
 * Global stats (Last Won, Luckiest) are stored in pvp/global.
 */
class PvpManager {
  constructor() {
    this.interval = null;
    this.isProcessing = false;
  }

  start() {
    console.log('PVP Manager: Starting flat-architecture heartbeat...');
    this.interval = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 1. Get active pointer
      const activeRef = db.collection('pvp').doc('active');
      const activeDoc = await activeRef.get();
      
      let currentGameId = 1;
      if (!activeDoc.exists) {
        await activeRef.set({ currentGameId: 1 });
      } else {
        currentGameId = activeDoc.data().currentGameId || 1;
      }

      // 2. Get current game data
      const gameRef = db.collection('pvp').doc(currentGameId.toString());
      const gameDoc = await gameRef.get();
      
      if (!gameDoc.exists) {
        // Init if missing
        await gameRef.set({ 
            id: currentGameId, 
            status: 'waiting', 
            players: [], 
            totalPool: 0, 
            createdAt: admin.firestore.FieldValue.serverTimestamp() 
        });
        this.isProcessing = false;
        return;
      }

      const game = gameDoc.data();
      const now = Date.now();

      // --- STATE TRANSITIONS ---
      if (game.status === 'pending' && game.startTime && now >= game.startTime) {
        // Start Rolling animation
        await this.startRolling(gameRef, game);
      } 
      else if (game.status === 'rolling' && game.rollingAt && (now - game.rollingAt) >= 6500) {
        // Normal flow: 6.5s Roll animation finished -> Payout and finish
        await this.payoutAndFinish(gameRef, game);
      }
      else if (game.status === 'rolling' && game.rollingAt && (now - game.rollingAt) >= 30000) {
        // Fail-safe: 30s have passed and still rolling? Force finish.
        console.warn(`PVP Manager: Game #${game.id} STUCK in rolling. Forcing payout.`);
        await this.payoutAndFinish(gameRef, game);
      }
      else if (game.status === 'finished' && game.resetAt && now >= game.resetAt) {
        // Game shown long enough -> Spawn next game
        await this.spawnNextGame(activeRef, currentGameId);
      }
      
      // Update system stats
      if (now % 10000 < 1000) { 
         await this.updateActiveUsers();
      }

    } catch (error) {
      console.error('PVP Manager Heartbeat Error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async startRolling(gameRef, game) {
    if (game.players.length < 2) {
        await gameRef.update({ status: 'waiting', startTime: null });
        return;
    }

    console.log(`PVP Manager [Game #${game.id}]: Starting roll.`);
    const { winner, winningAngle } = this.calculateWinner(game.players, game.totalPool);
    const winAmount = game.totalPool * 0.95;
    
    await gameRef.update({
      status: 'rolling',
      winner: { ...winner, winAmount },
      winningAngle: Number(winningAngle.toFixed(4)),
      rollingAt: Date.now()
    });
  }

  calculateWinner(players, totalPool) {
    // winningPoint is a value from 0 to 360
    const winningPoint = Math.random() * 360;
    
    // Find who this point belongs to using backend angles
    // startAngle and size are calculated in joinGame transaction
    const winner = players.find(p => {
      const start = p.startAngle;
      const end = p.startAngle + p.size;
      return winningPoint >= start && winningPoint < end;
    }) || players[0];

    // standard rotation logic: (360 - winner_pos) + many full turns
    const winningAngle = (360 - winningPoint) + (360 * 5); 
    return { winner, winningAngle };
  }

  async payoutAndFinish(gameRef, game) {
    const winner = game.winner;
    if (!winner) {
        await gameRef.update({ status: 'finished', resetAt: Date.now() + 1000 });
        return;
    }

    console.log(`PVP Manager [Game #${game.id}]: Awarding ${winner.username} prize: ${winner.winAmount}`);
    
    const winnerRef = db.collection('users').doc(winner.telegramId);
    const globalRef = db.collection('pvp').doc('global');

    await db.runTransaction(async (transaction) => {
      // --- ALL READS MUST HAPPEN FIRST ---
      const [gameSnap, globalSnap] = await Promise.all([
        transaction.get(gameRef),
        transaction.get(globalRef)
      ]);

      if (!gameSnap.exists || gameSnap.data().status !== 'rolling') {
          console.warn('PVP Manager: Transaction skipped - game not rolling or missing.');
          return;
      }

      // --- CALCULATIONS ---
      const winAmount = winner.winAmount;
      const currentGlobal = globalSnap.exists ? globalSnap.data() : { luckiest: null, lastGame: null };
      const currentChance = (game.totalPool > 0) ? (winner.amount / game.totalPool) * 100 : 0;
      const timestamp = new Date().toISOString();

      // --- ALL WRITES MUST HAPPEN SECOND ---
      
      // 1. Award Winner (Pruning activities to prevent 1MB document limit)
      const winnerSnap = await transaction.get(winnerRef);
      if (winnerSnap.exists) {
        const activities = [...(winnerSnap.data().activities || [])];
        activities.unshift({
          type: 'pvp_win',
          amount: winAmount,
          gameId: game.id,
          timestamp
        });
        const prunedActivities = activities.slice(0, 30);

        transaction.update(winnerRef, {
          balance: admin.firestore.FieldValue.increment(winAmount),
          totalEarned: admin.firestore.FieldValue.increment(winAmount),
          activities: prunedActivities
        });
      }

      // 2. Finish Game
      transaction.update(gameRef, {
        status: 'finished',
        resetAt: Date.now() + 5000 
      });

      // 3. Update Consolidated Global Stats (Last Won + Luckiest) in ONE write
      const updatedGlobal = {
        lastGame: {
          id: game.id,
          winner: { ...winner, winAmount }, // Record full winner info with amount
          totalPool: game.totalPool,
          winAmount: winAmount,
          timestamp
        }
      };

      // 4. Save to History Collection
      const historyRef = db.collection('pvp_history').doc(game.id.toString());
      transaction.set(historyRef, {
        gameId: game.id,
        winner: {
           username: winner.username,
           firstName: winner.firstName || winner.username,
           photoUrl: winner.photoUrl,
           telegramId: winner.telegramId
        },
        totalPool: game.totalPool,
        winAmount: winAmount,
        participantsCount: game.players.length,
        chance: currentChance,
        players: game.players,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Check for new Luckiest record
      if (!currentGlobal.luckiest || currentChance < currentGlobal.luckiest.chance) {
        updatedGlobal.luckiest = {
          winner: winner,
          winAmount: winAmount,
          chance: currentChance,
          gameId: game.id,
          timestamp
        };
      }

      transaction.set(globalRef, updatedGlobal, { merge: true });
    });
  }

  async spawnNextGame(activeRef, oldId) {
    const nextId = oldId + 1;
    console.log(`PVP Manager: Spawning Game #${nextId}`);

    const batch = db.batch();
    
    // Increment active game
    batch.update(activeRef, { currentGameId: nextId });

    // Init next game
    const nextGameRef = db.collection('pvp').doc(nextId.toString());
    batch.set(nextGameRef, {
      id: nextId,
      status: 'waiting',
      players: [],
      totalPool: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
  }
  
  async updateActiveUsers() {
    const globalRef = db.collection('pvp').doc('global');
    const sim = Math.floor(Math.random() * 10) + 20;
    await globalRef.set({ activeUsers: sim }, { merge: true });
  }
}

export default new PvpManager();
