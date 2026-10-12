
import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("DexPool", function () {
    it("adds liquidity, swaps VLC for mUSD and emits Swap event", async function () {
        const [deployer] = await ethers.getSigners();

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

        const pool = await ethers.deployContract("DexPool", [
            await tokenA.getAddress(),
            await tokenB.getAddress()
        ]);
        await pool.waitForDeployment();

        const poolAddress = await pool.getAddress();

        const amountA = ethers.parseEther("1000");
        const amountB = ethers.parseEther("2000");

        await (await tokenA.approve(poolAddress, amountA)).wait();
        await (await tokenB.approve(poolAddress, amountB)).wait();

        await (await pool.addLiquidity(amountA, amountB)).wait();

        expect(await pool.reserveA()).to.equal(amountA);
        expect(await pool.reserveB()).to.equal(amountB);

        const swapAmount = ethers.parseEther("50");

        expect(await pool.getFee(swapAmount)).to.equal(10n);

        await (await tokenA.approve(poolAddress, swapAmount)).wait();

        // Зберігаємо резерв до виконання обміну
        const reserveBBefore = await pool.reserveB();

        // Виконуємо обмін та отримуємо квитанцію транзакції
        const tx = await pool.swapAforB(swapAmount);
        const receipt = await tx.wait();

        expect(receipt).to.not.equal(null);

        expect(await pool.reserveA()).to.equal(
            ethers.parseEther("1050")
        );

        const reserveBAfter = await pool.reserveB();

        expect(reserveBAfter).to.be.lessThan(
            ethers.parseEther("2000")
        );

        expect(await tokenB.balanceOf(deployer.address)).to.be.greaterThan(
            ethers.parseEther("18000")
        );

        // Перевірка генерації події Swap
        const swapLogs = receipt!.logs.filter(
            (log) => log.address.toLowerCase() === poolAddress.toLowerCase()
        );

        expect(swapLogs).to.have.lengthOf(1);

        const swapEvent = pool.interface.parseLog(swapLogs[0]);

        expect(swapEvent).to.not.equal(null);
        expect(swapEvent!.name).to.equal("Swap");

        // Перевірка адреси трейдера
        expect(swapEvent!.args.trader).to.equal(deployer.address);

        // Перевірка кількості відправлених токенів
        expect(swapEvent!.args.amountIn).to.equal(swapAmount);

        // Перевірка кількості отриманих токенів
        expect(swapEvent!.args.amountOut).to.equal(
            reserveBBefore - reserveBAfter
        );

        expect(swapEvent!.args.amountOut).to.be.greaterThan(0n);

        console.log("Swap event successfully emitted");
        console.log("Trader:", swapEvent!.args.trader);
        console.log("Amount In:", ethers.formatEther(swapEvent!.args.amountIn), "VLC");
        console.log("Amount Out:", ethers.formatEther(swapEvent!.args.amountOut), "mUSD");
    });
});
