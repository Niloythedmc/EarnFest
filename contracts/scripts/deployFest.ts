import { Address, beginCell, toNano } from '@ton/core';
import { Fest } from '../build/Fest/tact_Fest';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const deployer = provider.sender().address;
    if (!deployer) {
        throw new Error("Deployer address is missing");
    }

    // This is an off-chain metadata JSON URL.
    // Ensure this URL hosts a valid TEP-64 JSON with {"name": "Fest", "symbol": "FEST", "decimals": "9", "description": "The official token of Eid Fest"}
    const metadataUrl = "https://earn-fest.web.app/fest-metadata.json"; 
    
    const contentCell = beginCell().storeInt(0x01, 8).storeStringTail(metadataUrl).endCell();

    // Initialize the contract
    const fest = provider.open(await Fest.fromInit(deployer, contentCell));

    ui.write('Deploying $FEST Jetton Master to: ' + fest.address.toString());

    await fest.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(fest.address);
    ui.write('Deployment successful!');
    
    ui.write('Minting initial supply of 1 Billion $FEST...');
    
    // Mint initial supply of 1,000,000,000 $FEST to the deployer
    await fest.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Mint',
            amount: 1000000000000000000n, // 1 Billion * 10^9
            receiver: deployer,
        }
    );

    ui.write('Done! You now own 1,000,000,000 $FEST tokens.');
}
