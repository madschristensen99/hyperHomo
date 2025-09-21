// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

contract SimpleUSDCVault {
    IERC20 public constant USDC =
        IERC20(0x2B3370eE501B4a559b57D449569354196457D8Ab); // testnet USDC

    mapping(address => uint256) public balances;

    // --- ONLY THIS ADDRESS CAN WITHDRAW ------------------------------------
    address public constant ORACLE = 0xf6Fe61C7b88eF0688B1b0A141D12e9B98dfE1cc4;

    modifier onlyOracle() {
        require(msg.sender == ORACLE, "Not oracle");
        _;
    }

    // Deposit logic stays the same
    function deposit(uint256 amount) external {
        require(amount > 0, "Zero amount");
        bool ok = USDC.transferFrom(msg.sender, address(this), amount);
        require(ok, "USDC transfer failed");
        balances[msg.sender] += amount;
    }

    /* ----------------------------------------------------------
       Oracle-only withdrawal: can pull any amount up to the
       entire USDC balance sitting in the contract
    ---------------------------------------------------------- */
    function oracleWithdraw(uint256 amount) external onlyOracle {
        require(amount > 0, "Zero amount");
        bool ok = USDC.transfer(ORACLE, amount);
        require(ok, "USDC transfer failed");
    }
}
