const quais = require('quais');
const { deployMetadata } = require("hardhat");
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });
const hre = require('hardhat');

async function deployUniswapAddressGrinder() {
    console.log('Deploying UniswapAddressGrinder contract...');

    // Configure provider and wallet using quais
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true });
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider);
    console.log(`Deploying from: ${wallet.address}`);

    // Compile the UniswapAddressGrinder contract
    console.log('Compiling contracts...');
    try {
        await hre.run('compile');
        console.log('Compilation successful');
    } catch (error) {
        console.error('Error during compilation:', error);
        process.exit(1);
    }

    // Get the compiled contract artifact
    const UniswapAddressGrinderArtifact = require('../artifacts/contracts/UniswapAddressGrinder.sol/UniswapAddressGrinder.json');

    // Push metadata to IPFS
    const ipfsHash = await deployMetadata.pushMetadataToIPFS("UniswapAddressGrinder");

    // Create contract factory for UniswapAddressGrinder
    const UniswapAddressGrinderFactory = new quais.ContractFactory(
        UniswapAddressGrinderArtifact.abi,
        UniswapAddressGrinderArtifact.bytecode,
        wallet,
        ipfsHash
    );

    // Deploy the contract
    console.log('Deploying UniswapAddressGrinder contract...');
    const uniswapAddressGrinder = await UniswapAddressGrinderFactory.deploy();
    console.log('Transaction broadcasted: ', uniswapAddressGrinder.deploymentTransaction().hash);

    // Wait for contract to be deployed
    await uniswapAddressGrinder.waitForDeployment();
    const uniswapAddressGrinderAddress = await uniswapAddressGrinder.getAddress();
    console.log(`UniswapAddressGrinder deployed to: ${uniswapAddressGrinderAddress}`);

    // Check if the address is in the correct Quai Network range
    const firstByte = parseInt(uniswapAddressGrinderAddress.slice(2, 4), 16);
    const secondByte = parseInt(uniswapAddressGrinderAddress.slice(4, 6), 16);

    if (firstByte === 0 && secondByte <= 127) {
        console.log(`✅ UniswapAddressGrinder address is in the correct Quai Network shard range!`);
    } else {
        console.log(`⚠️ Warning: UniswapAddressGrinder address may not be in the correct Quai Network shard range.`);
        console.log(`First byte: ${firstByte} (should be 0), Second byte: ${secondByte} (should be ≤ 127)`);
    }

    // Save the deployment info
    const deploymentPath = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentPath)) {
        fs.mkdirSync(deploymentPath, { recursive: true });
    }

    const deploymentData = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        uniswapAddressGrinder: uniswapAddressGrinderAddress,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        path.join(deploymentPath, `uniswap-address-grinder-${hre.network.name}.json`),
        JSON.stringify(deploymentData, null, 2)
    );

    console.log(`Deployment info saved to: ${path.join(deploymentPath, `uniswap-address-grinder-${hre.network.name}.json`)}`);

    return uniswapAddressGrinderAddress;
}

// Execute the deployment if this script is run directly
if (require.main === module) {
    deployUniswapAddressGrinder()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = deployUniswapAddressGrinder; 