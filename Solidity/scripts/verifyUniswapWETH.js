const quais = require('quais');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });
const hre = require('hardhat');

// Load the deployment data
function loadDeploymentData() {
    const deploymentData = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '../deployments/uniswap-v3-cyprus1.json'),
            'utf8'
        )
    );
    return deploymentData;
}

// Load ABIs
const UniswapV3FactoryABI = require('../../v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json').abi;
const NonfungiblePositionManagerABI = require('../../v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json').abi;
const SwapRouterABI = require('../../v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json').abi;
const WETH9ABI = require('../artifacts/contracts/WETH9.sol/WETH9.json').abi;
const NonfungibleTokenPositionDescriptorABI = require('../../v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json').abi;

async function getProvider() {
    return new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true });
}

async function getWallet() {
    const provider = await getProvider();
    return new quais.Wallet(hre.network.config.accounts[0], provider);
}

/**
 * Comprehensive verification of WETH9 integration with Uniswap V3
 */
async function verifyWQAI() {
    console.log('\n===== COMPREHENSIVE WQAI VERIFICATION =====');
    const deploymentData = loadDeploymentData();
    const wallet = await getWallet();

    // Extract addresses
    const WETH_ADDRESS = deploymentData.wethAddress;
    const FACTORY_ADDRESS = deploymentData.factoryAddress;
    const POSITION_MANAGER_ADDRESS = deploymentData.positionManagerAddress;
    const ROUTER_ADDRESS = deploymentData.routerAddress;
    const POSITION_DESCRIPTOR_ADDRESS = deploymentData.positionDescriptorAddress;

    console.log('Contract Addresses:');
    console.log(`- WQAI (WETH9): ${WETH_ADDRESS}`);
    console.log(`- Factory: ${FACTORY_ADDRESS}`);
    console.log(`- Position Manager: ${POSITION_MANAGER_ADDRESS}`);
    console.log(`- Router: ${ROUTER_ADDRESS}`);
    console.log(`- Position Descriptor: ${POSITION_DESCRIPTOR_ADDRESS}`);

    // Step 1: Verify WQAI contract itself
    console.log('\n1. Verifying WQAI Contract:');
    try {
        const wqai = new quais.Contract(WETH_ADDRESS, WETH9ABI, wallet);
        const name = await wqai.name();
        const symbol = await wqai.symbol();
        const decimals = await wqai.decimals();

        console.log(`- Name: ${name}`);
        console.log(`- Symbol: ${symbol}`);
        console.log(`- Decimals: ${decimals}`);

        if (name !== 'Wrapped QUAI' || symbol !== 'WQAI') {
            console.error(`⚠️ WARNING: WQAI contract does not have the expected name/symbol!`);
        } else {
            console.log(`✅ WQAI contract has correct name and symbol`);
        }
    } catch (error) {
        console.error(`❌ Error accessing WQAI contract at ${WETH_ADDRESS}:`, error.message);
    }

    // Step 2: Verify Position Manager's WETH9 address
    console.log('\n2. Verifying Position Manager Configuration:');
    try {
        const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);
        const pmWeth = await positionManager.WETH9();

        console.log(`- Position Manager's WETH9: ${pmWeth}`);
        if (pmWeth.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
            console.error(`❌ CRITICAL ERROR: Position Manager's WETH9 (${pmWeth}) does not match deployment WQAI (${WETH_ADDRESS})`);
        } else {
            console.log(`✅ Position Manager has correct WETH9 address`);
        }

        // Also check factory address
        const pmFactory = await positionManager.factory();
        console.log(`- Position Manager's Factory: ${pmFactory}`);
        if (pmFactory.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
            console.error(`❌ ERROR: Position Manager's Factory (${pmFactory}) does not match deployment Factory (${FACTORY_ADDRESS})`);
        } else {
            console.log(`✅ Position Manager has correct Factory address`);
        }
    } catch (error) {
        console.error(`❌ Error verifying Position Manager:`, error.message);
    }

    // Step 3: Verify Router's WETH9 address
    console.log('\n3. Verifying Router Configuration:');
    try {
        const router = new quais.Contract(ROUTER_ADDRESS, SwapRouterABI, wallet);
        const routerWeth = await router.WETH9();

        console.log(`- Router's WETH9: ${routerWeth}`);
        if (routerWeth.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
            console.error(`❌ CRITICAL ERROR: Router's WETH9 (${routerWeth}) does not match deployment WQAI (${WETH_ADDRESS})`);
        } else {
            console.log(`✅ Router has correct WETH9 address`);
        }

        // Also check factory address
        const routerFactory = await router.factory();
        console.log(`- Router's Factory: ${routerFactory}`);
        if (routerFactory.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) {
            console.error(`❌ ERROR: Router's Factory (${routerFactory}) does not match deployment Factory (${FACTORY_ADDRESS})`);
        } else {
            console.log(`✅ Router has correct Factory address`);
        }
    } catch (error) {
        console.error(`❌ Error verifying Router:`, error.message);
    }

    // Step 4: Verify Position Descriptor's WETH9 address
    console.log('\n4. Verifying Position Descriptor Configuration:');
    try {
        const positionDescriptor = new quais.Contract(POSITION_DESCRIPTOR_ADDRESS, NonfungibleTokenPositionDescriptorABI, wallet);
        const descriptorWeth = await positionDescriptor.WETH9();

        console.log(`- Position Descriptor's WETH9: ${descriptorWeth}`);
        if (descriptorWeth.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
            console.error(`❌ CRITICAL ERROR: Position Descriptor's WETH9 (${descriptorWeth}) does not match deployment WQAI (${WETH_ADDRESS})`);
        } else {
            console.log(`✅ Position Descriptor has correct WETH9 address`);
        }

        // Verify the native currency label
        // This may be formatted as bytes32 so we'll need to decode it
        try {
            const nativeCurrencyLabel = await positionDescriptor.nativeCurrencyLabel();
            let decodedLabel;

            // Try to decode the bytes32 to string
            try {
                // Remove trailing zeros
                const hexString = nativeCurrencyLabel.replace(/0+$/, '');
                // Convert hex to string
                decodedLabel = quais.toUtf8String(hexString);
            } catch (e) {
                decodedLabel = nativeCurrencyLabel;
            }

            console.log(`- Native Currency Label: ${decodedLabel}`);
            if (decodedLabel !== 'QUAI') {
                console.warn(`⚠️ WARNING: Native currency label is not 'QUAI': ${decodedLabel}`);
            } else {
                console.log(`✅ Position Descriptor has correct native currency label`);
            }
        } catch (error) {
            console.error(`❌ Error checking native currency label:`, error.message);
        }
    } catch (error) {
        console.error(`❌ Error verifying Position Descriptor:`, error.message);
    }

    // Step 5: Test basic WQAI functionality
    console.log('\n5. Testing WQAI Functionality:');
    try {
        const wqai = new quais.Contract(WETH_ADDRESS, WETH9ABI, wallet);

        // Check initial balance
        const initialBalance = await wqai.balanceOf(wallet.address);
        console.log(`- Initial WQAI balance: ${quais.formatUnits(initialBalance, 18)} WQAI`);

        // Test deposit (wrap) a small amount of QUAI
        const smallAmount = quais.parseUnits("0.001", 18);
        console.log(`- Depositing ${quais.formatUnits(smallAmount, 18)} QUAI...`);

        const tx = await wqai.deposit({ value: smallAmount });
        console.log(`- Deposit transaction hash: ${tx.hash}`);

        // Wait for transaction
        const receipt = await tx.wait();
        console.log(`- Transaction confirmed: ${receipt.status === 1 ? 'success' : 'failed'}`);

        // Check new balance
        const newBalance = await wqai.balanceOf(wallet.address);
        console.log(`- Updated WQAI balance: ${quais.formatUnits(newBalance, 18)} WQAI`);

        // Check that balance increased correctly
        const expectedIncrease = quais.BigNumber.from(initialBalance).add(smallAmount);
        if (!newBalance.eq(expectedIncrease)) {
            console.error(`❌ ERROR: WQAI balance after deposit (${newBalance}) doesn't match expected balance (${expectedIncrease})`);
        } else {
            console.log(`✅ WQAI deposit successful`);
        }

        // Withdraw the same amount
        console.log(`- Withdrawing ${quais.formatUnits(smallAmount, 18)} WQAI...`);
        const withdrawTx = await wqai.withdraw(smallAmount);
        console.log(`- Withdraw transaction hash: ${withdrawTx.hash}`);

        // Wait for transaction
        const withdrawReceipt = await withdrawTx.wait();
        console.log(`- Withdraw transaction confirmed: ${withdrawReceipt.status === 1 ? 'success' : 'failed'}`);

        // Check final balance
        const finalBalance = await wqai.balanceOf(wallet.address);
        console.log(`- Final WQAI balance: ${quais.formatUnits(finalBalance, 18)} WQAI`);

        // Check that balance decreased correctly
        if (!quais.BigNumber.from(finalBalance).eq(initialBalance)) {
            console.error(`❌ ERROR: WQAI balance after withdraw (${finalBalance}) doesn't match initial balance (${initialBalance})`);
        } else {
            console.log(`✅ WQAI withdraw successful`);
        }
    } catch (error) {
        console.error(`❌ Error testing WQAI functionality:`, error.message);
    }

    console.log('\n===== VERIFICATION SUMMARY =====');
    console.log('If all checks passed (indicated by ✅), the WQAI/WETH9 integration is correctly configured.');
    console.log('CRITICAL ERRORS (❌) must be fixed before using Uniswap V3.');
    console.log('WARNINGS (⚠️) should be investigated but may not prevent basic functionality.');
}

// Execute the verification
verifyWQAI()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
    }); 