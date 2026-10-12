
import express from "express";
import cors from "cors";
import { DatabaseSync } from "node:sqlite";
import { ethers } from "ethers";
import { readFileSync } from "node:fs";

const app = express();
app.use(cors());
app.use(express.json());

// Завантаження адрес розгорнутих контрактів
const deployment = JSON.parse(
    readFileSync("./deployments/local.json", "utf8")
);

const artifact = JSON.parse(
    readFileSync(
        "./artifacts/contracts/DexPool.sol/DexPool.json",
        "utf8"
    )
);

// Підключення до блокчейну
const provider = new ethers.JsonRpcProvider(deployment.rpcUrl);

const pool = new ethers.Contract(
    deployment.dexPool,
    artifact.abi,
    provider
);

// Створення бази даних SQLite
const db = new DatabaseSync("backend/swaps.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS swaps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader TEXT NOT NULL,
        transactionHash TEXT NOT NULL,
        amountIn TEXT NOT NULL,
        amountOut TEXT NOT NULL,
        blockNumber INTEGER NOT NULL,
        logIndex INTEGER NOT NULL,
        UNIQUE(transactionHash, logIndex)
    )
`);

console.log("SQLite database initialized");

// Підготовка SQL-запиту для збереження обмінів
const insertSwap = db.prepare(`
    INSERT OR IGNORE INTO swaps
    (trader, transactionHash, amountIn, amountOut, blockNumber, logIndex)
    VALUES (?, ?, ?, ?, ?, ?)
`);

let nextBlock = 0;
let isScanning = false;

// Фоновий індексатор подій Swap
async function scanSwapEvents() {
    if (isScanning) return;

    isScanning = true;

    try {
        const latestBlock = await provider.getBlockNumber();

        if (latestBlock < nextBlock) return;

        const events = await pool.queryFilter(
            pool.filters.Swap(),
            nextBlock,
            latestBlock
        );

        for (const event of events) {
            if (!event.args) continue;

            const trader = event.args.trader.toLowerCase();
            const amountIn = ethers.formatEther(event.args.amountIn);
            const amountOut = ethers.formatEther(event.args.amountOut);

            const result = insertSwap.run(
                trader,
                event.transactionHash,
                amountIn,
                amountOut,
                event.blockNumber,
                event.index
            );

            if (result.changes > 0) {
                console.log("Swap indexed:", event.transactionHash);
                console.log("Trader:", trader);
                console.log("Amount In:", amountIn);
                console.log("Amount Out:", amountOut);
            }
        }

        nextBlock = latestBlock + 1;
    } finally {
        isScanning = false;
    }
}

// REST API для отримання історії конкретного трейдера
app.get("/api/swaps", (req, res) => {
    const trader = req.query.trader;

    if (typeof trader !== "string" || !ethers.isAddress(trader)) {
        return res.status(400).json({
            error: "Valid trader address is required"
        });
    }

    const swaps = db.prepare(`
        SELECT trader, transactionHash, amountIn, amountOut, blockNumber
        FROM swaps
        WHERE trader = ?
        ORDER BY blockNumber DESC, logIndex DESC
    `).all(trader.toLowerCase());

    res.json(swaps);
});

// Перевірка працездатності сервера
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        network: "Hardhat",
        contract: deployment.dexPool
    });
});

async function main() {
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== deployment.chainId) {
        throw new Error("RPC network does not match deployment");
    }

    await scanSwapEvents();

    setInterval(() => {
        scanSwapEvents().catch(console.error);
    }, 3000);

    app.listen(5055, "127.0.0.1", () => {
        console.log("Backend running: http://127.0.0.1:5055");
        console.log("Indexer started. Polling every 3 seconds");
    });
}

main().catch(console.error);
