const quais = require('quais');
require('dotenv').config({ path: '../.env' });
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const deployUniswapAddressGrinder = require('./deployUniswapAddressGrinder');

async function testUniswapAddressGrinder() {
    console.log('Testing UniswapAddressGrinder contract deployment...');

    try {
        // Setup provider and wallet
        const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true });
        const wallet = new quais.Wallet(hre.network.config.accounts[0], provider);
        console.log(`Using wallet: ${wallet.address}`);
        console.log(`Wallet balance: ${quais.formatUnits(await provider.getBalance(wallet.address), 18)} QAI`);

        // 1. Deploy UniswapAddressGrinder
        console.log('\n1. Deploying UniswapAddressGrinder contract...');
        const uniswapAddressGrinderAddress = await deployUniswapAddressGrinder();

        // Load the contract
        const uniswapAddressGrinderArtifact = require('../artifacts/contracts/UniswapAddressGrinder.sol/UniswapAddressGrinder.json');
        const uniswapAddressGrinder = new quais.Contract(
            uniswapAddressGrinderAddress,
            uniswapAddressGrinderArtifact.abi,
            wallet
        );
        console.log(`UniswapAddressGrinder deployed at: ${uniswapAddressGrinderAddress}`);

        // 2. Test deploying a simple test contract
        console.log('\n2. Deploying a simple test contract via UniswapAddressGrinder...');

        // Get TestToken artifact
        const TestTokenArtifact = require('../artifacts/contracts/TestToken.sol/TestToken.json');

        // Prepare constructor args
        const name = "TestToken";
        const symbol = "TEST";
        const initialSupply = quais.parseUnits("1000000", 18);

        // Use quais.AbiCoder for encoding
        const abiCoder = new quais.AbiCoder();
        const constructorArgs = abiCoder.encode(
            ['string', 'string', 'uint256'],
            [name, symbol, initialSupply]
        );

        // Generate a salt
        const salt = quais.keccak256(quais.toUtf8Bytes(`TEST_TOKEN_SALT_${Date.now()}`));

        // Deploy using UniswapAddressGrinder
        console.log('Deploying test token...');
        const tx = await uniswapAddressGrinder["deployContract(bytes,bytes,bytes32,uint256)"](
            TestTokenArtifact.bytecode,
            constructorArgs,
            salt,
            { gasLimit: 5000000 }
        );

        console.log(`Transaction hash: ${tx.hash}`);
        const receipt = await tx.wait();

        // Check logs for deployment event
        let testTokenAddress;
        for (const log of receipt.logs) {
            try {
                const parsedLog = uniswapAddressGrinder.interface.parseLog(log);
                if (parsedLog.name === 'ContractDeployed') {
                    testTokenAddress = parsedLog.args.deployedAddress;
                    console.log(`Found ContractDeployed event with address: ${testTokenAddress}`);
                    break;
                }
            } catch (error) {
                // Not our event, skip
                continue;
            }
        }

        // If we didn't find the event, try to get address from logs
        if (!testTokenAddress) {
            console.log('Event not found, looking for deployed contract address in logs...');
            for (const log of receipt.logs) {
                if (log.address && log.address !== uniswapAddressGrinderAddress) {
                    testTokenAddress = log.address;
                    console.log(`Found potential test token address: ${testTokenAddress}`);
                    break;
                }
            }
        }

        if (!testTokenAddress) {
            throw new Error('Failed to find deployed test token address');
        }

        // 3. Verify the token address is Quai-compatible
        console.log('\n3. Verifying the token address is Quai-compatible...');
        const isCompatible = await uniswapAddressGrinder.isQuaiCompatibleAddress(testTokenAddress);
        console.log(`Contract reports address is Quai-compatible: ${isCompatible}`);

        const firstByte = parseInt(testTokenAddress.slice(2, 4), 16);
        const secondByte = parseInt(testTokenAddress.slice(4, 6), 16);

        if (firstByte === 0 && secondByte <= 127) {
            console.log(`✅ Test token address ${testTokenAddress} is in the correct Quai Network shard range!`);
        } else {
            console.log(`⚠️ Warning: Test token address ${testTokenAddress} is NOT in the correct Quai Network range.`);
            console.log(`First byte: ${firstByte} (should be 0), Second byte: ${secondByte} (should be ≤ 127)`);
        }

        // 4. Try to interact with the token
        console.log('\n4. Interacting with the deployed test token...');
        const testToken = new quais.Contract(
            testTokenAddress,
            TestTokenArtifact.abi,
            wallet
        );

        const tokenName = await testToken.name();
        const tokenSymbol = await testToken.symbol();
        const tokenSupply = await testToken.totalSupply();
        const ownerBalance = await testToken.balanceOf(wallet.address);

        console.log(`Token name: ${tokenName}`);
        console.log(`Token symbol: ${tokenSymbol}`);
        console.log(`Total supply: ${quais.formatUnits(tokenSupply, 18)}`);
        console.log(`Owner balance: ${quais.formatUnits(ownerBalance, 18)}`);

        console.log('\n✅ UniswapAddressGrinder test completed successfully!');
        return true;
    } catch (error) {
        console.error('Error testing UniswapAddressGrinder:', error);
        return false;
    }
}

// Run the test if script is executed directly
if (require.main === module) {
    testUniswapAddressGrinder()
        .then(success => {
            if (success) {
                console.log('Test completed successfully!');
                process.exit(0);
            } else {
                console.log('Test failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = testUniswapAddressGrinder; 