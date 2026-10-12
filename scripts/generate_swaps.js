
import { ethers } from "ethers";
import { readFileSync } from "node:fs";

// Завантаження адрес контрактів
const deployment = JSON.parse(
    readFileSync("./deployments/local.json", "utf8")
);

const tokenArtifact = JSON.parse(
    readFileSync(
        "./artifacts/contracts/AssetToken.sol/AssetToken.json",
        "utf8"
    )
);

const poolArtifact = JSON.parse(
    readFileSync(
        "./artifacts/contracts/DexPool.sol/DexPool.json",
        "utf8"
    )
);

// Підключення до локальної мережі
const provider = new ethers.JsonRpcProvider(deployment.rpcUrl);
const signer = await provider.getSigner(0);

const tokenA = new ethers.Contract(
    deployment.tokenA,
    tokenArtifact.abi,
    signer
);

const pool = new ethers.Contract(
    deployment.dexPool,
    poolArtifact.abi,
    signer
);

console.log("Trader:", await signer.getAddress());

// Дозвіл на використання токенів
const amounts = ["10", "50", "100"];

await (
    await tokenA.approve(
        deployment.dexPool,
        ethers.parseEther("160")
    )
).wait();

// Виконання трьох тестових обмінів
for (const amount of amounts) {
    const tx = await pool.swapAforB(
        ethers.parseEther(amount)
    );

    const receipt = await tx.wait();

    const eventLog = receipt.logs.find(
        (log) =>
            log.address.toLowerCase() ===
            deployment.dexPool.toLowerCase()
    );

    if (!eventLog) {
        throw new Error("Swap event not found");
    }

    const swapEvent = pool.interface.parseLog(eventLog);

    console.log("-----------------------------");
    console.log("Transaction:", tx.hash);
    console.log("Sent:", amount, "VLC");
    console.log(
        "Received:",
        ethers.formatEther(swapEvent.args.amountOut),
        "mUSD"
    );
}

console.log("-----------------------------");
console.log("All 3 swaps completed successfully!");
