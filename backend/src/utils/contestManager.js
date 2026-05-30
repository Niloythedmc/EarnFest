import admin, { db } from '../config/db.js';
import { sendTelegramMessage } from './bot.js';

const CONTESTS_COLLECTION = 'contests';

class ContestManager {
  /**
   * Create a new contest
   */
  async createContest(data) {
    const contestRef = db.collection(CONTESTS_COLLECTION).doc();
    const now = Date.now();
    
    const contest = {
      id: contestRef.id,
      type: data.type, // 'refer' | 'earning'
      title: data.title || `${data.type === 'refer' ? 'Referral' : 'Earning'} Contest`,
      startTime: new Date(data.startTime).getTime(),
      endTime: new Date(data.endTime).getTime(),
      winners: data.winners,
      prizeType: data.prizeType, // 'tier' | 'fest'
      prizes: data.prizes, // [{ rank, tier?, festAmount? }]
      status: this._determineStatus(new Date(data.startTime).getTime(), new Date(data.endTime).getTime()),
      rewarded: false,
      createdAt: now,
      updatedAt: now,
    };

    await contestRef.set(contest);
    return contest;
  }

  /**
   * Update an existing contest
   */
  async updateContest(contestId, data) {
    const contestRef = db.collection(CONTESTS_COLLECTION).doc(contestId);
    const contestSnap = await contestRef.get();
    if (!contestSnap.exists) {
      throw new Error('Contest not found');
    }

    const existing = contestSnap.data();
    if (existing.rewarded) {
      throw new Error('Cannot edit a contest that has already been rewarded');
    }

    const updateData = {
      ...data,
      startTime: data.startTime ? new Date(data.startTime).getTime() : existing.startTime,
      endTime: data.endTime ? new Date(data.endTime).getTime() : existing.endTime,
      status: this._determineStatus(
        data.startTime ? new Date(data.startTime).getTime() : existing.startTime,
        data.endTime ? new Date(data.endTime).getTime() : existing.endTime
      ),
      updatedAt: Date.now(),
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    await contestRef.update(updateData);
    return { ...existing, ...updateData };
  }

  /**
   * Delete a contest
   */
  async deleteContest(contestId) {
    const contestRef = db.collection(CONTESTS_COLLECTION).doc(contestId);
    const contestSnap = await contestRef.get();
    if (!contestSnap.exists) {
      throw new Error('Contest not found');
    }
    await contestRef.delete();
    return { success: true };
  }

  /**
   * Get all contests
   */
  async getAllContests() {
    const snapshot = await db.collection(CONTESTS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get active (ongoing) contest
   * Uses single-field range query + in-memory check to avoid composite index requirement
   */
  async getActiveContest() {
    const now = Date.now();
    try {
      const snapshot = await db.collection(CONTESTS_COLLECTION)
        .where('endTime', '>', now)
        .get();
      
      const active = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(c => c.startTime <= now);
      return active || null;
    } catch (e) {
      // Fallback: get all contests and filter in memory
      console.warn('Query failed, falling back to in-memory filter:', e.message);
      const allSnap = await db.collection(CONTESTS_COLLECTION).get();
      const active = allSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(c => c.startTime <= now && c.endTime > now);
      return active || null;
    }
  }

  /**
   * Get active (ongoing) contest by type
   */
  async getActiveContestByType(type) {
    const now = Date.now();
    try {
      const snapshot = await db.collection(CONTESTS_COLLECTION)
        .where('type', '==', type)
        .get();
      const active = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(c => c.startTime <= now && c.endTime > now);
      return active || null;
    } catch (e) {
      console.warn('Query for active contest by type failed:', e.message);
      const allSnap = await db.collection(CONTESTS_COLLECTION).get();
      const active = allSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(c => c.type === type && c.startTime <= now && c.endTime > now);
      return active || null;
    }
  }

  /**
   * Get upcoming contests
   */
  async getUpcomingContests() {
    const now = Date.now();
    const snapshot = await db.collection(CONTESTS_COLLECTION)
      .where('startTime', '>', now)
      .orderBy('startTime', 'asc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get ended contests that haven't been rewarded yet
   */
  async getEndedUnrewardedContests() {
    const now = Date.now();
    try {
      const snapshot = await db.collection(CONTESTS_COLLECTION)
        .where('endTime', '<=', now)
        .where('rewarded', '==', false)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      // Fallback: get all contests and filter in memory
      console.warn('Ended unrewarded compound query failed, falling back:', e.message);
      const allSnap = await db.collection(CONTESTS_COLLECTION).get();
      return allSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(c => c.endTime <= now && !c.rewarded);
    }
  }

  /**
   * Get leaderboard data for a specific contest type
   */
  async getContestLeaderboard(type, limit = 100) {
    if (type === 'chest') {
      let startTime = 0;
      let endTime = Date.now();

      // Find active or recent chest contest
      let contest = await this.getActiveContestByType('chest');
      if (!contest) {
        try {
          const snapshot = await db.collection(CONTESTS_COLLECTION)
            .where('type', '==', 'chest')
            .orderBy('endTime', 'desc')
            .limit(1)
            .get();
          if (snapshot.size > 0) {
            contest = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          }
        } catch (e) {
          console.warn('Failed to fetch recent chest contest:', e);
        }
      }

      if (contest) {
        startTime = contest.startTime;
        endTime = contest.endTime;
      } else {
        startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
      }

      const startVar = new Date(startTime);
      const endVar = new Date(endTime);

      try {
        const snapshot = await db.collection('transactions')
          .where('createdAt', '>=', startVar)
          .where('createdAt', '<=', endVar)
          .get();

        const userTotals = {};
        snapshot.docs.forEach(doc => {
          const id = doc.id;
          if (id.startsWith('chest_') || id.startsWith('task_chest_')) {
            const data = doc.data();
            const tgId = String(data.uid || data.tgId);
            if (tgId) {
              userTotals[tgId] = (userTotals[tgId] || 0) + (Number(data.amount) || 0);
            }
          }
        });

        const sortedUsers = Object.entries(userTotals)
          .map(([tgId, value]) => ({ tgId, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, limit);

        const leaderboard = [];
        for (const entry of sortedUsers) {
          const userDoc = await db.collection('users').doc(entry.tgId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            leaderboard.push({
              telegramId: userData.telegramId,
              firstName: userData.firstName,
              username: userData.username,
              photoUrl: userData.photoUrl,
              value: entry.value,
            });
          } else {
            leaderboard.push({
              telegramId: entry.tgId,
              firstName: 'User ' + entry.tgId,
              username: '',
              photoUrl: '',
              value: entry.value,
            });
          }
        }
        return leaderboard;
      } catch (err) {
        console.error('Chest leaderboard aggregation failed:', err);
        return [];
      }
    }

    const field = type === 'refer' ? 'referralCount' : 'totalEarned';
    try {
      const snapshot = await db.collection('users')
        .orderBy(field, 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          telegramId: data.telegramId,
          firstName: data.firstName,
          username: data.username,
          photoUrl: data.photoUrl,
          value: data[field] || 0,
        };
      });
    } catch (e) {
      // Fallback: get all users and sort in memory
      console.warn(`Leaderboard orderBy query failed for ${field}, falling back:`, e.message);
      const allSnap = await db.collection('users').get();
      return allSnap.docs
        .map(doc => {
          const data = doc.data();
          return {
            telegramId: data.telegramId,
            firstName: data.firstName,
            username: data.username,
            photoUrl: data.photoUrl,
            value: data[field] || 0,
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    }
  }

  /**
   * Get user's position in a contest leaderboard
   */
  async getUserPosition(type, telegramId) {
    if (type === 'chest') {
      let startTime = 0;
      let endTime = Date.now();

      let contest = await this.getActiveContestByType('chest');
      if (!contest) {
        try {
          const snapshot = await db.collection(CONTESTS_COLLECTION)
            .where('type', '==', 'chest')
            .orderBy('endTime', 'desc')
            .limit(1)
            .get();
          if (snapshot.size > 0) {
            contest = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          }
        } catch (e) {
          console.warn('Failed to fetch recent chest contest for position:', e);
        }
      }

      if (contest) {
        startTime = contest.startTime;
        endTime = contest.endTime;
      } else {
        startTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
      }

      const startVar = new Date(startTime);
      const endVar = new Date(endTime);

      try {
        const snapshot = await db.collection('transactions')
          .where('createdAt', '>=', startVar)
          .where('createdAt', '<=', endVar)
          .get();

        const userTotals = {};
        snapshot.docs.forEach(doc => {
          const id = doc.id;
          if (id.startsWith('chest_') || id.startsWith('task_chest_')) {
            const data = doc.data();
            const tgId = String(data.uid || data.tgId);
            if (tgId) {
              userTotals[tgId] = (userTotals[tgId] || 0) + (Number(data.amount) || 0);
            }
          }
        });

        const sorted = Object.entries(userTotals)
          .map(([tgId, value]) => ({ tgId, value }))
          .sort((a, b) => b.value - a.value);

        const myIndex = sorted.findIndex(item => item.tgId === telegramId.toString());
        const myValue = userTotals[telegramId.toString()] || 0;

        return {
          position: myIndex >= 0 ? myIndex + 1 : sorted.length + 1,
          value: myValue,
        };
      } catch (err) {
        console.error('Chest user position failed:', err);
        return { position: null, value: 0 };
      }
    }

    const field = type === 'refer' ? 'referralCount' : 'totalEarned';
    
    // Get the user's value
    const userSnap = await db.collection('users').doc(telegramId.toString()).get();
    if (!userSnap.exists) return null;
    
    const userValue = userSnap.data()[field] || 0;
    
    try {
      // Count how many users have a higher value
      const higherCount = await db.collection('users')
        .where(field, '>', userValue)
        .get();
      
      return {
        position: higherCount.size + 1,
        value: userValue,
      };
    } catch (e) {
      // Fallback: get all users sorted and find position
      console.warn('Position query failed, falling back:', e.message);
      const allSnap = await db.collection('users')
        .orderBy(field, 'desc')
        .get();
      const users = allSnap.docs.map(doc => doc.data());
      const idx = users.findIndex(u => u.telegramId?.toString() === telegramId.toString());
      return {
        position: idx >= 0 ? idx + 1 : users.length + 1,
        value: userValue,
      };
    }
  }

  /**
   * Reward winners for an ended contest
   */
  async rewardContest(contestId) {
    const contestRef = db.collection(CONTESTS_COLLECTION).doc(contestId);
    const contestSnap = await contestRef.get();
    
    if (!contestSnap.exists) {
      throw new Error('Contest not found');
    }

    const contest = contestSnap.data();
    if (contest.rewarded) {
      throw new Error('Contest already rewarded');
    }

    const now = Date.now();
    if (contest.endTime > now) {
      throw new Error('Contest has not ended yet');
    }

    // Get leaderboard for this contest type
    const leaderboard = await this.getContestLeaderboard(contest.type, contest.winners);
    
    const results = [];
    const batch = db.batch();

    for (let i = 0; i < Math.min(contest.winners, leaderboard.length); i++) {
      const entry = leaderboard[i];
      const prize = contest.prizes.find(p => p.rank === i + 1);
      if (!prize) continue;

      const userRef = db.collection('users').doc(entry.telegramId.toString());
      const userSnap = await userRef.get();
      if (!userSnap.exists) continue;

      const userData = userSnap.data();
      let rewardDescription = '';

      if (contest.prizeType === 'fest') {
        const amount = prize.festAmount || 0;
        batch.update(userRef, {
          balance: admin.firestore.FieldValue.increment(amount),
          totalEarned: admin.firestore.FieldValue.increment(amount),
        });
        rewardDescription = `${amount} $FEST`;
      } else if (contest.prizeType === 'tier') {
        const tier = prize.tier || 'free';
        batch.update(userRef, { tier });
        rewardDescription = `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier`;
      }

      results.push({
        rank: i + 1,
        telegramId: entry.telegramId,
        firstName: entry.firstName,
        reward: rewardDescription,
      });

      // Send Telegram notification
      try {
        const message = `🏆 <b>Contest Winner!</b>\n\nCongratulations <b>${entry.firstName}</b>!\n\nYou placed <b>#${i + 1}</b> in the "${contest.title}" contest!\n\n🎁 Prize: <b>${rewardDescription}</b>\n\nKeep up the great work on Earn Fest! 🚀`;
        await sendTelegramMessage(entry.telegramId, message);
      } catch (e) {
        console.error(`Failed to send win notification to ${entry.telegramId}:`, e.message);
      }
    }

    // Mark contest as rewarded
    batch.update(contestRef, { rewarded: true, rewardedAt: now });
    await batch.commit();

    return { success: true, winners: results };
  }

  /**
   * Check and reward all ended contests
   */
  async checkAndRewardContests() {
    const ended = await this.getEndedUnrewardedContests();
    const results = [];
    for (const contest of ended) {
      try {
        const result = await this.rewardContest(contest.id);
        results.push({ contestId: contest.id, ...result });
      } catch (e) {
        console.error(`Failed to reward contest ${contest.id}:`, e.message);
      }
    }
    return results;
  }

  _determineStatus(startTime, endTime) {
    const now = Date.now();
    if (now < startTime) return 'upcoming';
    if (now >= startTime && now <= endTime) return 'ongoing';
    return 'ended';
  }
}

export default new ContestManager();