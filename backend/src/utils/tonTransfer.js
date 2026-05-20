import { TonClient, TonClient4, WalletContractV4, WalletContractV3R2, internal, beginCell, Address, toNano } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import { getHttpEndpoint } from '@orbs-network/ton-access';

// ── Secure Configuration ─────────────────────────────────────────────────────
const FEST_MASTER_MAINNET = "EQA5tc67TExHH3doV0lMAzWNVgbFEl5bBrl5obz68l6jDfUF";
const PRIMARY_API_KEY = 'AEB2JB3ML42UANAAAAAHLGCS34SCOEZVKLW2JSCYBY3YWMHNF43ZYBD62CXFP43IQPBDSDI';

const getMnemonic = () => {
    const rawPhrase = process.env.PROJECT_WALLET_PHRASE || "";
    const words = rawPhrase.trim().split(/\s+/).slice(0, 24);
    if (words.length !== 24) console.error("CRITICAL: PROJECT_WALLET_PHRASE invalid.");
    return words;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Persistent Global State ──────────────────────────────────────────────────
let isTransferring = false;
let cachedJettonWalletAddress = null; 
let lastSuccessfulSeqno = 0; 

/**
 * Level 4 Resilience Node Pool (Supporting V2 and V4 protocols)
 */
const getClientPool = async () => {
    const v2Pool = [
        { url: 'https://toncenter.com/api/v2/jsonRPC', key: process.env.TONCENTER_API_KEY || PRIMARY_API_KEY },
        { url: 'https://ton-mainnet.core.chainstack.com/264e83c26786cc7277b0845a7a153be5/jsonRPC', key: null }
    ];

    try {
        const orbs = await getHttpEndpoint({ network: 'mainnet' });
        if (orbs) v2Pool.push({ url: orbs, key: null });
    } catch (e) {}

    const v4Pool = [
        'https://mainnet-v4.tonhubapi.com'
    ];

    return {
        v2: v2Pool.map(e => ({ client: new TonClient({ endpoint: e.url, apiKey: e.key }), url: e.url })),
        v4: v4Pool.map(url => ({ client: new TonClient4({ endpoint: url }), url: url }))
    };
};

const withRetry = async (fn, retries = 5, delay = 2500) => {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try { return await fn(); } catch (e) {
            lastError = e;
            const msg = e?.message?.toLowerCase() || '';
            const isRetryable = msg.includes('429') || msg.includes('limit') || msg.includes('timeout') || 
                                msg.includes('401') || msg.includes('500') || msg.includes('502') ||
                                msg.includes('network') || msg.includes('unable to execute') ||
                                msg.includes('broadcast failed') || msg.includes('chain busy');
            if (isRetryable) {
                console.warn(`[TON-RETRY] Attempt ${i + 1} failed: ${e.message}. Retrying...`);
                await sleep(delay);
                delay *= 1.4;
                continue;
            }
            throw e; 
        }
    }
    throw lastError;
};

/**
 * Bulletproof TON Withdrawal Level 4 (God Mode)
 */
export async function transferFEST(destinationAddress, amountStr, userId, withdrawId) {
    while (isTransferring) { await sleep(1500); }
    isTransferring = true;
    
    // Clear cache if we switch masters (optional but safe)
    // cachedJettonWalletAddress = null; 

    try {
        const amount = Math.floor(parseFloat(amountStr) * 1e9); // FEST has 9 decimals
        const mnemonic = await getMnemonic();
        const keyPair = await mnemonicToWalletKey(mnemonic);
        
        // --- NODE POOL INITIALIZATION ---
        const pool = await getClientPool();
        const allClients = [...pool.v2, ...pool.v4];

        // --- WALLET VERSION RESOLUTION (V4 vs V3R2) ---
        let wallet = null;
        let walletVersion = 'V4';
        const v4Wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
        const v3Wallet = WalletContractV3R2.create({ workchain: 0, publicKey: keyPair.publicKey });

        // Auto-Detect Active Wallet Version
        let foundActive = false;
        for (const entry of allClients) {
            try {
                let seq = 0;
                if (entry.client instanceof TonClient4) {
                    const last = await entry.client.getLastBlock();
                    const acc = await entry.client.getAccount(last.last.seqno, v4Wallet.address);
                    seq = acc?.account?.state?.type === 'active' ? 1 : 0;
                } else {
                    seq = await entry.client.open(v4Wallet).getSeqno();
                }

                if (seq > 0) {
                    wallet = v4Wallet;
                    walletVersion = 'V4';
                    foundActive = true;
                    break;
                }
            } catch (e) { continue; }
        }

        if (!foundActive) {
            console.log("[TON] Wallet V4 inactive, falling back to V3R2...");
            wallet = v3Wallet;
            walletVersion = 'V3R2';
        } else {
            console.log(`[TON] Detected Active Wallet: ${walletVersion} (${v4Wallet.address.toString()})`);
        }

        // Final sanity check for V3 initialization
        if (!wallet) wallet = v4Wallet;

        const target = Address.parse(destinationAddress.trim());
        const destString = target.toString({ bounceable: false });

        // --- PHASE 1: RESOLVE SOURCE JETTON WALLET ---
        if (!cachedJettonWalletAddress) {
            await withRetry(async () => {
                const ownerAddr = wallet.address.toString();
                try {
                    const response = await axios.get(`https://tonapi.io/v2/blockchain/accounts/${FEST_MASTER_MAINNET}/methods/get_wallet_address`, {
                        params: { args: ownerAddr },
                        timeout: 10000
                    });

                    const resAddr = response.data?.decoded?.jetton_wallet_address || response.data?.stack?.[0]?.value;
                    
                    if (response.data?.success && resAddr) {
                        cachedJettonWalletAddress = Address.parse(resAddr);
                        console.log(`[TON] Resolved $FEST Source Wallet: ${cachedJettonWalletAddress.toString()}`);
                        return;
                    }
                } catch (e) {
                    console.warn(`[TON] Tonapi resolution failed, trying fallback...`);
                }

                // Fallback to manual runMethod if Tonapi fails
                for (const entry of pool.v2) {
                    try {
                        const festMaster = Address.parse(FEST_MASTER_MAINNET);
                        const response = await entry.client.runMethod(festMaster, 'get_wallet_address', [
                            { type: 'slice', cell: beginCell().storeAddress(wallet.address).endCell() }
                        ]);
                        cachedJettonWalletAddress = response.stack.readAddress();
                        console.log(`[TON] Resolved $FEST Source Wallet (Fallback): ${cachedJettonWalletAddress.toString()}`);
                        return;
                    } catch (e) { continue; }
                }
                throw new Error("$FEST Wallet Resolution Failed");
            });
        }

        // --- PHASE 2: SYNC SEQNO (Maximum Node Sync) ---
        let currentSeqno = 0;
        await withRetry(async () => {
            const seqnos = [];
            for (const entry of allClients) {
                try {
                    let seq = 0;
                    if (entry.client instanceof TonClient4) {
                        const last = await entry.client.getLastBlock();
                        const acc = await entry.client.getAccount(last.last.seqno, wallet.address);
                        seq = acc?.account?.state?.type === 'active' ? (acc.account.state.seqno || 0) : 0;
                    } else {
                        seq = await entry.client.open(wallet).getSeqno();
                    }
                    if (seq > 0) seqnos.push(seq);
                } catch (e) { continue; }
            }
            
            if (seqnos.length > 0) {
                currentSeqno = Math.max(...seqnos);
                if (currentSeqno < lastSuccessfulSeqno) {
                    console.warn(`[TON] Node Lag Detected: Max Seqno ${currentSeqno} < Last ${lastSuccessfulSeqno}. Forcing last known.`);
                    currentSeqno = lastSuccessfulSeqno;
                }
                return;
            }
            // If every node returned error or 0, we treat it as uninitialized (seqno 0) or fallback to last known
            currentSeqno = lastSuccessfulSeqno || 0;
            console.warn(`[TON] Sequential Sync Warning: No active nodes responded. Using Seqno ${currentSeqno}`);
        }, 3, 2000);

        // --- PHASE 3: BROADCAST ---
        const body = beginCell()
            .storeUint(0xf8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(amount)
            .storeAddress(target)
            .storeAddress(wallet.address)
            .storeBit(0)
            .storeCoins(toNano("0.04"))
            .storeBit(1)
            .storeRef(beginCell().storeUint(0, 32).storeStringTail(`${userId || 'id'}:${withdrawId || 'w'}`).endCell())
            .endCell();

        await withRetry(async () => {
            let lastErrorMsg = '';
            for (const entry of pool.v2) {
                try {
                    const endpoint = entry.url;
                    console.log(`[TON] Broadcasting Level 4 via ${endpoint.slice(0, 40)}...`);
                    const provider = entry.client.open(wallet);
                    await provider.sendTransfer({
                        seqno: currentSeqno,
                        secretKey: keyPair.secretKey,
                        messages: [
                            internal({
                                to: cachedJettonWalletAddress,
                                value: toNano("0.075"),
                                bounce: true,
                                body: body
                            })
                        ]
                    });
                    return;
                } catch (e) { 
                    lastErrorMsg = e.message;
                    console.warn(`[TON-BROADCAST] Node ${entry.url.slice(0, 30)} rejected: ${e.message}`);
                    if (e.message.includes('429')) throw e; // Let withRetry handle rate limits
                    continue; 
                }
            }
            // --- FALLBACK: BROADCAST VIA V4 (Tonhub) ---
            console.log("[TON] Primary V2 Broadcast failed. Attempting V4 Fallback...");
            const boc = await wallet.createTransfer({
                seqno: currentSeqno,
                secretKey: keyPair.secretKey,
                messages: [
                    internal({
                        to: cachedJettonWalletAddress,
                        value: toNano("0.075"),
                        bounce: true,
                        body: body
                    })
                ]
            }).toBoc();

            for (const entry of pool.v4) {
                try {
                    console.log(`[TON] Broadcasting via V4 (${entry.url})...`);
                    await entry.client.sendMessage(boc);
                    return;
                } catch (e) {
                    lastErrorMsg = e.message;
                    console.warn(`[TON-V4] Node ${entry.url} rejected: ${e.message}`);
                    continue;
                }
            }
            
            throw new Error(`Broadcast Failed on all endpoints (V2 & V4). Last error: ${lastErrorMsg}`);
        }, 3, 3500);

        // --- PHASE 4: CONFIRMATION (REDUNDANT NODE POLLING) ---
        let confirmed = false;
        for (let attempt = 0; attempt < 45; attempt++) {
            await sleep(2500);
            try {
                const entry = allClients[attempt % allClients.length];
                let newSeqno = 0;
                if (entry.client instanceof TonClient4) {
                    const last = await entry.client.getLastBlock();
                    const acc = await entry.client.getAccount(last.last.seqno, wallet.address);
                    newSeqno = acc?.account?.state?.seqno || 0;
                } else {
                    newSeqno = await entry.client.open(wallet).getSeqno();
                }

                if (newSeqno > currentSeqno) {
                    confirmed = true;
                    lastSuccessfulSeqno = newSeqno;
                    break;
                }
            } catch (e) { continue; }
        }

        if (!confirmed) {
            console.warn(`[TON] Success/Confirmation Timeout. Check: https://tonviewer.com/${destString}`);
            return { success: true, pending: true, txLink: `https://tonviewer.com/${destString}` };
        }

        console.log(`[TON] DONE! Sent ${amountStr} $FEST to ${destString} (${walletVersion})`);
        return { success: true, pending: false, txLink: `https://tonviewer.com/${destString}` };

    } catch (error) {
        console.error("[TON-FATAL] Level 4 Failure:", error.message);
        return { success: false, error: error.message };
    } finally {
        isTransferring = false;
    }
}
