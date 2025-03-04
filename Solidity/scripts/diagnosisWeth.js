const quais = require('quais');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });
const hre = require('hardhat');

// Load deployment data
const deploymentData = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, '../deployments/uniswap-v3-cyprus1.json'),
        'utf8'
    )
);

// Contract addresses
const WETH_ADDRESS = deploymentData.wethAddress;
const FACTORY_ADDRESS = deploymentData.factoryAddress;
const POSITION_MANAGER_ADDRESS = deploymentData.positionManagerAddress;
const ROUTER_ADDRESS = deploymentData.routerAddress;

// Load ABIs
const UniswapV3FactoryABI = require('../../v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json').abi;
const NonfungiblePositionManagerABI = require('../../v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json').abi;
const SwapRouterABI = require('../../v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json').abi;
const WETH9ABI = require('../artifacts/contracts/WETH9.sol/WETH9.json').abi;

function getProvider() {
    return new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true });
}

function getWallet() {
    const provider = getProvider();
    return new quais.Wallet(hre.network.config.accounts[0], provider);
}

/**
 * Diagnose WETH9 configuration issues
 */
async function diagnoseWETH9Issues() {
    console.log('\n========== WETH9 Configuration Diagnosis ==========');
    const wallet = getWallet();
    console.log(`Using wallet address: ${wallet.address}`);

    // 1. Check WETH9 deployed contract
    console.log('\n--- WETH9 Contract Check ---');
    try {
        const weth = new quais.Contract(WETH_ADDRESS, WETH9ABI, wallet);
        const name = await weth.name();
        const symbol = await weth.symbol();
        const decimals = await weth.decimals();

        console.log(`WETH9 contract at ${WETH_ADDRESS}:`);
        console.log(`- Name: ${name}`);
        console.log(`- Symbol: ${symbol}`);
        console.log(`- Decimals: ${decimals}`);

        // Try to deposit a small amount to test
        const depositAmount = quais.parseUnits("0.001", 18);
        console.log(`\nTesting deposit with ${quais.formatUnits(depositAmount, 18)} QAI...`);

        const tx = await weth.deposit({ value: depositAmount });
        console.log(`Deposit transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log('Deposit successful! ✅');

        // Check balance
        const balance = await weth.balanceOf(wallet.address);
        console.log(`WETH9 balance: ${quais.formatUnits(balance, 18)}`);
    } catch (error) {
        console.error(`Error accessing WETH9 contract at ${WETH_ADDRESS}:`, error.message);
        console.error('❌ WETH9 contract is not accessible or not working correctly');
    }

    // 2. Check Uniswap Factory
    console.log('\n--- Uniswap Factory Check ---');
    try {
        const factory = new quais.Contract(FACTORY_ADDRESS, UniswapV3FactoryABI, wallet);
        const owner = await factory.owner();
        console.log(`Factory contract at ${FACTORY_ADDRESS}:`);
        console.log(`- Owner: ${owner}`);
        console.log('Factory contract is accessible ✅');
    } catch (error) {
        console.error(`Error accessing Factory contract at ${FACTORY_ADDRESS}:`, error.message);
        console.error('❌ Factory contract is not accessible');
    }

    // 3. Check Position Manager and its WETH9 setting
    console.log('\n--- Position Manager Check ---');
    try {
        const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);
        console.log(`Position Manager contract at ${POSITION_MANAGER_ADDRESS}:`);

        // Try to get the factory address
        const pmFactory = await positionManager.factory();
        console.log(`- Factory: ${pmFactory}`);
        console.log(`- Factory matches our setting: ${pmFactory === FACTORY_ADDRESS}`);

        // Try to get WETH9 address if the method exists
        try {
            const pmWETH = await positionManager.WETH9();
            console.log(`- WETH9: ${pmWETH}`);
            console.log(`- WETH9 matches our setting: ${pmWETH === WETH_ADDRESS}`);

            if (pmWETH !== WETH_ADDRESS) {
                console.error('❌ CRITICAL ISSUE: Position Manager is using a different WETH9 address!');
                console.error('This is likely causing the "Not WETH9" error');
                console.error(`Position Manager expects: ${pmWETH}`);
                console.error(`Our script is using: ${WETH_ADDRESS}`);

                // Suggest solutions
                console.log('\nSuggested solutions:');
                console.log(`1. Update your deployment file to use WETH_ADDRESS = ${pmWETH}`);
                console.log('2. Redeploy Position Manager with the correct WETH9 address');
            } else {
                console.log('Position Manager WETH9 configuration is correct ✅');
            }
        } catch (error) {
            console.log('Could not retrieve WETH9 address from Position Manager:', error.message);
        }
    } catch (error) {
        console.error(`Error accessing Position Manager at ${POSITION_MANAGER_ADDRESS}:`, error.message);
        console.error('❌ Position Manager is not accessible');
    }

    // 4. Check Router and its WETH9 setting
    console.log('\n--- Router Check ---');
    try {
        const router = new quais.Contract(ROUTER_ADDRESS, SwapRouterABI, wallet);
        console.log(`Router contract at ${ROUTER_ADDRESS}:`);

        // Try to get the factory address
        const routerFactory = await router.factory();
        console.log(`- Factory: ${routerFactory}`);
        console.log(`- Factory matches our setting: ${routerFactory === FACTORY_ADDRESS}`);

        // Try to get WETH9 address if the method exists
        try {
            const routerWETH = await router.WETH9();
            console.log(`- WETH9: ${routerWETH}`);
            console.log(`- WETH9 matches our setting: ${routerWETH === WETH_ADDRESS}`);

            if (routerWETH !== WETH_ADDRESS) {
                console.error('❌ CRITICAL ISSUE: Router is using a different WETH9 address!');
                console.error('This could cause the "Not WETH9" error');
                console.error(`Router expects: ${routerWETH}`);
                console.error(`Our script is using: ${WETH_ADDRESS}`);

                // Suggest solutions
                console.log('\nSuggested solutions:');
                console.log(`1. Update your deployment file to use WETH_ADDRESS = ${routerWETH}`);
                console.log('2. Redeploy Router with the correct WETH9 address');
            } else {
                console.log('Router WETH9 configuration is correct ✅');
            }
        } catch (error) {
            console.log('Could not retrieve WETH9 address from Router:', error.message);
        }
    } catch (error) {
        console.error(`Error accessing Router at ${ROUTER_ADDRESS}:`, error.message);
        console.error('❌ Router is not accessible');
    }

    console.log('\n========== End of WETH9 Diagnosis ==========');
}

// Run the diagnosis
diagnoseWETH9Issues()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error running diagnosis:', error);
        process.exit(1);
    }); 