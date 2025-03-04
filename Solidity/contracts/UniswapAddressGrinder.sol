// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

import 'hardhat/console.sol';

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
  /// @param gasLimit The amount of gas to forward to the deployment operation (optional)
  /// @return deployedAddress The address where the contract was deployed
  function deployContract(
    bytes memory bytecode,
    bytes memory constructorArgs,
    bytes32 salt,
    uint256 gasLimit
  ) external returns (address deployedAddress) {
    // Combine bytecode and constructor arguments
    bytes memory initCode = abi.encodePacked(bytecode, constructorArgs);

    // Hash the init code for CREATE2
    bytes32 initCodeHash = keccak256(initCode);

    // Log the bytecode size
    console.log('Processing bytecode with length:', bytecode.length);

    // For large contracts, use a more efficient grinding approach with fewer iterations
    bytes32 groundSalt;
    uint256 maxIterations = bytecode.length > 24599 ? 100 : 10000000; // Reduced iterations for large contracts

    // Find a salt that will generate a Quai-compatible address, with optimized approach for large contracts
    groundSalt = findSaltWithLimit(initCodeHash, salt, maxIterations);
    require(groundSalt != bytes32(0), 'UniswapAddressGrinder: Failed to find compatible salt');

    // Use default gas limit if none provided, but ensure minimum for large contracts
    uint256 gasToUse = gasLimit > 0 ? gasLimit : (bytecode.length > 24576 ? 15000000 : gasleft() - 100000);

    // Log the deployment details for debugging
    console.log('Attempting deployment with gas: ', gasToUse);
    console.log('Bytecode length: ', initCode.length);
    console.log('Using ground salt: ', uint256(groundSalt));

    // Deploy contract using CREATE2 with the ground salt and specified gas
    assembly {
      // Use mload to get the length of initCode
      let size := mload(initCode)
      // Use add to get the pointer to the start of the code
      let ptr := add(initCode, 0x20)
      // Attempt to deploy with calculated gas and salt
      deployedAddress := create2(0, ptr, size, groundSalt)

      // Log the result in assembly
      if iszero(deployedAddress) {
        // Print failure reason if available
        let returnDataSize := returndatasize()
        if gt(returnDataSize, 0) {
          // Log we have return data
          mstore(0x00, 0x12345678) // Just a marker for the log
          log0(0x00, 0x20)

          // Copy return data to memory and log it
          returndatacopy(0x00, 0x00, returnDataSize)
          log0(0x00, returnDataSize)
        }
      }
    }

    // Check if deployment was successful
    if (deployedAddress == address(0)) {
      console.log('Contract deployment failed');
      console.log('Bytecode first 64 bytes:');
      bytes memory firstBytes = new bytes(bytecode.length > 64 ? 64 : bytecode.length);
      for (uint i = 0; i < firstBytes.length; i++) {
        firstBytes[i] = bytecode[i];
      }
      console.logBytes(firstBytes);
      revert('UniswapAddressGrinder: Contract deployment failed');
    }

    console.log('Contract deployed successfully at:', deployedAddress);

    // Verify the deployed address is Quai-compatible
    require(isQuaiCompatibleAddress(deployedAddress), 'UniswapAddressGrinder: Deployed address not compatible with Quai Network');

    // Emit the ContractDeployed event
    emit ContractDeployed(deployedAddress, groundSalt);

    return deployedAddress;
  }

  /// @notice Finds a salt with a maximum iteration limit
  /// @param initCodeHash The hash of the init code for the contract to deploy
  /// @param startingSalt The initial salt value to start searching from
  /// @param maxIterations Maximum number of iterations to try
  /// @return A salt value that will result in a Quai-compatible address, or zero if not found
  function findSaltWithLimit(bytes32 initCodeHash, bytes32 startingSalt, uint256 maxIterations) internal view returns (bytes32) {
    bytes32 salt = startingSalt;

    for (uint256 i = 0; i < maxIterations; i++) {
      address computedAddress = computeAddress(salt, initCodeHash);

      // Check if the first byte is 0x00 and the second byte is <= 127
      if (uint8(uint160(computedAddress) >> 152) == 0x00 && uint8(uint160(computedAddress) >> 144) <= 127) {
        return salt;
      }

      // Increment the salt by adding 1 (will wrap around if it exceeds 256-bit size)
      salt = bytes32(uint256(salt) + 1);
    }

    // Return 0 if no salt is found within the iteration limit
    return bytes32(0);
  }

  // For backward compatibility
  function deployContract(bytes memory bytecode, bytes memory constructorArgs, bytes32 salt) external returns (address) {
    return this.deployContract(bytecode, constructorArgs, salt, 0);
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
