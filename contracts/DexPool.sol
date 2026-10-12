
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DexPool {
    IERC20 public tokenA;
    IERC20 public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    // Подія обміну токенів
    event Swap(
        address indexed trader,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        require(amountA > 0 && amountB > 0, "Invalid liquidity amount");

        require(
            tokenA.transferFrom(msg.sender, address(this), amountA),
            "Token A transfer failed"
        );

        require(
            tokenB.transferFrom(msg.sender, address(this), amountB),
            "Token B transfer failed"
        );

        reserveA += amountA;
        reserveB += amountB;
    }

    function getFee(uint256 amountIn) public view returns (uint256) {
        require(reserveA > 0, "Pool is empty");

        // Комісія 1% для угод, що перевищують 5% резерву.
        if (amountIn * 100 > reserveA * 5) {
            return 100;
        }

        // Базова комісія 0.1%.
        return 10;
    }

    function swapAforB(uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        require(reserveA > 0 && reserveB > 0, "Pool is empty");

        uint256 fee = getFee(amountIn);
        uint256 amountInWithFee = amountIn * (10000 - fee);

        uint256 numerator = amountInWithFee * reserveB;
        uint256 denominator = reserveA * 10000 + amountInWithFee;

        amountOut = numerator / denominator;

        require(amountOut > 0, "Insufficient output amount");
        require(amountOut < reserveB, "Insufficient liquidity");

        require(
            tokenA.transferFrom(msg.sender, address(this), amountIn),
            "Token A transfer failed"
        );

        require(
            tokenB.transfer(msg.sender, amountOut),
            "Token B transfer failed"
        );

        reserveA += amountIn;
        reserveB -= amountOut;

        // Генерація події після успішного обміну
        emit Swap(msg.sender, amountIn, amountOut);
    }
}
