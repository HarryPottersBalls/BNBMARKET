import fs from 'fs';
import path from 'path';
import Web3 from 'web3';
import dotenvFlow from 'dotenv-flow';
dotenvFlow.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function main() {
    // 1. Setup Provider and Wallet
    const rpcUrl = process.env.BSC_RPC_URL;
    if (!rpcUrl) {
        throw new Error('BSC_TESTNET_RPC not found in .env file');
    }
    const web3 = new Web3(rpcUrl);

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('PRIVATE_KEY not found in .env file');
    }
    const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`);
    web3.eth.accounts.wallet.add(account);
    web3.eth.defaultAccount = account.address;

    console.log(`Attempting to deploy from account: ${account.address}`);

    // 2. Read Contract Artifacts
    const artifactPath = path.resolve(__dirname, '..', 'artifacts', 'PredictionMarket.json');
    if (!fs.existsSync(artifactPath)) {
        throw new Error('Contract artifact not found. Please compile first.');
    }
    const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // 3. Deploy Contract
    const PredictionMarketContract = new web3.eth.Contract(abi);

    // Use the deployer's address as a placeholder for all constructor arguments
    const initialOwner = account.address;
    const platformWallet = account.address;
    const treasuryWallet = account.address;

    console.log('Deploying contract...');
    const contractInstance = await PredictionMarketContract.deploy({
        data: bytecode,
        arguments: [initialOwner, platformWallet, treasuryWallet],
    }).send({
        from: account.address,
        gas: 3000000, // Adjust gas limit as needed
        gasPrice: await web3.eth.getGasPrice(),
    });

    console.log('✅ Contract deployed at address:', contractInstance.options.address);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
