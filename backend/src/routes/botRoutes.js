import express from 'express';
import { sendTelegramPhoto, sendTelegramMessage } from '../utils/bot.js';
import admin, { db } from '../config/db.js';
import axios from 'axios';
import crypto from 'crypto';
import { transferFEST } from '../utils/tonTransfer.js';
import { decrementPendingWithdrawals } from '../utils/stats.js';
import { TIERS } from '../config/tiers.js';

const router = express.Router();
const ADMIN_IDS = ['5968063026', '6686954447', '1678112785'];

const findReferralLinkByParam = async (param) => {
  if (!param) return null;
  const linkQuery = await db.collection('referralLinks').where('param', '==', param).limit(1).get();
  if (linkQuery.empty) return null;
  const linkDoc = linkQuery.docs[0];
  return { id: linkDoc.id, ...linkDoc.data() };
};

// [DIAGNOSTIC] External Reachability Test
// Visit: https://eidfest.up.railway.app/api/bot/ping
router.get('/ping', (req, res) => {
  res.json({ status: 'PONG', timestamp: new Date().toISOString() });
});

// WalletFather Deposit Webhook
const walletFatherDepositHandler = async (req, res) => {
  try {
    // WalletFather payloads can vary between versions; accept multiple common keys.
    // Format A: Path parameters (userId-amount-currency)
    let payloadUserId, payloadAmount, payloadCurrency;
    if (req.params.payload) {
      const parts = req.params.payload.split('-');
      if (parts.length >= 3) {
        payloadUserId = parts[0];
        payloadAmount = parts[1];
        payloadCurrency = parts[2];
      }
    }

    const userId =
      payloadUserId ||
      req.body?.userId ||
      req.body?.telegramId ||
      req.body?.userid ||
      req.body?.user_id ||
      req.query?.userId ||
      req.query?.telegramId;

    const amount = payloadAmount || (req.body?.amount ?? req.query?.amount);
    const currency = String(payloadCurrency || (req.body?.currency ?? req.query?.currency) || 'FEST').toUpperCase();
    const txHash = req.body?.txHash || req.body?.hash || req.query?.txHash || req.query?.hash;

    // [DEBUG] Log the incoming request to Firestore for audit
    await db.collection('walletFatherLogs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      params: req.params,
      query: req.query,
      body: req.body,
      identified: { userId, amount, currency, txHash }
    }).catch(err => console.error('[DEBUG] Failed to log to Firestore:', err));

    if (!userId || !amount || currency !== 'FEST') {
      return res.status(400).json({ error: 'Invalid deposit data', received: { userId, amount, currency } });
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount', received: { amount } });
    }

    const normalizedUserId = userId.toString();
    const normalizedTxId =
      (txHash && String(txHash).trim()) ||
      // fallback deterministic id to avoid duplicate credits if WalletFather retries without tx hash
      `wf_${normalizedUserId}_${crypto.createHash('sha256').update(`${normalizedUserId}|${parsedAmount}|${currency}`).digest('hex').slice(0, 16)}`;

    const userRef = db.collection('users').doc(normalizedUserId);
    const txRef = db.collection('processedTransactions').doc(normalizedTxId);

    // Atomic processing (idempotent)
    const result = await db.runTransaction(async (transaction) => {
      const [userDoc, txDoc, settingsDoc, offerDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(txRef),
        transaction.get(db.collection('admin').doc('settings')),
        transaction.get(db.collection('admin').doc('offer')),
      ]);

      if (txDoc.exists) return { status: 'duplicate' };
      if (!userDoc.exists) return { status: 'no_user' };

      const userData = userDoc.data();
      const userTier = userData.tier || 'free';

      // Check minimum deposit (tier + active offer)
      let minDeposit = TIERS[userTier]?.minDeposit || 10000;
      if (settingsDoc.exists && settingsDoc.data().tierLimits?.[userTier]) {
        minDeposit = Number(settingsDoc.data().tierLimits[userTier]);
      }
      if (offerDoc.exists) {
        const offerData = offerDoc.data();
        if (new Date(offerData.endTime) > new Date() && offerData.isActive) {
          const offerLimit = offerData.limits?.[userTier];
          if (offerLimit !== undefined) {
            minDeposit = Number(offerLimit);
          }
        }
      }

      if (parsedAmount < minDeposit) {
        return { status: 'min_limit', minDeposit };
      }

      const timestamp = new Date().toISOString();
      transaction.update(userRef, {
        balance: admin.firestore.FieldValue.increment(parsedAmount),
        totalEarned: admin.firestore.FieldValue.increment(parsedAmount),
        activities: admin.firestore.FieldValue.arrayUnion({
          type: 'deposit',
          amount: parsedAmount,
          currency: 'FEST',
          txHash: txHash || normalizedTxId,
          timestamp,
        })
      });

      transaction.set(txRef, {
        telegramId: normalizedUserId,
        amount: parsedAmount,
        type: 'deposit',
        currency: 'FEST',
        txHash: txHash || null,
        wfId: normalizedTxId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { status: 'ok' };
    });

    if (result.status === 'ok') {
      console.log(`[DEPOSIT] Deposit succeeded for User: ${normalizedUserId}, Amount: ${parsedAmount} FEST, TxId: ${normalizedTxId}`);
    }

    // [DEBUG] Update log with final result
    await db.collection('walletFatherLogs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId: normalizedUserId,
      amount: parsedAmount,
      txId: normalizedTxId,
      status: result.status,
      minDeposit: result.minDeposit || null
    }).catch(() => {});

    if (result.status === 'duplicate') {
      return res.status(409).json({ error: 'Transaction already processed' });
    }
    if (result.status === 'no_user') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (result.status === 'min_limit') {
      return res.status(400).json({ error: `Minimum deposit is ${result.minDeposit} $FEST` });
    }

    // Send confirmation message to user
    try {
      const msg = `💰 <b>Deposit Successful!</b>\n\nYour deposit of <b>${parsedAmount.toFixed(0)} $FEST</b> has been verified and credited to your balance.\n\nThank you for using EarnFest! 🚀`;
      await sendTelegramMessage(normalizedUserId, msg);
    } catch (msgErr) {
      console.error('Failed to send deposit confirmation:', msgErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('WalletFather deposit webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
};

// Support path-based payload (WalletFather format: /userId-amount-currency)
router.get('/walletfather-deposit/:payload', walletFatherDepositHandler);

// Support both POST (preferred) and GET (some webhook providers send query params only)
router.post('/walletfather-deposit', walletFatherDepositHandler);
router.get('/walletfather-deposit', walletFatherDepositHandler);

// Legacy/Alternative endpoint used by some configurations
router.get('/callback', walletFatherDepositHandler);
router.post('/callback', walletFatherDepositHandler);

// Telegram Bot Webhook
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;

    // Diagnostic log
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.error('CRITICAL: TELEGRAM_BOT_TOKEN is missing in the environment!');
    }

    // Basic Logging for production monitoring
    if (update) {
      console.log(`Bot Update Received: ${JSON.stringify(update)}`);
    }

    // Handle bot block/unblock updates
    if (update.my_chat_member) {
      const { chat, new_chat_member } = update.my_chat_member;
      if (chat && chat.type === 'private' && new_chat_member) {
        const userId = chat.id.toString();
        const isBlocked = !['creator', 'administrator', 'member', 'restricted'].includes(new_chat_member.status);
        
        try {
          const userRef = db.collection('users').doc(userId);
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            await userRef.update({
              blocked: isBlocked,
              blockedUpdatedAt: new Date().toISOString()
            });
            console.log(`User ${userId} bot status updated: blocked = ${isBlocked}`);
          }
        } catch (dbErr) {
          console.error(`Failed to update blocked status for user ${userId}:`, dbErr.message);
        }
      }
    }

    if (update.message) {
      const { chat, text, from } = update.message;
      if (!from || !chat) return res.status(200).send('OK');

      const telegramId = chat.id.toString();
      let referralCode = null;

      if (text && text.startsWith('/start ')) {
        referralCode = text.substring(7).trim();
        console.log(`Start referral detected: ${referralCode}`);

        // Track the visit globally regardless of user's new/existing status
        try {
          const linkData = await findReferralLinkByParam(referralCode);
          if (linkData) {
            await db.collection('referralLinks').doc(linkData.id).update({
              visitCount: admin.firestore.FieldValue.increment(1),
              lastVisitedAt: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error('Failed to increment visit count:', e);
        }
      }

      if (text && (text === '/start' || text.startsWith('/start'))) {
        // [ONBOARDING] Check if user exists, if not create them
        const userRef = db.collection('users').doc(telegramId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          let referredById = null;
          let joinedViaLink = null;

          if (referralCode) {
            const linkData = await findReferralLinkByParam(referralCode);
            if (linkData) {
              joinedViaLink = {
                linkId: linkData.id,
                param: linkData.param,
                createdAt: new Date().toISOString()
              };
              await db.collection('referralLinks').doc(linkData.id).update({
                joinCount: admin.firestore.FieldValue.increment(1),
                joinedUsers: admin.firestore.FieldValue.arrayUnion(telegramId),
                lastJoinedAt: new Date().toISOString()
              });
            } else {
              const referrerQuery = await db.collection('users').where('referralCode', '==', referralCode).limit(1).get();
              if (!referrerQuery.empty) {
                const referrerDoc = referrerQuery.docs[0];
                referredById = referrerDoc.id;
                await referrerDoc.ref.update({
                  referrals: admin.firestore.FieldValue.arrayUnion(telegramId)
                });
                console.log(`Referral Linked: ${telegramId} referred by ${referredById}`);
              }
            }
          }

          // Initial user structure
          await userRef.set({
            telegramId: telegramId,
            username: from.username || from.first_name || 'User',
            firstName: from.first_name || '',
            photoUrl: '',
            balance: 0,
            tier: 'free',
            adsCountToday: 0,
            lastAdDate: new Date().toISOString(),
            referralCode: `EF${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
            referredBy: referredById,
            referrals: [],
            referralEarnings: 0,
            rewardHistory: [],
            taskHistory: [],
            activities: [],
            spinAdViews: 0,
            totalAdViews: 0,
            totalAdEarnings: 0,
            spinHistory: [],
            joinedViaLink,
            createdAt: new Date().toISOString(),
            blocked: false
          });
        } else {
          // If the user already exists, update their blocked state to false
          await userRef.update({
            blocked: false,
            blockedUpdatedAt: new Date().toISOString()
          });
        }

        const welcomeBanner = 'https://firebasestorage.googleapis.com/v0/b/eidfest.appspot.com/o/earnfest_welcome_banner.png?alt=media';
        const welcomeCaption = `🚀 <b>Welcome to EarnFest, ${from.first_name || 'Earner'}!</b>\n\n<b>Earn digital rewards</b> by watching ads, spinning the wheel, and growing your network.\n\n💰 <b>Automated TON Payouts</b>\n📈 <b>Tiered Multipliers</b>\n🔗 <b>Direct Referrals</b>\n\nClick the button below to start your digital earning journey! 💸`;

        const appUrl = 'https://t.me/EarnFestBot/app';
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '🚀 Launch EarnFest', url: appUrl }]
          ]
        };

        try {
          // Try to send photo first
          await sendTelegramPhoto(telegramId, welcomeBanner, welcomeCaption, replyMarkup);
        } catch (photoError) {
          console.error('Photo send failed, trying direct message fallback');
          // Fallback to text message if photo fails (e.g. broken URL)
          await sendTelegramMessage(telegramId, welcomeCaption, replyMarkup);
        }
      } else if (ADMIN_IDS.includes(from.id.toString())) {
        // Normalize custom emoji metadata before store
        const normalizeTelegramEntity = (entity) => {
          if (!entity || typeof entity !== 'object') return null;
          const normalized = { ...entity };

          if (normalized.type === 'custom_emoji') {
            if (normalized.custom_emoji_id && !normalized.document_id) {
              normalized.document_id = normalized.custom_emoji_id;
            }
            if (!normalized.document_id) {
              return null;
            }
          }

          // Always remove custom_emoji_id to prevent any issues
          delete normalized.custom_emoji_id;

          return normalized;
        };

        const normalizeEntities = (arr = []) =>
          Array.isArray(arr)
            ? arr.map(normalizeTelegramEntity).filter(e => e !== null)
            : [];

        const normalizedMessage = { ...update.message };
        normalizedMessage.entities = normalizeEntities(update.message?.entities);
        normalizedMessage.caption_entities = normalizeEntities(update.message?.caption_entities);

        // Firestore does not support array of arrays (e.g., inline_keyboard)
        if (normalizedMessage.reply_markup) {
          try {
            normalizedMessage.reply_markup = JSON.stringify(normalizedMessage.reply_markup);
          } catch (e) { }
        }

        console.log('Original entities:', update.message?.entities);
        console.log('Normalized entities:', normalizedMessage.entities);
        console.log('Storing admin message with entities:', normalizedMessage.entities);
        console.log('Full message object:', JSON.stringify(normalizedMessage, null, 2));
        await db.collection('admin').doc('lastMessage').set({
          message: normalizedMessage,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Add callback_query Handler for Withdrawals
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data;
      const from = cb.from;
      const message = cb.message;

      if (data && data.startsWith('confirm_withdraw_') && ADMIN_IDS.includes(from.id.toString())) {
        const withdrawId = data.slice('confirm_withdraw_'.length);
        const token = process.env.TELEGRAM_BOT_TOKEN;

        try {
          await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { callback_query_id: cb.id, text: "Processing USDT withdrawal..." });
          if (message) {
            await axios.post(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
              chat_id: message.chat.id,
              message_id: message.message_id,
              reply_markup: { inline_keyboard: [[{ text: '⏳ Processing on TON...', callback_data: 'processing' }]] }
            });
          }
        } catch (e) {
          console.error("Callback answer failed", e.message);
        }

        const wRef = db.collection('withdrawals').doc(withdrawId);
        const wDoc = await wRef.get();
        if (wDoc.exists && wDoc.data().status === 'PENDING') {
          const wData = wDoc.data();
          const { address: targetAddress, amount, userId } = wData;

          const uRef = db.collection('users').doc(userId.toString());
          const uDoc = await uRef.get();
          const uData = uDoc.exists ? uDoc.data() : { firstName: 'User', telegramId: userId };

          try {
            const transferResult = await transferFEST(targetAddress, amount.toString(), userId, withdrawId);
            if (transferResult.success) {
              await wRef.update({
                status: 'COMPLETED',
                completedAt: new Date().toISOString(),
                txLink: transferResult.txLink
              });
              decrementPendingWithdrawals(); // Track completion

              try {
                await axios.post(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                  chat_id: message.chat.id,
                  message_id: message.message_id,
                  reply_markup: { inline_keyboard: [[{ text: '✅ Completed', callback_data: 'completed' }]] }
                });
              } catch (e) { }

              const handle = uData.firstName || uData.username || 'User';
              const sessionUserId = String(userId || '');
              const profileLink = `tg://user?id=${sessionUserId}`;
              const publicMsg = `✅ Successful $FEST Withdrawal! 💸\n\n👤 User: <a href="${profileLink}">${handle}</a>\n💰 Amount: <b>${amount.toFixed(0)} $FEST</b>\n🔗 Transaction: <a href="${transferResult.txLink}">View on Explorer</a>\n\nFunds have been successfully sent via <a href="https://t.me/WF_web3_Bot/wallet">WalletFather</a>! 🚀`;

              await sendTelegramMessage('@EarnFestChat', publicMsg, {
                inline_keyboard: [
                  [
                    { text: '🚀 Earn Now', url: 'https://t.me/EarnFestBot/Earn' },
                    { text: '👛 Check Wallet', url: 'https://t.me/WF_web3_Bot/wallet' }
                  ]
                ]
              }, true);
            } else {
              await wRef.update({
                status: 'FAILED',
                error: transferResult.error
              });
              decrementPendingWithdrawals(); // Track refund/failure as no longer pending

              // REFUND LOGIC
              const refundAmount = parseFloat(amount);
              const timestampNow = new Date().toISOString();
              await uRef.update({
                balance: admin.firestore.FieldValue.increment(refundAmount),
                activities: admin.firestore.FieldValue.arrayUnion({
                  type: 'withdrawal_refund',
                  amount: refundAmount,
                  timestamp: timestampNow
                }),
                rewardHistory: admin.firestore.FieldValue.arrayUnion({
                  type: 'refund',
                  amount: refundAmount,
                  timestamp: timestampNow
                })
              });

              // NOTIFY USER
              try {
                const notifyText = `⚠️ <b>Withdrawal Failed & Refunded</b>\n\nYour withdrawal request for <b>${refundAmount.toFixed(0)} $FEST</b> could not be processed right now due to a network error. The amount has been fully refunded to your balance.\n\nPlease try again later!`;
                await sendTelegramMessage(userId, notifyText);
              } catch (e) {
                console.error("Failed to notify user about refund", e);
              }

              try {
                let errShort = (transferResult.error || 'Error');
                if (errShort.includes('Insufficient')) errShort = "Low Balance";
                else if (errShort.includes('Seqno')) errShort = "Node Sync Lag";
                else if (errShort.includes('Broadcast')) errShort = "Chain Busy";
                else if (errShort.length > 20) errShort = errShort.substring(0, 20) + '...';

                await axios.post(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                  chat_id: message.chat.id,
                  message_id: message.message_id,
                  reply_markup: { inline_keyboard: [[{ text: '❌ Refunded: ' + errShort, callback_data: 'failed' }]] }
                });
              } catch (e) { }
            }
          } catch (error) {
            console.error("TON Transfer caught error:", error);
          }
        }
      } else if (data && data.startsWith('confirm_offchain_withdraw_') && ADMIN_IDS.includes(from.id.toString())) {
        const withdrawId = data.slice('confirm_offchain_withdraw_'.length);
        const token = process.env.TELEGRAM_BOT_TOKEN;

        try {
          await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { callback_query_id: cb.id, text: "Processing offchain withdrawal..." });
          if (message) {
            await axios.post(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
              chat_id: message.chat.id,
              message_id: message.message_id,
              reply_markup: { inline_keyboard: [[{ text: '⏳ Processing via WalletFather...', callback_data: 'processing' }]] }
            });
          }
        } catch (e) {
          console.error("Callback answer failed", e.message);
        }

        const wRef = db.collection('withdrawals').doc(withdrawId);
        const wDoc = await wRef.get();
        if (wDoc.exists && wDoc.data().status === 'PENDING') {
          const wData = wDoc.data();
          const { amount, userId } = wData;

          const uRef = db.collection('users').doc(userId.toString());
          const uDoc = await uRef.get();
          const uData = uDoc.exists ? uDoc.data() : { firstName: 'User', telegramId: userId };

          try {
            // Use WalletFather to pay
            const WALLET_FATHER_API_BASE = 'https://walletfather.up.railway.app/api/projects/api';
            const WALLET_FATHER_PRIVATE_KEY = process.env.WALLETFATHER_PRIVATE_KEY;

            const wfRes = await fetch(
              `${WALLET_FATHER_API_BASE}/pay/${WALLET_FATHER_PRIVATE_KEY}-${userId}-${amount}-FEST`,
              { method: 'POST' }
            );
            const wfData = await wfRes.json().catch(() => ({}));

            if (wfRes.ok && wfData?.ok) {
              await wRef.update({
                status: 'COMPLETED',
                completedAt: new Date().toISOString(),
                txHash: wfData.hash || null
              });
              decrementPendingWithdrawals();

              console.log(`[WITHDRAWAL_COMPLETED] Withdrawal request ${withdrawId} completed successfully. User: ${userId}, Amount: ${amount} FEST, Tx: ${wfData.hash || 'N/A'}`);

              try {
                await axios.post(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                  chat_id: message.chat.id,
                  message_id: message.message_id,
                  reply_markup: { inline_keyboard: [[{ text: '✅ Completed', callback_data: 'completed' }]] }
                });
              } catch (e) { }

              // Send confirmation to user
              try {
                const userMsg = `✅ <b>Withdrawal Successful!</b>\n\nYour withdrawal of <b>${amount.toFixed(0)} $FEST</b> has been processed successfully via WalletFather.\n\nFunds have been sent to your connected wallet! 🚀`;
                await sendTelegramMessage(userId, userMsg);
              } catch (e) {
                console.error("Failed to notify user about successful withdrawal", e);
              }

              const handle = uData.firstName || uData.username || 'User';
              const profileLink = `tg://user?id=${uData.telegramId || userId}`;
              const publicMsg = `✅ Successful $FEST Withdrawal! 💸\n\n👤 User: <a href="${profileLink}">${handle}</a>\n💰 Amount: <b>${amount.toFixed(0)} $FEST</b>\n\nFunds have been successfully sent via <a href="https://t.me/WF_web3_Bot/wallet">WalletFather</a>! 🚀`;

              await sendTelegramMessage('@EarnFestChat', publicMsg, {
                inline_keyboard: [
                  [
                    { text: '🚀 Earn Now', url: 'https://t.me/EarnFestBot/Earn' },
                    { text: '👛 Check Wallet', url: 'https://t.me/WF_web3_Bot/wallet' }
                  ]
                ]
              }, true);
            } else {
              const errMsg = wfData?.error || wfData?.message || 'WalletFather payout failed';
              await wRef.update({
                status: 'FAILED',
                error: errMsg
              });
              decrementPendingWithdrawals();
              console.error(`[WITHDRAWAL_FAILED] Withdrawal request ${withdrawId} failed. User: ${userId}, Amount: ${amount} FEST. Error: ${errMsg}`);

              // REFUND LOGIC
              const refundAmount = parseFloat(amount);
              const timestampNow = new Date().toISOString();
              await uRef.update({
                balance: admin.firestore.FieldValue.increment(refundAmount),
                activities: admin.firestore.FieldValue.arrayUnion({
                  type: 'withdrawal_refund',
                  amount: refundAmount,
                  timestamp: timestampNow
                }),
                rewardHistory: admin.firestore.FieldValue.arrayUnion({
                  type: 'refund',
                  amount: refundAmount,
                  timestamp: timestampNow
                })
              });

              // NOTIFY USER
              try {
                const notifyText = `⚠️ <b>Withdrawal Failed & Refunded</b>\n\nYour withdrawal request for <b>${refundAmount.toFixed(0)} $FEST</b> could not be processed. The amount has been fully refunded to your balance.\n\nPlease try again later!`;
                await sendTelegramMessage(userId, notifyText);
              } catch (e) {
                console.error("Failed to notify user about refund", e);
              }

              try {
                let errShort = (wfData?.error || wfData?.message || 'Error');
                if (errShort.length > 20) errShort = errShort.substring(0, 20) + '...';

                await axios.post(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
                  chat_id: message.chat.id,
                  message_id: message.message_id,
                  reply_markup: { inline_keyboard: [[{ text: '❌ Refunded: ' + errShort, callback_data: 'failed' }]] }
                });
              } catch (e) { }
            }
          } catch (error) {
            console.error("WalletFather payout caught error:", error);
          }
        }
      } else if (data) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          await axios.post(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { callback_query_id: cb.id, text: "Unauthorized or action not permitted", show_alert: true }).catch(e => { });
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Bot Webhook Fatal Error:', error);
    res.status(200).send('OK');
  }
});

export default router;
