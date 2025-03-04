// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

/// @title Interface for WETH9
interface IWETH9 {
  /// @notice Deposit ether to get wrapped ether
  function deposit() external payable;

  /// @notice Withdraw wrapped ether to get ether
  function withdraw(uint256) external;

  /// @notice ERC20 functions from IERC20
  function totalSupply() external view returns (uint256);
  function balanceOf(address account) external view returns (uint256);
  function transfer(address recipient, uint256 amount) external returns (bool);
  function allowance(address owner, address spender) external view returns (uint256);
  function approve(address spender, uint256 amount) external returns (bool);
  function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

  /// @notice ERC20 standard events
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}
