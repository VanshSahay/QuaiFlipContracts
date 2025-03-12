// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

/**
 * @title TestToken
 * @dev A standalone ERC20 token implementation for testing Uniswap v3 integration on Quai Network
 */
contract TestToken {
  // ERC20 standard events
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  // Token metadata
  string private _name;
  string private _symbol;
  uint8 private constant _decimals = 18;

  // Token state
  mapping(address => uint256) private _balances;
  mapping(address => mapping(address => uint256)) private _allowances;
  uint256 private _totalSupply;

  /**
   * @dev Constructor that gives the msg.sender all of the initial token supply.
   * @param name_ The name of the token
   * @param symbol_ The symbol of the token
   * @param initialSupply_ The initial token supply
   */
  constructor(string memory name_, string memory symbol_, uint256 initialSupply_, address owner) {
    _name = name_;
    _symbol = symbol_;
    _mint(owner, initialSupply_);
  }

  /**
   * @dev Returns the name of the token.
   */
  function name() public view returns (string memory) {
    return _name;
  }

  /**
   * @dev Returns the symbol of the token.
   */
  function symbol() public view returns (string memory) {
    return _symbol;
  }

  /**
   * @dev Returns the number of decimals used for token display.
   * Always returns 18 as this is the standard for ERC20 tokens.
   */
  function decimals() public pure returns (uint8) {
    return _decimals;
  }

  /**
   * @dev Returns the total supply of the token.
   */
  function totalSupply() public view returns (uint256) {
    return _totalSupply;
  }

  /**
   * @dev Returns the amount of tokens owned by the specified account.
   * @param account The address to query the balance of
   */
  function balanceOf(address account) public view returns (uint256) {
    return _balances[account];
  }

  /**
   * @dev Transfers tokens from the caller's account to the recipient.
   * @param recipient The address receiving the tokens
   * @param amount The amount of tokens to transfer
   */
  function transfer(address recipient, uint256 amount) public returns (bool) {
    _transfer(msg.sender, recipient, amount);
    return true;
  }

  /**
   * @dev Returns the remaining tokens that spender is allowed to spend on behalf of owner.
   * @param owner The address which owns the tokens
   * @param spender The address which will spend the tokens
   */
  function allowance(address owner, address spender) public view returns (uint256) {
    return _allowances[owner][spender];
  }

  /**
   * @dev Sets amount as the allowance of spender over the caller's tokens.
   * @param spender The address which will spend the tokens
   * @param amount The amount of tokens to allow spender to spend
   */
  function approve(address spender, uint256 amount) public returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  /**
   * @dev Transfers tokens from sender to recipient using the allowance mechanism.
   * amount is deducted from the caller's allowance.
   * @param sender The address sending the tokens
   * @param recipient The address receiving the tokens
   * @param amount The amount of tokens to transfer
   */
  function transferFrom(address sender, address recipient, uint256 amount) public returns (bool) {
    _transfer(sender, recipient, amount);

    uint256 currentAllowance = _allowances[sender][msg.sender];
    require(currentAllowance >= amount, 'ERC20: transfer amount exceeds allowance');
    unchecked {
      _approve(sender, msg.sender, currentAllowance - amount);
    }

    return true;
  }

  /**
   * @dev Atomically increases the allowance granted to spender by the caller.
   * @param spender The address which will spend the tokens
   * @param addedValue The amount of tokens to increase the allowance by
   */
  function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
    return true;
  }

  /**
   * @dev Atomically decreases the allowance granted to spender by the caller.
   * @param spender The address which will spend the tokens
   * @param subtractedValue The amount of tokens to decrease the allowance by
   */
  function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
    uint256 currentAllowance = _allowances[msg.sender][spender];
    require(currentAllowance >= subtractedValue, 'ERC20: decreased allowance below zero');
    unchecked {
      _approve(msg.sender, spender, currentAllowance - subtractedValue);
    }

    return true;
  }

  /**
   * @dev Internal function to move tokens from one account to another.
   * @param sender The address sending the tokens
   * @param recipient The address receiving the tokens
   * @param amount The amount of tokens to transfer
   */
  function _transfer(address sender, address recipient, uint256 amount) internal {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    uint256 senderBalance = _balances[sender];
    require(senderBalance >= amount, 'ERC20: transfer amount exceeds balance');
    unchecked {
      _balances[sender] = senderBalance - amount;
    }
    _balances[recipient] += amount;

    emit Transfer(sender, recipient, amount);
  }

  /**
   * @dev Internal function to mint new tokens and assign them to account.
   * @param account The address receiving the minted tokens
   * @param amount The amount of tokens to mint
   */
  function _mint(address account, uint256 amount) internal {
    require(account != address(0), 'ERC20: mint to the zero address');

    _totalSupply += amount;
    _balances[account] += amount;
    emit Transfer(address(0), account, amount);
  }

  /**
   * @dev Internal function to set the allowance of spender over owner's tokens.
   * @param owner The address which owns the tokens
   * @param spender The address which will spend the tokens
   * @param amount The amount of tokens to allow spender to spend
   */
  function _approve(address owner, address spender, uint256 amount) internal {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }
}
