const { compileFunc, compilerVersion } = require('@ton-community/func-js');
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require('fs');
const { Cell } = require('ton');

async function compileContract(contractName) {
    const result = await compileFunc({
        targets: [`contracts/${contractName}.fc`],
        sources: (path) => readFileSync(__dirname + '/' + path).toString()
    });

    if (result.status === 'error') {
        console.error(`Error compiling ${contractName}:`, result.message);
        return;
    }

    // result.codeBoc contains base64 encoded BOC with code cell 
    const codeCell = Cell.fromBoc(Buffer.from(result.codeBoc, "base64"))[0];
    
    // Ensure the output directory exists
    const outputPath = `compiled/${contractName}.boc`;
    const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // Save the compiled BOC to a file
    writeFileSync(outputPath, codeCell.toBoc());
    console.log(`Compiled ${contractName} to ${outputPath}`);
}

async function main() {
    // Print compiler version
    const version = await compilerVersion();
    console.log(`TON FunC compiler version: ${version}`);

    // List of contracts to compile
    const contracts = [
        'bridge/Bridge',
        'bridge/MessageHandler',
        'bridge/Validator',
        'governance/DAO',
        'governance/Staking',
        'governance/Treasury',
        'pool/Factory',
        'pool/Router',
        'pool/SwapPool',
        'utils/Constants',
        'utils/Math',
        'utils/Security'
    ];

    // Compile each contract
    for (const contract of contracts) {
        await compileContract(contract);
    }
}

main().catch(console.error);