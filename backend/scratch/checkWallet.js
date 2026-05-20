import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

async function main() {
    const phrase = process.env.PROJECT_WALLET_PHRASE;
    if (!phrase) {
        console.log('NO PHRASE FOUND');
        return;
    }
    const words = phrase.trim().split(/\s+/).slice(0, 24);
    if (words.length !== 24) {
        console.log('INVALID PHRASE LENGTH:', words.length);
        return;
    }
    const key = await mnemonicToWalletKey(words);
    const w = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    console.log('Derived Wallet:', w.address.toString());
}

main();
