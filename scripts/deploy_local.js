
import { ethers } from "ethers";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

// Підключення до локального RPC-вузла Hardhat
const rpcUrl = "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(rpcUrl);

const network = await provider.getNetwork();

if (network.chainId !== 31337n) {
    throw new Error("Очікується локальна мережа Hardhat (31337)");
}

const deployer = await provider.getSigner(0);

// Завантаження скомпільованих контрактів
const tokenArtifact = JSON.parse(
    readFileSync("./artifacts/contracts/AssetToken.sol/AssetToken.json", "utf8")
);

const poolArtifact = JSON.parse(
    readFileSync("./artifacts/contracts/DexPool.sol/DexPool.json", "utf8")
);

// Функція розгортання смарт-контрактів
async function deploy(artifact, ...args) {
    const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        deployer
    );

    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();

    return contract;
}

console.log("Deployer:", await deployer.getAddress());

// Розгортання токенів
const tokenA = await deploy(tokenArtifact, "VladCoin", "VLC", 10000);
const tokenB = await deploy(tokenArtifact, "MockUSD", "mUSD", 20000);

console.log("VladCoin:", await tokenA.getAddress());
console.log("MockUSD:", await tokenB.getAddress());

// Розгортання пулу ліквідності
const pool = await deploy(
    poolArtifact,
    await tokenA.getAddress(),
    await tokenB.getAddress()
);

const poolAddress = await pool.getAddress();

console.log("DexPool:", poolAddress);

// Додавання початкової ліквідності
const amountA = ethers.parseEther("1000");
const amountB = ethers.parseEther("2000");

await (await tokenA.approve(poolAddress, amountA)).wait();
await (await tokenB.approve(poolAddress, amountB)).wait();

await (await pool.addLiquidity(amountA, amountB)).wait();

console.log("Liquidity successfully added");
console.log("Reserve A:", ethers.formatEther(await pool.reserveA()), "VLC");
console.log("Reserve B:", ethers.formatEther(await pool.reserveB()), "mUSD");

// Збереження адрес для бекенду
mkdirSync("deployments", { recursive: true });

writeFileSync(
    "deployments/local.json",
    JSON.stringify({
        chainId: Number(network.chainId),
        rpcUrl,
        deployer: await deployer.getAddress(),
        tokenA: await tokenA.getAddress(),
        tokenB: await tokenB.getAddress(),
        dexPool: poolAddress
    }, null, 2)
);

console.log("Deployment completed successfully!");
