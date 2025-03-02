const quais = require('quais')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '../.env' })

// Import the UniswapV3Factory directly from v3-core
// Note: Path is relative to the Solidity directory
const UniswapV3Factory = require('../../v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')

async function deployUniswapV3Core() {
    // Config provider, wallet, and contract factory
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)

    // Since we're deploying from external artifacts, we can't use the deploy-metadata plugin
    // because it looks for local artifacts, not external ones
    console.log('Creating metadata directory for reference...')
    const metadataDir = path.join(__dirname, '../metadata')
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true })
    }

    // Save the ABI to the metadata directory for reference
    const metadataPath = path.join(metadataDir, 'UniswapV3Factory_abi.json')
    fs.writeFileSync(metadataPath, JSON.stringify(UniswapV3Factory.abi, null, 2))
    console.log(`Factory ABI saved to ${metadataPath} for reference`)

    // For Quai Network, we need an IPFS hash even for external contracts
    // We'll use a dummy IPFS hash for now
    // This is a dummy IPFS hash that should be 46 characters long
    const dummyIpfsHash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
    console.log(`Using dummy IPFS hash: ${dummyIpfsHash}`)

    // Create contract factory for UniswapV3Factory (with dummy IPFS hash)
    const Factory = new quais.ContractFactory(
        UniswapV3Factory.abi,
        UniswapV3Factory.bytecode,
        wallet,
        dummyIpfsHash
    )

    // Deploy UniswapV3Factory
    console.log('Deploying UniswapV3Factory...')
    const factory = await Factory.deploy()
    console.log('Transaction broadcasted: ', factory.deploymentTransaction().hash)

    // Wait for contract to be deployed
    await factory.waitForDeployment()
    const factoryAddress = await factory.getAddress()
    console.log('UniswapV3Factory deployed to:', factoryAddress)

    // Save the address for future reference
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, '../deployments')
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true })
    }

    // Save the deployment data
    const deploymentData = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        factoryAddress: factoryAddress,
        timestamp: new Date().toISOString()
    }

    fs.writeFileSync(
        path.join(deploymentsDir, `factory-${hre.network.name}.json`),
        JSON.stringify(deploymentData, null, 2)
    )

    return factoryAddress
}

// Execute the deployment
if (require.main === module) {
    deployUniswapV3Core()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
}

module.exports = deployUniswapV3Core 