import React, { useState } from 'react';
import { BridgeForm } from '../components/BridgeForm';
import { PriceChart } from '../components/PriceChart';
import { TokenSelect } from '../components/TokenSelect';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { 
    ArrowLeftRight,
    History,
    Wallet,
    ExternalLink,
    AlertCircle 
} from 'lucide-react';

interface Transaction {
    id: string;
    sourceChain: string;
    targetChain: string;
    amount: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp: number;
    hash: string;
    confirmations: number;
    requiredConfirmations: number;
}

export const BridgePage: React.FC = () => {
    useTonConnectUI();
    const [activeTab, setActiveTab] = useState('bridge');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [showRiskDialog, setShowRiskDialog] = useState(true);

    // Statistics for the bridge
    const stats = {
        totalVolume: '$1,234,567',
        activeUsers: '1,234',
        avgTime: '~15 mins',
        successRate: '99.9%'
    };

    // Supported chains info
    const chains = [
        {
            name: 'TON',
            icon: '/chains/ton.svg',
            status: 'operational',
            latestBlock: 12345678
        },
        {
            name: 'Ethereum',
            icon: '/chains/eth.svg',
            status: 'operational',
            latestBlock: 18456789
        },
        {
            name: 'BSC',
            icon: '/chains/bsc.svg',
            status: 'operational',
            latestBlock: 29876543
        }
    ];

    return (
        <div className="container mx-auto p-4 space-y-6 max-w-4xl">
            {/* Risk Acknowledgment Dialog */}
            <AlertDialog open={showRiskDialog} onOpenChange={setShowRiskDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Bridge Safety Notice
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>
                                Cross-chain bridges involve inherent risks. Please ensure you:
                            </p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Verify all transaction details carefully</li>
                                <li>Use only official bridge interfaces</li>
                                <li>Never bridge more than you can afford to lose</li>
                                <li>Be patient as confirmations may take time</li>
                            </ul>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction>I Understand</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bridge Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats).map(([key, value]) => (
                    <Card key={key}>
                        <CardContent className="p-4">
                            <p className="text-sm text-gray-500">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className="text-2xl font-bold">{value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="bridge" className="flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        Bridge
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="bridge" className="space-y-4">
                    {/* Network Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Network Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                {chains.map((chain) => (
                                    <div
                                        key={chain.name}
                                        className="flex items-center space-x-2 p-2 rounded-lg border"
                                    >
                                        <img
                                            src={chain.icon}
                                            alt={chain.name}
                                            className="w-6 h-6"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">
                                                {chain.name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Block: {chain.latestBlock.toLocaleString()}
                                            </p>
                                        </div>
                                        <div
                                            className={`w-2 h-2 rounded-full ${
                                                chain.status === 'operational'
                                                    ? 'bg-green-500'
                                                    : 'bg-red-500'
                                            }`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bridge Form */}
                    <BridgeForm />

                    {/* Price Chart */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Price Chart</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PriceChart 
                                tokenPair={{
                                    tokenIn: 'TON',
                                    tokenOut: 'ETH'
                                }}
                                height={300}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>
                                Your recent bridge transactions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {transactions.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No transactions yet
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {transactions.map((tx) => (
                                        <div
                                            key={tx.id}
                                            className="flex items-center justify-between p-4 border rounded-lg"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {tx.amount}
                                                    </span>
                                                    <ArrowLeftRight className="h-4 w-4" />
                                                    <span className="text-sm text-gray-500">
                                                        {tx.sourceChain} → {tx.targetChain}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-xs ${
                                                            tx.status === 'completed'
                                                                ? 'bg-green-100 text-green-700'
                                                                : tx.status === 'pending'
                                                                ? 'bg-yellow-100 text-yellow-700'
                                                                : 'bg-red-100 text-red-700'
                                                        }`}
                                                    >
                                                        {tx.status}
                                                    </span>
                                                    <span className="text-gray-500">
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
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* FAQ Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="font-medium">How long do transfers take?</h3>
                        <p className="text-sm text-gray-500">
                            Transfer times vary by chain. TON → ETH typically takes 15 minutes,
                            TON → BSC takes 5 minutes.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-medium">What are the fees?</h3>
                        <p className="text-sm text-gray-500">
                            Fees include network gas fees and a 0.3% bridge fee.
                            The exact amount is shown before confirmation.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default BridgePage;