import { TonClient, WalletContractV4, WalletContractV3R2 } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const rawPhrase = process.env.PROJECT_WALLET_PHRASE || "";
    const words = rawPhrase.trim().split(/\s+/).slice(0, 24);
    if (words.length !== 24) {
        console.error("Invalid mnemonic length:", words.length);
        return;
    }

    const keyPair = await mnemonicToWalletKey(words);
    
    // V4 Address
    const walletV4 = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    console.log("Wallet V4 Address:", walletV4.address.toString());

    // V3R2 Address
    const walletV3 = WalletContractV3R2.create({ workchain: 0, publicKey: keyPair.publicKey });
    console.log("Wallet V3R2 Address:", walletV3.address.toString());
}

check();
