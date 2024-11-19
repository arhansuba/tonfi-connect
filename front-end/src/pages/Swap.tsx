import React, { useState, useEffect } from 'react';
import { SwapForm } from '../components/SwapForm';
import { PriceChart } from '../components/PriceChart';
import { TokenSelect } from '../components/TokenSelect';
import { useSwap } from '../hooks/useSwap';
import { useTonConnectUI } from '@tonconnect/ui-react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import {
    Settings,
    History,
    TrendingUp,
    Info,
    BarChart2,
    Clock,
    Wallet
} from 'lucide-react';

interface SwapTransaction {
    hash: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    timestamp: number;
    status: 'pending' | 'completed' | 'failed';
}

export const SwapPage: React.FC = () => {
    const [tonConnectUI, setTonConnectUI] = useTonConnectUI();
    const { connected, wallet } = tonConnectUI;
    const [activeTab, setActiveTab] = useState('swap');
    const [showSettings, setShowSettings] = useState(false);
    const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
    const [marketStats, setMarketStats] = useState({
        volumeLast24h: '$1,234,567',
        trades24h: '1,234',
        totalLiquidity: '$5,678,901',
        avgSlippage: '0.2%'
    });

    // Pool statistics for selected pair
    const [poolStats, setPoolStats] = useState({
        tvl: '$1,234,567',
        volume24h: '$123,456',
        fees24h: '$1,234',
        apr: '12.34%'
    });

    // Load transactions from local storage
    useEffect(() => {
        if (connected) {
            const storedTx = localStorage.getItem(`swap_transactions_${tonConnectUI.address}`);
            if (storedTx) {
                setTransactions(JSON.parse(storedTx));
            }
        }
    }, [connected, wallet?.address]);

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-4xl">
            {/* Market Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(marketStats).map(([key, value]) => (
                    <Card key={key}>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                </p>
                                <span className="text-2xl font-bold">{value}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content */}
            <div className="grid md:grid-cols-12 gap-6">
                {/* Left Column - Chart and Pool Stats */}
                <div className="md:col-span-7 space-y-6">
                    {/* Price Chart */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Price Chart</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">1H</Button>
                                <Button variant="outline" size="sm">24H</Button>
                                <Button variant="outline" size="sm">1W</Button>
                                <Button variant="outline" size="sm">1M</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <PriceChart
                                tokenPair={{
                                    tokenIn: 'TON',
                                    tokenOut: 'USDT'
                                }}
                                height={300}
                            />
                        </CardContent>
                    </Card>

                    {/* Pool Statistics */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Pool Statistics</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(poolStats).map(([key, value]) => (
                                    <div key={key} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-500">
                                            {key.toUpperCase()}
                                        </span>
                                        <span className="font-medium">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Swap Form and History */}
                <div className="md:col-span-5 space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="swap" className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Swap
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <History className="h-4 w-4" />
                                History
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="swap">
                            {/* Swap Form */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Swap Tokens</CardTitle>
                                    <Sheet open={showSettings} onOpenChange={setShowSettings}>
                                        <SheetTrigger asChild>
                                            <Button variant="ghost" size="sm">
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent>
                                            <SheetHeader>
                                                <SheetTitle>Swap Settings</SheetTitle>
                                                <SheetDescription>
                                                    Configure your swap preferences
                                                </SheetDescription>
                                            </SheetHeader>
                                            <div className="space-y-4 py-4">
                                                {/* Slippage Settings */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">
                                                        Slippage Tolerance
                                                    </label>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm">Auto</Button>
                                                        <Button variant="outline" size="sm">0.1%</Button>
                                                        <Button variant="outline" size="sm">0.5%</Button>
                                                        <Button variant="outline" size="sm">1.0%</Button>
                                                    </div>
                                                </div>

                                                {/* Transaction Deadline */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">
                                                        Transaction Deadline
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-20 px-2 py-1 border rounded"
                                                            defaultValue="30"
                                                        />
                                                        <span className="text-sm text-gray-500">minutes</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </CardHeader>
                                <CardContent>
                                    <SwapForm />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="history">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Transaction History</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {transactions.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">
                                                No transactions yet
                                            </div>
                                        ) : (
                                            transactions.map((tx) => (
                                                <div
                                                    key={tx.hash}
                                                    className="flex items-center justify-between p-4 border rounded-lg"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span>{tx.amountIn} {tx.tokenIn}</span>
                                                            <TrendingUp className="h-4 w-4" />
                                                            <span>{tx.amountOut} {tx.tokenOut}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-4 w-4 text-gray-500" />
                                                            <span className="text-sm text-gray-500">
                                                                {new Date(tx.timestamp).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={`https://tonscan.org/tx/${tx.hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-600"
                                                    >
                                                        <Info className="h-4 w-4" />
                                                    </a>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Market Analysis */}
            <Card>
                <CardHeader>
                    <CardTitle>Market Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Volume Chart */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium">Volume (24h)</h3>
                            <BarChart2 className="h-32 w-full text-gray-300" />
                        </div>

                        {/* Top Pairs */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium">Top Pairs</h3>
                            <div className="space-y-2">
                                {[
                                    { pair: 'TON/USDT', volume: '$789,012' },
                                    { pair: 'TON/ETH', volume: '$456,789' },
                                    { pair: 'TON/WBTC', volume: '$123,456' },
                                ].map((item) => (
                                    <div key={item.pair} className="flex justify-between">
                                        <span className="text-sm">{item.pair}</span>
                                        <span className="text-sm text-gray-500">{item.volume}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-medium">Recent Activity</h3>
                            <div className="space-y-2">
                                {[
                                    { type: 'Swap', amount: '1,000 TON', time: '2m ago' },
                                    { type: 'Add Liquidity', amount: '500 TON', time: '5m ago' },
                                    { type: 'Swap', amount: '2,000 USDT', time: '10m ago' },
                                ].map((item, index) => (
                                    <div key={index} className="flex justify-between">
                                        <div className="text-sm">
                                            <span>{item.type}:</span>
                                            <span className="ml-2">{item.amount}</span>
                                        </div>
                                        <span className="text-sm text-gray-500">{item.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SwapPage;