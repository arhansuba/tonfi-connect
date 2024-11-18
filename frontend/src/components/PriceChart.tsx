import React, { useState, useEffect, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface PriceData {
    timestamp: number;
    price: number;
    volume: number;
}

interface TokenPair {
    tokenIn: string;
    tokenOut: string;
}

type TimeFrame = '1H' | '24H' | '1W' | '1M' | 'ALL';

interface PriceChartProps {
    tokenPair: TokenPair;
    className?: string;
    height?: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({
    tokenPair,
    className = '',
    height = 300
}) => {
    const [timeFrame, setTimeFrame] = useState<TimeFrame>('24H');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [priceData, setPriceData] = useState<PriceData[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [priceChange, setPriceChange] = useState<{
        value: number;
        percentage: number;
    } | null>(null);

    // Time frames in milliseconds
    const TIME_FRAMES = {
        '1H': 60 * 60 * 1000,
        '24H': 24 * 60 * 60 * 1000,
        '1W': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000,
        'ALL': Infinity
    };

    // Fetch price data
    useEffect(() => {
        const fetchPriceData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Simulate API call - replace with actual API
                const response = await fetch(
                    `/api/prices?tokenIn=${tokenPair.tokenIn}&tokenOut=${tokenPair.tokenOut}&timeFrame=${timeFrame}`
                );
                
                if (!response.ok) throw new Error('Failed to fetch price data');
                
                const data = await response.json();
                setPriceData(data);
                
                // Update current price and price change
                if (data.length > 0) {
                    const current = data[data.length - 1].price;
                    const start = data[0].price;
                    setCurrentPrice(current);
                    setPriceChange({
                        value: current - start,
                        percentage: ((current - start) / start) * 100
                    });
                }
            } catch (err) {
                console.error('Error fetching price data:', err);
                setError('Failed to load price data');
                
                // Generate mock data for demo
                const mockData = generateMockData(timeFrame);
                setPriceData(mockData);
                
                const current = mockData[mockData.length - 1].price;
                const start = mockData[0].price;
                setCurrentPrice(current);
                setPriceChange({
                    value: current - start,
                    percentage: ((current - start) / start) * 100
                });
            } finally {
                setLoading(false);
            }
        };

        fetchPriceData();
        
        // Set up real-time updates
        const interval = setInterval(fetchPriceData, 15000); // Update every 15s
        return () => clearInterval(interval);
    }, [timeFrame, tokenPair]);

    // Format tooltip value
    const formatValue = (value: number) => {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
        return `$${value.toFixed(2)}`;
    };

    // Custom tooltip component
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border">
                    <p className="text-gray-500">
                        {format(new Date(label), 'PPp')}
                    </p>
                    <p className="font-medium">
                        Price: {formatValue(payload[0].value)}
                    </p>
                    <p className="text-gray-500">
                        Volume: {formatValue(payload[1].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    // Generate gradient
    const priceColor = priceChange?.value ?? 0 >= 0 ? "#22c55e" : "#ef4444";

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">
                            {currentPrice ? formatValue(currentPrice) : '-'}
                        </CardTitle>
                        {priceChange && (
                            <span
                                className={`text-sm ${
                                    priceChange.value >= 0
                                        ? 'text-green-500'
                                        : 'text-red-500'
                                }`}
                            >
                                {priceChange.value >= 0 ? '↑' : '↓'}{' '}
                                {formatValue(Math.abs(priceChange.value))} (
                                {priceChange.percentage.toFixed(2)}%)
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {Object.keys(TIME_FRAMES).map((tf) => (
                            <Button
                                key={tf}
                                variant={timeFrame === tf ? "default" : "outline"}
                                size="sm"
                                onClick={() => setTimeFrame(tf as TimeFrame)}
                            >
                                {tf}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="w-full h-[300px]" />
                ) : error ? (
                    <div className="flex items-center justify-center h-[300px] text-gray-500">
                        {error}
                    </div>
                ) : (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={priceData}
                                margin={{
                                    top: 5,
                                    right: 5,
                                    left: 5,
                                    bottom: 5,
                                }}
                            >
                                <defs>
                                    <linearGradient
                                        id="priceGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor={priceColor}
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor={priceColor}
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={(timestamp) =>
                                        format(
                                            new Date(timestamp),
                                            timeFrame === '1H' ? 'HH:mm' :
                                            timeFrame === '24H' ? 'HH:mm' :
                                            timeFrame === '1W' ? 'EEE' :
                                            'MMM d'
                                        )
                                    }
                                    minTickGap={30}
                                />
                                <YAxis
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={formatValue}
                                    width={60}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke={priceColor}
                                    strokeWidth={2}
                                    fill="url(#priceGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                
                {/* Volume Chart */}
                <div className="h-[100px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={priceData}
                            margin={{
                                top: 5,
                                right: 5,
                                left: 5,
                                bottom: 5,
                            }}
                        >
                            <XAxis
                                dataKey="timestamp"
                                tickFormatter={(timestamp) =>
                                    format(
                                        new Date(timestamp),
                                        timeFrame === '1H' ? 'HH:mm' :
                                        timeFrame === '24H' ? 'HH:mm' :
                                        timeFrame === '1W' ? 'EEE' :
                                        'MMM d'
                                    )
                                }
                                height={0}
                                tick={false}
                            />
                            <YAxis
                                tickFormatter={formatValue}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="volume"
                                stroke="#6b7280"
                                fill="#6b728033"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

// Helper function to generate mock data
function generateMockData(timeFrame: TimeFrame): PriceData[] {
    const now = Date.now();
    const data: PriceData[] = [];
    const points = 100;
    const timeSpan = TIME_FRAMES[timeFrame];
    const interval = timeSpan / points;
    
    let basePrice = 2.45; // Initial price
    let baseVolume = 1000000; // Initial volume
    
    for (let i = 0; i < points; i++) {
        const timestamp = now - timeSpan + (i * interval);
        
        // Add some randomness to price and volume
        const priceChange = (Math.random() - 0.5) * 0.1;
        const volumeChange = (Math.random() - 0.5) * 200000;
        
        basePrice += priceChange;
        baseVolume += volumeChange;
        
        data.push({
            timestamp,
            price: Math.max(0.01, basePrice),
            volume: Math.max(100000, baseVolume)
        });
    }
    
    return data;
}

export default PriceChart;