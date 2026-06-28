import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import { fetchWalletActivity, parseContractInput } from "./fetcher";

dotenv.config();

export interface WalletScanReport {
  walletAddress: string;
  trustScore: number; // 0-100
  verdict: "Trusted" | "Suspicious" | "Dangerous";
  suspiciousTransactions: { count: number; details: string[] };
  scamContractInteractions: { detected: boolean; contracts: string[] };
  walletAge: string;
  activityPattern: string;
  riskFactors: { factor: string; severity: "High" | "Medium" | "Low" }[];
  summary: string;
  generatedAt: string;
}

const SYSTEM_PROMPT = `You are an expert blockchain forensics analyst. Your task is to analyze the given wallet address and its transaction history to detect security risks, potential phishing interactions, exposure to scam contracts, suspicious funding patterns, and overall wallet trust profile.

You MUST respond with **only** valid JSON matching the WalletScanReport interface, with no markdown fences, no commentary, and no extra text.

JSON Schema:
{
  "walletAddress": "<string>",
  "trustScore": <number 0-100>,
  "verdict": "<Trusted | Suspicious | Dangerous>",
  "suspiciousTransactions": {
    "count": <number>,
    "details": ["<string>"]
  },
  "scamContractInteractions": {
    "detected": <boolean>,
    "contracts": ["<string>"]
  },
  "walletAge": "<string describing age/first tx seen or estimate>",
  "activityPattern": "<string>",
  "riskFactors": [
    { "factor": "<string>", "severity": "<High | Medium | Low>" }
  ],
  "summary": "<string>",
  "generatedAt": "<ISO 8601 string>"
}`;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function scanWallet(walletAddress: string): Promise<WalletScanReport> {
  const { address, chain } = parseContractInput(walletAddress);

  // 1. Fetch wallet transaction activity
  const transactions = await fetchWalletActivity(walletAddress);

  // 2. Format transaction history for prompt (limit size to fit context easily)
  let txHistorySummary = "";
  if (transactions.length > 0) {
    txHistorySummary = transactions
      .slice(0, 30) // Pass up to 30 recent transactions to keep payload clean
      .map((tx, idx) => {
        const date = new Date(Number(tx.timeStamp) * 1000).toISOString();
        const valueEth = Number(tx.value) / 1e18;
        return `Tx #${idx + 1}:
  Date: ${date}
  Hash: ${tx.hash}
  From: ${tx.from}
  To: ${tx.to}
  Value: ${valueEth} ETH/Native
  Method: ${tx.functionName || tx.methodId || "Transfer"}
  IsError: ${tx.isError === "0" ? "Success" : "Failed"}`;
      })
      .join("\n\n");
  } else {
    txHistorySummary = "No recent transactions found on the block explorer for this address.";
  }

  // 3. Construct user prompt
  const userPrompt = `Analyze the following wallet address and its transaction history:
Wallet Address: ${address}
Chain: ${chain}
Total Transactions Found (Sampled): ${transactions.length}

--- TRANSACTION HISTORY (Recent first) ---
${txHistorySummary}
------------------------------------------

Generate and return the WalletScanReport JSON object matching the requested schema.`;

  // 4. Call Claude API
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  let rawResponse = textBlock.text.trim();

  // Strip markdown fences if present
  if (rawResponse.startsWith("```")) {
    const lines = rawResponse.split("\n");
    if (lines[0].startsWith("```")) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith("```")) {
      lines.pop();
    }
    rawResponse = lines.join("\n").trim();
  }

  try {
    const report: WalletScanReport = JSON.parse(rawResponse);
    return report;
  } catch (err: any) {
    throw new Error(`Failed to parse wallet scan report as JSON: ${err.message}\nRaw response:\n${rawResponse}`);
  }
}
