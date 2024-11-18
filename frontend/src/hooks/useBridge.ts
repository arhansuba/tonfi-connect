import { useState, useCallback, useEffect } from 'react';
import { 
    Address,
    beginCell,
    toNano,
    fromNano,
    TonClient,
    SendMode 
} from '@ton/ton';
import { BigNumber } from 'bignumber.js';
import { useTonWallet } from '@tonconnect/ui-react';
import { useTonConnect } from '@tonconnect/ui-react';

interface ChainInfo {
    id: number;
    name: string;
    icon: string;
    nativeToken: string;
    enabled: boolean;
    minAmount: string;
    maxAmount: string;
    estimatedTime: number; // in minutes
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
    baseFee: string;
    percentageFee: string;
    totalFee: string;
    gasEstimate: string;
}

interface UseBridgeReturn {
    // States
    sourceChain: ChainInfo | null;
    setSourceChain: (chain: ChainInfo) => void;
    targetChain: ChainInfo | null;
    setTargetChain: (chain: ChainInfo) => void;
    amount: string;
    setAmount: (amount: string) => void;
    loading: boolean;
    error: string | null;
    
    // Bridge operations
    executeBridge: () => Promise<string>;
    estimateFees: () => Promise<BridgeFees>;
    
    // Transaction management
    pendingTransactions: BridgeTransaction[];
    getTransactionStatus: (hash: string) => Promise<BridgeTransaction>;
    
    // Utils
    validateBridge: () => string | null;
    switchChains: () => void;
    resetState: () => void;
}

export function useBridge(): UseBridgeReturn {
    // Initialize wallet and client connections
    const wallet = useTonWallet();
    const { connected, connector } = useTonConnect();
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

    // Constants
    const SUPPORTED_CHAINS: ChainInfo[] = [
        {
            id: 1,
            name: 'TON',
            icon: '/ton.svg',
            nativeToken: 'TON',
            enabled: true,
            minAmount: '10',
            maxAmount: '10000',
            estimatedTime: 15
        },
        {
            id: 2,
            name: 'Ethereum',
            icon: '/eth.svg',
            nativeToken: 'ETH',
            enabled: true,
            minAmount: '0.1',
            maxAmount: '100',
            estimatedTime: 20
        },
        {
            id: 3,
            name: 'BSC',
            icon: '/bsc.svg',
            nativeToken: 'BNB',
            enabled: true,
            minAmount: '0.1',
            maxAmount: '500',
            estimatedTime: 10
        }
    ];

    // Clear error on input change
    useEffect(() => {
        setError(null);
    }, [amount, sourceChain, targetChain]);

    // Load pending transactions
    useEffect(() => {
        if (connected && wallet?.account.address) {
            loadPendingTransactions();
        }
    }, [connected, wallet?.account.address]);

    // Monitor pending transactions
    useEffect(() => {
        const interval = setInterval(async () => {
            await updatePendingTransactions();
        }, 15000);

        return () => clearInterval(interval);
    }, [pendingTransactions]);

    const loadPendingTransactions = async () => {
        try {
            const storage = localStorage.getItem(`bridge_transactions_${wallet?.account.address}`);
            if (storage) {
                const transactions: BridgeTransaction[] = JSON.parse(storage);
                setPendingTransactions(transactions);
            }
        } catch (error) {
            console.error('Failed to load pending transactions:', error);
        }
    };

    const updatePendingTransactions = async () => {
        const updatedTransactions = await Promise.all(
            pendingTransactions.map(async (tx) => {
                if (tx.status === 'completed' || tx.status === 'failed') {
                    return tx;
                }
                return await getTransactionStatus(tx.hash);
            })
        );

        setPendingTransactions(updatedTransactions);
        savePendingTransactions(updatedTransactions);
    };

    const savePendingTransactions = (transactions: BridgeTransaction[]) => {
        if (wallet?.account.address) {
            localStorage.setItem(
                `bridge_transactions_${wallet.account.address}`,
                JSON.stringify(transactions)
            );
        }
    };

    const executeBridge = async (): Promise<string> => {
        try {
            const validationError = validateBridge();
            if (validationError) throw new Error(validationError);
            if (!wallet?.account.address) throw new Error('Wallet not connected');

            setLoading(true);

            // Prepare bridge message
            const message = beginCell()
                .storeUint(1, 32) // op: lock
                .storeCoins(toNano(amount))
                .storeUint(targetChain!.id, 32)
                .storeAddress(Address.parse(wallet.account.address))
                .endCell();

            // Calculate fees
            const fees = await estimateFees();

            // Send transaction
            const result = await connector.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 300,
                messages: [
                    {
                        address: process.env.NEXT_PUBLIC_BRIDGE_ADDRESS!,
                        amount: (new BigNumber(amount))
                            .plus(fees.totalFee)
                            .plus(fees.gasEstimate)
                            .toString(),
                        payload: message.toBoc().toString('base64'),
                        stateInit: null
                    }
                ]
            });

            // Create pending transaction
            const newTransaction: BridgeTransaction = {
                hash: result.hash,
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

            // Reset form
            resetState();

            return result.hash;

        } catch (error) {
            console.error('Bridge failed:', error);
            setError(error instanceof Error ? error.message : 'Bridge failed. Please try again.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const estimateFees = async (): Promise<BridgeFees> => {
        try {
            if (!amount || !sourceChain || !targetChain) {
                throw new Error('Invalid parameters for fee estimation');
            }

            // Get base fee from contract
            const baseFee = await client.callGetMethod(
                Address.parse(process.env.NEXT_PUBLIC_BRIDGE_ADDRESS!),
                'get_base_fee',
                []
            );

            // Calculate percentage fee (0.3%)
            const percentageFee = new BigNumber(amount).multipliedBy(0.003);

            // Estimate gas
            const gasEstimate = toNano('0.1'); // Default gas estimate

            return {
                baseFee: fromNano(baseFee.stack.readBigNumber()),
                percentageFee: percentageFee.toString(),
                totalFee: percentageFee.plus(fromNano(baseFee.stack.readBigNumber())).toString(),
                gasEstimate: fromNano(gasEstimate)
            };
        } catch (error) {
            console.error('Fee estimation failed:', error);
            throw new Error('Failed to estimate fees');
        }
    };

    const getTransactionStatus = async (hash: string): Promise<BridgeTransaction> => {
        try {
            // Get transaction status from bridge contract
            const status = await client.callGetMethod(
                Address.parse(process.env.NEXT_PUBLIC_BRIDGE_ADDRESS!),
                'get_transfer_status',
                [{ type: 'slice', value: hash }]
            );

            const tx = pendingTransactions.find(t => t.hash === hash);
            if (!tx) throw new Error('Transaction not found');

            const confirmations = status.stack.readNumber();
            const isCompleted = status.stack.readBoolean();
            const isFailed = status.stack.readBoolean();

            return {
                ...tx,
                confirmations,
                status: isFailed ? 'failed' : isCompleted ? 'completed' : 'confirming',
            };

        } catch (error) {
            console.error('Failed to get transaction status:', error);
            throw error;
        }
    };

    const validateBridge = (): string | null => {
        if (!connected) return 'Wallet not connected';
        if (!sourceChain) return 'Select source chain';
        if (!targetChain) return 'Select target chain';
        if (!amount || isNaN(Number(amount))) return 'Enter amount';

        const numAmount = Number(amount);
        if (numAmount <= 0) return 'Invalid amount';
        if (numAmount < Number(sourceChain.minAmount)) return `Minimum amount is ${sourceChain.minAmount} ${sourceChain.nativeToken}`;
        if (numAmount > Number(sourceChain.maxAmount)) return `Maximum amount is ${sourceChain.maxAmount} ${sourceChain.nativeToken}`;

        return null;
    };

    const switchChains = useCallback(() => {
        setSourceChain(targetChain);
        setTargetChain(sourceChain);
    }, [sourceChain, targetChain]);

    const resetState = useCallback(() => {
        setAmount('');
        setError(null);
    }, []);

    const getRequiredConfirmations = (): number => {
        // Different chains require different confirmation counts
        switch (targetChain?.id) {
            case 1: return 1;  // TON
            case 2: return 12; // ETH
            case 3: return 5;  // BSC
            default: return 1;
        }
    };

    return {
        // States
        sourceChain,
        setSourceChain,
        targetChain,
        setTargetChain,
        amount,
        setAmount,
        loading,
        error,

        // Bridge operations
        executeBridge,
        estimateFees,

        // Transaction management
        pendingTransactions,
        getTransactionStatus,

        // Utils
        validateBridge,
        switchChains,
        resetState
    };
}