const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  const PredictionMarket = await hre.ethers.getContractFactory('YinYangPredictionMarket');
  const predictionMarket = await PredictionMarket.deploy();

  await predictionMarket.deployed();

  console.log('YinYang Prediction Market deployed to:', predictionMarket.address);

  // Save contract address and ABI for frontend use
  const contractsDir = path.join(__dirname, '../src/contracts');

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, 'PredictionMarket.json'),
    JSON.stringify({
      address: predictionMarket.address,
      abi: JSON.parse(predictionMarket.interface.format('json'))
    }, null, 2)
  );

  console.log('Contract details saved successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
