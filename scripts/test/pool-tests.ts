import { expect } from 'chai';
import { TonClient, WalletContract, Contract, Cell, Address, toNano, fromNano } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { KeyPair } from '@ton/crypto';

describe('SwapPool Tests', () => {
    let client: TonClient;
    let wallet: WalletContract;
    let pool: Contract;
    let keyPair: KeyPair;
    
    // Test tokens
    const TOKEN_A = {
        address: Address.parse('EQC...'), // Test token A address
        decimals: 9
    };
    const TOKEN_B = {
        address: Address.parse('EQC...'), // Test token B address
        decimals: 9
    };

    before(async () => {
        // Initialize test environment
        client = new TonClient({
            endpoint: 'http://localhost:8081/api/v2/jsonRPC'
        });
        
        // Setup test wallet
        const mnemonic = process.env.TEST_MNEMONIC?.split(' ') || [];
        keyPair = await mnemonicToPrivateKey(mnemonic);
        wallet = await WalletContract.create({
            publicKey: keyPair.publicKey,
            workchain: 0
        });
        
        // Deploy test pool
        pool = await deployTestPool();
    });

    async function deployTestPool(): Promise<Contract> {
        // Load pool contract code
        const code = Cell.fromBoc(Buffer.from(
            require('fs').readFileSync('../contracts/pool/SwapPool.fc', 'utf8'),
            'base64'
        ))[0];

        // Initial data
        const data = Cell.fromBoc(Buffer.from(JSON.stringify({
            owner: wallet.address,
            tokenA: TOKEN_A.address,
            tokenB: TOKEN_B.address,
            fee: 3, // 0.3%
            totalLiquidity: 0
        })))[0];

        const contract = new Contract(code, data);
        
        // Deploy
        const seqno = await wallet.getSeqno();
        await wallet.external.transfer({
            to: await contract.getAddress(),
            value: toNano('1'),
            bounce: false,
            seqno,
            payload: Cell.EMPTY,
            stateInit: { code, data }
        });

        return contract;
    }

    describe('Liquidity Operations', () => {
        it('should add initial liquidity', async () => {
            const amount_a = toNano('100');
            const amount_b = toNano('100');
            
            await addLiquidity(amount_a, amount_b);
            
            const reserves = await pool.getMethod('get_reserves')();
            expect(reserves[0]).to.equal(amount_a);
            expect(reserves[1]).to.equal(amount_b);
        });

        it('should fail if minimum liquidity not met', async () => {
            const amount_a = toNano('0.1');
            const amount_b = toNano('0.1');
            
            try {
                await addLiquidity(amount_a, amount_b);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error.toString()).to.include('insufficient_liquidity');
            }
        });

        it('should remove liquidity', async () => {
            const lpTokens = toNano('50');
            await removeLiquidity(lpTokens);
            
            const reserves = await pool.getMethod('get_reserves')();
            expect(fromNano(reserves[0])).to.be.lessThan(100);
            expect(fromNano(reserves[1])).to.be.lessThan(100);
        });
    });

    describe('Swap Operations', () => {
        it('should execute swap with correct output', async () => {
            const amountIn = toNano('10');
            const expectedOut = calculateExpectedOutput(amountIn);
            
            const result = await executeSwap(amountIn);
            expect(result.output).to.be.closeTo(expectedOut, toNano('0.01'));
        });

        it('should fail on excessive slippage', async () => {
            const amountIn = toNano('10');
            const minOut = toNano('11'); // Unrealistic expectation
            
            try {
                await executeSwap(amountIn, minOut);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error.toString()).to.include('slippage_too_high');
            }
        });

        it('should handle multiple swaps maintaining k-constant', async () => {
            const initialK = await getKConstant();
            
            for (let i = 0; i < 5; i++) {
                await executeSwap(toNano('1'));
            }
            
            const finalK = await getKConstant();
            expect(finalK).to.be.closeTo(initialK, initialK * 0.001); // 0.1% tolerance
        });

        it('should collect correct fees', async () => {
            const initialFees = await pool.getMethod('get_collected_fees')();
            await executeSwap(toNano('100'));
            const finalFees = await pool.getMethod('get_collected_fees')();
            
            expect(finalFees).to.be.greaterThan(initialFees);
        });
    });

    describe('Price Impact Tests', () => {
        it('should calculate correct price impact', async () => {
            const largeAmount = toNano('1000');
            const impact = await pool.getMethod('calculate_price_impact')([largeAmount]);
            
            expect(impact).to.be.greaterThan(0);
            expect(impact).to.be.lessThan(2000); // Less than 20%
        });

        it('should fail on excessive price impact', async () => {
            const hugeAmount = toNano('10000');
            
            try {
                await executeSwap(hugeAmount);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error.toString()).to.include('price_impact_too_high');
            }
        });
    });
});