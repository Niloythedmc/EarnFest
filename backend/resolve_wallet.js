import { TonClient, WalletContractV4, Address, beginCell } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import dotenv from 'dotenv';
dotenv.config();

const USDT_MASTER_MAINNET = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

async function solve() {
    const rawPhrase = process.env.PROJECT_WALLET_PHRASE || "";
    const words = rawPhrase.trim().split(/\s+/).slice(0, 24);
    if (words.length !== 24) return console.error("Bad mnemonic");
    
    const keyPair = await mnemonicToWalletKey(words);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    
    const client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: 'AEB2JB3ML42UANAAAAAHLGCS34SCOEZVKLW2JSCYBY3YWMHNF43ZYBD62CXFP43IQPBDSDI'
    });

    const usdtMaster = Address.parse(USDT_MASTER_MAINNET);
    const response = await client.runMethod(usdtMaster, 'get_wallet_address', [
        { type: 'slice', cell: beginCell().storeAddress(wallet.address).endCell() }
    ]);
    const jettonWallet = response.stack.readAddress();
    console.log("PROJECT_MAIN_WALLET:", wallet.address.toString());
    console.log("PROJECT_USDT_WALLET (Hardcode this!):", jettonWallet.toString());
}

solve();
