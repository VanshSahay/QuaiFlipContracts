// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './interfaces/IUniswapV3PoolDeployer.sol';
import './libraries/QuaiAddressFinder.sol';
import './UniswapV3Pool.sol';

contract UniswapV3PoolDeployer is IUniswapV3PoolDeployer {
    struct Parameters {
        address factory;
        address token0;
        address token1;
        uint24 fee;
        int24 tickSpacing;
    }

    /// @inheritdoc IUniswapV3PoolDeployer
    Parameters public override parameters;

    /// @dev Deploys a pool with the given parameters by transiently setting the parameters storage slot and then
    /// clearing it after deploying the pool.
    /// @param factory The contract address of the Uniswap V3 factory
    /// @param token0 The first token of the pool by address sort order
    /// @param token1 The second token of the pool by address sort order
    /// @param fee The fee collected upon every swap in the pool, denominated in hundredths of a bip
    /// @param tickSpacing The spacing between usable ticks
    function deploy(
        address factory,
        address token0,
        address token1,
        uint24 fee,
        int24 tickSpacing
    ) internal returns (address pool) {
        parameters = Parameters({factory: factory, token0: token0, token1: token1, fee: fee, tickSpacing: tickSpacing});

        // Calculate the original salt (similar to the original implementation)
        bytes32 originalSalt = keccak256(abi.encode(token0, token1, fee));

        // Get init code hash for UniswapV3Pool
        bytes32 initCodeHash = keccak256(type(UniswapV3Pool).creationCode);

        // Find a salt that will result in an address with the correct format for Quai Network
        bytes32 qaiSalt = QuaiAddressFinder.findSaltForAddress(address(this), initCodeHash, originalSalt);

        // Use the found salt to deploy the pool with CREATE2
        bytes memory bytecode = type(UniswapV3Pool).creationCode;
        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), qaiSalt)
        }

        delete parameters;
    }
}
