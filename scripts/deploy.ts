import { 
    TonClient, 
    Address, 
    Cell,
    Contract,
    WalletContract,
    SendMode,
    fromNano,
    toNano 
} from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { KeyPair } from '@ton/crypto';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Contract paths
const PATHS = {
    SWAP_POOL: '../contracts/pool/SwapPool.fc',
    ROUTER: '../contracts/pool/Router.fc',
    BRIDGE: '../contracts/bridge/Bridge.fc'
};

// Initial configuration
const INITIAL_CONFIG = {
    minLiquidity: toNano('1'), // 1 TON
    swapFee: 3, // 0.3%
    minValidators: 3,
    bridgeFee: toNano('0.5'), // 0.5 TON
    supportedChains: [1, 2, 3] // TON, ETH, BSC
};

interface DeployedContract {
    address: Address;
    contract: Contract;
}

class Deployer {
    private client: TonClient;
    private wallet: WalletContract;
    private keyPair: KeyPair;
    private deployedContracts: { [key: string]: DeployedContract } = {};

    constructor() {
        this.client = new TonClient({
            endpoint: process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC'
        });
    }

    async init() {
        console.log('Initializing deployer...');
        
        // Load wallet
        const mnemonic = process.env.DEPLOYER_MNEMONIC;
        if (!mnemonic) throw new Error('Deployer mnemonic not found in .env');
        
        this.keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
        this.wallet = await this.createWallet();
        
        console.log(`Deployer wallet: ${this.wallet.address.toString()}`);
        await this.checkBalance();
    }

    private async createWallet(): Promise<WalletContract> {
        // Create wallet contract
        return WalletContract.create({
            publicKey: this.keyPair.publicKey,
            workchain: 0
        });
    }

    private async checkBalance() {
        const balance = await this.client.getBalance(this.wallet.address);
        console.log(`Wallet balance: ${fromNano(balance)} TON`);
        
        if (balance < toNano('5')) {
            throw new Error('Insufficient balance for deployment');
        }
    }

    private async loadContract(path: string): Promise<Cell> {
        try {
            const code = fs.readFileSync(path, 'utf8');
            return Cell.fromBoc(Buffer.from(code, 'base64'))[0];
        } catch (error) {
            console.error(`Error loading contract from ${path}:`, error);
            throw error;
        }
    }

    async deploySwapPool(): Promise<void> {
        console.log('\nDeploying SwapPool contract...');
        
        const code = await this.loadContract(PATHS.SWAP_POOL);
        const data = this.createSwapPoolData();

        const contract = new Contract(code, data);
        const address = await contract.getAddress();

        // Deploy transaction
        await this.sendDeploy(
            contract,
            toNano('1'), // Initial balance
            code,
            data
        );

        this.deployedContracts.swapPool = { address, contract };
        console.log(`SwapPool deployed at: ${address.toString()}`);
    }

    async deployRouter(): Promise<void> {
        console.log('\nDeploying Router contract...');
        
        const code = await this.loadContract(PATHS.ROUTER);
        const data = this.createRouterData();

        const contract = new Contract(code, data);
        const address = await contract.getAddress();

        await this.sendDeploy(
            contract,
            toNano('0.5'),
            code,
            data
        );

        this.deployedContracts.router = { address, contract };
        console.log(`Router deployed at: ${address.toString()}`);
    }

    async deployBridge(): Promise<void> {
        console.log('\nDeploying Bridge contract...');
        
        const code = await this.loadContract(PATHS.BRIDGE);
        const data = this.createBridgeData();

        const contract = new Contract(code, data);
        const address = await contract.getAddress();

        await this.sendDeploy(
            contract,
            toNano('1'),
            code,
            data
        );

        this.deployedContracts.bridge = { address, contract };
        console.log(`Bridge deployed at: ${address.toString()}`);
    }

    private createSwapPoolData(): Cell {
        return Cell.fromBoc(Buffer.from(JSON.stringify({
            owner: this.wallet.address,
            totalLiquidity: 0,
            tokenBalances: {},
            fee: INITIAL_CONFIG.swapFee,
            minLiquidity: INITIAL_CONFIG.minLiquidity
        })))[0];
    }

    private createRouterData(): Cell {
        return Cell.fromBoc(Buffer.from(JSON.stringify({
            owner: this.wallet.address,
            pools: {},
            wtonAddress: process.env.WTON_ADDRESS
        })))[0];
    }

    private createBridgeData(): Cell {
        return Cell.fromBoc(Buffer.from(JSON.stringify({
            owner: this.wallet.address,
            validators: {},
            minValidators: INITIAL_CONFIG.minValidators,
            supportedChains: INITIAL_CONFIG.supportedChains,
            bridgeFee: INITIAL_CONFIG.bridgeFee
        })))[0];
    }

    private async sendDeploy(
        contract: Contract,
        value: bigint,
        code: Cell,
        data: Cell
    ) {
        const seqno = await this.wallet.getSeqno();
        
        await this.wallet.external.transfer({
            to: await contract.getAddress(),
            value: value,
            bounce: false,
            seqno: seqno,
            payload: Cell.EMPTY,
            stateInit: {
                code,
                data
            }
        });

        // Wait for deployment
        await this.waitForTransaction();
    }

    private async waitForTransaction() {
        return new Promise(resolve => setTimeout(resolve, 5000));
    }

    async setupInitialConfig() {
        console.log('\nSetting up initial configuration...');

        // Link Router with SwapPool
        await this.setRouterPool();

        // Add initial validators to Bridge
        await this.addInitialValidators();

        // Setup cross-contract permissions
        await this.setupPermissions();

        console.log('Initial configuration completed');
    }

    private async setRouterPool() {
        const seqno = await this.wallet.getSeqno();
        
        await this.deployedContracts.router.contract.sendMessage({
            to: this.deployedContracts.swapPool.address,
            value: toNano('0.1'),
            bounce: true,
            sender: this.wallet.address,
            seqno: seqno,
            payload: {
                op: 'addPool',
                poolAddress: this.deployedContracts.swapPool.address
            }
        });
    }

    private async addInitialValidators() {
        // Add validators from environment or config
        const validators = process.env.INITIAL_VALIDATORS?.split(',') || [];
        
        for (const validator of validators) {
            const seqno = await this.wallet.getSeqno();
            
            await this.deployedContracts.bridge.contract.sendMessage({
                to: this.deployedContracts.bridge.address,
                value: toNano('0.1'),
                bounce: true,
                sender: this.wallet.address,
                seqno: seqno,
                payload: {
                    op: 'addValidator',
                    validator: Address.parse(validator)
                }
            });
        }
    }

    private async setupPermissions() {
        // Setup permissions between contracts
        const permissions = [
            { from: 'router', to: 'swapPool', permission: 'execute_swap' },
            { from: 'bridge', to: 'swapPool', permission: 'bridge_transfer' }
        ];

        for (const { from, to, permission } of permissions) {
            const seqno = await this.wallet.getSeqno();
            
            await this.deployedContracts[from].contract.sendMessage({
                to: this.deployedContracts[to].address,
                value: toNano('0.1'),
                bounce: true,
                sender: this.wallet.address,
                seqno: seqno,
                payload: {
                    op: 'grantPermission',
                    permission
                }
            });
        }
    }

    async saveDeployment() {
        const deployment = {
            timestamp: new Date().toISOString(),
            network: process.env.TON_ENDPOINT,
            contracts: Object.entries(this.deployedContracts).reduce((acc, [name, { address }]) => ({
                ...acc,
                [name]: address.toString()
            }), {})
        };

        fs.writeFileSync(
            './deployment.json',
            JSON.stringify(deployment, null, 2)
        );

        console.log('\nDeployment info saved to deployment.json');
    }

    async verifyContracts() {
        console.log('\nVerifying deployed contracts...');

        for (const [name, { address, contract }] of Object.entries(this.deployedContracts)) {
            try {
                const deployed = await this.client.getContractState(address);
                if (!deployed) {
                    throw new Error(`Contract ${name} not found`);
                }

                console.log(`✓ ${name} verified at ${address.toString()}`);
            } catch (error) {
                console.error(`× Failed to verify ${name}:`, error);
                throw error;
            }
        }
    }
}

async function main() {
    console.log('Starting TONFi deployment...\n');

    const deployer = new Deployer();
    
    try {
        await deployer.init();

        // Deploy contracts
        await deployer.deploySwapPool();
        await deployer.deployRouter();
        await deployer.deployBridge();

        // Setup configuration
        await deployer.setupInitialConfig();

        // Verify deployment
        await deployer.verifyContracts();

        // Save deployment info
        await deployer.saveDeployment();

        console.log('\nDeployment completed successfully!');
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

main();