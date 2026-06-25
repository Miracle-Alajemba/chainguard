# ChainGuard — Setup Guide

Before running ChainGuard you need to register it as an agent on the CROO network and configure your environment variables. All setup is done through the **CROO Dashboard**.

---

## Prerequisites

- A crypto wallet (MetaMask, Rabby, etc.)
- Some USDC on **Base** for receiving payments
- An [Anthropic API key](https://console.anthropic.com/) for Claude
- An [Etherscan API key](https://etherscan.io/apis) (optional — needed only for auditing deployed contracts by address)

---

## Step 1 — Connect Your Wallet

1. Go to **[agent.croo.network](https://agent.croo.network)**
2. Click **Connect Wallet** and sign in with your wallet

---

## Step 2 — Create the ChainGuard Agent

1. Navigate to the **Agents** section
2. Click **Create Agent**
3. Fill in the details:

| Field | Value |
|-------|-------|
| **Agent Name** | `ChainGuard` |
| **Description** | `AI-powered smart contract security auditor. Submit a contract address or Solidity code and get back a detailed vulnerability report with severity ratings and recommendations. Powered by Claude AI.` |

4. Click **Create**
5. Copy the **Agent ID** — you'll need it in the next steps

---

## Step 3 — Deploy the Agent Wallet

1. Open your newly created **ChainGuard** agent
2. Click **Deploy Wallet**
3. Wait for the on-chain wallet deployment to complete
4. Note down the **Agent Wallet Address** — this is where payments will be received

> **Tip:** Make sure to deposit some USDC to this wallet if you plan to also use ChainGuard as a requester.

---

## Step 4 — Register the Audit Service

1. Inside the ChainGuard agent, go to **Services**
2. Click **Create Service**
3. Fill in the details:

| Field | Value |
|-------|-------|
| **Service Name** | `Smart Contract Audit` |
| **Description** | `Submit a contract address (0x...) or raw Solidity code. Returns a full security audit report including vulnerabilities, severity levels, gas optimizations, and an overall risk score.` |
| **Price** | `0.10 USDC` (100000 in base units, USDC has 6 decimals) |
| **SLA** | `5 minutes` |
| **Payment Token** | USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| **Order Type** | `One-time` |
| **Deliverable Type** | `Text` |

4. Click **Create Service**
5. Copy the **Service ID**

---

## Step 5 — Generate an SDK Key

1. Inside the ChainGuard agent, go to **SDK Keys**
2. Click **Generate Key**
3. Copy the generated key — it will look like `croo_sk_...`

> ⚠️ **Save this key immediately.** It will only be shown once.

---

## Step 6 — Configure Environment Variables

Open the `.env` file in the project root and fill in your values:

```env
CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
WALLET_PRIVATE_KEY=your-wallet-private-key
CROO_SDK_KEY=croo_sk_your_key_here
ANTHROPIC_API_KEY=sk-ant-your-key-here
ETHERSCAN_API_KEY=your-etherscan-key-here
```

| Variable | Where to get it |
|----------|----------------|
| `CROO_SDK_KEY` | Step 5 above |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
| `ETHERSCAN_API_KEY` | [etherscan.io/apis](https://etherscan.io/apis) |
| `WALLET_PRIVATE_KEY` | Your wallet's private key (used for on-chain signing) |

---

## Step 7 — Start ChainGuard

```bash
# Development
npm start

# Or build and run production
npm run build
npm run start:prod
```

You should see:

```
=======================================
  ChainGuard — Smart Contract Auditor
  Powered by CROO CAP + Claude AI
  Listening for audit orders...
=======================================

⛓️  ChainGuard provider is live — listening for audit orders…
```

ChainGuard is now live and will automatically accept, audit, and deliver results for incoming orders on the CROO network.

---

## Summary of Values

After setup, you should have:

| Item | Example |
|------|---------|
| Agent ID | `ag_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| Agent Wallet | `0x1234...abcd` |
| Service ID | `svc_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| SDK Key | `croo_sk_...` |
