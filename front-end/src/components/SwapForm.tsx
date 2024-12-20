'use client';
import React, { useState, useEffect } from 'react';
import { useSwap } from '../hooks/useSwap';
import { Address } from '@ton/core';
import { useTonConnectUI, TonConnect } from '@tonconnect/ui-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@radix-ui/react-dialog';
import { Settings, ArrowDown, AlertCircle } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { DialogHeader } from './ui/dialog';
import { Skeleton } from './ui/skeleton';

interface Token {
    symbol: string;
    address: string;
    icon: string;
    decimals: number;
    balance?: string;
}

const TOKENS: Token[] = [
    { symbol: 'TON', address: 'EQ...', icon: '/ton.svg', decimals: 9 },
    { symbol: 'USDT', address: 'EQ...', icon: '/usdt.svg', decimals: 6 },
    { symbol: 'WTON', address: 'EQ...', icon: '/wton.svg', decimals: 9 },
];

export const SwapForm: React.FC = () => {
    const [tonConnectUI, setTonConnectUI] = useTonConnectUI();
    const { connected, connector } = tonConnectUI;
    const {
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
        executeSwap,
        getQuote,
        switchTokens,
        validateSwap,
    } = useSwap() as {
        inputAmount: string;
        setInputAmount: (amount: string) => void;
        outputAmount: string;
        tokenIn: Token | null;
        setTokenIn: (token: Token | null) => void;
        tokenOut: Token | null;
        setTokenOut: (token: Token | null) => void;
        settings: any;
        updateSettings: (settings: any) => void;
        loading: boolean;
        error: string | null;
        executeSwap: () => Promise<void>;
        getQuote: () => Promise<any>;
        switchTokens: () => void;
        validateSwap: () => string | null;
    };

    const [showSettings, setShowSettings] = useState(false);
    const [priceImpact, setPriceImpact] = useState<number>(0);
    const [swapQuote, setSwapQuote] = useState<any>(null);

    // Update quote when inputs change
    useEffect(() => {
        const updateQuote = async () => {
            if (inputAmount && tokenIn && tokenOut) {
                const quote = await getQuote();
                setSwapQuote(quote);
                setPriceImpact(quote?.priceImpact || 0);
            }
        };

        const debounce = setTimeout(updateQuote, 500);
        return () => clearTimeout(debounce);
    }, [inputAmount, tokenIn, tokenOut, settings.slippageTolerance]);

    const handleSwap = async () => {
        try {
            if (!connected) {
                await connector.connect({ jsBridgeKey: 'your-js-bridge-key' });
                return;
            }
            await executeSwap();
            // Show success message using Telegram Mini App native UI
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showAlert('Swap executed successfully!');
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showAlert('Swap failed. Please try again.');
            } else {
                alert('Swap failed. Please try again.');
            }
                alert('Swap executed successfully!');
            }
        } catch (error) {
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showAlert('Swap failed. Please try again.');
            } else {
                alert('Swap failed. Please try again.');
            }
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Swap</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                    <Settings className="h-4 w-4" />
                </Button>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Input Amount */}
                <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between">
                        <input
                            type="number"
                            value={inputAmount}
                            onChange={(e: { target: { value: string; }; }) => setInputAmount(e.target.value)}
                            placeholder="0.0"
                            className="border-none text-2xl w-2/3"
                        />
                        <TokenSelect
                            value={tokenIn}
                            onChange={setTokenIn}
                            tokens={TOKENS}
                            excludeToken={tokenOut}
                        />
                    </div>
                    {tokenIn && (
                        <div className="text-sm text-gray-500">
                            Balance: {tokenIn.balance || '0.00'}
                        </div>
                    )}
                </div>

                {/* Swap Direction Button */}
                <div className="flex justify-center -my-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full p-2"
                        onClick={switchTokens}
                    >
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                </div>

                {/* Output Amount */}
                <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between">
                        <div className="text-2xl w-2/3">
                            {loading ? (
                                <Skeleton className="h-8 w-32" />
                            ) : (
                                outputAmount || '0.0'
                            )}
                        </div>
                        <TokenSelect
                            value={tokenOut}
                            onChange={setTokenOut}
                            tokens={TOKENS}
                            excludeToken={tokenIn}
                        />
                    </div>
                </div>

                {/* Price Impact Warning */}
                {priceImpact > 2 && (
                    <Alert variant={priceImpact > 5 ? "destructive" : "default"}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Price Impact Warning</AlertTitle>
                        <AlertDescription>
                            This swap has a price impact of {priceImpact.toFixed(2)}%
                        </AlertDescription>
                    </Alert>
                )}

                {/* Swap Details */}
                {swapQuote && (
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-500">
                            <span>Rate</span>
                            <span>
                                1 {tokenIn?.symbol} = {(Number(outputAmount) / Number(inputAmount)).toFixed(6)} {tokenOut?.symbol}
                            </span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                            <span>Fee</span>
                            <span>{swapQuote.fee} {tokenIn?.symbol}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                            <span>Min. Received</span>
                            <span>{swapQuote.minimumOutput} {tokenOut?.symbol}</span>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Swap Button */}
                <Button
                    className="w-full"
                    size="lg"
                    disabled={!!validateSwap() || loading}
                    onClick={handleSwap}
                >
                    {!connected
                        ? 'Connect Wallet'
                        : validateSwap() || (loading ? 'Swapping...' : 'Swap')}
                </Button>
            </CardContent>

            {/* Settings Dialog */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Swap Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label>Slippage Tolerance</label>
                            <div className="flex gap-2">
                                {[0.1, 0.5, 1.0].map((value) => (
                                    <Button
                                        key={value}
                                        variant={
                                            settings.slippageTolerance === value * 100
                                                ? "default"
                                                : "outline"
                                        }
                                        onClick={() =>
                                            updateSettings({
                                                slippageTolerance: value * 100,
                                            })
                                        }
                                    >
                                        {value}%
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label>Transaction Deadline</label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={settings.deadline}
                                    onChange={(e: { target: { value: any; }; }) =>
                                        updateSettings({
                                            deadline: Number(e.target.value),
                                        })
                                    }
                                    min="1"
                                    max="60"
                                />
                                <span className="self-center">minutes</span>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

// Token Select Component
const TokenSelect: React.FC<{
    value: Token | null;
    onChange: (token: Token) => void;
    tokens: Token[];
    excludeToken: Token | null;
}> = ({ value, onChange, tokens, excludeToken }) => {
    const [showSelect, setShowSelect] = useState(false);

    return (
        <Dialog open={showSelect} onOpenChange={setShowSelect}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    {value ? (
                        <>
                            <img
                                src={value.icon}
                                alt={value.symbol}
                                className="w-5 h-5"
                            />
                            {value.symbol}
                        </>
                    ) : (
                        "Select Token"
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Select Token</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                    {tokens
                        .filter((token) => token !== excludeToken)
                        .map((token) => (
                            <Button
                                key={token.address}
                                variant="ghost"
                                className="w-full justify-start gap-2"
                                onClick={() => {
                                    onChange(token);
                                    setShowSelect(false);
                                }}
                            >
                                <img
                                    src={token.icon}
                                    alt={token.symbol}
                                    className="w-5 h-5"
                                />
                                {token.symbol}
                            </Button>
                        ))}
                </div>
            </DialogContent>
        </Dialog>
    );
};