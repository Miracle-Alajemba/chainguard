import { AgentClient, EventType, DeliverableType } from "@croo-network/sdk";
import { fetchContractSource, isContractAddress, parseContractInput } from "./fetcher";
import { auditContract } from "./auditor";
import { hashResult } from "./hasher";

function generateMarkdownReport(report: any, contractInput: string): string {
  let vulnerabilitiesMd = "";
  if (Array.isArray(report.vulnerabilities) && report.vulnerabilities.length > 0) {
    vulnerabilitiesMd = report.vulnerabilities
      .map(
        (v: any) => `
### ⚠️ ${v.name || "Unnamed Vulnerability"} (${v.severity || "Unknown Severity"})
* **Description:** ${v.description || "No description provided."}
* **Recommendation:** ${v.recommendation || "No recommendation provided."}
`
      )
      .join("\n");
  } else {
    vulnerabilitiesMd = "\n*No vulnerabilities identified.*\n";
  }

  let gasMd = "";
  if (Array.isArray(report.gasOptimizations) && report.gasOptimizations.length > 0) {
    gasMd = report.gasOptimizations
      .map(
        (g: any) => `
* **Suggestion:** ${g.description || "No description provided."}
  * *Estimated Savings:* ${g.estimatedSavings || "N/A"}
`
      )
      .join("\n");
  } else {
    gasMd = "\n*No gas optimizations identified.*\n";
  }

  return `# ⛓️ ChainGuard Smart Contract Security Audit Report

## 📊 Overview
* **Target:** \`${contractInput}\`
* **Overall Security Score:** **${report.overallScore !== undefined ? report.overallScore : "N/A"}/100**
* **Risk Level:** **${report.riskLevel || "Unknown"}**

### Summary
${report.summary || "No summary provided."}

---

## 🔍 Vulnerabilities Detail
${vulnerabilitiesMd}

---

## ⛽ Gas Optimizations
${gasMd}

---
*Report generated autonomously by ChainGuard Security Agent on CROO CAP.*
`;
}


// ── Environment ──────────────────────────────────────────────────────────────

const CROO_API_URL = process.env.CROO_API_URL || "https://api.croo.network";
const CROO_WS_URL = process.env.CROO_WS_URL || "wss://api.croo.network/ws";
const CROO_SDK_KEY = process.env.CROO_SDK_KEY || "";
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

if (!CROO_SDK_KEY) {
  throw new Error("CROO_SDK_KEY is required — set it in .env");
}
if (!WALLET_PRIVATE_KEY) {
  throw new Error("WALLET_PRIVATE_KEY is required — set it in .env");
}
if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is required — set it in .env");
}

// ── Provider ─────────────────────────────────────────────────────────────────

export async function startProvider(): Promise<void> {
  const client = new AgentClient(
    { baseURL: CROO_API_URL, wsURL: CROO_WS_URL },
    CROO_SDK_KEY,
  );

  const stream = await client.connectWebSocket();

  console.log("⛓️  ChainGuard provider is live — listening for audit orders…");

  // ── Step 1: Validate & accept incoming negotiations ───────────────────

  stream.on(EventType.NegotiationCreated, async (event) => {
    const negotiationId = event.negotiation_id;
    if (!negotiationId) {
      console.error("❌ Negotiation event missing negotiation_id");
      return;
    }
    console.log(`📩 Negotiation received: ${negotiationId}`);

    try {
      const negotiation = await client.getNegotiation(negotiationId);
      
      const expectedToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
      const expectedAmount = 10000; // 0.01 USDC in base units (6 decimals)

      if (negotiation.fundToken && negotiation.fundToken.toLowerCase() !== expectedToken.toLowerCase()) {
        console.log(`🚫 Rejecting negotiation ${negotiationId}: Invalid token ${negotiation.fundToken}`);
        await client.rejectNegotiation(negotiationId, `Invalid payment token. Expected USDC on Base (${expectedToken})`);
        return;
      }

      if (negotiation.fundAmount) {
        const amount = parseFloat(negotiation.fundAmount);
        if (isNaN(amount) || amount < expectedAmount) {
          console.log(`🚫 Rejecting negotiation ${negotiationId}: Insufficient payment amount ${negotiation.fundAmount}`);
          await client.rejectNegotiation(negotiationId, `Insufficient price. Expected at least 0.01 USDC (10000 base units)`);
          return;
        }
      }

      const result = await client.acceptNegotiation(negotiationId);
      console.log(`✅ Accepted → Order created: ${result.order.orderId}`);
    } catch (err) {
      console.error(`❌ Failed to accept negotiation ${negotiationId}:`, err);
    }
  });

  // ── Step 2: Process & deliver after payment ────────────────────────────

  stream.on(EventType.OrderPaid, async (event) => {
    const orderId = event.order_id;
    if (!orderId) {
      console.error("❌ OrderPaid event missing order_id");
      return;
    }
    console.log(`💰 Payment confirmed for order: ${orderId}`);

    try {
      // Retrieve the negotiation to read the requester's input
      const order = await client.getOrder(orderId);
      const negotiation = await client.getNegotiation(order.negotiationId);
      const input = (negotiation.requirements || "").trim();

      if (!input) {
        throw new Error("No input provided — expected a contract address or Solidity source code");
      }

      // Resolve source code: fetch from Etherscan if address, otherwise use raw input
      console.log(`🔍 Resolving source code…`);
      let sourceCode: string;

      if (isContractAddress(input)) {
        const { address, chain } = parseContractInput(input);
        console.log(`   → Fetching verified source for ${address} on chain ${chain}`);
        sourceCode = await fetchContractSource(address, chain);
      } else {
        console.log(`   → Using provided Solidity source code`);
        sourceCode = input;
      }

      // Run the AI audit
      console.log(`🤖 Running AI security audit…`);
      const report = await auditContract(sourceCode);

      // Generate Markdown report and upload to storage
      console.log(`📄 Generating Markdown report…`);
      const markdownReport = generateMarkdownReport(report, input);
      const reportFileName = `audit-${orderId}.md`;

      console.log(`📤 Uploading report file to CROO storage…`);
      const objectKey = await client.uploadFile(reportFileName, Buffer.from(markdownReport));
      const downloadUrl = await client.getDownloadURL(objectKey);

      console.log(`🔗 Hosted report URL: ${downloadUrl}`);

      // Inject the download link into the report JSON
      const finalReport = {
        ...report,
        reportUrl: downloadUrl,
      };

      // Prepare the deliverable
      const reportJson = JSON.stringify(finalReport, null, 2);
      const proofHash = hashResult(reportJson);

      console.log(`📊 Audit complete — Score: ${report.overallScore}/100 | Risk: ${report.riskLevel}`);
      console.log(`🔐 Delivery proof hash: ${proofHash}`);

      // Deliver result back through CAP
      await client.deliverOrder(orderId, {
        deliverableType: DeliverableType.Text,
        deliverableText: reportJson,
        deliverableSchema: proofHash,
      });

      console.log(`📦 Order ${orderId} delivered successfully\n`);
    } catch (err) {
      console.error(`❌ Error processing order ${orderId}:`, err);

      // Deliver an error message so the order doesn't hang
      try {
        const errorReport = JSON.stringify({
          overallScore: 0,
          riskLevel: "Critical",
          vulnerabilities: [],
          summary: `Audit failed: ${(err as Error).message}`,
          gasOptimizations: [],
          error: true,
        });

        await client.deliverOrder(orderId, {
          deliverableType: DeliverableType.Text,
          deliverableText: errorReport,
          deliverableSchema: hashResult(errorReport),
        });

        console.log(`⚠️  Error report delivered for order ${orderId}\n`);
      } catch (deliveryErr) {
        console.error(`🚨 Failed to deliver error report for ${orderId}:`, deliveryErr);
      }
    }
  });

  // ── Lifecycle logging ──────────────────────────────────────────────────

  stream.on(EventType.OrderCompleted, (event) => {
    console.log(`🎉 Order ${event.order_id || "unknown"} completed and verified on-chain`);
  });

  stream.on(EventType.OrderExpired, (event) => {
    console.log(`⏰ Order ${event.order_id || "unknown"} expired (SLA breach)`);
  });

  stream.on(EventType.NegotiationRejected, (event) => {
    console.log(`🚫 Negotiation ${event.negotiation_id || "unknown"} rejected: ${event.reason || "no reason"}`);
  });
}
