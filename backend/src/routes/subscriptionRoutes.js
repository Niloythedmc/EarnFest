import express from 'express';
import { db } from '../config/db.js';
import { validateINITData } from '../middleware/auth.js';
import { verifyTonTransaction, verifyTonTransactionByHash } from '../utils/ton.js';
import { TIERS } from '../config/tiers.js';
import { getTonPrice } from '../utils/price.js';
import { processTierUpgrade } from '../utils/upgradeLogic.js';
import { triggerPaymentScan } from '../utils/paymentScanner.js';

const router = express.Router();

const PLATFORM_TON_WALLET = process.env.TON_DESTINATION_WALLET || 'UQD9IooF-EBlvryx2G8TIZNtDwM_KR3I8lAIW5ID-drfcgnw';

// 1. Get TON Payment Details
router.post('/buy', async (req, res) => {
  try {
    const { telegramId, tier } = req.body;
    
    if (!telegramId || !tier || !TIERS[tier]) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const livePrice = await getTonPrice();
    const amountUsd = TIERS[tier].price;
    const amountTon = (amountUsd / livePrice).toFixed(4);
    const memo = telegramId.toString(); 

    res.json({
        success: true,
        address: PLATFORM_TON_WALLET,
        amountTon: amountTon,
        amountUsd: amountUsd,
        memo: memo,
        livePrice: livePrice,
        message: `Please send ${amountTon} TON to the address below with the memo: ${memo}`
    });
  } catch (error) {
    console.error('Buy Error:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// 2. Verify TON Payment manually (Triggered by front-end "Check" button for UPGRADES)
router.post('/verify', validateINITData, async (req, res) => {
  try {
    const { tier, txHash } = req.body;
    const telegramId = req.telegramUser?.id;
    
    if (!telegramId || !tier || !TIERS[tier]) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    const livePrice = await getTonPrice();

    // Case A: Verify via direct transaction hash (Can verify any user's transaction if memo contains their userId)
    if (txHash && txHash.trim().length > 10) {
        const hashResult = await verifyTonTransactionByHash(txHash.trim(), PLATFORM_TON_WALLET);
        if (!hashResult.ok) {
            return res.status(400).json({ success: false, error: hashResult.error || 'Failed to verify transaction by hash' });
        }

        const txTelegramId = hashResult.telegramId;
        const actualUsd = hashResult.amount;

        // Map USD value of transaction to a tier
        let matchedTier = null;
        let matchedTierPrice = 0;
        for (const [tierKey, tierConfig] of Object.entries(TIERS)) {
            if (tierConfig.price <= 0) continue;
            const tolerance = 0.15 * tierConfig.price;
            if (Math.abs(actualUsd - tierConfig.price) < tolerance) {
                matchedTier = tierKey;
                matchedTierPrice = tierConfig.price;
                break;
            }
        }

        if (!matchedTier) {
            return res.status(400).json({ success: false, error: `No matching tier found for transaction value ($${actualUsd.toFixed(2)})` });
        }

        // Check if the paying user exists
        const targetUserRef = db.collection('users').doc(txTelegramId.toString());
        const targetUserDoc = await targetUserRef.get();
        if (!targetUserDoc.exists) {
            return res.status(404).json({ success: false, error: `User with ID ${txTelegramId} not found in database.` });
        }

        const targetUserData = targetUserDoc.data();
        const tierRanks = ['free', 'cash', 'reward', 'bonus', 'profit'];
        const currentRank = tierRanks.indexOf(targetUserData.tier || 'free');
        const targetRank = tierRanks.indexOf(matchedTier);

        if (currentRank >= targetRank) {
            return res.json({ success: true, message: `User already on ${matchedTier} or higher tier. No upgrade needed.` });
        }

        const result = await processTierUpgrade(txTelegramId.toString(), matchedTier, hashResult.hash, matchedTierPrice);
        if (result.success) {
            return res.json({ success: true, message: `Upgrade successful for user ${txTelegramId}!` });
        } else {
            return res.status(400).json({ success: false, error: result.error || 'Failed to process upgrade' });
        }
    } 
    
    // Case B: Verify via polling recently received wallet transactions (Fallback/Standard flow)
    const tierConfig = TIERS[tier];
    const amountUsd = tierConfig.price;

    const userRef = db.collection('users').doc(telegramId.toString());
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });
    
    if (userDoc.data().tier === tier) {
        return res.json({ success: true, message: 'Already upgraded' });
    }

    const listResult = await verifyTonTransaction(PLATFORM_TON_WALLET, amountUsd, telegramId, livePrice);
    if (listResult.success) {
        const result = await processTierUpgrade(telegramId.toString(), tier, listResult.txHash, amountUsd);
        if (result.success) {
            return res.json({ success: true, message: 'Upgrade successful!' });
        } else {
            return res.status(400).json({ success: false, error: result.error || 'Failed to process upgrade' });
        }
    } else {
        // Trigger a wider scan in the background
        triggerPaymentScan();
        return res.status(400).json({ success: false, error: listResult.error || 'Payment not found yet.' });
    }
  } catch (error) {
    console.error('Verify Error:', error);
    res.status(500).json({ error: 'Internal verification error' });
  }
});

// 3. Verify Deposit manually (Triggered by front-end "Check" button for DEPOSITS)
router.post('/verify-deposit', validateINITData, async (req, res) => {
  // On-chain deposits are intentionally disabled. Deposits must go through WalletFather.
  return res.status(410).json({
    success: false,
    error: 'On-chain deposits are disabled. Please deposit via WalletFather.',
    code: 'onchain_deposit_disabled'
  });
});

export default router;
