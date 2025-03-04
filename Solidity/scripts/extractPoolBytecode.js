// Script to extract the bytecode from the compiled UniswapV3Pool contract

try {
    const UniswapV3PoolArtifact = require('../../v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json');

    // Get the bytecode and format it for inclusion in our factory
    const bytecode = UniswapV3PoolArtifact.bytecode;

    console.log('UniswapV3Pool bytecode:');
    console.log(bytecode);
    console.log(`\nBytecode length: ${bytecode.length} characters`);
    console.log(`Bytecode size: ${(bytecode.length - 2) / 2} bytes\n`);

    console.log('To use in the QuaiUniswapV3FactoryBytecodeOnly.sol contract, replace the placeholder with:');
    console.log(`hex"${bytecode.substring(2)}"`);
} catch (error) {
    console.error("Error loading artifacts:", error);
} 