import React, { useState, useEffect } from 'react';
import { useBridge } from '../hooks/useBridge';
import { ArrowDownUp, Info, ArrowRight, AlertCircle } from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from '@/components/ui/card';
import {
    Alert,
    AlertDescription,
} from '@/components/ui/alert';

import { useTonConnectUI } from '@tonconnect/ui-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

// Define shared interface for chain information
export interface Chain {
    id: number;
    name: string;
    icon: string;
    nativeToken: string;
    explorerUrl: string;
    enabled: boolean;
    minAmount: string;
    maxAmount: string;
    estimatedTime: number;
}

// Export the chains array so it can be used by other components
export const CHAINS: Chain[] = [
    {
        id: 1,
        name: 'TON',
        icon: '/chains/ton.svg',
        nativeToken: 'TON',
        explorerUrl: 'https://tonscan.org',
        minAmount: '10',
        maxAmount: '1000000',
        estimatedTime: 2,
        enabled: true
    },
    {
        id: 2,
        name: 'Ethereum',
        icon: '/chains/eth.svg',
        nativeToken: 'ETH',
        explorerUrl: 'https://etherscan.io',
        minAmount: '0.1',
        maxAmount: '1000',
        estimatedTime: 15,
        enabled: true
    },
    {
        id: 3,
        name: 'BSC',
        icon: '/chains/bsc.svg',
        nativeToken: 'BNB',
        explorerUrl: 'https://bscscan.com',
        minAmount: '0.1',
        maxAmount: '5000',
        estimatedTime: 5,
        enabled: true
    }
];

interface FeeEstimate {
    bridgeFee: string;
    gasEstimate: string;
    estimatedTime: number;
}

interface PendingTransaction {
    hash: string;
    amount: string;
    fromChain: string;
    toChain: string;
    confirmations: number;
    requiredConfirmations: number;
}

// Declare global Telegram types
declare global {
    interface Window {
        Telegram: {
            WebApp: {
                showPopup: (params: { title: string; message: string; buttons: { type: string }[] }) => void;
                showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
                showAlert: (message: string) => void;
            };
        };
    }
}

const ChainSelector: React.FC<{
    value: Chain | null;
    onChange: (chain: Chain) => void;
    exclude?: Chain | null;
    label: string;
}> = ({ value, onChange, exclude, label }) => (
    <div className="space-y-2">
        <label className="text-sm text-gray-500">{label}</label>
        <div className="grid grid-cols-3 gap-2">
            {CHAINS
                .filter(chain => chain.enabled && chain !== exclude)
                .map(chain => (
                    <Button
                        key={chain.id}
                        variant={value?.id === chain.id ? "default" : "outline"}
                        className="flex flex-col items-center p-4 h-auto"
                        onClick={() => onChange(chain)}
                    >
                        <img
                            src={chain.icon}
                            alt={chain.name}
                            className="w-8 h-8 mb-2"
                        />
                        <span className="text-sm">{chain.name}</span>
                    </Button>
                ))}
        </div>
    </div>
);

export const BridgeForm: React.FC = () => {
    const [tonConnectUI] = useTonConnectUI();
    const { connected } = tonConnectUI;
    const {
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
        validateBridge,
        switchChains,
    } = useBridge();

    const [fees, setFees] = useState<FeeEstimate | null>(null);

    useEffect(() => {
        const updateFees = async () => {
            if (amount && sourceChain && targetChain) {
                try {
                    const estimatedFees = await estimateFees();
                    setFees({
                        bridgeFee: estimatedFees.bridgeFee,
                        gasEstimate: estimatedFees.gasEstimate,
                        estimatedTime: targetChain.estimatedTime
                    });
                } catch (error) {
                    console.error('Failed to estimate fees:', error);
                }
            }
        };

        const debounce = setTimeout(updateFees, 500);
        return () => clearTimeout(debounce);
    }, [amount, sourceChain, targetChain, estimateFees]);

    const handleBridge = async () => {
        try {
            if (!connected) {
                await tonConnectUI.connectWallet();
                return;
            }

            const validationError = validateBridge();
            if (validationError) {
                window.Telegram.WebApp.showPopup({
                    title: 'Validation Error',
                    message: validationError,
                    buttons: [{ type: 'ok' }]
                });
                return;
            }

            const confirmation = await new Promise<boolean>((resolve) => {
                window.Telegram.WebApp.showConfirm(
                    `Bridge ${amount} ${sourceChain?.nativeToken} to ${targetChain?.name}?\n\n` +
                    `Bridge Fee: ${fees?.bridgeFee}\n` +
                    `Network Fee: ${fees?.gasEstimate}\n` +
                    `Estimated Time: ${fees?.estimatedTime} minutes`,
                    (confirmed) => resolve(confirmed)
                );
            });

            if (!confirmation) return;

            const txHash = await executeBridge();

            window.Telegram.WebApp.showAlert(
                `Bridge initiated!\nTransaction Hash: ${txHash.slice(0, 8)}...${txHash.slice(-6)}`
            );

        } catch (error) {
            console.error('Bridge failed:', error);
            window.Telegram.WebApp.showAlert('Bridge failed. Please try again.');
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Bridge</CardTitle>
                <CardDescription>
                    Transfer tokens across chains securely
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                <ChainSelector
                    value={sourceChain as Chain}
                    onChange={setSourceChain}
                    exclude={targetChain as Chain}
                    label="From"
                />

                {sourceChain && (
                    <div className="space-y-2">
                        <label className="text-sm text-gray-500">Amount</label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={`Min: ${sourceChain.minAmount} ${sourceChain.nativeToken}`}
                                className="text-lg"
                            />
                            <span className="text-sm font-medium">
                                {sourceChain.nativeToken}
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex justify-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={switchChains}
                        className="rounded-full p-2"
                    >
                        <ArrowDownUp className="h-4 w-4" />
                    </Button>
                </div>

                <ChainSelector
                    value={targetChain as Chain}
                    onChange={setTargetChain}
                    exclude={sourceChain as Chain}
                    label="To"
                />

                {fees && (
                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg dark:bg-gray-800">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Bridge Fee:</span>
                            <span>{fees.bridgeFee} {sourceChain?.nativeToken}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Network Fee:</span>
                            <span>{fees.gasEstimate} {sourceChain?.nativeToken}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Estimated Time:</span>
                            <span>{fees.estimatedTime} minutes</span>
                        </div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </CardContent>

            <CardFooter>
                <Button
                    className="w-full"
                    size="lg"
                    disabled={!!validateBridge() || loading}
                    onClick={handleBridge}
                >
                    {!connected
                        ? 'Connect Wallet'
                        : validateBridge() || (loading ? 'Bridging...' : 'Bridge')}
                </Button>
            </CardFooter>
        </Card>
    );
};

export default BridgeForm;