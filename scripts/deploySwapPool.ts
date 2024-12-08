import { toNano } from '@ton/core';
import { SwapPool } from '../wrappers/SwapPool';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const swapPool = provider.open(SwapPool.createFromConfig({}, await compile('SwapPool')));

    await swapPool.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(swapPool.address);

    // run methods on `swapPool`
}
