import express from 'express';
import admin, { db } from '../config/db.js';
import { validateINITData } from '../middleware/auth.js';
import { checkChatMember } from '../utils/bot.js';
import { incrementPromos, adjustTotalBalance } from '../utils/stats.js';

const router = express.Router();

router.use(validateINITData);

// 1. Initial Redeem Check (Metadata)
router.post('/check', async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.telegramUser.id.toString();

    if (!code) return res.status(400).json({ error: 'Code required' });

    const q = code.toUpperCase().trim();
    const promoQuery = await db.collection('promocodes').where('code', '==', q).limit(1).get();
    
    if (promoQuery.empty) {
      return res.status(404).json({ error: 'Invalid or expired promocode' });
    }

    const promoDoc = promoQuery.docs[0];
    const promoData = { id: promoDoc.id, ...promoDoc.data() };

    // Check expiry
    if (promoData.validUntil && new Date(promoData.validUntil) < new Date()) {
      return res.status(400).json({ error: 'This promocode has expired' });
    }

    // Check supply
    if (promoData.supply <= 0) {
      return res.status(400).json({ error: 'This promocode has reached its limit' });
    }

    // Check claim history
    const claimDoc = await db.collection('promo_claims').doc(`${userId}_${promoDoc.id}`).get();
    if (claimDoc.exists) {
      return res.status(400).json({ error: 'You have already claimed this promocode' });
    }

    res.json({
      success: true,
      promo: {
        id: promoData.id,
        title: promoData.title,
        description: promoData.description,
        reward: promoData.reward,
        task: promoData.task, // { type, link, title }
        themeColor: promoData.themeColor || '#d4af37',
        available: promoData.supply
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Promo check failed' });
  }
});

// 2. Final Claim (Task Verification + Reward)
router.post('/claim', async (req, res) => {
  try {
    const { promoId } = req.body;
    const userId = req.telegramUser.id.toString();
    const username = req.telegramUser.username || 'User';

    const promoRef = db.collection('promocodes').doc(promoId);
    const promoDoc = await promoRef.get();

    if (!promoDoc.exists) return res.status(404).json({ error: 'Promo not found' });
    const promoData = promoDoc.data();

    const claimRef = db.collection('promo_claims').doc(`${userId}_${promoId}`);

    // Verify Telegram Task if exists
    if (promoData.task && promoData.task.type !== 'bot' && promoData.task.link) {
      // Extract chatId from link (e.g. t.me/channelname)
      const parts = promoData.task.link.split('/');
      const chatId = parts[parts.length - 1]; // Simplified
      
      const isMember = await checkChatMember(userId, chatId);
      if (!isMember) {
        return res.status(400).json({ error: `Please join ${promoData.task.title || 'the channel'} to claim.` });
      }
    }

    // Atomic transaction for supply and claim
    const result = await db.runTransaction(async (transaction) => {
      // SECURITY: Check claim history INSIDE transaction to prevent race conditions
      const claimDoc = await transaction.get(claimRef);
      if (claimDoc.exists) throw new Error('Already claimed');

      const freshPromo = await transaction.get(promoRef);
      const data = freshPromo.data();

      if (data.supply <= 0) throw new Error('Reached limit');

      transaction.update(promoRef, { 
        supply: admin.firestore.FieldValue.increment(-1) 
      });

      transaction.set(claimRef, {
        userId,
        promoId,
        username,
        reward: data.reward,
        timestamp: new Date().toISOString()
      });

      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        balance: admin.firestore.FieldValue.increment(data.reward),
        totalEarned: admin.firestore.FieldValue.increment(data.reward),
        activities: admin.firestore.FieldValue.arrayUnion({
          type: 'promocode_reward',
          promoTitle: data.title,
          amount: data.reward,
          timestamp: new Date().toISOString()
        })
      });

      return { reward: data.reward };
    });

    // Track promo claim in AppStats
    incrementPromos();
    adjustTotalBalance(result.reward);
    res.json({ success: true, reward: result.reward });
  } catch (error) {
    console.error('Promo Claim Error:', error);
    res.status(400).json({ error: error.message || 'Claim failed' });
  }
});

export default router;
