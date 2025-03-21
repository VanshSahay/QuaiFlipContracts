// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract TestTransfer {
  function testTransferFrom(address token, address from, address to, uint256 amount) external {
    IERC20(token).transferFrom(from, to, amount);
  }
}
