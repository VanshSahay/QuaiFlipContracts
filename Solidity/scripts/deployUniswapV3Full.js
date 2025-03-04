const quais = require('quais')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '../.env' })
const hre = require('hardhat')
const deployUniswapAddressGrinder = require('./deployUniswapAddressGrinder')

// Helper function to extract deployed address from receipt
async function extractDeployedAddress(receipt, uniswapAddressGrinderContract) {
    // Find the deployment event in the logs
    let deployedAddress
    for (const log of receipt.logs) {
        try {
            // Parse the log as the ContractDeployed event
            const parsedLog = uniswapAddressGrinderContract.interface.parseLog(log)
            if (parsedLog.name === 'ContractDeployed') {
                deployedAddress = parsedLog.args.deployedAddress
                console.log(`Found ContractDeployed event with address: ${deployedAddress}`)
                return deployedAddress
            }
        } catch (error) {
            // Not our event, continue
            continue
        }
    }

    // Fallback if event not found
    console.log('ContractDeployed event not found, trying to extract address from logs...')
    // Try to get the address from to/address field of the logs
    for (const log of receipt.logs) {
        if (log.address && log.address !== uniswapAddressGrinderContract.address) {
            deployedAddress = log.address
            console.log(`Found potential deployed address from logs: ${deployedAddress}`)
            return deployedAddress
        }
    }

    throw new Error('Failed to find deployed contract address')
}

// Function to ensure bytecode is properly formatted for deployment
function processBytecodeForDeployment(bytecode) {
    // Ensure bytecode has 0x prefix
    if (!bytecode.startsWith('0x')) {
        bytecode = '0x' + bytecode;
    }

    // Log details for debugging
    console.log(`Processing bytecode with length: ${bytecode.length}`);

    return bytecode;
}

async function deployWETH9WithGrinder(uniswapAddressGrinderContract, provider, wallet) {
    console.log('Deploying WETH9 using UniswapAddressGrinder...')

    // Get the WETH9 bytecode and abi
    const WETH9Artifact = require('../artifacts/contracts/WETH9.sol/WETH9.json')

    // WETH9 has no constructor arguments
    const constructorArgs = '0x'

    // Use a random salt or a deterministic one
    const salt = quais.keccak256(quais.toUtf8Bytes('WETH9_SALT_' + Date.now()))

    // Deploy WETH9 using the grinder - specify the exact function signature to avoid ambiguity
    console.log('Calling deployContract with explicit function signature...')
    const tx = await uniswapAddressGrinderContract['deployContract(bytes,bytes,bytes32,uint256)'](
        WETH9Artifact.bytecode,
        constructorArgs,
        salt,
        0,  // Explicit gasLimit parameter as the 4th argument
        { gasLimit: 5000000 }  // Transaction options
    )
    const receipt = await tx.wait()

    // Extract the deployed address
    const wethAddress = await extractDeployedAddress(receipt, uniswapAddressGrinderContract)

    console.log(`WETH9 deployed to: ${wethAddress}`)
    // Verify the address is Quai compatible
    await verifyQuaiAddress(wethAddress)

    return wethAddress
}

async function deployUniswapV3Core(uniswapAddressGrinderContract, provider, wallet) {
    console.log('Deploying UniswapV3Factory using UniswapAddressGrinder...')

    // Get the UniswapV3Factory bytecode and abi
    const UniswapV3FactoryArtifact = require('../../v3-core/artifacts/contracts/QuaiUniswapV3FactoryBytecodeOnly.sol/QuaiUniswapV3Factory.json')

    // Log bytecode size in bytes and kilobytes
    const bytecodeSize = (UniswapV3FactoryArtifact.bytecode.length - 2) / 2; // -2 for '0x', /2 because each byte is 2 hex chars
    console.log(`QuaiUniswapV3Factory bytecode size: ${bytecodeSize} bytes (${(bytecodeSize / 1024).toFixed(2)} KB)`)

    // UniswapV3Factory has no constructor arguments
    const constructorArgs = '0x'

    // Use a random salt or a deterministic one
    const salt = quais.keccak256(quais.toUtf8Bytes('UNISWAP_FACTORY_SALT_' + Date.now()))

    // Deploy Factory using the grinder with an explicitly high gas limit
    console.log('Deploying factory with high gas limit...')

    try {
        // Try with an extremely high gas limit to ensure we don't run out of gas during grinding
        const tx = await uniswapAddressGrinderContract['deployContract(bytes,bytes,bytes32,uint256)'](
            UniswapV3FactoryArtifact.bytecode,
            constructorArgs,
            salt,
            0, // Explicit gasLimit parameter as the 4th argument
            { gasLimit: 5000000 } // Transaction options - 30M gas
        )

        console.log('Transaction sent with hash:', tx.hash)
        console.log('Waiting for transaction confirmation...')

        const receipt = await tx.wait()
        console.log('Transaction confirmed with status:', receipt.status)

        // Extract the deployed address
        const factoryAddress = await extractDeployedAddress(receipt, uniswapAddressGrinderContract)
        console.log(`UniswapV3Factory deployed to: ${factoryAddress}`)

        // Verify the address is Quai compatible
        await verifyQuaiAddress(factoryAddress)

        try {
            // Create a factory contract instance
            const factory = new quais.Contract(
                factoryAddress,
                UniswapV3FactoryArtifact.abi,
                wallet
            )

            // Now set the UniswapAddressGrinder address in the factory
            console.log('Setting UniswapAddressGrinder address in the factory...')

            // Get the grinder address - different versions of ethers/quais may have it in different places
            let grinderAddress = null
            if (uniswapAddressGrinderContract.address) {
                grinderAddress = uniswapAddressGrinderContract.address
            } else if (uniswapAddressGrinderContract.target) {
                grinderAddress = uniswapAddressGrinderContract.target
            } else {
                // Try to extract it from the deployments file
                try {
                    const deploymentsPath = path.join(__dirname, '../deployments/uniswap-address-grinder-cyprus1.json')
                    if (fs.existsSync(deploymentsPath)) {
                        const deploymentData = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'))
                        grinderAddress = deploymentData.address
                    }
                } catch (err) {
                    console.warn('Error reading deployments file:', err.message)
                }
            }

            if (grinderAddress) {
                try {
                    // Attempt to set the grinder address but continue if it fails
                    console.log(`Attempting to set UniswapAddressGrinder address to ${grinderAddress}...`)
                    const setGrinderTx = await factory.setUniswapAddressGrinder(
                        grinderAddress,
                        { gasLimit: 3000000 }
                    )
                    await setGrinderTx.wait()
                    console.log(`UniswapAddressGrinder set to: ${grinderAddress}`)
                } catch (txError) {
                    console.warn('⚠️ Unable to set UniswapAddressGrinder in factory. This might be expected with the minimal factory implementation.')
                    console.warn('Continuing with deployment without setting the grinder address.')
                }
            } else {
                console.warn('⚠️ Failed to retrieve UniswapAddressGrinder address, skipping setting it in factory')
            }
        } catch (error) {
            console.error('Error setting UniswapAddressGrinder in factory:')
            console.error(error)
            console.log('Continuing deployment despite factory configuration error...')
        }

        return factoryAddress;
    } catch (error) {
        console.error('Error deploying UniswapV3Factory:')
        if (error.error) {
            console.error('Error code:', error.error.code)
            console.error('Error message:', error.error.message)

            // Try to parse the error data if available
            if (error.error.data) {
                try {
                    const decodedData = quais.toUtf8String(error.error.data.slice(138));
                    console.error('Decoded error data:', decodedData);
                } catch (decodeError) {
                    console.error('Raw error data:', error.error.data);
                }
            }
        } else {
            console.error(error)
        }

        throw error
    }
}

// Fix for formatBytes32String
function formatBytes32String(text) {
    // Pad the string with zeros to make it 32 bytes
    const textBytes = Buffer.from(text, 'utf8');

    if (textBytes.length > 31) {
        throw new Error(`String '${text}' is too long for bytes32`);
    }

    // Create a hex string with the appropriate padding
    const hex = '0x' + textBytes.toString('hex').padEnd(64, '0');
    return hex;
}

async function deployUniswapV3Periphery(uniswapAddressGrinderContract, factoryAddress, wethAddress, provider, wallet) {
    console.log('Deploying UniswapV3 Periphery contracts using UniswapAddressGrinder...')

    // 1. First deploy the NFTDescriptor library
    console.log('1. Deploying NFTDescriptor library...')
    const NFTDescriptorArtifact = require('../../v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json')

    // NFTDescriptor has no constructor arguments
    const nftDescriptorConstructorArgs = '0x'

    // Use a random salt
    const nftDescriptorSalt = quais.keccak256(quais.toUtf8Bytes('NFT_DESCRIPTOR_SALT_' + Date.now()))

    // Deploy NFTDescriptor
    const nftDescriptorTx = await uniswapAddressGrinderContract['deployContract(bytes,bytes,bytes32,uint256)'](
        NFTDescriptorArtifact.bytecode,
        nftDescriptorConstructorArgs,
        nftDescriptorSalt,
        0, // Explicit gasLimit parameter
        {} // No additional options needed
    )
    const nftDescriptorReceipt = await nftDescriptorTx.wait()

    // Get the deployed address
    const nftDescriptorAddress = await extractDeployedAddress(nftDescriptorReceipt, uniswapAddressGrinderContract)
    console.log(`NFTDescriptor deployed to: ${nftDescriptorAddress}`)
    await verifyQuaiAddress(nftDescriptorAddress)

    // 2. Deploy NonfungibleTokenPositionDescriptor
    console.log('2. Deploying NonfungibleTokenPositionDescriptor...')
    const NonfungibleTokenPositionDescriptorArtifact = require('../../v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json')

    // Create the label for 'QUAI' as bytes32
    const nativeCurrencyLabel = formatBytes32String('QUAI')
    console.log(`Native currency label: ${nativeCurrencyLabel}`)

    // Encode constructor arguments safely using AbiCoder.encode
    const positionDescriptorConstructorArgs = quais.AbiCoder.defaultAbiCoder().encode(
        ['address', 'bytes32'],
        [wethAddress, nativeCurrencyLabel]
    )

    // Use a random salt
    const positionDescriptorSalt = quais.keccak256(quais.toUtf8Bytes('POSITION_DESCRIPTOR_SALT_' + Date.now()))

    // Updated regex to match Solidity library placeholders with 34 hex digits.
    // This will match any occurrence of __$<34 hex digits>$__
    const placeholderRegex = /__\$[a-fA-F0-9]{34}\$__/g;
    let unlinkedBytecode = NonfungibleTokenPositionDescriptorArtifact.bytecode;
    if (placeholderRegex.test(unlinkedBytecode)) {
        const cleanLibAddress = nftDescriptorAddress.replace(/^0x/, '');
        // This will replace all instances of the placeholder in the bytecode.
        unlinkedBytecode = unlinkedBytecode.replace(placeholderRegex, cleanLibAddress);
        console.log("Linked NFTDescriptor into NonfungibleTokenPositionDescriptor bytecode.");
    } else {
        console.warn("Library placeholder not found in bytecode. Check your artifact.");
    }



    // Process the linked bytecode to ensure it's valid for deployment.
    const processedPositionDescriptorBytecode = processBytecodeForDeployment(unlinkedBytecode);

    console.log('Deploying NonfungibleTokenPositionDescriptor with constructor args:', positionDescriptorConstructorArgs)
    console.log('WETH address:', wethAddress)

    // Deploy with fixed and linked bytecode format
    const positionDescriptorTx = await uniswapAddressGrinderContract['deployContract(bytes,bytes,bytes32,uint256)'](
        processedPositionDescriptorBytecode,
        positionDescriptorConstructorArgs,
        positionDescriptorSalt,
        0, // Explicit gasLimit parameter
        { gasLimit: 8000000 } // Higher gas limit for this complex contract
    )

    const positionDescriptorReceipt = await positionDescriptorTx.wait()

    // Get the deployed address
    const positionDescriptorAddress = await extractDeployedAddress(positionDescriptorReceipt, uniswapAddressGrinderContract)
    console.log(`NonfungibleTokenPositionDescriptor deployed to: ${positionDescriptorAddress}`)
    await verifyQuaiAddress(positionDescriptorAddress)

    // 3. Deploy NonfungiblePositionManager
    console.log('3. Deploying NonfungiblePositionManager...')
    const NonfungiblePositionManagerArtifact = require('../../v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')

    // Prepare constructor arguments
    const positionManagerConstructorArgs = quais.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'address'],
        [factoryAddress, wethAddress, positionDescriptorAddress]
    )

    // Use a random salt
    const positionManagerSalt = quais.keccak256(quais.toUtf8Bytes('POSITION_MANAGER_SALT_' + Date.now()))

    // Deploy PositionManager
    const positionManagerTx = await uniswapAddressGrinderContract['deployContract(bytes,bytes,bytes32,uint256)'](
        NonfungiblePositionManagerArtifact.bytecode,
        positionManagerConstructorArgs,
        positionManagerSalt,
        0, // Explicit gasLimit parameter
        { gasLimit: 8000000 } // Increased gas limit
    )
    const positionManagerReceipt = await positionManagerTx.wait()

    // Get the deployed address
    const positionManagerAddress = await extractDeployedAddress(positionManagerReceipt, uniswapAddressGrinderContract)
    console.log(`NonfungiblePositionManager deployed to: ${positionManagerAddress}`)
    await verifyQuaiAddress(positionManagerAddress)

    // 4. Deploy SwapRouter
    console.log('4. Deploying SwapRouter...')
    const SwapRouterArtifact = require('../../v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')

    // Prepare constructor arguments
    const routerConstructorArgs = quais.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address'],
        [factoryAddress, wethAddress]
    )

    // Use a random salt
    const routerSalt = quais.keccak256(quais.toUtf8Bytes('ROUTER_SALT_' + Date.now()))

    // Process the bytecode properly before deployment
    const processedRouterBytecode = processBytecodeForDeployment(SwapRouterArtifact.bytecode)

    // Deploy Router
    const routerTx = await uniswapAddressGrinderContract['deployContract(bytes,bytes,bytes32,uint256)'](
        processedRouterBytecode,
        routerConstructorArgs,
        routerSalt,
        0, // Explicit gasLimit parameter
        { gasLimit: 8000000 } // Increased gas limit
    )
    const routerReceipt = await routerTx.wait()

    // Get the deployed address
    const routerAddress = await extractDeployedAddress(routerReceipt, uniswapAddressGrinderContract)
    console.log(`SwapRouter deployed to: ${routerAddress}`)
    await verifyQuaiAddress(routerAddress)

    return {
        positionDescriptor: positionDescriptorAddress,
        positionManager: positionManagerAddress,
        router: routerAddress
    }
}

// Helper function to verify an address is Quai compatible
async function verifyQuaiAddress(address) {
    const firstByte = parseInt(address.slice(2, 4), 16)
    const secondByte = parseInt(address.slice(4, 6), 16)

    if (firstByte === 0 && secondByte <= 127) {
        console.log(`✅ Address ${address} is Quai Network compatible`)
        return true
    } else {
        console.log(`⚠️ Warning: Address ${address} may not be Quai Network compatible!`)
        console.log(`First byte: ${firstByte} (should be 0), Second byte: ${secondByte} (should be ≤ 127)`)
        return false
    }
}

async function deployUniswapV3Full() {
    console.log('Starting Uniswap v3 deployment on Quai Network with address grinding...')
    console.log('Deploying to network:', hre.network.name)
    console.log('--------------------------------------')

    // Setup provider and wallet
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)
    console.log(`Deploying from: ${wallet.address}`)

    // Step 0: Deploy UniswapAddressGrinder
    console.log('Step 0: Deploying UniswapAddressGrinder...')
    const uniswapAddressGrinderAddress = await deployUniswapAddressGrinder()

    // Get UniswapAddressGrinder contract instance
    const uniswapAddressGrinderArtifact = require('../artifacts/contracts/UniswapAddressGrinder.sol/UniswapAddressGrinder.json')
    const uniswapAddressGrinder = new quais.Contract(uniswapAddressGrinderAddress, uniswapAddressGrinderArtifact.abi, wallet)
    console.log('--------------------------------------')

    // Step 1: Deploy WETH9 using UniswapAddressGrinder
    console.log('Step 1: Deploying WETH9...')
    const wethAddress = await deployWETH9WithGrinder(uniswapAddressGrinder, provider, wallet)
    console.log('--------------------------------------')

    // Step 2: Deploy v3-core (UniswapV3Factory) using UniswapAddressGrinder
    console.log('Step 2: Deploying UniswapV3Factory...')
    const factoryAddress = await deployUniswapV3Core(uniswapAddressGrinder, provider, wallet)
    console.log('--------------------------------------')

    // Step 3: Deploy v3-periphery contracts using UniswapAddressGrinder
    console.log('Step 3: Deploying v3-periphery contracts...')
    const peripheryAddresses = await deployUniswapV3Periphery(uniswapAddressGrinder, factoryAddress, wethAddress, provider, wallet)
    console.log('--------------------------------------')

    // Step 4: Save all deployed addresses to a JSON file
    const deploymentData = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        uniswapAddressGrinder: uniswapAddressGrinderAddress,
        wethAddress: wethAddress,
        factoryAddress: factoryAddress,
        positionDescriptorAddress: peripheryAddresses.positionDescriptor,
        positionManagerAddress: peripheryAddresses.positionManager,
        routerAddress: peripheryAddresses.router,
        timestamp: new Date().toISOString()
    }

    // Write deployment info to file
    const deploymentFilePath = path.join(__dirname, '../deployments', `uniswap-v3-${hre.network.name}.json`)

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, '../deployments'))) {
        fs.mkdirSync(path.join(__dirname, '../deployments'), { recursive: true })
    }

    fs.writeFileSync(
        deploymentFilePath,
        JSON.stringify(deploymentData, null, 2)
    )

    console.log(quais.getZoneForAddress(wethAddress))
    console.log(quais.getZoneForAddress(factoryAddress))
    console.log(quais.getZoneForAddress(peripheryAddresses.positionDescriptor))
    console.log(quais.getZoneForAddress(peripheryAddresses.positionManager))
    console.log(quais.getZoneForAddress(peripheryAddresses.router))

    console.log('Deployment complete! Addresses saved to:', deploymentFilePath)
    console.log('Deployment summary:')
    console.log('- UniswapAddressGrinder:', uniswapAddressGrinderAddress)
    console.log('- WETH9:', wethAddress)
    console.log('- Factory:', factoryAddress)
    console.log('- Position Descriptor:', peripheryAddresses.positionDescriptor)
    console.log('- Position Manager:', peripheryAddresses.positionManager)
    console.log('- Router:', peripheryAddresses.router)

    return deploymentData
}

// Execute the deployment
if (require.main === module) {
    deployUniswapV3Full()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
}

module.exports = deployUniswapV3Full
