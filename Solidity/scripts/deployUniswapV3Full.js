const quais = require('quais')
const fs = require('fs')
require('dotenv').config({ path: '../.env' })
const deployWETH9 = require('./deployWETH9')
const deployUniswapV3Core = require('./deployUniswapV3Core')
const deployUniswapV3Periphery = require('./deployUniswapV3Periphery')

async function deployUniswapV3Full() {
    console.log('Starting Uniswap v3 deployment on Quai Network...')
    console.log('Deploying to network:', hre.network.name)
    console.log('--------------------------------------')

    // Step 1: Deploy WETH9
    console.log('Step 1: Deploying WETH9...')
    const wethAddress = await deployWETH9()
    console.log('--------------------------------------')

    // Step 2: Deploy v3-core (UniswapV3Factory)
    console.log('Step 2: Deploying UniswapV3Factory...')
    const factoryAddress = await deployUniswapV3Core()
    console.log('--------------------------------------')

    // Step 3: Deploy v3-periphery contracts
    console.log('Step 3: Deploying v3-periphery contracts...')
    const peripheryAddresses = await deployUniswapV3Periphery(factoryAddress, wethAddress)
    console.log('--------------------------------------')

    // Step 4: Save all deployed addresses to a JSON file
    const deploymentData = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        wethAddress: wethAddress,
        factoryAddress: factoryAddress,
        positionDescriptorAddress: peripheryAddresses.positionDescriptor,
        positionManagerAddress: peripheryAddresses.positionManager,
        routerAddress: peripheryAddresses.router,
        timestamp: new Date().toISOString()
    }

    // Write deployment info to file
    const deploymentFilePath = `./deployments/uniswap-v3-${hre.network.name}.json`

    // Create deployments directory if it doesn't exist
    if (!fs.existsSync('./deployments')) {
        fs.mkdirSync('./deployments', { recursive: true })
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