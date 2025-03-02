const quais = require('quais')
const { deployMetadata } = require("hardhat");
require('dotenv').config({ path: '../.env' })
const fs = require('fs')

// Use the local WETH9 contract instead of trying to import from v3-periphery
// We'll compile our implementation and then deploy it

async function deployWETH9() {
    // Config provider, wallet, and contract factory
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)

    // Compile the contract if needed
    console.log('Compiling WETH9 contract...')
    try {
        await hre.run('compile');
        console.log('Compilation successful');
    } catch (error) {
        console.error('Error during compilation:', error);
        process.exit(1);
    }

    // Get the compiled contract artifact
    const WETH9Artifact = require('../artifacts/contracts/WETH9.sol/WETH9.json');

    // Push metadata to IPFS
    const ipfsHash = await deployMetadata.pushMetadataToIPFS("WETH9")

    // Create contract factory for WETH9
    const WETH9Factory = new quais.ContractFactory(
        WETH9Artifact.abi,
        WETH9Artifact.bytecode,
        wallet,
        ipfsHash
    )

    // Deploy WETH9
    console.log('Deploying WETH9...')
    const weth9 = await WETH9Factory.deploy()
    console.log('Transaction broadcasted: ', weth9.deploymentTransaction().hash)

    // Wait for contract to be deployed
    await weth9.waitForDeployment()
    const weth9Address = await weth9.getAddress()
    console.log('WETH9 deployed to:', weth9Address)

    // Save deployed address to a file for reference
    const deploymentData = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        weth9Address: weth9Address,
        timestamp: new Date().toISOString()
    }

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments', { recursive: true })
    }

    fs.writeFileSync(
        `./deployments/weth9-${hre.network.name}.json`,
        JSON.stringify(deploymentData, null, 2)
    )

    return weth9Address
}

// Execute the deployment
if (require.main === module) {
    deployWETH9()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
}

module.exports = deployWETH9 