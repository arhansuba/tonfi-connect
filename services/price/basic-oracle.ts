import { 
    TonClient, 
    Address, 
    Contract,
    WalletContract 
} from '@ton/ton';
import axios from 'axios';
import { EventEmitter } from 'events';
import { BigNumber } from 'bignumber.js';

interface PriceData {
    price: number;
    timestamp: number;
    source: string;
    confidence: number;
}

interface TokenConfig {
    symbol: string;
    address: string;
    decimals: number;
    priceSource: string[];
}

class PriceOracle extends EventEmitter {
    private prices: Map<string, PriceData> = new Map();
    private updateInterval: NodeJS.Timer | null = null;
    private readonly UPDATE_INTERVAL = 60000; // 1 minute
    private readonly PRICE_VALIDITY = 300000; // 5 minutes
    private readonly MAX_PRICE_CHANGE = 10; // 10% max price change
    
    private readonly client: TonClient;
    private readonly contract: Contract;
    private readonly tokens: Map<string, TokenConfig> = new Map();
    
    // Price sources
    private readonly API_KEYS = {
        coingecko: process.env.COINGECKO_API_KEY,
        binance: process.env.BINANCE_API_KEY,
        tonapi: process.env.TONAPI_KEY
    };

    constructor(
        endpoint: string,
        contractAddress: string,
        tokenConfigs: TokenConfig[]
    ) {
        super();
        this.client = new TonClient({ endpoint });
        this.contract = new Contract(/* contract info */);
        
        // Initialize token configs
        tokenConfigs.forEach(config => {
            this.tokens.set(config.address, config);
        });
    }

    async start(): Promise<void> {
        try {
            console.log('Starting price oracle service...');
            
            // Initial price fetch
            await this.updateAllPrices();
            
            // Start update interval
            this.updateInterval = setInterval(
                () => this.updateAllPrices(),
                this.UPDATE_INTERVAL
            );
            
            this.emit('started');
            console.log('Price oracle service started successfully');
        } catch (error) {
            console.error('Failed to start price oracle:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.emit('stopped');
    }

    private async updateAllPrices(): Promise<void> {
        console.log('Updating all prices...');
        
        const updates: Promise<void>[] = [];
        
        for (const [address, config] of this.tokens.entries()) {
            updates.push(this.updateTokenPrice(address, config));
        }
        
        await Promise.allSettled(updates);
    }

    private async updateTokenPrice(
        address: string,
        config: TokenConfig
    ): Promise<void> {
        try {
            // Fetch prices from multiple sources
            const prices = await Promise.all(
                config.priceSource.map(source => 
                    this.fetchPrice(config.symbol, source)
                )
            );
            
            // Filter out failed fetches
            const validPrices = prices.filter(p => p !== null) as number[];
            
            if (validPrices.length === 0) {
                throw new Error(`No valid prices for ${config.symbol}`);
            }
            
            // Calculate median price
            const sortedPrices = validPrices.sort((a, b) => a - b);
            const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
            
            // Validate price change
            const currentPrice = this.prices.get(address);
            if (currentPrice) {
                const priceChange = Math.abs(
                    ((medianPrice - currentPrice.price) / currentPrice.price) * 100
                );
                
                if (priceChange > this.MAX_PRICE_CHANGE) {
                    throw new Error(
                        `Price change too large for ${config.symbol}: ${priceChange}%`
                    );
                }
            }
            
            // Update price
            this.prices.set(address, {
                price: medianPrice,
                timestamp: Date.now(),
                source: 'aggregated',
                confidence: this.calculateConfidence(validPrices)
            });
            
            // Emit update event
            this.emit('priceUpdated', {
                token: config.symbol,
                address,
                price: medianPrice
            });
            
        } catch (error) {
            console.error(`Failed to update price for ${config.symbol}:`, error);
            this.emit('priceError', {
                token: config.symbol,
                address,
                error
            });
        }
    }

    private async fetchPrice(
        symbol: string,
        source: string
    ): Promise<number | null> {
        try {
            switch (source) {
                case 'coingecko':
                    return await this.fetchCoingeckoPrice(symbol);
                    
                case 'binance':
                    return await this.fetchBinancePrice(symbol);
                    
                case 'tonapi':
                    return await this.fetchTonAPIPrice(symbol);
                    
                default:
                    throw new Error(`Unknown price source: ${source}`);
            }
        } catch (error) {
            console.error(`Failed to fetch price from ${source}:`, error);
            return null;
        }
    }

    private async fetchCoingeckoPrice(symbol: string): Promise<number> {
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price`,
            {
                params: {
                    ids: symbol.toLowerCase(),
                    vs_currencies: 'usd',
                    api_key: this.API_KEYS.coingecko
                }
            }
        );
        
        return response.data[symbol.toLowerCase()].usd;
    }

    private async fetchBinancePrice(symbol: string): Promise<number> {
        const response = await axios.get(
            `https://api.binance.com/api/v3/ticker/price`,
            {
                params: {
                    symbol: `${symbol}USDT`
                },
                headers: {
                    'X-MBX-APIKEY': this.API_KEYS.binance
                }
            }
        );
        
        return parseFloat(response.data.price);
    }

    private async fetchTonAPIPrice(symbol: string): Promise<number> {
        const response = await axios.get(
            `https://tonapi.io/v2/prices/${symbol}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.API_KEYS.tonapi}`
                }
            }
        );
        
        return response.data.price;
    }

    private calculateConfidence(prices: number[]): number {
        if (prices.length < 2) return 0;
        
        const mean = prices.reduce((a, b) => a + b) / prices.length;
        const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        
        // Higher confidence when standard deviation is lower
        return Math.max(0, 100 - (stdDev / mean * 100));
    }

    // Public Methods
    async getPrice(address: string): Promise<PriceData | null> {
        const price = this.prices.get(address);
        
        if (!price) return null;
        
        // Check if price is stale
        if (Date.now() - price.timestamp > this.PRICE_VALIDITY) {
            return null;
        }
        
        return price;
    }

    async getPrices(addresses: string[]): Promise<(PriceData | null)[]> {
        return Promise.all(addresses.map(addr => this.getPrice(addr)));
    }

    // On-chain price updates
    async updateOnChainPrices(): Promise<void> {
        try {
            const validPrices: [string, number][] = [];
            
            for (const [address, priceData] of this.prices.entries()) {
                if (Date.now() - priceData.timestamp <= this.PRICE_VALIDITY) {
                    validPrices.push([address, priceData.price]);
                }
            }
            
            if (validPrices.length > 0) {
                await this.contract.sendMessage({
                    op: 'updatePrices',
                    prices: validPrices
                });
                
                this.emit('onChainUpdated', validPrices);
            }
        } catch (error) {
            console.error('Failed to update on-chain prices:', error);
            this.emit('onChainError', error);
        }
    }
}

// Usage example:
const tokenConfigs: TokenConfig[] = [
    {
        symbol: 'TON',
        address: 'EQC...',
        decimals: 9,
        priceSource: ['coingecko', 'binance', 'tonapi']
    },
    {
        symbol: 'WTON',
        address: 'EQC...',
        decimals: 9,
        priceSource: ['coingecko', 'binance']
    }
];

const oracle = new PriceOracle(
    'https://testnet.toncenter.com/api/v2/jsonRPC',
    'EQC...',  // Oracle contract address
    tokenConfigs
);

// Start the oracle
oracle.start().catch(console.error);

// Event handling
oracle.on('priceUpdated', (update) => {
    console.log('Price updated:', update);
});

oracle.on('priceError', (error) => {
    console.error('Price error:', error);
});

oracle.on('onChainUpdated', (prices) => {
    console.log('On-chain prices updated:', prices);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await oracle.stop();
    process.exit(0);
});

export default PriceOracle;