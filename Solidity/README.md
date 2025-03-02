# QuaiFlip
## Quai ModifiedUniswap v3 Deployment

The Modified Uniswap v3 deployment mainly includes:
- WETH9 (Wrapped ETH)
- UniswapV3Factory (Core contract)
- NonfungibleTokenPositionDescriptor
- NonfungiblePositionManager
- SwapRouter

We modified the Uniswap v3 contracts to support the Quai Network. We added CREATE support instead of CREATE2. This is because deterministic deployment is not supported on Quai Network due to sharding.

To deploy Modified Uniswap v3 to Quai Network, first compile the contracts and then run the deployment script:

first make sure you're in the right directory:

```shell
cd QuaiFlip/Contracts/Solidity
```

then compile the contracts:

```shell
# Compile the contracts
node scripts/compileUniswapV3.js

# Deploy all contracts
npx hardhat run scripts/deployUniswapV3Full.js --network cyprus1
```

To test the deployment, run the following script:

```shell
npx hardhat uniswap-two-tokens --network cyprus1 
```