# QuaiFlipContracts
## Uniswap V3 Modifications for Quai Network

This document outlines the modifications made to Uniswap V3 contracts to support deployment on Quai Network's sharded architecture.

### Overview

Quai Network has a unique sharded architecture that requires contracts to be deployed with specific address patterns to ensure they reside in the correct shard. Specifically, contract addresses must have:

- First byte = `0x00`
- Second byte ≤ `0x7F` (127 in decimal)

To achieve this, we've implemented "address grinding" in the contracts that use the CREATE2 opcode.

### Modified Files

#### v3-core/contracts/UniswapV3PoolDeployer.sol

- Added `findSaltForAddress` function to find a salt that results in a contract address with the required pattern
- Added `computeAddress` function to pre-compute what address would result from a given salt
- Modified the `deploy` function to use address grinding when creating pools

#### v3-core/contracts/test/MockTimeUniswapV3PoolDeployer.sol

- Similar modifications as the main deployer for consistency in tests

#### v3-periphery/contracts/libraries/PoolAddress.sol

- Added a helper function `isQuaiCompatibleAddress` to check if an address fits Quai Network's requirements
- Updated comments in `computeAddress` to warn that the actual address may be different due to address grinding

#### Solidity/scripts/uniswapExamples.js

- Updated the `createUniswapPool` function to add explanations about address grinding
- Added verification to check if deployed pool addresses are in the correct range for Quai Network

### How It Works

1. When deploying a pool, instead of using the standard salt (hash of tokens and fee), we:
   - Start with the standard salt
   - Calculate what address would result from using this salt
   - If the address doesn't match Quai Network requirements, increment the salt and try again
   - Continue until we find a salt that results in an address with the correct pattern
   - Use this salt with CREATE2 to deploy the contract

2. This ensures all deployed contracts have addresses compatible with Quai Network's sharding.

### Important Notes

- Address prediction in periphery contracts is approximate since the actual address depends on the ground salt
- For accurate pool addresses, always query the factory using `getPool(token0, token1, fee)`
- The grinding process can increase gas costs for deployment, but this only affects contract creation, not interactions

### Deployment & Testing

To deploy and test the modified Uniswap V3 contracts on Quai Network, follow these steps:

1. Ensure you are in the correct directory:
```shell
cd QuaiFlip/Contracts/Solidity
```
2. Compile the contracts:
```shell
# Compile the contracts
node scripts/compileUniswapV3.js
```
3. Deploy all contracts:
```shell
# Deploy all contracts
npx hardhat run scripts/deployUniswapV3Full.js --network cyprus1
```
4. Test the deployment:
```shell
npx hardhat uniswap-two-tokens --network cyprus1 
```