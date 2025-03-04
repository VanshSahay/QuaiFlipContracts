// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;

/// @title UniswapAddressGrinder
/// @notice Contract for deploying Uniswap contracts with addresses compatible with Quai Network's sharding requirements
/// @dev This contract has the grinding logic built-in rather than relying on external scripts
contract UniswapAddressGrinder {
  /// @notice Emitted when a contract is deployed
  /// @param deployedAddress The address of the deployed contract
  /// @param salt The ground salt used for the deployment
  event ContractDeployed(address indexed deployedAddress, bytes32 salt);

  /// @notice Finds a salt that will generate a Quai-compatible address
  /// @param initCodeHash The hash of the init code for the contract to deploy
  /// @param startingSalt The initial salt value to start searching from
  /// @return A salt value that will result in a Quai-compatible address
  function findSaltForAddress(bytes32 initCodeHash, bytes32 startingSalt) public view returns (bytes32) {
    bytes32 salt = startingSalt;

    for (uint256 i = 0; i < 10000000; i++) {
      address computedAddress = computeAddress(salt, initCodeHash);

      // Check if the first byte is 0x00 and the second byte is <= 127
      if (uint8(uint160(computedAddress) >> 152) == 0x00 && uint8(uint160(computedAddress) >> 144) <= 127) {
        return salt;
      }
      // Increment the salt by adding 1 (will wrap around if it exceeds 256-bit size)
      salt = bytes32(uint256(salt) + 1);
    }

    // Return 0 if no salt is found (although it will theoretically run until it finds one)
    return bytes32(0);
  }

  /// @notice Computes the address a contract will be deployed to using CREATE2
  /// @param salt The salt value to use in the CREATE2 operation
  /// @param initCodeHash The hash of the init code for the contract to be deployed
  /// @return The address the contract will be deployed to
  function computeAddress(bytes32 salt, bytes32 initCodeHash) public view returns (address) {
    // Calculate the address using the same formula as CREATE2
    bytes32 hash = keccak256(
      abi.encodePacked(
        bytes1(0xff), // Fixed prefix used in CREATE2
        address(this),
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
  function isQuaiCompatibleAddress(address addr) public pure returns (bool) {
    return uint8(uint160(addr) >> 152) == 0x00 && uint8(uint160(addr) >> 144) <= 127;
  }

  /// @notice Deploys a contract with an address compatible with Quai Network's sharding requirements
  /// @param bytecode The bytecode of the contract to deploy
  /// @param constructorArgs The ABI-encoded constructor arguments for the contract
  /// @param salt The initial salt value for the CREATE2 operation
  /// @return deployedAddress The address where the contract was deployed
  function deployContract(bytes memory bytecode, bytes memory constructorArgs, bytes32 salt) external returns (address deployedAddress) {
    // Combine bytecode and constructor arguments
    bytes memory initCode = abi.encodePacked(bytecode, constructorArgs);

    // Hash the init code for CREATE2
    bytes32 initCodeHash = keccak256(initCode);

    // Find a salt that will generate a Quai-compatible address
    bytes32 groundSalt = findSaltForAddress(initCodeHash, salt);

    // Deploy contract using CREATE2 with the ground salt
    assembly {
      deployedAddress := create2(0, add(initCode, 0x20), mload(initCode), groundSalt)
    }

    // Check if deployment was successful
    require(deployedAddress != address(0), 'UniswapAddressGrinder: Contract deployment failed');

    // Verify the deployed address is Quai-compatible
    require(isQuaiCompatibleAddress(deployedAddress), 'UniswapAddressGrinder: Deployed address not compatible with Quai Network');

    // Emit the ContractDeployed event
    emit ContractDeployed(deployedAddress, groundSalt);

    return deployedAddress;
  }

  /// @notice Predicts the address where a contract will be deployed
  /// @param bytecode The bytecode of the contract to deploy
  /// @param constructorArgs The ABI-encoded constructor arguments for the contract
  /// @param salt The initial salt value for the CREATE2 operation
  /// @return predictedAddress The predicted address where the contract will be deployed
  function predictDeploymentAddress(bytes memory bytecode, bytes memory constructorArgs, bytes32 salt) external view returns (address) {
    // Combine bytecode and constructor arguments
    bytes memory initCode = abi.encodePacked(bytecode, constructorArgs);

    // Hash the init code for CREATE2
    bytes32 initCodeHash = keccak256(initCode);

    // Find a salt that will generate a Quai-compatible address
    bytes32 groundSalt = findSaltForAddress(initCodeHash, salt);

    // Predict the deployment address
    return computeAddress(groundSalt, initCodeHash);
  }
}
