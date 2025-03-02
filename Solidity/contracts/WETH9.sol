// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.20;

import './ERC20.sol';

/**
 * @title WETH9
 * @dev Wrapped Ether implementation for Quai Network
 * This contract allows users to wrap their native QAI into an ERC20 token
 * This is needed for DeFi protocols like Uniswap v3 that require ERC20 tokens
 */
contract WETH9 is ERC20 {
  event Deposit(address indexed dst, uint wad);
  event Withdrawal(address indexed src, uint wad);

  constructor() ERC20('Wrapped QAI', 'WQAI', 0) {}

  /**
   * @notice Deposit native token to get wrapped token
   */
  function deposit() public payable {
    _mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  /**
   * @notice Withdraw wrapped token to get native token
   * @param wad Amount to withdraw
   */
  function withdraw(uint wad) public {
    require(balanceOf(msg.sender) >= wad, 'WETH9: insufficient balance');
    // Use transfer to remove tokens from sender's balance
    _transfer(msg.sender, address(this), wad);
    // Send the equivalent amount of native tokens
    payable(msg.sender).transfer(wad);
    emit Withdrawal(msg.sender, wad);
  }

  // Allow receiving native token
  receive() external payable {
    deposit();
  }
}
