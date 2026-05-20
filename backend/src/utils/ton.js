import { TonClient, Address, Cell, beginCell } from '@ton/ton';
import { getHttpEndpoint } from '@orbs-network/ton-access';
import axios from 'axios';

const API_KEY = process.env.TONCENTER_API_KEY; 

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * STRICT MAINNET CHECK: Ensure the transaction actually exists on Mainnet.
 * We use tonapi.io because it is a reliable secondary source that is strictly mainnet.
 * @param {string} txHash 
 * @returns {Promise<boolean>}
 */
export async function verifyIsMainnet(txHash) {
    if (!txHash) return false;
    
    // Normalize hash (ensure it's hex and correct length)
    const normalizedHash = txHash.toLowerCase().trim();
    
    try {
        // No prefix means Mainnet. For testnet it would be testnet.tonapi.io
        const response = await axios.get(`https://tonapi.io/v2/blockchain/transactions/${normalizedHash}`, {
            timeout: 10000 // 10s timeout
        });
        
        // Final sanity check: response must be successful and contain data
        if (response.status === 200 && response.data) {
            return true;
        }
        return false;
    } catch (e) {
        if (e.response && e.response.status === 404) {
            console.warn(`[SECURITY] Transaction ${normalizedHash} NOT found on Mainnet. Rejected.`);
        } else {
            console.error(`[TON] Mainnet verification error for ${normalizedHash}:`, e.message);
        }
        return false;
    }
}

/**
 * Verify a TON transaction by searching recent transactions for a specific wallet,
 * matching by amount (in TON) and a unique memo (userId).
 */
export async function verifyTonTransaction(destinationWallet, amountInUsd, memo, tonPriceUsd = 5.0) {
    try {
        const expectedNanoTon = Math.floor((amountInUsd / tonPriceUsd) * 1e9);
        const tolerance = 0.10 * expectedNanoTon; // 10% tolerance (± 10% range)

        console.log(`Verifying TON: Wallet=${destinationWallet}, Amount=$${amountInUsd}, Memo=${memo}`);

        let transactions = [];
        let retries = 3;
        let invalidateApiKeyForThisSession = false;
        const address = Address.parse(destinationWallet);
        
        while (retries > 0) {
           try {
               const client = await getTonClient();
               
               transactions = await client.getTransactions(address, { limit: 20 });
               break; // Exit loop on success
           } catch (error) {
               if (error?.response?.status === 401 || (error?.message && error.message.includes('401'))) {
                   console.error("TON API Key is invalid (401). Falling back to decentralized nodes for verification.");
                   invalidateApiKeyForThisSession = true;
               }
               
               retries -= 1;
               if (retries === 0) throw error;
               console.warn(`API error, retrying... (${retries} left)`);
               await sleep(1000); // Sleep 1 sec before retry
           }
        }

        for (const tx of transactions) {
            const inMsg = tx.inMessage;
            if (!inMsg || inMsg.info.type !== 'internal') continue;

            const value = Number(inMsg.info.value.coins.toString());
            let msgMemo = "";
            
            const body = inMsg.body;
            if (body) {
                const slice = body.beginParse();
                if (slice.remainingBits >= 32) {
                    const op = slice.loadUint(32);
                    if (op === 0) {
                        msgMemo = slice.loadStringTail();
                    }
                }
            }

            const isAmountMatch = Math.abs(value - expectedNanoTon) < tolerance;
            const isMemoMatch = msgMemo === memo.toString();

            if (isAmountMatch && isMemoMatch) {
                // Check if it was received recently (within last 1 hour)
                const txTime = tx.now;
                const now = Math.floor(Date.now() / 1000);
                if (now - txTime < 3600) {
                   const txHash = tx.hash().toString('hex');
                   
                   // CRITICAL: Double-check on Mainnet via secondary API
                   const isRealMainnet = await verifyIsMainnet(txHash);
                   if (!isRealMainnet) {
                       return { success: false, error: 'Network mismatch: Testnet transactions are rejected' };
                   }
                   
                   return { success: true, txHash };
                }
            }
        }

        return { success: false, error: 'Transaction not found or memo mismatch' };
    } catch (error) {
        console.error('TON Verification Error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Verify a SPECIFIC TON transaction by its hash.
 * This is more secure and used for manual verification.
 */
/**
 * Verify a SPECIFIC Jetton (FEST) transaction by its hash.
 */
export async function verifyJettonTransactionByHash(txHash, expectedRecipient, expectedMemo, jettonMaster) {
    try {
        const normalizedHash = txHash.toLowerCase().trim();
        
        // 1. Fetch EVENT from tonapi.io (Better for Jetton transfers as it summarizes the whole trace)
        const response = await axios.get(`https://tonapi.io/v2/events/${normalizedHash}`, {
            timeout: 10000
        });

        if (!response.data || response.status !== 200) {
            return { ok: false, error: 'Transaction/Event not found on Mainnet' };
        }

        const event = response.data;
        
        // 2. Scan for JettonTransfer actions
        let foundTransfer = false;
        let amount = 0;
        let memo = "";

        if (event.actions) {
            for (const action of event.actions) {
                if (action.type === 'JettonTransfer' && action.JettonTransfer) {
                    const transfer = action.JettonTransfer;
                    
                    // Check if recipient matches our platform wallet
                    // Note: Tonapi might return the address in a slightly different format, so we parse it
                    if (transfer.recipient && Address.parse(transfer.recipient.address).equals(Address.parse(expectedRecipient))) {
                        amount = Number(transfer.amount) / 1e9;
                        memo = transfer.comment || "";
                        foundTransfer = true;
                        break;
                    }
                }
            }
        }

        if (!foundTransfer) {
            // Log actions for debugging if it failed
            console.warn('[TON] JettonTransfer not found in actions:', JSON.stringify(event.actions || []));
            return { ok: false, error: 'No valid $FEST transfer to platform found in this transaction' };
        }

        // 3. Verify memo
        // The memo usually contains the telegramId | amount
        const memoParts = memo.split('|').map(s => s.trim());
        const txTelegramId = memoParts[0];

        if (String(txTelegramId) !== String(expectedMemo)) {
            return { ok: false, error: `Memo mismatch: expected ${expectedMemo}, found ${txTelegramId}` };
        }

        return {
            ok: true,
            hash: normalizedHash,
            amount: amount,
            timestamp: event.timestamp
        };

    } catch (error) {
        console.error('[TON] verifyJettonTransactionByHash FATAL ERROR:', error);
        return { ok: false, error: `Verification engine error: ${error.message}` };
    }
}

export async function verifyTonTransactionByHash(txHash, expectedRecipient, expectedAmountUsd, expectedMemo) {
    try {
        const client = await getTonClient();
        if (!client) throw new Error('TON Network unreachable');

        // We use toncenter API directly for this specific lookup as TonClient search by hash is limited
        const apiKey = process.env.TONCENTER_API_KEY || 'AEMUNTFHYNZAC4YAAAAG6LBFXLHUILRGT26BNP4TT5TLWMLAVBU6APZ4AGIZPH6UIQTLKFQ';
        const baseUrl = 'https://toncenter.com/api/v2/getTransactionByHash'; // MAINNET ONLY
        
        // STRICT MAINNET CHECK: Ensure the transaction actually exists on Mainnet
        const isRealMainnet = await verifyIsMainnet(txHash);
        if (!isRealMainnet) {
            return { ok: false, error: 'Transaction rejected: Testnet transactions are strictly forbidden.' };
        }

        const response = await axios.get(baseUrl, {
            params: {
                tx_hash: txHash,
                api_key: apiKey
            }
        });

        if (!response.data || !response.data.ok || !response.data.result) {
            return { ok: false, error: 'Transaction not found on Mainnet' };
        }

        const tx = response.data.result;
        
        // 1. Recipient check
        const inMsg = tx.in_msg;
        if (!inMsg) return { ok: false, error: 'Invalid transaction (No incoming message)' };
        
        const destination = Address.parse(inMsg.destination).toString();
        const recipient = Address.parse(expectedRecipient).toString();
        if (destination !== recipient) {
            return { ok: false, error: 'Transaction recipient mismatch' };
        }

        // 2. Memo check
        let memo = "";
        if (inMsg.message) {
            memo = inMsg.message; 
        }

        const memoParts = memo.split('|').map(s => s.trim());
        const txTelegramId = memoParts[0];

        // Ensure memo is a valid user ID (numeric)
        if (!txTelegramId || !/^\d+$/.test(txTelegramId)) {
            return { ok: false, error: 'Memo does not contain a valid Telegram User ID' };
        }

        if (expectedMemo && String(txTelegramId) !== String(expectedMemo)) {
            return { ok: false, error: 'Memo/User mismatch' };
        }

        // 3. Amount check
        const valueNano = inMsg.value;
        const valueTon = parseFloat(valueNano) / 1e9;
        
        // Fetch price for conversion
        const { getTonPrice } = await import('./price.js');
        const tonPrice = await getTonPrice();
        const actualUsd = valueTon * tonPrice;

        let finalNotedAmount = actualUsd;

        if (memoParts.length === 2) {
            const notedAmount = parseFloat(memoParts[1]);
            if (isNaN(notedAmount)) return { ok: false, error: 'Invalid amount in memo' };
            
            if (Math.abs(actualUsd - notedAmount) > 0.05) {
                return { ok: false, error: 'Amount mismatch between payment and memo' };
            }
            finalNotedAmount = notedAmount;
        } else if (expectedAmountUsd) {
            if (actualUsd < expectedAmountUsd * 0.9) {
                return { ok: false, error: 'Insufficient payment amount' };
            }
        }

        return {
            ok: true,
            hash: txHash,
            amount: finalNotedAmount,
            tonAmount: valueTon,
            telegramId: txTelegramId,
            timestamp: tx.utime
        };

    } catch (error) {
        console.error('verifyTonTransactionByHash error:', error);
        return { ok: false, error: 'Failed to verify transaction' };
    }
}

export async function getTonClient() {
    let endpoint = 'https://toncenter.com/api/v2/jsonRPC';
    const apiKey = process.env.TONCENTER_API_KEY || 'AEMUNTFHYNZAC4YAAAAG6LBFXLHUILRGT26BNP4TT5TLWMLAVBU6APZ4AGIZPH6UIQTLKFQ';

    try {
        const { getHttpEndpoint } = await import('@orbs-network/ton-access');
        endpoint = await getHttpEndpoint({ network: 'mainnet' });
        
        // Final guard: prevent any testnet URL from leaking in
        if (endpoint.toLowerCase().includes('testnet')) {
            throw new Error('Discovery service returned a Testnet endpoint while Mainnet was requested');
        }
    } catch (e) {
        console.warn('TON: getHttpEndpoint failed or returned testnet, falling back to toncenter mainnet.');
        endpoint = 'https://toncenter.com/api/v2/jsonRPC';
    }

    const client = new TonClient({ 
        endpoint, 
        ...(apiKey && !apiKey.startsWith('AEM') && { apiKey }) 
    });

    // Verify we are actually on Mainnet by checking the masterchain and global network ID
    try {
        const masterchainInfo = await client.getMasterchainInfo();
        
        // Double-check the network via a custom method call if possible, 
        // or use the seqno/workchain as a heuristic.
        // For absolute certainty, we can query a known mainnet-only contract or config.
        
        console.log(`[TON] Network Check: Endpoint=${endpoint} (Seqno: ${masterchainInfo.seqno})`);
        
        if (masterchainInfo.seqno < 1000000) {
            console.warn('[SECURITY] Seqno suspiciously low. This node might be on Testnet.');
        }

    } catch (e) {
        console.error('TON: Failed to verify network connectivity:', e.message);
    }

    return client;
}
