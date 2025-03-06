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
const UNISWAP_ADDRESS_GRINDER_ADDRESS = deploymentData.uniswapAddressGrinder || deploymentData.addressGrinder;
const WETH_ADDRESS = deploymentData.wethAddress;
const FACTORY_ADDRESS = deploymentData.factoryAddress;
const POSITION_MANAGER_ADDRESS = deploymentData.positionManagerAddress;
const ROUTER_ADDRESS = deploymentData.routerAddress;

// Debug log contract addresses
console.log("=== CONTRACT ADDRESSES ===");
console.log(`WETH_ADDRESS: ${WETH_ADDRESS}`);
console.log(`FACTORY_ADDRESS: ${FACTORY_ADDRESS}`);
console.log(`POSITION_MANAGER_ADDRESS: ${POSITION_MANAGER_ADDRESS}`);
console.log(`ROUTER_ADDRESS: ${ROUTER_ADDRESS}`);
console.log("========================");

// Load the full ABIs from the artifacts folders
const UniswapV3FactoryABI = require('../../v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json').abi;
const NonfungiblePositionManagerABI = require('../../v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json').abi;
const SwapRouterABI = require('../../v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json').abi;
const WETH9ABI = require('../artifacts/contracts/WETH9.sol/WETH9.json').abi;
const IUniswapV3PoolABI = require('../../v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json').abi;
// Load UniswapAddressGrinder ABI from Solidity/contracts directory
const UniswapAddressGrinderABI = require('../artifacts/contracts/UniswapAddressGrinder.sol/UniswapAddressGrinder.json').abi;

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

/**
 * Helper function to deploy a test token for examples using AddressGrinder
 */
async function deployTestToken(name = "Example Token", symbol = "EXTKN", initialSupply = "1000000") {
    console.log(`\n---- Helper: Deploying Test Token ${name} with Address Grinding ----`);
    const wallet = getWallet();

    // Token parameters - now configurable via parameters
    const initialSupplyParsed = quais.parseQuai(initialSupply);

    console.log(`Deploying test token with parameters:`);
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Initial Supply: ${quais.formatUnits(initialSupplyParsed, 18)}`);

    try {
        // Load the UniswapAddressGrinder from artifacts
        const uniswapAddressGrinderArtifact = require('../artifacts/contracts/UniswapAddressGrinder.sol/UniswapAddressGrinder.json');
        const uniswapAddressGrinder = new quais.Contract(UNISWAP_ADDRESS_GRINDER_ADDRESS, uniswapAddressGrinderArtifact.abi, wallet);
        console.log(`Using UniswapAddressGrinder at: ${UNISWAP_ADDRESS_GRINDER_ADDRESS}`);

        // Load the TestToken artifact
        const TestTokenArtifact = require('../artifacts/contracts/TestToken.sol/TestToken.json');

        // Prepare constructor arguments using AbiCoder
        const abiCoder = new quais.AbiCoder();
        const constructorArgs = abiCoder.encode(
            ['string', 'string', 'uint256'],
            [name, symbol, initialSupplyParsed]
        );

        // Use a random salt or one based on token name
        const salt = quais.keccak256(quais.toUtf8Bytes(`${name}_${symbol}_SALT_${Date.now()}`));

        console.log(`Deploying ${name} token using UniswapAddressGrinder...`);
        const tx = await uniswapAddressGrinder.deployContract(
            TestTokenArtifact.bytecode,
            constructorArgs,
            salt,
            { gasLimit: 5000000 } // Increased gas limit for grinding
        );

        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();

        // Extract the deployed address from the receipt
        const tokenAddress = await extractDeployedAddress(receipt, uniswapAddressGrinder);

        console.log(`Test token deployed at: ${tokenAddress}`);

        // Verify address is Quai compatible
        const firstByte = parseInt(tokenAddress.slice(2, 4), 16);
        const secondByte = parseInt(tokenAddress.slice(4, 6), 16);

        if (firstByte === 0 && secondByte <= 127) {
            console.log(`✅ Token address is in the correct Quai Network shard range!`);
        } else {
            console.log(`⚠️ Warning: Token address may not be in the correct Quai Network shard range.`);
            console.log(`First byte: ${firstByte} (should be 0), Second byte: ${secondByte} (should be ≤ 127)`);
        }

        return tokenAddress;
    } catch (error) {
        console.error('Error deploying test token:', error);
        throw error;
    }
}

/**
 * Debug function to trace ETH transfers in the transaction
 */
async function traceTransaction(txHash) {
    console.log(`\n---- Tracing Transaction: ${txHash} ----`);
    const provider = getProvider();

    try {
        // Get transaction details
        const tx = await provider.getTransaction(txHash);
        console.log(`Transaction from: ${tx.from}`);
        console.log(`Transaction to: ${tx.to}`);

        // Use formatUnits instead of formatEther since quais.formatEther is not a function
        // formatUnits with 18 decimals is equivalent to formatEther
        console.log(`Transaction value: ${quais.formatUnits(tx.value, 18)} ETH`);

        // Get transaction receipt to check status
        const receipt = await provider.getTransactionReceipt(txHash);
        console.log(`Transaction status: ${receipt.status ? 'Success' : 'Failed'}`);
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);

        // Check if there were any revert messages
        if (!receipt.status) {
            console.log("Transaction failed. Checking for revert message...");
            try {
                await provider.call(tx, tx.blockNumber);
            } catch (error) {
                console.log("Revert reason:", error.message);

                // Additional debug for the "Not WETH9" error
                if (error.message.includes("Not WETH9")) {
                    console.log("Found 'Not WETH9' error!");
                    console.log(`WETH_ADDRESS: ${WETH_ADDRESS}`);
                    console.log(`Transaction sender: ${tx.from}`);
                    console.log(`Transaction recipient: ${tx.to}`);
                    console.log("This error means the ETH is being sent to a contract from an address that's not the configured WETH9 address");
                }
            }
        }

        console.log(`---- End of Transaction Trace ----\n`);
        return receipt;
    } catch (error) {
        console.error("Error tracing transaction:", error.message);
        return null;
    }
}

/**
 * Example 1: Wrapping QAI to get WQAI
 * This is a prerequisite for interacting with Uniswap v3
 */
async function wrapQAI() {
    console.log('\n---- Example 1: Wrapping QAI ----');
    const wallet = getWallet();
    console.log(`Wallet address: ${wallet.address}`);

    // Create WETH contract instance using full ABI
    const weth = new quais.Contract(WETH_ADDRESS, WETH9ABI, wallet);
    console.log(`Using WETH contract at address: ${WETH_ADDRESS}`);

    // Check initial balance
    const initialBalance = await weth.balanceOf(wallet.address);
    console.log(`Initial WQAI balance: ${quais.formatUnits(initialBalance, 18)} WQAI`);

    // Amount to wrap (e.g., 1 QAI)
    const wrapAmount = quais.parseQuai("0.1");

    console.log(`Wrapping ${quais.formatUnits(wrapAmount, 18)} QAI...`);

    try {
        // Deposit native QAI to get WQAI
        const tx = await weth.deposit({ value: wrapAmount });
        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();

        // Trace the transaction
        await traceTransaction(tx.hash);

        const factory = new quais.Contract(FACTORY_ADDRESS, UniswapV3FactoryABI, wallet);
        const tickSpacing = await factory.feeAmountTickSpacing(3000);
        console.log(`Tick spacing for fee 3000: ${tickSpacing}`);

        // Check new balance
        const newBalance = await weth.balanceOf(wallet.address);
        console.log(`New WQAI balance: ${quais.formatUnits(newBalance, 18)} WQAI`);
        console.log(`Successfully wrapped ${quais.formatUnits(wrapAmount, 18)} QAI to WQAI!`);
    } catch (error) {
        console.error("Error wrapping QAI:", error);

        // If we have a transaction hash, trace it
        if (error.transaction) {
            await traceTransaction(error.transaction.hash);
        }
        throw error;
    }
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
    // Ensure WETH9 configuration is correct
    await ensureWETH9Configuration();

    console.log('\n---- Creating Uniswap V3 Pool ----');

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
    console.log(`Wallet address: ${wallet.address}`);

    // Create contract instances using full ABIs
    const factory = new quais.Contract(FACTORY_ADDRESS, UniswapV3FactoryABI, wallet);
    const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);

    console.log(`Factory contract address: ${FACTORY_ADDRESS}`);
    console.log(`Position Manager address: ${POSITION_MANAGER_ADDRESS}`);

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
        console.log(`Using token0: ${token0}, token1: ${token1}, fee: ${fee}, sqrtPriceX96: ${sqrtPriceX96}`);
        const tx = await positionManager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            fee,
            sqrtPriceX96,
            { gasLimit: 10000000 } // Increased from 5000000 to 10000000
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
        console.error(`Error creating pool: ${error}`);

        // Try to get more details about the error
        console.log("\nAdditional error details:");
        if (error.receipt) {
            console.log(`Gas used: ${error.receipt.gasUsed?.toString()}`);
            console.log(`Transaction status: ${error.receipt.status}`);
        }

        if (error.transaction) {
            console.log(`Transaction data: ${error.transaction.data}`);
        }

        if (error.reason) {
            console.log(`Error reason: ${error.reason}`);
        }

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
    console.log(`Wallet address: ${wallet.address}`);

    console.log(`Pool address: ${poolAddress}`);
    console.log(`token0: ${token0}, Is WETH: ${token0 === WETH_ADDRESS}`);
    console.log(`token1: ${token1}, Is WETH: ${token1 === WETH_ADDRESS}`);

    const token0Contract = new quais.Contract(token0, token0 === WETH_ADDRESS ? WETH9ABI : ERC20_ABI, wallet);
    const token1Contract = new quais.Contract(token1, token1 === WETH_ADDRESS ? WETH9ABI : ERC20_ABI, wallet);
    const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);
    const poolContract = new quais.Contract(poolAddress, IUniswapV3PoolABI, wallet);

    // Log the position manager address
    console.log(`Position Manager address: ${POSITION_MANAGER_ADDRESS}`);

    try {
        // Check if positionManager has WETH9 method
        if (typeof positionManager.WETH9 === 'function') {
            try {
                const pmWETH = await positionManager.WETH9();
                console.log(`Position Manager's WETH9 address: ${pmWETH}`);
                console.log(`Matches our WETH_ADDRESS: ${pmWETH === WETH_ADDRESS}`);

                // Critical error check
                if (pmWETH !== WETH_ADDRESS) {
                    console.error(`⚠️ CRITICAL: Position Manager's WETH9 (${pmWETH}) does not match our WETH_ADDRESS (${WETH_ADDRESS})`);
                    console.error("This will cause 'Not WETH9' errors when sending ETH");
                }
            } catch (error) {
                console.error("Error checking Position Manager's WETH9:", error.message);
            }
        }

        // Get token decimals
        const token0Decimals = await token0Contract.decimals();
        const token1Decimals = await token1Contract.decimals();
        console.log(`Token0 decimals: ${token0Decimals}, Token1 decimals: ${token1Decimals}`);

        // Approve tokens
        console.log('Approving tokens for PositionManager...');

        // Use max uint256 for approvals to ensure we don't run into allowance issues
        const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

        let tx = await token0Contract.approve(POSITION_MANAGER_ADDRESS, MAX_UINT256);
        console.log(`Token0 approval tx: ${tx.hash}`);
        await tx.wait();

        tx = await token1Contract.approve(POSITION_MANAGER_ADDRESS, MAX_UINT256);
        console.log(`Token1 approval tx: ${tx.hash}`);
        await tx.wait();

        // Calculate price range & liquidity amount
        // Fetch the current price from the pool
        const slot0 = await poolContract.slot0();
        const currentSqrtPrice = slot0.sqrtPriceX96;
        const currentTick = slot0.tick;
        console.log(`Current pool tick: ${currentTick}, Current sqrtPrice: ${currentSqrtPrice}`);

        // Get tick spacing
        const tickSpacing = await poolContract.tickSpacing();
        console.log(`Tick spacing: ${tickSpacing}`);

        // SIMPLIFIED APPROACH: Use a simple tick range around zero
        // This ensures we're not dealing with any conversion issues
        const lowerTick = BigInt(Number(tickSpacing) * -1);  // -1 tick spacing
        const upperTick = BigInt(Number(tickSpacing));       // +1 tick spacing

        console.log(`Using tick range: ${lowerTick} to ${upperTick} (with spacing ${tickSpacing})`);

        // Amount of tokens to add as liquidity
        const token0Amount = quais.parseQuai("0.01", token0Decimals);
        const token1Amount = quais.parseQuai("0.01", token1Decimals);
        console.log(`Adding ${quais.formatUnits(token0Amount, token0Decimals)} token0 and ${quais.formatUnits(token1Amount, token1Decimals)} token1 as liquidity`);

        // Add liquidity to pool using the position manager
        console.log('Adding liquidity to pool...');

        // Create parameters as explicit BigInt values to avoid any type conversion issues
        const mintParams = {
            token0: token0,
            token1: token1,
            fee: fee,
            tickLower: lowerTick,
            tickUpper: upperTick,
            amount0Desired: token0Amount,
            amount1Desired: token1Amount,
            amount0Min: BigInt(0),
            amount1Min: BigInt(0),
            recipient: wallet.address,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 10) // 10 minutes
        };

        console.log('Mint parameters:', JSON.stringify(mintParams, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        tx = await positionManager.mint(
            mintParams,
            {
                gasLimit: 12000000  // Increased gas limit
            }
        );

        console.log(`Add liquidity transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();

        // Trace the transaction to look for "Not WETH9" errors
        await traceTransaction(tx.hash);

        // Extract tokenId from events
        const mintedEvent = receipt.events.find(event => event.event === 'IncreaseLiquidity');
        if (mintedEvent) {
            const tokenId = mintedEvent.args.tokenId;
            console.log(`Successfully added liquidity! NFT position ID: ${tokenId}`);

            // Get position information
            const position = await positionManager.positions(tokenId);
            console.log(`Position details:
                Token0: ${position.token0}
                Token1: ${position.token1}
                Fee: ${position.fee}
                Tick Lower: ${position.tickLower}
                Tick Upper: ${position.tickUpper}
                Liquidity: ${position.liquidity}
            `);

            return {
                positionId: tokenId,
                token0,
                token1,
                fee
            };
        } else {
            console.log('Liquidity added, but could not find the IncreaseLiquidity event');
            return {
                token0,
                token1,
                fee
            };
        }
    } catch (error) {
        console.error("Error adding liquidity:", error);

        // Look for the "Not WETH9" error
        if (error.message && error.message.includes("Not WETH9")) {
            console.error("\n⚠️ DETECTED 'Not WETH9' ERROR! ⚠️");
            console.error("This error occurs when ETH is being sent to a Uniswap contract from an address that doesn't match the WETH9 address");
            console.error(`Our configured WETH_ADDRESS: ${WETH_ADDRESS}`);
            console.error("Check if the Position Manager or Router is using a different WETH9 address");
        }

        // If we have a transaction hash, trace it
        if (error.transaction) {
            await traceTransaction(error.transaction.hash);
        }
        throw error;
    }
}

/**
 * Example 4: Performing a swap
 */
async function performSwap(poolInfo) {
    console.log('\n---- Example 4: Swapping Tokens ----');
    console.log(poolInfo);

    const { poolAddress, token0, token1, fee } = poolInfo;
    const wallet = getWallet();
    console.log(`Wallet address: ${wallet.address}`);

    // Log router address being used
    console.log(`Router address: ${ROUTER_ADDRESS}`);
    console.log(`token0: ${token0}, Is WETH: ${token0 === WETH_ADDRESS}`);
    console.log(`token1: ${token1}, Is WETH: ${token1 === WETH_ADDRESS}`);

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
    const amount = "1"; // Amount to swap
    const amountIn = quais.parseQuai(amount);

    try {
        console.log(`Approving router to spend tokens...`);
        // Approve router to spend token0
        const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approveTx = await token0Contract.approve(ROUTER_ADDRESS, MAX_UINT256);
        await approveTx.wait();
        console.log(`Token0 approved for router`);

        console.log(`Swapping ${quais.formatUnits(amountIn, 18)} token0 for token1...`);

        // Exact input swap parameters
        const params = {
            tokenIn: token0,
            tokenOut: token1,
            fee: BigInt(fee),
            recipient: wallet.address,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 10), // 10 minutes
            amountIn: amountIn,
            amountOutMinimum: BigInt(0), // We're not setting a minimum output amount for this example
            sqrtPriceLimitX96: BigInt(0) // We're not setting a price limit for this example
        };

        console.log('Swap parameters:', JSON.stringify(params, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        // Execute the swap
        const tx = await router.exactInputSingle(
            params,
            { gasLimit: 10000000 }
        );

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
 * Ensures the WETH9 address is correctly set in Uniswap contracts
 * This should be called before any Uniswap operations
 */
async function ensureWETH9Configuration() {
    console.log('\n---- Checking WETH9 configuration before proceeding ----');
    const wallet = getWallet();

    let allChecksPass = true;

    // 1. Check WETH9 contract exists and is correct
    try {
        const weth = new quais.Contract(WETH_ADDRESS, WETH9ABI, wallet);
        const name = await weth.name();
        const symbol = await weth.symbol();

        console.log(`WETH9 contract name: ${name}, symbol: ${symbol}`);

        // Validate the expected name/symbol for Quai
        if ((name !== 'Wrapped QUAI' && name !== 'Wrapped Ether') ||
            (symbol !== 'WQAI' && symbol !== 'WETH')) {
            console.warn(`⚠️ Warning: WETH9 contract has unexpected name/symbol`);
        }
    } catch (error) {
        console.error(`❌ Error: Cannot access WETH9 at ${WETH_ADDRESS}: ${error.message}`);
        allChecksPass = false;
    }

    // 2. Check Position Manager's WETH9
    try {
        const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);
        if (typeof positionManager.WETH9 === 'function') {
            const pmWETH = await positionManager.WETH9();
            console.log(`Position Manager's WETH9: ${pmWETH}`);

            if (pmWETH.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
                console.error(`❌ CRITICAL: Position Manager's WETH9 (${pmWETH}) doesn't match configured WETH (${WETH_ADDRESS})`);
                allChecksPass = false;
            }
        }
    } catch (error) {
        console.error(`❌ Error checking Position Manager: ${error.message}`);
        allChecksPass = false;
    }

    // 3. Check Router's WETH9
    try {
        const router = new quais.Contract(ROUTER_ADDRESS, SwapRouterABI, wallet);
        if (typeof router.WETH9 === 'function') {
            const routerWETH = await router.WETH9();
            console.log(`Router's WETH9: ${routerWETH}`);

            if (routerWETH.toLowerCase() !== WETH_ADDRESS.toLowerCase()) {
                console.error(`❌ CRITICAL: Router's WETH9 (${routerWETH}) doesn't match configured WETH (${WETH_ADDRESS})`);
                allChecksPass = false;
            }
        }
    } catch (error) {
        console.error(`❌ Error checking Router: ${error.message}`);
        allChecksPass = false;
    }

    if (!allChecksPass) {
        throw new Error("WETH9 configuration check failed. Please run the verifyUniswapWETH.js script for more details.");
    }

    console.log('✅ WETH9 configuration looks good, proceeding with example...');
    return true;
}

/**
 * Debug function to verify WETH9 address in Uniswap contracts
 * This will help identify address mismatches
 */
async function verifyWETH9AddressConfiguration() {
    console.log('\n---- WETH9 Address Configuration Verification ----');
    const wallet = getWallet();

    // Check what address is configured in our script
    console.log(`WETH_ADDRESS from deployment data: ${WETH_ADDRESS}`);

    // Verify this is a valid contract by checking its name
    try {
        const weth = new quais.Contract(WETH_ADDRESS, WETH9ABI, wallet);
        const name = await weth.name();
        const symbol = await weth.symbol();
        console.log(`WETH contract name: ${name}, symbol: ${symbol}`);
    } catch (error) {
        console.error(`Error accessing WETH contract at ${WETH_ADDRESS}:`, error.message);
    }

    // Check what WETH address is configured in the factory
    try {
        const factory = new quais.Contract(FACTORY_ADDRESS, UniswapV3FactoryABI, wallet);
        console.log(`Factory contract address: ${FACTORY_ADDRESS}`);
    } catch (error) {
        console.error(`Error accessing Factory contract at ${FACTORY_ADDRESS}:`, error.message);
    }

    // Check what WETH address is configured in position manager
    try {
        const positionManager = new quais.Contract(POSITION_MANAGER_ADDRESS, NonfungiblePositionManagerABI, wallet);
        console.log(`Position Manager contract address: ${POSITION_MANAGER_ADDRESS}`);
        // Try to get WETH9 from position manager if it has a method to access it
        if (positionManager.WETH9) {
            const pmWETH = await positionManager.WETH9();
            console.log(`Position Manager's WETH9 address: ${pmWETH}`);
            console.log(`Matches our WETH_ADDRESS: ${pmWETH === WETH_ADDRESS}`);
        }
    } catch (error) {
        console.error(`Error accessing Position Manager contract at ${POSITION_MANAGER_ADDRESS}:`, error.message);
    }

    // Check what WETH address is configured in the router
    try {
        const router = new quais.Contract(ROUTER_ADDRESS, SwapRouterABI, wallet);
        console.log(`Router contract address: ${ROUTER_ADDRESS}`);
        // Try to get WETH9 from router if it has a method to access it
        if (router.WETH9) {
            const routerWETH = await router.WETH9();
            console.log(`Router's WETH9 address: ${routerWETH}`);
            console.log(`Matches our WETH_ADDRESS: ${routerWETH === WETH_ADDRESS}`);
        }
    } catch (error) {
        console.error(`Error accessing Router contract at ${ROUTER_ADDRESS}:`, error.message);
    }

    console.log('---- End of WETH9 Address Verification ----\n');
}

/**
 * Complete workflow demo for QuaiFlip
 */
async function runCompleteWorkflow() {
    console.log('\n===== QuaiFlip Complete Uniswap V3 Workflow Demo =====');

    // Verify WETH9 configuration before proceeding
    await verifyWETH9AddressConfiguration();

    // 1. First wrap some QAI
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