import { TonClient } from '@ton/ton';
import { getHttpEndpoint } from '@orbs-network/ton-access';

async function check() {
    const endpoint = await getHttpEndpoint({ network: 'mainnet' });
    const client = new TonClient({ endpoint });
    const info = await client.getMasterchainInfo();
    console.log('Masterchain Info:', JSON.stringify(info, null, 2));
    
    // Check config param 0 (Network ID)
    try {
        const config = await client.getConfigParam(0);
        console.log('Config Param 0:', JSON.stringify(config, null, 2));
    } catch (e) {
        console.log('Config Param 0 failed:', e.message);
    }
}

check();
