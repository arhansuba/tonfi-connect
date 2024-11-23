import { compileContract } from "ton-compiler";
import * as fs from 'fs/promises';
import * as path from 'path';

const CONTRACTS_DIR = './contracts';
const BUILD_DIR = './build';

// Utility function to read a file
async function readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf8');
}

// Utility function to ensure directory exists
async function ensureDir(dir: string) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {
        // Directory already exists
    }
}

async function compileContracts() {
    // Ensure build directory exists
    await ensureDir(BUILD_DIR);

    // Read stdlib
    const stdlib = await readFile(path.join(CONTRACTS_DIR, 'stdlib.fc'));

    // Define contract groups
    const contracts = {
        pool: ['Factory', 'Router', 'SwapPool'],
        bridge: ['Bridge', 'MessageHandler', 'Validator'],
        governance: ['DAO', 'Staking', 'Treasury'],
        utils: ['Math', 'Constants', 'Security']
    };

    // Compile all contracts
    for (const [group, files] of Object.entries(contracts)) {
        for (const file of files) {
            console.log(`Compiling ${group}/${file}.fc...`);
            
            try {
                // Read contract code
                const contractPath = path.join(CONTRACTS_DIR, group, `${file}.fc`);
                const contractCode = await readFile(contractPath);

                // Compile contract
                const result = await compileContract({
                    files: [contractPath],
                    stdlib: true,
                    version: 'latest'
                });

                if (result.ok) {
                    // Save Fift assembly
                    const fiftPath = path.join(BUILD_DIR, `${group}_${file}.fif`);
                    await fs.writeFile(fiftPath, result.fift);

                    // Save compiled cell
                    const cellPath = path.join(BUILD_DIR, `${group}_${file}.cell`);
                    await fs.writeFile(cellPath, result.output);

                    console.log(`✓ ${file} compiled successfully`);
                } else {
                    console.error(`✗ Failed to compile ${file}:`);
                    console.error(result.log);
                }
            } catch (error) {
                console.error(`Error compiling ${file}:`, error);
            }
        }
    }
}

// Run compilation
compileContracts().catch(console.error);