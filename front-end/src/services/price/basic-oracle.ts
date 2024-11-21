import { 
    TonClient, 
    Address, 
    Contract,
    ContractProvider,
    Sender,
    beginCell,
    Cell,
    Dictionary,
    toNano,
    WalletContractV4,
    internal
} from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
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

interface PriceUpdateEvent {
    token: string;
    address: string;
    price: number;
}

interface PriceErrorEvent {
    token: string;
    address: string;
    error: Error;
}

class OracleContract implements Contract {
    constructor(
        readonly address: Address,
        readonly provider: ContractProvider,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address, provider: ContractProvider): OracleContract {
        return new OracleContract(address, provider);
    }

    async getState() {
        return await this.provider.getState();
    }

    async sendUpdatePrices(sender: Sender, prices: [string, number][]): Promise<void> {
        const dict = Dictionary.empty(
            Dictionary.Keys.BigUint(256),
            Dictionary.Values.Cell()
        );
        
        prices.forEach(([addr, price]) => {
            const hashBytes = Address.parse(addr).hash.toString('hex');
            dict.set(
                BigInt('0x' + hashBytes),
                beginCell().storeCoins(BigInt(Math.floor(price * 1e9))).endCell()
            );
        });

        const messageBody = beginCell()
            .storeUint(1, 32) // op: update_prices
            .storeUint(0, 64) // query_id
            .storeDict(dict)
            .endCell();

        await this.provider.internal(sender, {
            value: toNano('0.1'),
            body: messageBody
        });
    }
}

class PriceOracle extends EventEmitter {
    private prices: Map<string, PriceData> = new Map();
    private updateInterval: NodeJS.Timeout | null = null;
    private readonly UPDATE_INTERVAL = 60000; // 1 minute
    private readonly PRICE_VALIDITY = 300000; // 5 minutes
    private readonly MAX_PRICE_CHANGE = 10; // 10% max price change
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 1000; // 1 second
    
    private readonly client: TonClient;
    private readonly contract: OracleContract;
    private readonly tokens: Map<string, TokenConfig> = new Map();
    private readonly wallet: WalletContractV4;
    private readonly sender: Sender;
    
    private readonly API_KEYS = {
        coingecko: process.env.COINGECKO_API_KEY || '',
        binance: process.env.BINANCE_API_KEY || '',
        tonapi: process.env.TONAPI_KEY || ''
    };

    constructor(
        endpoint: string,
        contractAddress: string,
        tokenConfigs: TokenConfig[],
        wallet: WalletContractV4,
        secretKey: Buffer
    ) {
        super();
        
        this.client = new TonClient({ endpoint });
        this.wallet = wallet;
        
        const address = Address.parse(contractAddress);
        const provider = this.client.provider(address);
        this.contract = new OracleContract(address, provider);
        
        // Initialize sender with proper provider and async get methods
        const walletProvider = this.client.provider(wallet.address);
        this.sender = {
            address: wallet.address,
            async send(args: {
                to: Address;
                value: bigint;
                body?: Cell;
                init?: { code: Cell; data: Cell };
            }): Promise<void> {
                try {
                    const seqno = await wallet.getSeqno(walletProvider);
                    await wallet.sendTransfer(walletProvider, {
                            seqno,
                            secretKey,
                            messages: [
                                internal({
                                    to: args.to,
                                    value: args.value,
                                    body: args.body,
                                    init: args.init
                                })
                            ]
                        });
                } catch (error) {
                    console.error('Send transaction failed:', error);
                    throw error;
                }
            }
        };
        
        tokenConfigs.forEach(config => {
            this.tokens.set(config.address, config);
        });
    }

    async start(): Promise<void> {
        try {
            console.log('Starting price oracle service...');
            await this.updateAllPrices();
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

    private async withRetry<T>(
        operation: () => Promise<T>,
        retries = this.MAX_RETRIES
    ): Promise<T> {
        let lastError: Error | null = null;
        
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                if (i < retries - 1) {
                    await new Promise(resolve => 
                        setTimeout(resolve, this.RETRY_DELAY * Math.pow(2, i))
                    );
                }
            }
        }
        
        throw lastError;
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
            const prices = await Promise.all(
                config.priceSource.map(source => 
                    this.withRetry(() => this.fetchPrice(config.symbol, source))
                )
            );
            
            const validPrices = prices.filter((p): p is number => p !== null);
            
            if (validPrices.length === 0) {
                throw new Error(`No valid prices for ${config.symbol}`);
            }
            
            const sortedPrices = validPrices.sort((a, b) => a - b);
            const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
            
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
            
            this.prices.set(address, {
                price: medianPrice,
                timestamp: Date.now(),
                source: 'aggregated',
                confidence: this.calculateConfidence(validPrices)
            });
            
            this.emit('priceUpdated', {
                token: config.symbol,
                address,
                price: medianPrice
            } as PriceUpdateEvent);
            
        } catch (error) {
            console.error(`Failed to update price for ${config.symbol}:`, error);
            this.emit('priceError', {
                token: config.symbol,
                address,
                error: error as Error
            } as PriceErrorEvent);
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
        return Math.max(0, 100 - (stdDev / mean * 100));
    }

    async getPrice(address: string): Promise<PriceData | null> {
        const price = this.prices.get(address);
        if (!price) return null;
        if (Date.now() - price.timestamp > this.PRICE_VALIDITY) {
            return null;
        }
        return price;
    }

    async getPrices(addresses: string[]): Promise<(PriceData | null)[]> {
        return Promise.all(addresses.map(addr => this.getPrice(addr)));
    }

    async updateOnChainPrices(): Promise<void> {
        try {
            const validPrices: [string, number][] = [];
            
            for (const [address, priceData] of this.prices.entries()) {
                if (Date.now() - priceData.timestamp <= this.PRICE_VALIDITY) {
                    validPrices.push([address, priceData.price]);
                }
            }
            
            if (validPrices.length > 0) {
                await this.withRetry(() => 
                    this.contract.sendUpdatePrices(
                        this.sender,
                        validPrices
                    )
                );
                
                this.emit('onChainUpdated', validPrices);
            }
        } catch (error) {
            console.error('Failed to update on-chain prices:', error);
            this.emit('onChainError', error);
        }
    }
}

export default PriceOracle;