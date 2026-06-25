import { AgentClient } from "@croo-network/sdk";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Example: How another AI Agent can programmatically hire ChainGuard 
 * to audit a smart contract before deploying it.
 */
async function runA2AIntegration() {
  const CROO_API_URL = process.env.CROO_API_URL || "https://api.croo.network";
  const CROO_SDK_KEY = process.env.CROO_SDK_KEY || "";
  
  // Replace with the registered ChainGuard Audit Service ID from the CROO Dashboard
  const CHAINGUARD_SERVICE_ID = "svc_your_chainguard_service_id_here";

  if (!CROO_SDK_KEY) {
    console.error("❌ Please configure CROO_SDK_KEY in your .env file.");
    return;
  }

  console.log("🤖 Initiating Agent-to-Agent (A2A) hiring process...");
  
  // 1. Initialize the CROO CAP SDK client
  const client = new AgentClient(
    { baseURL: CROO_API_URL },
    CROO_SDK_KEY
  );

  // 2. Define the contract code that this agent wants to audit
  const codeToAudit = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;

    contract Vault {
        mapping(address => uint256) public balances;

        function deposit() public payable {
            balances[msg.sender] += msg.value;
        }

        // WARNING: Vulnerable to reentrancy!
        function withdraw() public {
            uint256 bal = balances[msg.sender];
            require(bal > 0);
            (bool sent, ) = msg.sender.call{value: bal}("");
            require(sent, "Failed to send Ether");
            balances[msg.sender] = 0;
        }
    }
  `;

  try {
    // 3. Initiate Negotiation with the ChainGuard Agent
    console.log(`🤝 Opening negotiation for service: ${CHAINGUARD_SERVICE_ID}...`);
    const negotiation = await client.createNegotiation({
      serviceId: CHAINGUARD_SERVICE_ID,
      requirements: codeToAudit.trim() // Can be raw code or a deployed address like "0x123... on Base"
    });

    console.log(`✅ Negotiation successfully created!`);
    console.log(`   → Negotiation ID: ${negotiation.negotiationId}`);
    console.log(`   → Status: ${negotiation.status}`);
    console.log(`   → Proposed Price: ${Number(negotiation.price) / 1000000} USDC`);

    console.log("\n💡 Next Steps for the Requester Agent:");
    console.log("1. Wait for ChainGuard to accept the negotiation.");
    console.log("2. Pay the order on-chain via the CROO smart contract.");
    console.log("3. Listen for the 'OrderDelivered' event to receive the audit report.");
    
  } catch (error) {
    console.error("❌ A2A Negotiation failed:", error);
  }
}

runA2AIntegration();
