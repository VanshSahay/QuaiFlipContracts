const quais = require('quais')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '../.env' })
const deployUniswapV3Core = require('./deployUniswapV3Core')

// Import the necessary contracts from v3-periphery
const SwapRouter = require('../../v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
const NonfungiblePositionManager = require('../../v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')
const NonfungibleTokenPositionDescriptor = require('../../v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json')

// Helper function to save ABI for reference
function saveContractABI(contractName, contractArtifact) {
    // Create metadata directory if it doesn't exist
    const metadataDir = path.join(__dirname, '../metadata')
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true })
    }

    // Save the ABI to the metadata directory for reference
    const abiPath = path.join(metadataDir, `${contractName}_abi.json`)
    fs.writeFileSync(abiPath, JSON.stringify(contractArtifact.abi, null, 2))
    console.log(`${contractName} ABI saved to ${abiPath} for reference`)
}

// Create different dummy IPFS hashes for each contract
// These are dummy IPFS hashes that should be 46 characters long
const DUMMY_IPFS_HASHES = {
    NonfungibleTokenPositionDescriptor: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdH",
    NonfungiblePositionManager: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdI",
    SwapRouter: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdJ"
}

async function deployUniswapV3Periphery(factoryAddress = null, wethAddress = null) {
    // Config provider, wallet, and contract factory
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)

    // If factoryAddress is not provided, deploy the factory
    if (!factoryAddress) {
        console.log('No factory address provided, deploying UniswapV3Factory first...')
        factoryAddress = await deployUniswapV3Core()
    }

    // Default WETH address if not provided
    // Note: In a real deployment, you should deploy WETH9 first or use the existing one
    if (!wethAddress) {
        wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // Placeholder - replace with actual
        console.log('Warning: Using placeholder WETH address. For production, provide a real WETH address.')
    }

    console.log('Using factory address:', factoryAddress)
    console.log('Using WETH address:', wethAddress)

    // For NonfungibleTokenPositionDescriptor, we'll use a more simplified approach
    console.log('Deploying NonfungibleTokenPositionDescriptor...')
    saveContractABI("NonfungibleTokenPositionDescriptor", NonfungibleTokenPositionDescriptor)
    console.log(`Using dummy IPFS hash for NonfungibleTokenPositionDescriptor: ${DUMMY_IPFS_HASHES.NonfungibleTokenPositionDescriptor}`)

    // Create a simplified mock version of the descriptor for our deployment
    // This is a workaround due to bytecode size issues
    const MockDescriptorABI = [
        "function tokenURI(uint256 tokenId) external view returns (string memory)",
        "function baseURI() external pure returns (string memory)"
    ];

    const MockDescriptorBytecode = "0x608060405234801561001057600080fd5b5061017f806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806356702c7a1461003b578063c87b56dd14610059575b600080fd5b610043610089565b60405161005091906100c8565b60405180910390f35b610072610067366004610115565b6100a9565b60405161005091906100e5565b60606040518060600160405280602581526020016101306025913990505b90565b6060604051806060016040528060258152602001610130602591399050919050565b600060208083528351808285015260005b818110156100f55785810183015185820160400152602001610109565b81811115610107576000604083870101525b50601f01601f1916929092016040019392505050565b60006020828403121561012657600080fd5b503591905056fe68747470733a2f2f756e69737761702e6f72672f7661756c742f746f6b656e732f7b69647da16469706673582212207a26e26bc02b9d2fb7fb6bae8467edcab54bc9eec0091aab55b0c0c94599796c64736f6c634300080b0033";

    const MockDescriptorFactory = new quais.ContractFactory(
        MockDescriptorABI,
        MockDescriptorBytecode,
        wallet,
        DUMMY_IPFS_HASHES.NonfungibleTokenPositionDescriptor
    );

    const descriptor = await MockDescriptorFactory.deploy();
    console.log('Transaction broadcasted: ', descriptor.deploymentTransaction().hash);
    await descriptor.waitForDeployment();
    const descriptorAddress = await descriptor.getAddress();
    console.log('NonfungibleTokenPositionDescriptor (Mock) deployed to:', descriptorAddress);

    // Deploy NonfungiblePositionManager
    console.log('Deploying NonfungiblePositionManager...')
    saveContractABI("NonfungiblePositionManager", NonfungiblePositionManager)
    console.log(`Using dummy IPFS hash for NonfungiblePositionManager: ${DUMMY_IPFS_HASHES.NonfungiblePositionManager}`)

    const PositionManager = new quais.ContractFactory(
        NonfungiblePositionManager.abi,
        NonfungiblePositionManager.bytecode,
        wallet,
        DUMMY_IPFS_HASHES.NonfungiblePositionManager
    )

    const positionManager = await PositionManager.deploy(
        factoryAddress,
        wethAddress,
        descriptorAddress
    )
    console.log('Transaction broadcasted: ', positionManager.deploymentTransaction().hash)
    await positionManager.waitForDeployment()
    const positionManagerAddress = await positionManager.getAddress()
    console.log('NonfungiblePositionManager deployed to:', positionManagerAddress)

    // Deploy SwapRouter
    console.log('Deploying SwapRouter...')
    saveContractABI("SwapRouter", SwapRouter)
    console.log(`Using dummy IPFS hash for SwapRouter: ${DUMMY_IPFS_HASHES.SwapRouter}`)

    const Router = new quais.ContractFactory(
        SwapRouter.abi,
        SwapRouter.bytecode,
        wallet,
        DUMMY_IPFS_HASHES.SwapRouter
    )

    const router = await Router.deploy(
        factoryAddress,
        wethAddress
    )
    console.log('Transaction broadcasted: ', router.deploymentTransaction().hash)
    await router.waitForDeployment()
    const routerAddress = await router.getAddress()
    console.log('SwapRouter deployed to:', routerAddress)

    // Save all deployed addresses to a file
    const deploymentData = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        factoryAddress: factoryAddress,
        wethAddress: wethAddress,
        positionDescriptorAddress: descriptorAddress,
        positionManagerAddress: positionManagerAddress,
        routerAddress: routerAddress,
        timestamp: new Date().toISOString()
    }

    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, '../deployments')
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true })
    }

    fs.writeFileSync(
        path.join(deploymentsDir, `periphery-${hre.network.name}.json`),
        JSON.stringify(deploymentData, null, 2)
    )

    // Return all deployed contract addresses
    return {
        factory: factoryAddress,
        weth: wethAddress,
        positionDescriptor: descriptorAddress,
        positionManager: positionManagerAddress,
        router: routerAddress
    }
}

// Execute the deployment
if (require.main === module) {
    deployUniswapV3Periphery()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
}

module.exports = deployUniswapV3Periphery 