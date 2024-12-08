import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type SwapPoolConfig = {};

export function swapPoolConfigToCell(config: SwapPoolConfig): Cell {
    return beginCell().endCell();
}

export class SwapPool implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SwapPool(address);
    }

    static createFromConfig(config: SwapPoolConfig, code: Cell, workchain = 0) {
        const data = swapPoolConfigToCell(config);
        const init = { code, data };
        return new SwapPool(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
