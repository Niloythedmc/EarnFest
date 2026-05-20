import { TonClient } from '@ton/ton';

async function check() {
    const apiKey = 'AEMUNTFHYNZAC4YAAAAG6LBFXLHUILRGT26BNP4TT5TLWMLAVBU6APZ4AGIZPH6UIQTLKFQ';
    const endpoint = 'https://toncenter.com/api/v2/jsonRPC';
    
    const client = new TonClient({ endpoint, apiKey });
    try {
        const info = await client.getMasterchainInfo();
        console.log('Info with Key:', JSON.stringify(info, null, 2));
        
        // Check if we can find a known MAINNET-only transaction
        // Mainnet TX: 28424268000001 (arbitrary seqno)
        // Actually, let's just check the masterchain info.
    } catch (e) {
        console.log('Error with Key:', e.message);
    }
}

check();
