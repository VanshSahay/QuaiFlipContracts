// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import './ERC20.sol';

/**
 * @title TestToken
 * @dev A simple ERC20 token for testing Uniswap v3 integration on Quai Network
 */
contract TestToken is ERC20 {
  /**
   * @dev Constructor that gives the msg.sender all of existing tokens.
   * @param name_ The name of the token
   * @param symbol_ The symbol of the token
   * @param initialSupply_ The initial token supply
   */
  constructor(string memory name_, string memory symbol_, uint256 initialSupply_) ERC20(name_, symbol_, initialSupply_) {
    // Initial supply is handled in the ERC20 constructor
  }
}
