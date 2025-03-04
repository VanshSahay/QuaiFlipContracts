// Simple script to check the bytecode size of QuaiUniswapV3FactoryBytecodeOnly

// Get the QuaiUniswapV3FactoryBytecodeOnly bytecode and abi
try {
    const UniswapV3FactoryArtifact = require('../../v3-core/artifacts/contracts/QuaiUniswapV3FactoryBytecodeOnly.sol/QuaiUniswapV3Factory.json');

    // Log bytecode size in bytes and kilobytes
    const bytecodeSize = (UniswapV3FactoryArtifact.bytecode.length - 2) / 2; // -2 for '0x', /2 because each byte is 2 hex chars
    console.log(`QuaiUniswapV3FactoryBytecodeOnly size: ${bytecodeSize} bytes (${(bytecodeSize / 1024).toFixed(2)} KB)`);

    // Check if it's within Ethereum limits
    if (bytecodeSize <= 24576) {
        console.log("✅ Contract is within EVM bytecode size limit (24KB)");
    } else {
        console.log(`❌ Contract exceeds EVM bytecode size limit by ${((bytecodeSize - 24576) / 1024).toFixed(2)} KB`);
    }
} catch (error) {
    console.error("Error loading artifacts:", error);
} 