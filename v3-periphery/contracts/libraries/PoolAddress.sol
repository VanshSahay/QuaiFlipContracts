// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/// @title Provides functions for deriving a pool address from the factory, tokens, and the fee
library PoolAddress {
    bytes32 internal constant POOL_INIT_CODE_HASH = 0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;

    /// @notice The identifying key of the pool
    struct PoolKey {
        address token0;
        address token1;
        uint24 fee;
    }

    /// @notice Returns PoolKey: the ordered tokens with the matched fee levels
    /// @param tokenA The first token of a pool, unsorted
    /// @param tokenB The second token of a pool, unsorted
    /// @param fee The fee level of the pool
    /// @return Poolkey The pool details with ordered token0 and token1 assignments
    function getPoolKey(address tokenA, address tokenB, uint24 fee) internal pure returns (PoolKey memory) {
        if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);
        return PoolKey({token0: tokenA, token1: tokenB, fee: fee});
    }

    /// @notice Helper function to check if an address fits Quai Network's sharding requirements
    /// @param addr The address to check
    /// @return True if the address has first byte as 0x00 and second byte <= 127
    function isQuaiCompatibleAddress(address addr) internal pure returns (bool) {
        return (uint8(uint160(addr) >> 152) == 0x00 && uint8(uint160(addr) >> 144) <= 127);
    }

    /// @notice Deterministically computes the pool address given the factory and PoolKey
    /// @param factory The Uniswap V3 factory contract address
    /// @param key The PoolKey
    /// @return pool The contract address of the V3 pool
    function computeAddress(address factory, PoolKey memory key) internal pure returns (address pool) {
        require(key.token0 < key.token1);

        // This is only a prediction of what the address would be
        // The actual deployment happens in the UniswapV3PoolDeployer with address grinding
        bytes32 salt = keccak256(abi.encode(key.token0, key.token1, key.fee));

        pool = address(uint160(uint256(keccak256(abi.encodePacked(hex'ff', factory, salt, POOL_INIT_CODE_HASH)))));

        // Warning: This is only an approximation - the actual address may be different
        // due to address grinding in the factory contract
        // If querying for a real pool, use IUniswapV3Factory(factory).getPool() instead
    }
}
