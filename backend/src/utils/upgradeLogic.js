import admin, { db } from '../config/firebase.js';
import { sendTelegramMessage } from './bot.js';
import { TIERS } from '../config/tiers.js';
import { recordTierPurchase } from './stats.js';
import { processReferralCommission, checkAndRewardActiveReferral } from './referralLogic.js';

/**
 * Process a tier upgrade for a user reliably.
 * This can be called by the manual /verify endpoint or the automatic background scanner.
 * 
 * @param {string} telegramId - The user's Telegram ID
 * @param {string} tier - The tier key (e.g., 'cash', 'reward')
 * @param {string} txHash - The transaction hash on the blockchain
 * @param {number} amountUsd - The amount paid in USD (equivalent)
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function processTierUpgrade(telegramId, tier, txHash, amountUsd) {
    try {
        if (!telegramId || !tier || !TIERS[tier]) {
            return { success: false, error: 'Invalid parameters' };
        }

        const tierConfig = TIERS[tier];
        const userRef = db.collection('users').doc(telegramId.toString());
        const txRef = db.collection('processedTransactions').doc(txHash);

        // Atomic check and update using transaction
        return await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const txDoc = await transaction.get(txRef);

            if (!userDoc.exists) {
                return { success: false, error: 'User not found' };
            }

            if (txDoc.exists) {
                console.log(`[Upgrade] Transaction ${txHash.substring(0,8)}... matches existing record. Skipping...`);
                return { success: false, error: 'Transaction already processed' };
            }

            const userData = userDoc.data();
            
            // If user is already on this tier or higher (optional check, depends on if they can downgrade)
            // For now, assume they can always "re-buy" or upgrade
            if (userData.tier === tier) {
                // If they are already this tier, we still mark the transaction as processed
                // and maybe extend or just say "already upgraded"
                // But for simplicity, we treat it as successful processing
            }

            const timestamp = new Date().toISOString();

            // 1. Mark transaction as processed
            transaction.set(txRef, {
                telegramId,
                tier,
                amountUsd,
                txHash,
                timestamp,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const activities = [...(userData.activities || [])];
            activities.unshift({
                type: 'subscription_upgrade',
                tier: tier,
                amount: amountUsd,
                txHash: txHash,
                timestamp
            });

            // 2. Upgrade user doc
            transaction.update(userRef, {
                tier: tier,
                activities: activities.slice(0, 30)
            });

            // 3. Handle Referrer Commission (20%) using unified logic
            if (userData.referredBy) {
                // Scale USD/TON price to $FEST (20,000x) for commission calculation
                processReferralCommission(telegramId, amountUsd * 20000, 'upgrade', userData.referredBy, transaction);
            }

            return { success: true, userData, tierConfig };
        }).then(async (result) => {
            if (!result.success) return result;

            const { userData, tierConfig } = result;

            // 4. Trigger Active Friend Check
            await checkAndRewardActiveReferral(telegramId);

            // 5. Send Notifications (Post-Transaction)
            try {
                // To user
                await sendTelegramMessage(telegramId, `<b>Congratulations!</b> 💎🎉\n\nYour payment has been verified and your account has been upgraded to <b>${tierConfig.name}</b>!\n\nGo to the app now to see your boosted rewards! 🚀`);

                // To referrer
                if (userData.referredBy) {
                    const commission = (amountUsd * 20000) * 0.2;
                    await sendTelegramMessage(userData.referredBy, `🎉 You earned <b>${commission.toFixed(0)} $FEST</b> commission from your referral's upgrade to ${tierConfig.name}!`);
                }

                // To public chat
                const handle = userData.username ? `@${userData.username}` : userData.firstName || 'User';
                const profileLink = userData.username ? `https://t.me/${userData.username}` : `tg://user?id=${userData.telegramId || telegramId}`;
                const txExplorerUrl = `https://tonviewer.com/transaction/${txHash}`;
                
                const publicMsg = `💎 <b>NEW TIER UPGRADE!</b> 💎\n\n👤 User: <a href="${profileLink}">${handle}</a>\n⭐ Tier: <b>${tierConfig.name.toUpperCase()}</b>\n💰 Paid: <b>$${amountUsd} in TON</b>\n🔗 Transaction: <a href="${txExplorerUrl}">View on Explorer</a>\n\nCongratulations on boosting your earnings! 🚀`;

                await sendTelegramMessage('@EarnFestChat', publicMsg, {
                    inline_keyboard: [[
                        { text: '🚀 Upgrade Mine!', url: 'https://t.me/EarnFestBot/Earn' }
                    ]]
                }, true);
            } catch (notifyErr) {
                console.error('Notification error after upgrade:', notifyErr);
                // We don't fail the whole thing if notifications fail
            }

            // 5. Record Global Stats
            recordTierPurchase(tier, amountUsd);

            return { success: true, message: 'Upgrade successful!' };
        });

    } catch (error) {
        console.error('ProcessTierUpgrade Error:', error);
        return { success: false, error: error.message };
    }
}
