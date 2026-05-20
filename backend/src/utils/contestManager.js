import admin, { db } from '../config/firebase.js';
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
   * Uses a two-step approach: first tries compound query, falls back to in-memory filter
   */
  async getActiveContest() {
    const now = Date.now();
    try {
      // Try compound query first (requires composite index)
      const snapshot = await db.collection(CONTESTS_COLLECTION)
        .where('startTime', '<=', now)
        .where('endTime', '>', now)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (e) {
      // Fallback: get all contests and filter in memory
      console.warn('Compound query failed, falling back to in-memory filter:', e.message);
      const allSnap = await db.collection(CONTESTS_COLLECTION).get();
      const active = allSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find(c => c.startTime <= now && c.endTime > now);
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