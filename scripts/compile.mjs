import fs from 'fs';
import path from 'path';
import solc from 'solc';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * The import callback for the solc compiler.
 * It finds imported files from node_modules or the local contracts folder.
 * @param {string} importPath - The path being imported.
 * @returns {object} - The contents of the imported file or an error.
 */
function findImports(importPath) {
    try {
        // Construct the absolute path to the imported file within node_modules
        const nodeModulesPath = path.resolve(__dirname, '..', 'node_modules', importPath);

        if (fs.existsSync(nodeModulesPath)) {
            return { contents: fs.readFileSync(nodeModulesPath, 'utf8') };
        }

        // Fallback for local file imports (e.g., './OtherContract.sol')
        const localPath = path.resolve(__dirname, '..', 'contracts', importPath);
        if (fs.existsSync(localPath)) {
            return { contents: fs.readFileSync(localPath, 'utf8') };
        }

        return { error: `Source "${importPath}" not found` };
    } catch (error) {
        return { error: error.message };
    }
}

// Path to your root contract
const contractPath = path.resolve(__dirname, '..', 'contracts', 'PredictionMarket.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Create the compiler input
const input = {
    language: 'Solidity',
    sources: {
        'PredictionMarket.sol': {
            content: source,
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode'],
            },
        },
    },
};

// Compile the contract using the import callback
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Error handling
let hasErrors = false;
if (output.errors) {
    output.errors.forEach(err => {
        // We only care about errors, not warnings
        if (err.severity === 'error') {
            console.error(err.formattedMessage);
            hasErrors = true;
        }
    });
}

if (hasErrors) {
    console.error('\nCompilation failed with errors.');
    process.exit(1);
}

// Get the contract artifact
const contractName = 'PredictionMarket';
const contractArtifact = output.contracts['PredictionMarket.sol'][contractName];

if (!contractArtifact) {
    console.error(`Could not find contract '${contractName}' in compilation output.`);
    process.exit(1);
}

// Create artifacts directory if it doesn't exist
const artifactsDir = path.resolve(__dirname, '..', 'artifacts');
if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir);
}

// Save the ABI and bytecode
const artifact = {
    contractName: contractName,
    abi: contractArtifact.abi,
    bytecode: contractArtifact.evm.bytecode.object,
};

fs.writeFileSync(
    path.join(artifactsDir, `${contractName}.json`),
    JSON.stringify(artifact, null, 2)
);

console.log(`✅ Contract artifact saved to artifacts/${contractName}.json`);
