import { AgentClient, EventType, DeliverableType } from "@croo-network/sdk";
import { fetchContractSource, isContractAddress, parseContractInput } from "./fetcher";
import { auditContract } from "./auditor";
import { hashResult } from "./hasher";
import { analyzeToken } from "./tokenAnalyzer";
import { scanWallet } from "./walletScanner";
import { optimizeGas } from "./gasOptimizer";




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
      console.log(`   → Service: ${negotiation.serviceId} | Status: ${negotiation.status}`);

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
        throw new Error("No input provided — expected a contract address, wallet address, or Solidity source code");
      }

      // Try to parse the input as JSON in case it is wrapped (e.g. {"text": "..."})
      let parsedInput = input;
      try {
        const parsed = JSON.parse(input);
        if (parsed && typeof parsed === "object") {
          parsedInput = (parsed.text || parsed.contractAddress || parsed.address || parsed.contract_address || parsed.requirements || input).toString().trim();
        }
      } catch {
        // Not JSON formatted, use raw input
      }

      // Read the service name from negotiation to determine which service was ordered
      const serviceId = negotiation.serviceId;
      const serviceNameFromMetadata = (() => {
        try {
          const meta = JSON.parse(negotiation.metadata || "{}");
          return meta.serviceName || meta.service_name;
        } catch {
          return null;
        }
      })();

      const SERVICE_MAP: Record<string, string> = {
        "585dbe8a-af77-4628-a8f3-3f7372ce07da": "Smart Contract Audit",
        "7a4e743f-eb70-465b-862b-d2aadc182c93": "Token Contract Analyzer",
        "d507471e-3048-4c57-ba87-576eb7444081": "Gas Optimizer",
        "918a1ddc-f056-4ad2-b204-8ed26ebcc88d": "Wallet Security Scan",
      };
      const service = SERVICE_MAP[serviceId] || "Smart Contract Audit";

      console.log(`🛎️  Routing paid order ${orderId} to service: "${service}" with input: "${parsedInput.substring(0, 60)}${parsedInput.length > 60 ? '...' : ''}"`);

      let reportJson = "";
      let proofHash = "";

      if (service === "Token Contract Analyzer") {
        console.log(`🤖 Running Token Contract Analysis for ${parsedInput}…`);
        const report = await analyzeToken(parsedInput);
        reportJson = JSON.stringify(report, null, 2);
        proofHash = hashResult(reportJson);
        console.log(`📊 Token analysis complete — Safety Score: ${report.safetyScore}/100 | Verdict: ${report.verdict}`);
      } else if (service === "Wallet Security Scan") {
        console.log(`🕵️ Running Wallet Security Scan for ${parsedInput}…`);
        const report = await scanWallet(parsedInput);
        reportJson = JSON.stringify(report, null, 2);
        proofHash = hashResult(reportJson);
        console.log(`📊 Wallet scan complete — Trust Score: ${report.trustScore}/100 | Verdict: ${report.verdict}`);
      } else if (service === "Gas Optimizer") {
        console.log(`⛽ Running Solidity Gas Optimization for contract…`);
        const report = await optimizeGas(parsedInput);
        reportJson = JSON.stringify(report, null, 2);
        proofHash = hashResult(reportJson);
        console.log(`📊 Gas optimization complete — Functions Analyzed: ${report.totalFunctionsAnalyzed} | Est. Savings: ${report.estimatedTotalSavings}`);
      } else {
        // Default: Smart Contract Audit
        console.log(`🔍 Resolving source code…`);
        let sourceCode: string;

        if (isContractAddress(parsedInput)) {
          const { address, chain } = parseContractInput(parsedInput);
          console.log(`   → Fetching verified source for ${address} on chain ${chain}`);
          sourceCode = await fetchContractSource(address, chain);
        } else {
          console.log(`   → Using provided Solidity source code`);
          sourceCode = parsedInput;
        }

        console.log(`🤖 Running AI security audit…`);
        const report = await auditContract(sourceCode);

        reportJson = JSON.stringify(report, null, 2);
        proofHash = hashResult(reportJson);

        console.log(`📊 Audit complete — Score: ${report.overallScore}/100 | Risk: ${report.riskLevel}`);
      }

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
