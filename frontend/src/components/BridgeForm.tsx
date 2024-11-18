import React, { useState, useEffect } from 'react';
import { useBridge } from '../../hooks/useBridge';
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
    AlertTitle,
} from '@/components/ui/alert';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useTonConnect } from '@tonconnect/ui-react';

interface Chain {
    id: number;
    name: string;
    icon: string;
    nativeToken: string;
    explorerUrl: string;
    minAmount: string;
    maxAmount: string;
    estimatedTime: number;
}

const CHAINS: Chain[] = [
    {
        id: 1,
        name: 'TON',
        icon: '/chains/ton.svg',
        nativeToken: 'TON',
        explorerUrl: 'https://tonscan.org',
        minAmount: '10',
        maxAmount: '1000000',
        estimatedTime: 2
    },
    {
        id: 2,
        name: 'Ethereum',
        icon: '/chains/eth.svg',
        nativeToken: 'ETH',
        explorerUrl: 'https://etherscan.io',
        minAmount: '0.1',
        maxAmount: '1000',
        estimatedTime: 15
    },
    {
        id: 3,
        name: 'BSC',
        icon: '/chains/bsc.svg',
        nativeToken: 'BNB',
        explorerUrl: 'https://bscscan.com',
        minAmount: '0.1',
        maxAmount: '5000',
        estimatedTime: 5
    }
];

export const BridgeForm: React.FC = () => {
    const { connected, connector } = useTonConnect();
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

    const [fees, setFees] = useState<{
        bridgeFee: string;
        networkFee: string;
        estimatedTime: number;
    } | null>(null);

    // Update fees when input changes
    useEffect(() => {
        const updateFees = async () => {
            if (amount && sourceChain && targetChain) {
                try {
                    const estimatedFees = await estimateFees();
                    setFees({
                        bridgeFee: estimatedFees.bridgeFee,
                        networkFee: estimatedFees.gasEstimate,
                        estimatedTime: targetChain.estimatedTime
                    });
                } catch (error) {
                    console.error('Failed to estimate fees:', error);
                }
            }
        };

        const debounce = setTimeout(updateFees, 500);
        return () => clearTimeout(debounce);
    }, [amount, sourceChain, targetChain]);

    const handleBridge = async () => {
        try {
            if (!connected) {
                await connector.connect();
                return;
            }

            const validationError = validateBridge();
            if (validationError) {
                Telegram.WebApp.showPopup({
                    title: 'Validation Error',
                    message: validationError,
                    buttons: [{ type: 'ok' }]
                });
                return;
            }

            // Show confirmation popup
            const confirmation = await new Promise<boolean>((resolve) => {
                Telegram.WebApp.showConfirm(
                    `Bridge ${amount} ${sourceChain?.nativeToken} to ${targetChain?.name}?\n\n` +
                    `Bridge Fee: ${fees?.bridgeFee}\n` +
                    `Network Fee: ${fees?.networkFee}\n` +
                    `Estimated Time: ${fees?.estimatedTime} minutes`,
                    (confirmed) => resolve(confirmed)
                );
            });

            if (!confirmation) return;

            const txHash = await executeBridge();

            // Show success message
            Telegram.WebApp.showAlert(
                `Bridge initiated!\nTransaction Hash: ${txHash.slice(0, 8)}...${txHash.slice(-6)}`
            );

        } catch (error) {
            console.error('Bridge failed:', error);
            Telegram.WebApp.showAlert('Bridge failed. Please try again.');
        }
    };

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
                    .filter(chain => chain !== exclude)
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

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Bridge</CardTitle>
                <CardDescription>
                    Transfer tokens across chains securely
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Source Chain */}
                <ChainSelector
                    value={sourceChain}
                    onChange={setSourceChain}
                    exclude={targetChain}
                    label="From"
                />

                {/* Amount Input */}
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

                {/* Switch Button */}
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

                {/* Target Chain */}
                <ChainSelector
                    value={targetChain}
                    onChange={setTargetChain}
                    exclude={sourceChain}
                    label="To"
                />

                {/* Fee Information */}
                {fees && (
                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Bridge Fee:</span>
                            <span>{fees.bridgeFee} {sourceChain?.nativeToken}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Network Fee:</span>
                            <span>{fees.networkFee} {sourceChain?.nativeToken}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Estimated Time:</span>
                            <span>{fees.estimatedTime} minutes</span>
                        </div>
                    </div>
                )}

                {/* Pending Transactions */}
                {pendingTransactions.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Recent Transactions</h3>
                        {pendingTransactions.map((tx) => (
                            <div
                                key={tx.hash}
                                className="p-3 bg-gray-50 rounded-lg space-y-2"
                            >
                                <div className="flex justify-between text-sm">
                                    <span>{tx.amount} {tx.fromChain}</span>
                                    <ArrowRight className="h-4 w-4" />
                                    <span>{tx.toChain}</span>
                                </div>
                                <Progress
                                    value={(tx.confirmations / tx.requiredConfirmations) * 100}
                                    className="h-1"
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>
                                        {tx.confirmations}/{tx.requiredConfirmations} confirmations
                                    </span>
                                    <a
                                        href={`${CHAINS[tx.fromChain].explorerUrl}/tx/${tx.hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-600"
                                    >
                                        View Transaction
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Error Display */}
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