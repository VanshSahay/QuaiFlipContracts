// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.6;

/// @title QuaiAddressFinder
/// @notice Library for finding addresses compatible with Quai Network's sharding architecture
library QuaiAddressFinder {
    /// @dev Find a salt value that will result in a contract address suitable for Quai Network sharding
    /// @param deployer The address of the contract deploying the new contract
    /// @param initCodeHash The hash of the init code for the contract to be deployed
    /// @param startingSalt The initial salt value to start searching from
    /// @return A salt value that will result in an address with the first byte 0x00 and second byte <= 127
    function findSaltForAddress(
        address deployer,
        bytes32 initCodeHash,
        bytes32 startingSalt
    ) internal pure returns (bytes32) {
        bytes32 salt = startingSalt;

        for (uint256 i = 0; i < 1000000; i++) {
            address computedAddress = computeAddress(deployer, salt, initCodeHash);

            // Check if the first byte is 0x00 and the second byte is <= 127
            // These conditions ensure the address is in the correct shard range for Quai Network
            if (uint8(uint160(computedAddress) >> 152) == 0x00 && uint8(uint160(computedAddress) >> 144) <= 127) {
                return salt;
            }
            // Increment the salt by adding 1 (will wrap around if it exceeds 256-bit size)
            salt = bytes32(uint256(salt) + 1);
        }

        // Return 0 if no salt is found (although it will theoretically run until it finds one)
        return bytes32(0);
    }

    /// @dev Computes the address a contract will be deployed to using CREATE2
    /// @param deployer The address of the contract deploying the new contract
    /// @param salt The salt value to use in the CREATE2 operation
    /// @param initCodeHash The hash of the init code for the contract to be deployed
    /// @return The address the contract will be deployed to
    function computeAddress(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        // Calculate the address using the same formula as CREATE2
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff), // Fixed prefix used in CREATE2
                deployer,
                salt,
                initCodeHash
            )
        );

        // Convert the last 20 bytes of the hash to an address
        return address(uint160(uint256(hash)));
    }

    /// @notice Checks if an address is compatible with Quai Network's sharding requirements
    /// @param addr The address to check
    /// @return True if the address is compatible (first byte 0x00 and second byte <= 127)
    function isQuaiCompatibleAddress(address addr) internal pure returns (bool) {
        return uint8(uint160(addr) >> 152) == 0x00 && uint8(uint160(addr) >> 144) <= 127;
    }
}
