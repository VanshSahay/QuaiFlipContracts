// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.7.6;

import './QuaiAddressFinder.sol';

/// @title AddressGrinder
/// @notice Contract for grinding addresses for all contracts deployed in the EVM.
/// @dev This contract uses QuaiAddressFinder to ensure all deployed contracts meet Quai Network's sharding requirements.
contract AddressGrinder {
    /// @notice Emitted when a contract is deployed
    /// @param deployedAddress The address of the deployed contract
    /// @param salt The ground salt used for the deployment
    event ContractDeployed(address indexed deployedAddress, bytes32 salt);

    /// @notice Deploys a contract with an address compatible with Quai Network's sharding requirements.
    /// @param bytecode The bytecode of the contract to deploy.
    /// @param constructorArgs The ABI-encoded constructor arguments for the contract.
    /// @param salt The initial salt value for the CREATE2 operation.
    /// @return deployedAddress The address where the contract was deployed.
    function deployContract(
        bytes memory bytecode,
        bytes memory constructorArgs,
        bytes32 salt
    ) external returns (address deployedAddress) {
        // Combine bytecode and constructor arguments
        bytes memory initCode = abi.encodePacked(bytecode, constructorArgs);

        // Hash the init code for CREATE2
        bytes32 initCodeHash = keccak256(initCode);

        // Find a salt that will generate a Quai-compatible address
        bytes32 groundSalt = QuaiAddressFinder.findSaltForAddress(address(this), initCodeHash, salt);

        // Deploy contract using CREATE2 with the ground salt
        assembly {
            deployedAddress := create2(0, add(initCode, 0x20), mload(initCode), groundSalt)
        }

        // Check if deployment was successful
        require(deployedAddress != address(0), 'AddressGrinder: Contract deployment failed');

        // Verify the deployed address is Quai-compatible
        require(
            QuaiAddressFinder.isQuaiCompatibleAddress(deployedAddress),
            'AddressGrinder: Deployed address not compatible with Quai Network'
        );

        // Emit the ContractDeployed event
        emit ContractDeployed(deployedAddress, groundSalt);

        return deployedAddress;
    }

    /// @notice Predicts the address where a contract will be deployed using our address grinding approach.
    /// @param bytecode The bytecode of the contract to deploy.
    /// @param constructorArgs The ABI-encoded constructor arguments for the contract.
    /// @param salt The initial salt value for the CREATE2 operation.
    /// @return predictedAddress The predicted address where the contract will be deployed.
    function predictDeploymentAddress(
        bytes memory bytecode,
        bytes memory constructorArgs,
        bytes32 salt
    ) external view returns (address predictedAddress) {
        // Combine bytecode and constructor arguments
        bytes memory initCode = abi.encodePacked(bytecode, constructorArgs);

        // Hash the init code for CREATE2
        bytes32 initCodeHash = keccak256(initCode);

        // Find a salt that will generate a Quai-compatible address
        bytes32 groundSalt = QuaiAddressFinder.findSaltForAddress(address(this), initCodeHash, salt);

        // Predict the deployment address
        predictedAddress = QuaiAddressFinder.computeAddress(address(this), groundSalt, initCodeHash);

        return predictedAddress;
    }

    /// @notice Checks if an address is compatible with Quai Network's sharding requirements.
    /// @param addr The address to check.
    /// @return True if the address is compatible with Quai Network sharding.
    function isQuaiCompatible(address addr) external pure returns (bool) {
        return QuaiAddressFinder.isQuaiCompatibleAddress(addr);
    }
}
