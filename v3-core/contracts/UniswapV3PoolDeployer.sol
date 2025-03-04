// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.7.6;

import './interfaces/IUniswapV3PoolDeployer.sol';

// Interface for interacting with UniswapAddressGrinder
interface IUniswapAddressGrinder {
    function deployContract(
        bytes memory bytecode,
        bytes memory constructorArgs,
        bytes32 salt
    ) external returns (address deployedAddress);
}

import './UniswapV3Pool.sol';

contract UniswapV3PoolDeployer is IUniswapV3PoolDeployer {
    // Address of the UniswapAddressGrinder contract
    address public addressGrinder;

    // Function to set the address grinder contract
    function setAddressGrinder(address _addressGrinder) external {
        require(_addressGrinder != address(0), 'UniswapV3PoolDeployer: Address grinder cannot be zero address');
        addressGrinder = _addressGrinder;
    }

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
        require(addressGrinder != address(0), 'UniswapV3PoolDeployer: Address grinder not set');

        parameters = Parameters({factory: factory, token0: token0, token1: token1, fee: fee, tickSpacing: tickSpacing});

        // Calculate the original salt (similar to the original implementation)
        bytes32 originalSalt = keccak256(abi.encode(token0, token1, fee));

        // Get the creation bytecode for UniswapV3Pool
        bytes memory bytecode = type(UniswapV3Pool).creationCode;

        // Use the external UniswapAddressGrinder contract to deploy the pool
        // This completely delegates the deployment and grinding logic to the external contract
        pool = IUniswapAddressGrinder(addressGrinder).deployContract(
            bytecode,
            '', // No constructor args for UniswapV3Pool
            originalSalt
        );

        delete parameters;
    }
}
