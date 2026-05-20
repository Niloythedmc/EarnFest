import { TonClient, Address } from '@ton/ton';
import { getHttpEndpoint } from '@orbs-network/ton-access';
import admin, { db } from '../config/firebase.js';
import { TIERS } from '../config/tiers.js';
import { getTonPrice } from './price.js';
import { processTierUpgrade } from './upgradeLogic.js';
import { sendTelegramMessage } from './bot.js';
import { getTonClient, verifyIsMainnet } from './ton.js';

const API_KEY = process.env.TONCENTER_API_KEY;
const PLATFORM_TON_WALLET = process.env.TON_DESTINATION_WALLET || 'UQD9IooF-EBlvryx2G8TIZNtDwM_KR3I8lAIW5ID-drfcgnw';
const SCAN_INTERVAL_MS = 60000; // 1 minute

let isScanning = false;

/**
 * Start the background blockchain scanner.
 * Polls the platform wallet for new transactions every minute.
 */
export async function startPaymentScanner() {
    console.log('[Scanner] Starting background payment scanner...');
    
    // Initial run
    scanTransactions().catch(err => console.error('[Scanner] Initial scan error:', err));
    
    // Periodic run every 60 seconds
    setInterval(() => {
        scanTransactions().catch(err => console.error('[Scanner] Interval scan error:', err));
    }, SCAN_INTERVAL_MS);
}

/**
 * Manually trigger a scan of the TON blockchain for recent transactions.
 * Called when the frontend sends a "Check Payment" request.
 */
export async function triggerPaymentScan() {
    console.log('[Scanner] Manual scan triggered...');
    scanTransactions().catch(err => console.error('[Scanner] Manual scan error:', err));
}

async function scanTransactions() {
    if (isScanning) return;
    isScanning = true;

    try {
        const tonPrice = await getTonPrice();
        const address = Address.parse(PLATFORM_TON_WALLET);
        
        let transactions = [];
        let retries = 2; // Try primary key first, then fallback node

        while (retries > 0) {
            try {
                const client = await getTonClient();
                const masterInfo = await client.getMasterchainInfo();
                console.log(`[Scanner] Syncing with node (Seqno: ${masterInfo.seqno})...`);
                transactions = await client.getTransactions(address, { limit: 20 });
                break; // Exit loop on success
            } catch (error) {
                const is401 = error?.response?.status === 401 || (error?.message && error.message.includes('401'));
                const is502 = error?.response?.status === 502 || (error?.message && error.message.includes('502'));

                if (is401) {
                    if (!useFallbackNode) {
                        console.warn('[Scanner] TON API Key rejected (401). Switching to fallback node...');
                        useFallbackNode = true;
                    }
                } else if (is502) {
                    console.warn('[Scanner] Node temporarily busy (502). Retrying...');
                }

                retries--;
                if (retries === 0) throw error;
                // Wait 1 second before retry to handle transient network issues
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        for (const tx of transactions) {
            const inMsg = tx.inMessage;
            if (!inMsg || inMsg.info.type !== 'internal') continue;

            const valueNano = Number(inMsg.info.value.coins.toString());
            const txHash = tx.hash().toString('hex');
            const txTime = tx.now;
            const now = Math.floor(Date.now() / 1000);

            // 1. Recency Check (Guard against ancient transactions) - 24 hours
            if (now - txTime > 86400) {
                // Don't log for every old one, just skip silently
                continue;
            }

            // 2. Check if already processed
            const txDoc = await db.collection('processedTransactions').doc(txHash).get();
            if (txDoc.exists) {
                // Occasional log for existing transactions is fine
                // console.log(`[Scanner] Transaction ${txHash.substring(0,8)} already processed.`);
                continue;
            }

            console.log(`[Scanner] Processing NEW transaction: Hash=${txHash.substring(0,8)}... Time=${new Date(txTime*1000).toLocaleString()}`);
            
            // 3. Identify Transaction Type (TON vs Jetton Notification)
            let isJettonNotification = false;
            let jettonAmount = 0n;
            let jettonSender = "";
            let memo = "";
            
            const body = inMsg.body;
            if (body) {
                const slice = body.beginParse();
                if (slice.remainingBits >= 32) {
                    const op = slice.loadUint(32);
                    if (op === 0) {
                        memo = slice.loadStringTail();
                    } else if (op === 0x7362d09c) { // transfer_notification
                        isJettonNotification = true;
                        slice.loadUint(64); // query_id
                        jettonAmount = slice.loadCoins();
                        jettonSender = slice.loadAddress().toString();
                        
                        if (slice.remainingBits > 0) {
                            try {
                                const hasRef = slice.loadBit();
                                if (hasRef) {
                                    const ref = slice.loadRef().beginParse();
                                    if (ref.remainingBits >= 32 && ref.loadUint(32) === 0) {
                                        memo = ref.loadStringTail();
                                    }
                                } else if (slice.remainingBits >= 32 && slice.loadUint(32) === 0) {
                                    memo = slice.loadStringTail();
                                }
                            } catch (e) {
                                console.warn('[Scanner] Failed to parse jetton memo');
                            }
                        }
                    }
                }
            }

            // --- STRICT MAINNET GUARD ---
            const isRealMainnet = await verifyIsMainnet(txHash);
            if (!isRealMainnet) {
                console.warn(`[Scanner] [SECURITY] Skipping transaction ${txHash.substring(0,8)} - NOT found on Mainnet.`);
                continue;
            }

            if (!memo) continue;

            const memoParts = memo.split('|').map(s => s.trim());

            // --- Jetton Notification (DISABLED) ---
            if (isJettonNotification) {
                // Skip all jetton transfers as on-chain deposits are disabled.
                continue;
            }

            // --- PATTERN B: TON Deposit (Legacy/Disabled but kept for security matching) ---
            // If it's a TON transaction with 2 memo parts, we reject it now as per user request "just accept FEST"
            if (!isJettonNotification && memoParts.length === 2) {
                console.warn(`[Scanner]   - Rejecting TON Deposit as only $FEST is allowed now.`);
                continue;
            }

            // --- PATTERN C: Tier Upgrade (memo = telegramId) ---
            if (!isJettonNotification) {
                const telegramId = memo.trim();
                const userRef = db.collection('users').doc(telegramId);
                const userDoc = await userRef.get().catch(() => null);
                if (!userDoc || !userDoc.exists) continue;

                for (const [tierKey, tierConfig] of Object.entries(TIERS)) {
                    if (tierConfig.price <= 0) continue; 
                    const expectedNanoTon = Math.floor((tierConfig.price / tonPrice) * 1e9);
                    const tierTolerance = 0.15 * expectedNanoTon; 

                    if (Math.abs(valueNano - expectedNanoTon) < tierTolerance) {
                        console.log(`[Scanner]   - Tier Match found for ${telegramId} (${tierKey}). Processing...`);
                        await processTierUpgrade(telegramId, tierKey, txHash, tierConfig.price);
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Scanner] Error during transaction scan:', error.message);
    } finally {
        isScanning = false;
    }
}

let useFallbackNode = false;

// Shared client logic is now imported from ton.js
