import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { SwapPool } from '../../wrappers/SwapPool';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('SwapPool', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('SwapPool');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let swapPool: SandboxContract<SwapPool>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        swapPool = blockchain.openContract(SwapPool.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await swapPool.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: swapPool.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and swapPool are ready to use
    });
});
