// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.7.6;

import '../interfaces/IUniswapV3PoolDeployer.sol';
import '../libraries/QuaiAddressFinder.sol';
import './MockTimeUniswapV3Pool.sol';

contract MockTimeUniswapV3PoolDeployer is IUniswapV3PoolDeployer {
    struct Parameters {
        address factory;
        address token0;
        address token1;
        uint24 fee;
        int24 tickSpacing;
    }

    Parameters public override parameters;

    event PoolDeployed(address pool);

    function deploy(
        address factory,
        address token0,
        address token1,
        uint24 fee,
        int24 tickSpacing
    ) external returns (address pool) {
        parameters = Parameters({factory: factory, token0: token0, token1: token1, fee: fee, tickSpacing: tickSpacing});

        // Calculate the original salt (similar to the original implementation)
        bytes32 originalSalt = keccak256(abi.encodePacked(token0, token1, fee, tickSpacing));

        // Get init code hash for MockTimeUniswapV3Pool
        bytes32 initCodeHash = keccak256(type(MockTimeUniswapV3Pool).creationCode);

        // Find a salt that will result in an address with the correct format for Quai Network
        bytes32 qaiSalt = QuaiAddressFinder.findSaltForAddress(address(this), initCodeHash, originalSalt);

        // Use the found salt to deploy the pool with CREATE2
        bytes memory bytecode = type(MockTimeUniswapV3Pool).creationCode;
        assembly {
            pool := create2(0, add(bytecode, 32), mload(bytecode), qaiSalt)
        }

        emit PoolDeployed(pool);
        delete parameters;
    }
}
