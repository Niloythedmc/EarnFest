import { Address, beginCell, toNano } from '@ton/core';
import { GiftMaster } from '../build/Gift/tact_GiftMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const deployer = provider.sender().address;
    if (!deployer) {
        throw new Error("Deployer address is missing");
    }

    // This is the off-chain TEP-64 metadata JSON URL.
    const metadataUrl = "https://earn-fest.web.app/gift-token.json"; 
    
    const contentCell = beginCell().storeInt(0x01, 8).storeStringTail(metadataUrl).endCell();

    // Initialize the contract with a unique nonce (salt) to deploy a brand new address!
    // Increment this number if you ever want to deploy a fresh new token instance.
    const nonce = 3n;
    const gift = provider.open(await GiftMaster.fromInit(deployer, contentCell, nonce));

    // Check if the contract is already deployed
    const isDeployed = await provider.isContractDeployed(gift.address);
    if (isDeployed) {
        ui.write('Jetton Master is already deployed at: ' + gift.address.toString());
        
        try {
            // Fetch current state
            const data = await gift.getGetJettonData();
            ui.write('Current total supply: ' + (data.total_supply / 1000000000n).toString() + ' $GIFT');
            ui.write('Mintable status: ' + data.mintable.toString());

            if (!data.mintable || data.total_supply > 0n) {
                ui.write('🎉 The 100 Trillion $GIFT tokens have already been successfully minted to your wallet!');
                ui.write('Skipping duplicate minting transaction to prevent contract rejection.');
                ui.write('Done! You now own 100,000,000,000,000 $GIFT tokens.');
                return;
            }
        } catch (e) {
            ui.write('Unable to fetch Jetton data, proceeding with fallback minting logic...');
        }
    } else {
        ui.write('Deploying $GIFT Jetton Master to: ' + gift.address.toString());

        await gift.send(
            provider.sender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        await provider.waitForDeploy(gift.address);
        ui.write('Deployment successful!');
    }

    ui.write('Minting initial supply of 100 Trillion $GIFT...');
    
    // Mint initial supply of 100,000,000,000,000 $GIFT to the deployer (100 Trillion * 10^9)
    await gift.send(
        provider.sender(),
        {
            value: toNano('0.05'),
            bounce: true,
        },
        {
            $$type: 'Mint',
            amount: 100_000_000_000_000_000_000_000n, // 100 Trillion * 10^9
            receiver: deployer,
        }
    );

    ui.write('Done! You now own 100,000,000,000,000 $GIFT tokens.');
}
