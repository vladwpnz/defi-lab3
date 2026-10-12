import { network } from "hardhat";

const { ethers } = await network.connect();

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deployer:", deployer.address);

    // Розгортання двох ERC-20 токенів
    const tokenA = await ethers.deployContract("AssetToken", [
        "VladCoin",
        "VLC",
        10000
    ]);
    await tokenA.waitForDeployment();

    const tokenB = await ethers.deployContract("AssetToken", [
        "MockUSD",
        "mUSD",
        20000
    ]);
    await tokenB.waitForDeployment();

    console.log("VladCoin:", await tokenA.getAddress());
    console.log("MockUSD:", await tokenB.getAddress());

    // Розгортання пулу ліквідності
    const pool = await ethers.deployContract("DexPool", [
        await tokenA.getAddress(),
        await tokenB.getAddress()
    ]);
    await pool.waitForDeployment();

    const poolAddress = await pool.getAddress();

    console.log("DexPool:", poolAddress);

    const amountA = ethers.parseEther("1000");
    const amountB = ethers.parseEther("2000");

    // Дозвіл пулу використовувати токени
    await (await tokenA.approve(poolAddress, amountA)).wait();
    await (await tokenB.approve(poolAddress, amountB)).wait();

    // Додавання ліквідності 1000 : 2000
    await (await pool.addLiquidity(amountA, amountB)).wait();

    console.log("\nInitial reserves:");
    console.log("Token A:", ethers.formatEther(await pool.reserveA()));
    console.log("Token B:", ethers.formatEther(await pool.reserveB()));

    // Обмін 50 VLC на mUSD
    const swapAmount = ethers.parseEther("50");

    await (await tokenA.approve(poolAddress, swapAmount)).wait();

    const balanceBefore = await tokenB.balanceOf(deployer.address);

    await (await pool.swapAforB(swapAmount)).wait();

    const balanceAfter = await tokenB.balanceOf(deployer.address);
    const received = balanceAfter - balanceBefore;

    console.log("\nTrade:");
    console.log("Sold: 50 VLC");
    console.log("Received:", ethers.formatEther(received), "mUSD");

    console.log("\nFinal reserves:");
    console.log("Token A:", ethers.formatEther(await pool.reserveA()));
    console.log("Token B:", ethers.formatEther(await pool.reserveB()));
}

main().catch(console.error);