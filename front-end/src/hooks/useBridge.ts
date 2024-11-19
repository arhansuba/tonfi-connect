import { useState, useCallback, useEffect } from 'react';
import { 
    Address,
    beginCell,
    toNano,
    fromNano,
    TonClient,
} from '@ton/ton';
import { BigNumber } from 'bignumber.js';
import { useTonWallet } from '@tonconnect/ui-react';
import { useTonConnectUI } from '@tonconnect/ui-react';

interface ChainInfo {
    id: number;
    name: string;
    icon: string;
    nativeToken: string;
    enabled: boolean;
    minAmount: string;
    maxAmount: string;
    estimatedTime: number;
}

interface BridgeTransaction {
    hash: string;
    fromChain: number;
    toChain: number;
    amount: string;
    status: 'pending' | 'confirming' | 'completed' | 'failed';
    confirmations: number;
    requiredConfirmations: number;
    timestamp: number;
}

interface BridgeFees {
    [x: string]: string;
    baseFee: string;
    percentageFee: string;
    totalFee: string;
    gasEstimate: string;
}

export function useBridge() {
    const wallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();
    const { connected, connector } = tonConnectUI;
    const [client] = useState(() => new TonClient({
        endpoint: process.env.NEXT_PUBLIC_TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC'
    }));

    // State management
    const [sourceChain, setSourceChain] = useState<ChainInfo | null>(null);
    const [targetChain, setTargetChain] = useState<ChainInfo | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingTransactions, setPendingTransactions] = useState<BridgeTransaction[]>([]);

    useEffect(() => {
        setError(null);
    }, [amount, sourceChain, targetChain]);

    const validateBridge = useCallback((): string | null => {
        if (!connected) return 'Wallet not connected';
        if (!sourceChain) return 'Select source chain';
        if (!targetChain) return 'Select target chain';
        if (!amount || isNaN(Number(amount))) return 'Enter amount';

        const numAmount = Number(amount);
        if (numAmount <= 0) return 'Invalid amount';
        if (numAmount < Number(sourceChain.minAmount)) 
            return `Minimum amount is ${sourceChain.minAmount} ${sourceChain.nativeToken}`;
        if (numAmount > Number(sourceChain.maxAmount)) 
            return `Maximum amount is ${sourceChain.maxAmount} ${sourceChain.nativeToken}`;

        return null;
    }, [connected, sourceChain, targetChain, amount]);

    const estimateFees = useCallback(async (): Promise<BridgeFees> => {
        try {
            if (!amount || !sourceChain || !targetChain) {
                throw new Error('Invalid parameters for fee estimation');
            }

            const baseFeeResult = await client.callGetMethod(
                Address.parse(process.env.NEXT_PUBLIC_BRIDGE_ADDRESS!),
                'get_base_fee',
                []
            );

            const baseFee = fromNano(baseFeeResult.stack.readBigNumber());
            const percentageFee = new BigNumber(amount).multipliedBy(0.003).toString();
            const totalFee = new BigNumber(baseFee).plus(percentageFee).toString();
            const gasEstimate = fromNano('0.1'); // Default gas estimate

            return {
                baseFee,
                percentageFee,
                totalFee,
                gasEstimate
            };
        } catch (error) {
            console.error('Fee estimation failed:', error);
            throw new Error('Failed to estimate fees');
        }
    }, [amount, sourceChain, targetChain, client]);

    const getRequiredConfirmations = useCallback((): number => {
        switch (targetChain?.id) {
            case 1: return 1;  // TON
            case 2: return 12; // ETH
            case 3: return 5;  // BSC
            default: return 1;
        }
    }, [targetChain]);

    const switchChains = useCallback(() => {
        const tempChain = sourceChain;
        setSourceChain(targetChain);
        setTargetChain(tempChain);
    }, [sourceChain, targetChain]);

    const resetState = useCallback(() => {
        setAmount('');
        setError(null);
    }, []);

    const savePendingTransactions = useCallback((transactions: BridgeTransaction[]) => {
        if (wallet?.account.address) {
            localStorage.setItem(
                `bridge_transactions_${wallet.account.address}`,
                JSON.stringify(transactions)
            );
        }
    }, [wallet?.account.address]);

    const getTransactionStatus = async (hash: string): Promise<BridgeTransaction> => {
        try {
            const status = await client.callGetMethod(
                Address.parse(process.env.NEXT_PUBLIC_BRIDGE_ADDRESS!),
                'get_transfer_status',
                [{
                    type: 'cell',
                    cell: beginCell().storeBuffer(Buffer.from(hash, 'hex')).endCell()
                }]
            );

            const tx = pendingTransactions.find(t => t.hash === hash);
            if (!tx) throw new Error('Transaction not found');

            const confirmations = status.stack.readNumber();
            const statusCode = status.stack.readNumber();

            return {
                ...tx,
                confirmations,
                status: decodeTransactionStatus(statusCode)
            };
        } catch (error) {
            console.error('Failed to get transaction status:', error);
            throw error;
        }
    };

    const executeBridge = async (): Promise<string> => {
        try {
            const validationError = validateBridge();
            if (validationError) throw new Error(validationError);
            if (!wallet?.account.address) throw new Error('Wallet not connected');
            if (!connector) throw new Error('Connector not initialized');

            setLoading(true);

            const message = beginCell()
                .storeUint(1, 32)
                .storeCoins(toNano(amount))
                .storeUint(targetChain!.id, 32)
                .storeAddress(Address.parse(wallet.account.address))
                .endCell();

            const fees = await estimateFees();
            const totalAmount = new BigNumber(amount)
                .plus(fees.totalFee)
                .plus(fees.gasEstimate)
                .toString();

            const result = await connector.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 300,
                messages: [{
                    address: process.env.NEXT_PUBLIC_BRIDGE_ADDRESS!,
                    amount: totalAmount,
                    payload: message.toBoc().toString('base64')
                }]
            });

            if (!result.boc) throw new Error('Failed to get transaction hash');

            const newTransaction: BridgeTransaction = {
                hash: result.boc,
                fromChain: sourceChain!.id,
                toChain: targetChain!.id,
                amount,
                status: 'pending',
                confirmations: 0,
                requiredConfirmations: getRequiredConfirmations(),
                timestamp: Date.now()
            };

            setPendingTransactions(prev => [...prev, newTransaction]);
            savePendingTransactions([...pendingTransactions, newTransaction]);
            resetState();

            return result.boc;
        } catch (error) {
            console.error('Bridge failed:', error);
            setError(error instanceof Error ? error.message : 'Bridge failed. Please try again.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const decodeTransactionStatus = (status: number): BridgeTransaction['status'] => {
        switch (status) {
            case 0: return 'pending';
            case 1: return 'confirming';
            case 2: return 'completed';
            case 3: return 'failed';
            default: return 'pending';
        }
    };

    return {
        sourceChain,
        setSourceChain,
        targetChain,
        setTargetChain,
        amount,
        setAmount,
        loading,
        error,
        executeBridge,
        estimateFees,
        pendingTransactions,
        getTransactionStatus,
        validateBridge,
        switchChains,
        resetState
    };
}

export default useBridge;