
import { useState } from "react";
import { ethers } from "ethers";
import "./App.css";

const API_URL = "http://127.0.0.1:5055";
const HARDHAT_CHAIN_ID = "0x7a69";

function App() {
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Підключення локальної мережі Hardhat
  async function ensureNetwork() {
    const chainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    if (chainId === HARDHAT_CHAIN_ID) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID }],
      });
    } catch (err) {
      if (err.code !== 4902) throw err;

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: HARDHAT_CHAIN_ID,
          chainName: "Hardhat Local",
          rpcUrls: ["http://127.0.0.1:8545"],
          nativeCurrency: {
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
          },
        }],
      });

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HARDHAT_CHAIN_ID }],
      });
    }
  }

  // Завантаження історії обмінів через REST API
  async function fetchHistory(address) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/swaps?trader=${encodeURIComponent(address)}`
      );

      if (!response.ok) {
        throw new Error("Помилка отримання даних з REST API");
      }

      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  // Підключення гаманця MetaMask
  async function connectWallet() {
    if (!window.ethereum) {
      setError("Встановіть розширення MetaMask у браузері.");
      return;
    }

    try {
      setError("");

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      await ensureNetwork();

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);
      await fetchHistory(address);
    } catch (err) {
      setError(err.shortMessage || err.message);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">◆</span>
          DeFi Pool
        </div>
        <span className="network">Hardhat Local · 31337</span>
      </header>

      <main className="container">
        <div className="intro">
          <span className="eyebrow">WEB3 DASHBOARD</span>
          <h1>Історія обмінів токенів</h1>
          <p>
            Децентралізований пул ліквідності VLC / mUSD.
            Підключіть гаманець для перегляду ваших транзакцій.
          </p>
        </div>

        <section className="wallet-card">
          <div>
            <span className="section-label">WEB3 ГАМАНЕЦЬ</span>
            <h2>{account ? "Гаманець підключено" : "Підключення MetaMask"}</h2>
            <p className="address">
              {account || "Підключіть гаманець, щоб отримати історію обмінів."}
            </p>
          </div>

          <button onClick={connectWallet}>
            {account ? "Змінити гаманець" : "Підключити MetaMask"}
          </button>
        </section>

        <section className="history-section">
          <div className="section-heading">
            <div>
              <span className="section-label">ON-CHAIN ACTIVITY</span>
              <h2>Історія транзакцій</h2>
            </div>

            <button
              className="refresh-button"
              disabled={!account || loading}
              onClick={() => fetchHistory(account)}
            >
              Оновити історію
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Хеш транзакції</th>
                  <th>Відправлено</th>
                  <th>Отримано</th>
                  <th>Блок</th>
                </tr>
              </thead>
              <tbody>
                {history.map((swap) => (
                  <tr key={swap.transactionHash}>
                    <td className="hash" title={swap.transactionHash}>
                      {swap.transactionHash.slice(0, 12)}...
                      {swap.transactionHash.slice(-6)}
                    </td>
                    <td>{swap.amountIn} VLC</td>
                    <td className="received">{swap.amountOut} mUSD</td>
                    <td>#{swap.blockNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!history.length && (
              <div className="empty">
                {loading
                  ? "Завантаження історії..."
                  : account
                    ? "Історія обмінів порожня."
                    : "Підключіть MetaMask для перегляду транзакцій."}
              </div>
            )}
          </div>

          <div className="table-footer">
            Знайдено транзакцій: {history.length}
          </div>
        </section>
      </main>

      <footer>DeFi Laboratory №3 · React + ethers.js + SQLite</footer>
    </div>
  );
}

export default App;
