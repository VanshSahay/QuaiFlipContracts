const quais = require('quais');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });
const hre = require('hardhat');
const BN = require('bn.js');

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

// Load the full ABIs from the artifacts folders
const UniswapV3FactoryABI = require('../../v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json').abi;
const NonfungiblePositionManagerABI = require('../../v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json').abi;
const SwapRouterABI = require('../../v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json').abi;
const WETH9ABI = require('../artifacts/contracts/WETH9.sol/WETH9.json').abi;
const IUniswapV3PoolABI = require('../../v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json').abi;

// Basic ERC20 ABI for tokens that might not have a full ABI available
const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

// Setup provider and wallet
function getProvider() {
    return new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true });
}

function getWallet() {
    const provider = getProvider();
    return new quais.Wallet(hre.network.config.accounts[0], provider);
}

/**
 * Helper function to deploy a test token for examples
 */
async function deployTestToken(name = "Example Token", symbol = "EXTKN", initialSupply = "1000000") {
    console.log(`\n---- Helper: Deploying Test Token ${name} ----`);
    const wallet = getWallet();

    // Token parameters - now configurable via parameters
    const initialSupplyParsed = quais.parseUnits(initialSupply, 18); // 1 million tokens

    console.log(`Deploying test token with parameters:`);
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Initial Supply: ${quais.formatUnits(initialSupplyParsed, 18)}`);

    try {
        // Generate a mock IPFS hash for metadata (required by Quai Network)
        const mockIpfsHash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
        console.log(`Using mock IPFS hash for metadata: ${mockIpfsHash}`);

        // Load the TestToken artifact
        const TestTokenArtifact = require('../artifacts/contracts/TestToken.sol/TestToken.json');

        // Create the factory
        const TestTokenFactory = new quais.ContractFactory(
            TestTokenArtifact.abi,
            TestTokenArtifact.bytecode,
            wallet,
            mockIpfsHash // Pass the IPFS hash directly here
        );

        // Deploy the token
        const token = await TestTokenFactory.deploy(name, symbol, initialSupplyParsed);
        console.log(`Transaction hash: ${token.deploymentTransaction().hash}`);

        await token.waitForDeployment();
        const tokenAddress = await token.getAddress();

        console.log(`Test token deployed at: ${tokenAddress}`);
        return tokenAddress;
    } catch (error) {
        console.error('Error deploying test token:', error);
        throw error;
    }
}

/**
 * Example 1: Wrapping QAI to get WQAI
 * This is a prerequisite for interacting with Uniswap v3
 */
async function wrapQAI() {
    console.log('\n---- Example 1: Wrapping QAI ----');
    const wallet = getWallet();

    // Create WETH contract instance using full ABI
    const weth = new quais.Contract(WETH_ADDRESS, WETH9ABI, wallet);

    // Check initial balance
    const initialBalance = await weth.balanceOf(wallet.address);
    console.log(`Initial WQAI balance: ${quais.formatUnits(initialBalance, 18)} WQAI`);

    // Amount to wrap (e.g., 1 QAI)
    const wrapAmount = quais.parseUnits("0.1", 18);

    console.log(`Wrapping ${quais.formatUnits(wrapAmount, 18)} QAI...`);

    // Deposit native QAI to get WQAI
    const tx = await weth.deposit({ value: wrapAmount });
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();

    const factory = new quais.Contract(FACTORY_ADDRESS, UniswapV3FactoryABI, wallet);
    const tickSpacing = await factory.feeAmountTickSpacing(3000);
    console.log(`Tick spacing for fee 3000: ${tickSpacing}`);


    // Check new balance
    const newBalance = await weth.balanceOf(wallet.address);
    console.log(`New WQAI balance: ${quais.formatUnits(newBalance, 18)} WQAI`);
    console.log(`Successfully wrapped ${quais.formatUnits(wrapAmount, 18)} QAI to WQAI!`);
}

/**
 * Helper function to encode the square root price for Uniswap v3 pool initialization
 */
function encodePriceSqrt(reserve1, reserve0) {
    // For a 1:1 price ratio, return a specific value that works with Uniswap v3
    if (reserve1 === 1 && reserve0 === 1) {
        // 1 in Q64.96 format (1 * 2^96)
        return "79228162514264337593543950336";
    }

    // For other price ratios, convert to string for BN
    const reserve1Str = typeof reserve1 === 'string' ? reserve1 : reserve1.toString();
    const reserve0Str = typeof reserve0 === 'string' ? reserve0 : reserve0.toString();

    // Use BN.js for high precision math
    const bn = new BN(reserve1Str);
    const bd = new BN(reserve0Str);

    // Calculate price = sqrt(reserve1/reserve0) * 2^96
    // Note: This is a simplified version and may not be accurate for all price ranges
    // For complex math like sqrt, you might need a more sophisticated library
    let price = bn.mul(new BN(2).pow(new BN(96))).div(bd);

    try {
        // Approximate sqrt using a simple algorithm
        // For production, use a proper sqrt implementation
        let z = price.clone();
        let x = price.clone().div(new BN(2)).add(new BN(1));
        while (x.lt(z)) {
            z = x.clone();
            x = price.clone().div(x).add(x).div(new BN(2));
        }
        return z.toString();
    } catch (error) {
        console.error("Error calculating sqrt:", error);
        // Fallback to a reasonable default
        return "79228162514264337593543950336";
    }
}

/**
 * Example 2: Creating a new Uniswap v3 pool
 * Creates a pool between two ERC20 tokens
 */
async function createUniswapPool(token1Address, token2Address) {
    console.log('\n---- Example 2: Creating a Uniswap v3 Pool ----');

    // If only one token is provided, use WETH as the second token (for backward compatibility)
    if (!token1Address) {
        console.error('Error: At least one token address is required. Please deploy an ERC20 token first.');
        return;
    }

    // If second token is not provided, use WETH
    if (!token2Address) {
        token2Address = WETH_ADDRESS;
        console.log(`Using WETH (${WETH_ADDRESS}) as the second token`);
    }

    const wallet = getWallet();

    // Create contract instances using full ABIs
    const factory = new quais.Contract(FACTORY_ADDRESS, UniswapV3FactoryABI, wallet);
    const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);

    // Determine token order (Uniswap requires token0 < token1)
    let token0, token1;
    if (token1Address.toLowerCase() < token2Address.toLowerCase()) {
        token0 = token1Address;
        token1 = token2Address;
    } else {
        token0 = token2Address;
        token1 = token1Address;
    }

    // Fee tier (0.3% = 3000)
    const fee = 3000;

    // Check if pool already exists
    const existingPool = await factory.getPool(token0, token1, fee);
    if (existingPool !== '0x0000000000000000000000000000000000000000') {
        console.log(`Pool already exists at ${existingPool}`);
        return {
            poolAddress: existingPool,
            token0,
            token1,
            fee
        };
    }
    console.log(existingPool);

    console.log(`Creating new pool with tokens:`);
    console.log(`- Token0: ${token0}`);
    console.log(`- Token1: ${token1}`);
    console.log(`- Fee: ${fee / 10000}% (${fee})`);

    // Note about address grinding for Quai Network
    console.log(`\nNote: Due to Quai Network's sharding requirements, the actual pool address will be different`);
    console.log(`from a standard Ethereum CREATE2 prediction. The contract performs address grinding to ensure`);
    console.log(`the deployed contract is in the correct address range for the intended shard.`);

    // Create and initialize the pool
    // sqrtPriceX96 represents the initial price - here it's set to 1:1
    const sqrtPriceX96 = encodePriceSqrt(1, 1);

    try {
        console.log(`Creating and initializing pool...`);
        const tx = await positionManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            fee,
            sqrtPriceX96,
            { gasLimit: 5000000 }
        );

        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();

        // Get the actual pool address from the factory
        const poolAddress = await factory.getPool(token0, token1, fee);
        console.log(`Pool created successfully at: ${poolAddress}`);

        // Check if the address is in the correct Quai Network range
        const firstByte = parseInt(poolAddress.slice(2, 4), 16);
        const secondByte = parseInt(poolAddress.slice(4, 6), 16);

        if (firstByte === 0 && secondByte <= 127) {
            console.log(`✅ Pool address is in the correct Quai Network shard range!`);
        } else {
            console.log(`⚠️ Warning: Pool address may not be in the correct Quai Network shard range.`);
            console.log(`First byte: ${firstByte} (should be 0), Second byte: ${secondByte} (should be ≤ 127)`);
        }

        return {
            poolAddress,
            token0,
            token1,
            fee
        };
    } catch (error) {
        console.error('Error creating pool:', error);
        throw error;
    }
}

/**
 * Example 3: Adding liquidity to a Uniswap v3 pool
 */
async function addLiquidity(poolInfo) {
    console.log('\n---- Example 3: Adding Liquidity to a Pool ----');
    console.log(poolInfo);

    const { poolAddress, token0, token1, fee } = poolInfo;
    const wallet = getWallet();

    const token0Contract = new quais.Contract(token0, token0 === WETH_ADDRESS ? WETH9ABI : ERC20_ABI, wallet);
    const token1Contract = new quais.Contract(token1, token1 === WETH_ADDRESS ? WETH9ABI : ERC20_ABI, wallet);
    const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);
    const poolContract = new quais.Contract(poolAddress, IUniswapV3PoolABI, wallet);

    // Check token decimals
    const token0Decimals = await token0Contract.decimals();
    const token1Decimals = await token1Contract.decimals();
    console.log(`Token0 decimals: ${token0Decimals}, Token1 decimals: ${token1Decimals}`);

    // Approve tokens
    console.log('Approving tokens for PositionManager...');
    let tx = await token0Contract.approve(POSITION_MANAGER_ADDRESS, quais.parseUnits("10000", token0Decimals));
    console.log(`Token0 approval tx: ${tx.hash}`);
    await tx.wait();
    tx = await token1Contract.approve(POSITION_MANAGER_ADDRESS, quais.parseUnits("10000", token1Decimals));
    console.log(`Token1 approval tx: ${tx.hash}`);
    await tx.wait();

    // Check pool state
    const slot0 = await poolContract.slot0();
    console.log(`Current tick: ${slot0.tick}, sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);

    // Use a narrower tick range
    const TICK_SPACING = 60;
    const tickLower = -60;
    const tickUpper = 60;

    // Use larger amounts
    const amount0Desired = quais.parseUnits("10000", token0Decimals);
    const amount1Desired = quais.parseUnits("10000", token1Decimals);
    const amount0Min = quais.parseUnits(
        (Number(quais.formatUnits(amount0Desired, token0Decimals)) * 0.95).toFixed(Number(token0Decimals)),
        token0Decimals
    );
    const amount1Min = quais.parseUnits(
        (Number(quais.formatUnits(amount1Desired, token1Decimals)) * 0.95).toFixed(Number(token1Decimals)),
        token1Decimals
    );

    console.log(`Adding liquidity: ${quais.formatUnits(amount0Desired, token0Decimals)} of Token0, ${quais.formatUnits(amount1Desired, token1Decimals)} of Token1`);
    console.log(`Tick range: ${tickLower} to ${tickUpper}`);

    const mintParams = {
        token0: token0,
        token1: token1,
        fee: fee,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20
    };

    try {
        console.log('Adding liquidity...');
        const tx = await positionManager.mint(mintParams, { gasLimit: 5000000 });
        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Liquidity added successfully!`);
        return receipt;
    } catch (error) {
        console.error('Error adding liquidity:', error.message, error.data);
        throw error;
    }
}

/**
 * Example 4: Performing a swap
 */
async function performSwap(poolInfo) {
    console.log('\n---- Example 4: Performing a Swap ----');

    if (!poolInfo || !poolInfo.token0 || !poolInfo.token1) {
        console.error('Error: Pool information is required.');
        return;
    }

    const wallet = getWallet();
    const { token0, token1, fee } = poolInfo;

    // Create contract instances with full ABIs
    const token0Contract = new quais.Contract(token0, token0 === WETH_ADDRESS ? WETH9ABI : ERC20_ABI, wallet);
    const token1Contract = new quais.Contract(token1, token1 === WETH_ADDRESS ? WETH9ABI : ERC20_ABI, wallet);
    const router = new quais.Contract(ROUTER_ADDRESS, SwapRouterABI, wallet);

    // Check balances before swap
    const token0BalanceBefore = await token0Contract.balanceOf(wallet.address);
    const token1BalanceBefore = await token1Contract.balanceOf(wallet.address);

    console.log(`Balances before swap:`);
    console.log(`- Token0: ${quais.formatUnits(token0BalanceBefore, 18)}`);
    console.log(`- Token1: ${quais.formatUnits(token1BalanceBefore, 18)}`);

    // Define swap parameters
    // In this example, we'll swap token0 for token1
    const amountIn = quais.parseUnits("1", 18); // 1 token

    // Approve the router to spend tokens
    console.log('Approving Router to spend tokens...');
    const tx = await token0Contract.approve(ROUTER_ADDRESS, amountIn);
    console.log(`Approval tx: ${tx.hash}`);
    await tx.wait();

    // Prepare the exactInputSingle parameters
    const params = {
        tokenIn: token0,
        tokenOut: token1,
        fee: fee,
        recipient: wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from now
        amountIn: amountIn,
        amountOutMinimum: 0, // In production, set a minimum to prevent slippage
        sqrtPriceLimitX96: 0 // 0 means no price limit
    };

    try {
        console.log(`Swapping ${quais.formatUnits(amountIn, 18)} of token0 for token1...`);
        const tx = await router.exactInputSingle(params);
        console.log(`Transaction hash: ${tx.hash}`);

        await tx.wait();
        console.log(`Swap executed successfully!`);

        // Check balances after swap
        const token0BalanceAfter = await token0Contract.balanceOf(wallet.address);
        const token1BalanceAfter = await token1Contract.balanceOf(wallet.address);

        console.log(`Balances after swap:`);
        console.log(`- Token0: ${quais.formatUnits(token0BalanceAfter, 18)} (${quais.formatUnits(token0BalanceAfter.sub(token0BalanceBefore), 18)} change)`);
        console.log(`- Token1: ${quais.formatUnits(token1BalanceAfter, 18)} (${quais.formatUnits(token1BalanceAfter.sub(token1BalanceBefore), 18)} change)`);

        return {
            amountIn,
            token0BalanceBefore,
            token0BalanceAfter,
            token1BalanceBefore,
            token1BalanceAfter
        };
    } catch (error) {
        console.error('Error performing swap:', error);
        throw error;
    }
}

/**
 * Run all examples in a complete workflow
 */
async function runCompleteWorkflow() {
    try {
        console.log('\n==== RUNNING COMPLETE UNISWAP V3 WORKFLOW ====');

        // 1. First, wrap QAI to get WQAI
        await wrapQAI();

        // 2. Deploy a test token
        const testTokenAddress = await deployTestToken();

        // 3. Create a pool with the test token
        const poolInfo = await createUniswapPool(testTokenAddress);

        // 4. Add liquidity to the pool
        await addLiquidity(poolInfo);

        // 5. Perform a swap
        await performSwap(poolInfo);

        console.log('\n==== WORKFLOW COMPLETED SUCCESSFULLY ====');
    } catch (error) {
        console.error('Error running complete workflow:', error);
    }
}

/**
 * Run all examples in a complete workflow with two custom tokens
 */
async function runCompleteWorkflowWithTwoTokens() {
    try {
        console.log('\n==== RUNNING COMPLETE UNISWAP V3 WORKFLOW WITH TWO CUSTOM TOKENS ====');

        // 1. Deploy two test tokens
        console.log('\n1. Deploying two test tokens...');
        const token1Address = await deployTestToken("Token A", "TKNA", "1000000");
        const token2Address = await deployTestToken("Token B", "TKNB", "1000000");

        // 2. Create a pool with the two test tokens
        console.log('\n2. Creating a pool between the two tokens...');
        const poolInfo = await createUniswapPool(token1Address, token2Address);

        // 3. Add liquidity to the pool
        console.log('\n3. Adding liquidity to the pool...');
        await addLiquidity(poolInfo);

        // 4. Perform a swap
        console.log('\n4. Performing a swap between tokens...');
        await performSwap(poolInfo);

        console.log('\n==== WORKFLOW COMPLETED SUCCESSFULLY ====');
    } catch (error) {
        console.error('Error running complete workflow with two tokens:', error);
    }
}

// Export all examples
module.exports = {
    wrapQAI,
    deployTestToken,
    createUniswapPool,
    addLiquidity,
    performSwap,
    runCompleteWorkflow,
    runCompleteWorkflowWithTwoTokens
};

// If script is run directly, run all examples
if (require.main === module) {
    (async () => {
        try {
            // Check if we should run the complete workflow
            // In Hardhat, we can't directly access positional arguments after the script
            // Use an environment variable or check for a marker file
            const workflowType = process.env.WORKFLOW_TYPE || '';

            if (workflowType.toLowerCase() === 'twotokens') {
                await runCompleteWorkflowWithTwoTokens();
            } else if (workflowType.toLowerCase() === 'complete') {
                await runCompleteWorkflow();
            } else {
                // 1. Wrap QAI to get WQAI
                await wrapQAI();

                // Just show basic info for manual execution
                console.log('\nThere are multiple ways to run the examples:');
                console.log('\n1. Using Hardhat tasks (recommended):');
                console.log('npx hardhat uniswap-workflow --network cyprus1');
                console.log('npx hardhat uniswap-two-tokens --network cyprus1');

                console.log('\n2. Using environment variables:');
                console.log('WORKFLOW_TYPE=complete npx hardhat run Solidity/scripts/uniswapExamples.js --network cyprus1');
                console.log('WORKFLOW_TYPE=twotokens npx hardhat run Solidity/scripts/uniswapExamples.js --network cyprus1');

                console.log('\n3. Using individual functions in the Hardhat console:');
                console.log('npx hardhat console --network cyprus1');
                console.log('> const examples = require("./scripts/uniswapExamples.js")');
                console.log('> const token1 = await examples.deployTestToken("Token A", "TKNA", "1000000")');
                console.log('> const token2 = await examples.deployTestToken("Token B", "TKNB", "1000000")');
                console.log('> const poolInfo = await examples.createUniswapPool(token1, token2)');
                console.log('> await examples.addLiquidity(poolInfo)');
                console.log('> await examples.performSwap(poolInfo)');
            }
        } catch (error) {
            console.error('Error running examples:', error);
        }
    })();
} 