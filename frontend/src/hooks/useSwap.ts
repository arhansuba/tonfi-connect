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

interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    balance?: string;
}

interface SwapSettings {
    slippageTolerance: number;  // in basis points (e.g., 50 = 0.5%)
    deadline: number;           // in minutes
    autoRouting: boolean;
}

interface SwapQuote {
    estimatedOutput: string;
    minimumOutput: string;
    priceImpact: number;
    route: string[];
    fee: string;
}

interface UseSwapReturn {
    // States
    inputAmount: string;
    setInputAmount: (amount: string) => void;
    outputAmount: string;
    tokenIn: TokenInfo | null;
    setTokenIn: (token: TokenInfo | null) => void;
    tokenOut: TokenInfo | null;
    setTokenOut: (token: TokenInfo | null) => void;
    settings: SwapSettings;
    updateSettings: (settings: Partial<SwapSettings>) => void;
    loading: boolean;
    error: string | null;
    
    // Actions
    executeSwap: () => Promise<void>;
    getQuote: () => Promise<SwapQuote | null>;
    approveToken: (token: TokenInfo) => Promise<void>;
    
    // Utils
    switchTokens: () => void;
    validateSwap: () => string | null;
    resetState: () => void;
}

const DEFAULT_SETTINGS: SwapSettings = {
    slippageTolerance: 50,  // 0.5%
    deadline: 20,           // 20 minutes
    autoRouting: true
};

export function useSwap(): UseSwapReturn {
    // Connect wallet and client
    const wallet = useTonWallet();
    const { connected, connector } = useTonConnect();
    const [client] = useState(() => new TonClient({
        endpoint: process.env.NEXT_PUBLIC_TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC'
    }));

    // State management
    const [inputAmount, setInputAmount] = useState<string>('');
    const [outputAmount, setOutputAmount] = useState<string>('');
    const [tokenIn, setTokenIn] = useState<TokenInfo | null>(null);
    const [tokenOut, setTokenOut] = useState<TokenInfo | null>(null);
    const [settings, setSettings] = useState<SwapSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastQuote, setLastQuote] = useState<SwapQuote | null>(null);

    // Clear error when inputs change
    useEffect(() => {
        setError(null);
    }, [inputAmount, tokenIn, tokenOut]);

    // Update quote when inputs change
    useEffect(() => {
        if (inputAmount && tokenIn && tokenOut) {
            const debounceTimeout = setTimeout(() => {
                getQuote();
            }, 500);
            return () => clearTimeout(debounceTimeout);
        }
    }, [inputAmount, tokenIn, tokenOut, settings.slippageTolerance]);

    // Token balance updates
    useEffect(() => {
        if (connected && tokenIn) {
            updateTokenBalance(tokenIn);
        }
    }, [connected, tokenIn, wallet]);

    const updateTokenBalance = async (token: TokenInfo) => {
        try {
            const balance = await getTokenBalance(token.address);
            setTokenIn(prev => prev ? { ...prev, balance } : null);
        } catch (error) {
            console.error('Failed to update balance:', error);
        }
    };

    const getTokenBalance = async (tokenAddress: string): Promise<string> => {
        if (!wallet?.account.address) throw new Error('Wallet not connected');
        
        const balance = await client.callGetMethod(
            Address.parse(tokenAddress),
            'get_wallet_balance',
            [{ type: 'slice', value: wallet.account.address }]
        );
        
        return fromNano(balance.stack.readBigNumber());
    };

    const getQuote = async (): Promise<SwapQuote | null> => {
        try {
            if (!inputAmount || !tokenIn || !tokenOut) return null;
            
            setLoading(true);
            
            // Get pool data
            const pool = await getPool(tokenIn.address, tokenOut.address);
            const reserves = await getPoolReserves(pool);
            
            // Calculate amounts
            const amountIn = toNano(inputAmount);
            const estimatedOutput = calculateOutputAmount(
                amountIn,
                reserves.reserveIn,
                reserves.reserveOut
            );
            
            // Calculate minimum output with slippage
            const minimumOutput = calculateMinimumOutput(
                estimatedOutput,
                settings.slippageTolerance
            );
            
            // Calculate price impact
            const priceImpact = calculatePriceImpact(
                amountIn,
                estimatedOutput,
                reserves.reserveIn,
                reserves.reserveOut
            );
            
            // Calculate fee
            const fee = calculateFee(amountIn);
            
            const quote: SwapQuote = {
                estimatedOutput: fromNano(estimatedOutput),
                minimumOutput: fromNano(minimumOutput),
                priceImpact,
                route: [tokenIn.address, tokenOut.address],
                fee: fromNano(fee)
            };
            
            setLastQuote(quote);
            setOutputAmount(quote.estimatedOutput);
            return quote;
            
        } catch (error) {
            console.error('Failed to get quote:', error);
            setError('Failed to calculate swap quote');
            return null;
        } finally {
            setLoading(false);
        }
    };

    const executeSwap = async (): Promise<void> => {
        try {
            if (!validateSwap()) throw new Error('Invalid swap parameters');
            if (!wallet?.account.address) throw new Error('Wallet not connected');
            if (!lastQuote) throw new Error('No quote available');
            
            setLoading(true);
            
            // Prepare swap message
            const message = beginCell()
                .storeUint(1, 32) // op: swap
                .storeAddress(Address.parse(tokenIn!.address))
                .storeAddress(Address.parse(tokenOut!.address))
                .storeCoins(toNano(inputAmount))
                .storeCoins(toNano(lastQuote.minimumOutput))
                .storeUint(Math.floor(Date.now() / 1000) + settings.deadline * 60, 64)
                .endCell();

            // Send transaction
            const result = await connector.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + settings.deadline * 60,
                messages: [
                    {
                        address: process.env.NEXT_PUBLIC_ROUTER_ADDRESS!,
                        amount: toNano(inputAmount).toString(),
                        payload: message.toBoc().toString('base64'),
                        stateInit: null
                    }
                ]
            });

            // Wait for transaction
            await waitForTransaction(result.hash);
            
            // Update balances
            await updateTokenBalance(tokenIn!);
            
            // Reset state
            setInputAmount('');
            setOutputAmount('');
            
        } catch (error) {
            console.error('Swap failed:', error);
            setError('Swap failed. Please try again.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const validateSwap = (): string | null => {
        if (!connected) return 'Wallet not connected';
        if (!tokenIn || !tokenOut) return 'Select tokens';
        if (!inputAmount || isNaN(Number(inputAmount))) return 'Enter amount';
        if (!lastQuote) return 'Get quote first';
        if (Number(inputAmount) <= 0) return 'Invalid amount';
        
        const balance = tokenIn.balance ? Number(tokenIn.balance) : 0;
        if (Number(inputAmount) > balance) return 'Insufficient balance';
        
        return null;
    };

    const switchTokens = useCallback(() => {
        setTokenIn(tokenOut);
        setTokenOut(tokenIn);
        setInputAmount(outputAmount);
        setOutputAmount('');
        setLastQuote(null);
    }, [tokenIn, tokenOut, outputAmount]);

    const updateSettings = useCallback((newSettings: Partial<SwapSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const resetState = useCallback(() => {
        setInputAmount('');
        setOutputAmount('');
        setTokenIn(null);
        setTokenOut(null);
        setLastQuote(null);
        setError(null);
    }, []);

    // Utility functions
    const calculateOutputAmount = (
        amountIn: BigNumber,
        reserveIn: BigNumber,
        reserveOut: BigNumber
    ): BigNumber => {
        const amountInWithFee = amountIn.multipliedBy(997);
        const numerator = amountInWithFee.multipliedBy(reserveOut);
        const denominator = reserveIn.multipliedBy(1000).plus(amountInWithFee);
        return numerator.dividedBy(denominator);
    };

    const calculateMinimumOutput = (
        estimatedOutput: BigNumber,
        slippageTolerance: number
    ): BigNumber => {
        return estimatedOutput.multipliedBy(
            new BigNumber(10000 - slippageTolerance).dividedBy(10000)
        );
    };

    const calculatePriceImpact = (
        amountIn: BigNumber,
        amountOut: BigNumber,
        reserveIn: BigNumber,
        reserveOut: BigNumber
    ): number => {
        const exactQuote = reserveOut.dividedBy(reserveIn);
        const executionPrice = amountOut.dividedBy(amountIn);
        return (
            exactQuote.minus(executionPrice).dividedBy(exactQuote).multipliedBy(100).toNumber()
        );
    };

    const calculateFee = (amountIn: BigNumber): BigNumber => {
        return amountIn.multipliedBy(3).dividedBy(1000); // 0.3% fee
    };

    return {
        // States
        inputAmount,
        setInputAmount,
        outputAmount,
        tokenIn,
        setTokenIn,
        tokenOut,
        setTokenOut,
        settings,
        updateSettings,
        loading,
        error,
        
        // Actions
        executeSwap,
        getQuote,
        approveToken: async () => {}, // Implement if needed
        
        // Utils
        switchTokens,
        validateSwap,
        resetState
    };
}