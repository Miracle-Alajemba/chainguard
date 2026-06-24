# ⛓️ ChainGuard

**AI-powered Smart Contract Security Auditor on CROO CAP**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Built on CROO CAP](https://img.shields.io/badge/Built%20on-CROO%20CAP-blue.svg)
![Powered by Claude AI](https://img.shields.io/badge/Powered%20by-Claude%20AI-blueviolet.svg)

---

## Overview

ChainGuard is an autonomous AI agent that performs instant smart contract security audits on the [CROO CAP](https://croo.network) decentralized marketplace. Submit a contract address or paste raw Solidity code — get back a comprehensive vulnerability report in seconds.

**Why it matters:** Traditional smart contract audits cost **$5,000–$50,000** and take **weeks** to complete. ChainGuard delivers a detailed security analysis in **seconds** for just **0.01 USDC** — making professional-grade auditing accessible to everyone.

**Who it's for:**
- **Developers** — get instant feedback on your contracts before deploying to mainnet
- **DAOs** — audit governance contracts and treasury logic without expensive retainers
- **AI Agents** — composable A2A integration lets other agents hire ChainGuard automatically through CROO CAP

---

## Features

- ✅ **Accepts contract address or raw Solidity code** — submit a deployed `0x...` address or paste source directly
- 🔍 **Vulnerability detection with severity ratings** — findings classified as Critical, High, Medium, Low, or Informational
- 📊 **Overall risk score** — 0–100 security rating with risk level classification
- ⛽ **Gas optimization suggestions** — actionable recommendations to reduce deployment and execution costs
- 🔐 **Delivery proof hash** — SHA-256 hash of the report for on-chain verification via CAP
- 🤖 **A2A composable** — other agents can discover and hire ChainGuard automatically on the CROO Agent Store

---

## How It Works

```
  Requester                          ChainGuard
      │                                  │
  1.  ├─── Submit contract + pay ───────►│
      │                                  │
  2.  │                    Fetch source ──┤ (Etherscan, if address)
      │                                  │
  3.  │                     AI Audit ─────┤ (Claude analyses code)
      │                                  │
  4.  │                  Generate proof ──┤ (SHA-256 hash)
      │                                  │
  5.  │◄── Deliver report + proof ───────┤
      │                                  │
```

**Step by step:**

1. **Submit** — A requester sends a contract address or Solidity code via CROO CAP negotiation
2. **Pay** — Payment of 0.01 USDC is confirmed on Base
3. **Fetch Source** — If an address was provided, ChainGuard fetches verified source from Etherscan
4. **AI Audit** — Claude AI analyses the code for vulnerabilities, access control issues, reentrancy risks, gas inefficiencies, and more
5. **Deliver Proof** — The structured JSON report and its SHA-256 proof hash are delivered back through CAP

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Runtime** | Node.js + TypeScript |
| **Protocol** | CROO CAP SDK (`@croo-network/sdk`) |
| **AI Engine** | Anthropic Claude API (`claude-sonnet-4-5`) |
| **Blockchain Data** | Etherscan API |
| **Payment Chain** | Base Network (USDC) |

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- A crypto wallet (MetaMask, Rabby, etc.)
- USDC on Base for receiving payments

### Install

```bash
git clone https://github.com/Miracle-Alajemba/chainguard.git
cd chainguard
npm install
```

### Configure Environment

Create a `.env` file in the project root:

```env
CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
WALLET_PRIVATE_KEY=
CROO_SDK_KEY=
ANTHROPIC_API_KEY=
ETHERSCAN_API_KEY=
```

| Variable | Source |
|----------|--------|
| `CROO_SDK_KEY` | CROO Dashboard — see [SETUP.md](SETUP.md) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/) |
| `ETHERSCAN_API_KEY` | [etherscan.io/apis](https://etherscan.io/apis) |
| `WALLET_PRIVATE_KEY` | Your wallet's private key |

### Register on CROO Network

Follow the step-by-step guide in **[SETUP.md](SETUP.md)** to register ChainGuard on the CROO Dashboard, deploy the agent wallet, and generate your SDK key.

---

## Usage

### Start the Agent

```bash
# Development
npm start

# Production
npm run build
npm run start:prod
```

### Hire ChainGuard on the Agent Store

1. Go to **[agent.croo.network](https://agent.croo.network)**
2. Find **ChainGuard — Smart Contract Audit** in the Agent Store
3. Submit a contract address or paste Solidity code as the order requirement
4. Pay 0.01 USDC — the audit report is delivered automatically

### Example Audit Output

Here's a real audit result for the **DAI Stablecoin** contract:

```json
{
  "overallScore": 78,
  "riskLevel": "Low",
  "vulnerabilities": [
    {
      "name": "Centralized Authorization Control",
      "severity": "Medium",
      "description": "The 'rely' and 'deny' functions allow any ward to add or remove other wards, creating a centralized point of control.",
      "recommendation": "Implement a multi-sig or timelock mechanism for administrative functions."
    },
    {
      "name": "Permit Front-Running",
      "severity": "Low",
      "description": "The EIP-2612 permit function could be susceptible to front-running attacks.",
      "recommendation": "Users should be aware of potential front-running when using permit approvals."
    }
  ],
  "summary": "The DAI contract is a well-structured ERC-20 implementation with EIP-2612 permit support. The primary concerns are around centralized ward control and minor front-running vectors. Overall, the contract demonstrates solid engineering practices with room for governance decentralization.",
  "gasOptimizations": [
    {
      "description": "Use 'unchecked' blocks for arithmetic operations where overflow is impossible",
      "estimatedSavings": "~200-500 gas per transfer"
    },
    {
      "description": "Cache storage variables in memory when accessed multiple times",
      "estimatedSavings": "~100 gas per redundant SLOAD"
    }
  ]
}
```

---

## CROO CAP Integration

ChainGuard runs as a **provider agent** on the CROO Compute Agent Protocol.

| Parameter | Value |
|-----------|-------|
| **SDK Client** | `AgentClient` from `@croo-network/sdk` |
| **Connection** | `connectWebSocket()` — real-time event streaming |
| **Negotiation** | `acceptNegotiation()` — auto-accepts all incoming orders |
| **Delivery** | `deliverOrder()` — returns report JSON + SHA-256 proof hash |
| **Payment Token** | USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| **Service Price** | 0.01 USDC (10,000 base units) |
| **SLA** | 5 minutes |
| **Deliverable Type** | Text + proof hash |

### Event Flow

```
NegotiationCreated → acceptNegotiation()
OrderPaid          → fetchSource() → auditContract() → hashResult() → deliverOrder()
OrderCompleted     → ✅ verified on-chain
```

---

## Project Structure

```
chainguard/
├── src/
│   ├── index.ts       # Entry point — startup banner, graceful shutdown
│   ├── provider.ts    # CROO CAP provider — order lifecycle management
│   ├── auditor.ts     # Claude AI audit engine — structured JSON reports
│   ├── fetcher.ts     # Etherscan verified source code fetcher
│   └── hasher.ts      # SHA-256 delivery proof generator
├── SETUP.md           # CROO Dashboard setup walkthrough
├── package.json
├── tsconfig.json
└── .env               # API keys (not committed)
```

---

## Live Agent

| | |
|---|---|
| **Agent Store** | [agent.croo.network](https://agent.croo.network) |
| **Network** | Base |
| **Service** | Smart Contract Audit |
| **Price** | 0.01 USDC |

---

## License

MIT
