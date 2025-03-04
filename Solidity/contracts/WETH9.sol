// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import './interfaces/IWETH9.sol';

/**
 * @title WQAI (Wrapped QUAI)
 * @notice Wrapped version of QUAI that conforms to the WETH9 interface expected by Uniswap V3
 * @dev This implementation follows the WETH9 interface required by Uniswap V3
 */
contract WETH9 is IWETH9 {
  string public name = 'Wrapped QUAI';
  string public symbol = 'WQAI';
  uint8 public decimals = 18;

  // Events already declared in the interface
  // event Approval(address indexed owner, address indexed spender, uint256 value);
  // event Transfer(address indexed from, address indexed to, uint256 value);

  // Custom events for WETH9-specific operations
  event Deposit(address indexed dst, uint256 amount);
  event Withdrawal(address indexed src, uint256 amount);

  mapping(address => uint256) public override balanceOf;
  mapping(address => mapping(address => uint256)) public override allowance;
  uint256 private _totalSupply;

  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  function deposit() public payable override {
    balanceOf[msg.sender] += msg.value;
    _totalSupply += msg.value;
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) public override {
    require(balanceOf[msg.sender] >= amount, 'WQAI: insufficient balance');
    balanceOf[msg.sender] -= amount;
    _totalSupply -= amount;

    // CRITICAL: Use call instead of transfer to make sure 'msg.sender' context
    // is preserved when ETH is sent. This ensures our contract is identified
    // as the sender in contracts like PeripheryPayments which have a
    // 'require(msg.sender == WETH9)' check.
    //
    // The .call pattern is the recommended way to send ETH in modern Solidity
    (bool success, ) = msg.sender.call{ value: amount }('');
    require(success, 'WQAI: ETH transfer failed');

    emit Withdrawal(msg.sender, amount);
  }

  function approve(address spender, uint256 amount) public override returns (bool) {
    allowance[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    return transferFrom(msg.sender, to, amount);
  }

  function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
    require(balanceOf[from] >= amount, 'WQAI: insufficient balance');
    if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
      require(allowance[from][msg.sender] >= amount, 'WQAI: insufficient allowance');
      allowance[from][msg.sender] -= amount;
    }
    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    emit Transfer(from, to, amount);
    return true;
  }

  receive() external payable {
    deposit();
  }
}
