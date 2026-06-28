import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import { fetchTokenData, fetchTokenHolders, fetchContractSource, parseContractInput } from "./fetcher";

dotenv.config();

export interface TokenAnalysisReport {
  contractAddress: string;
  safetyScore: number; // 0-100
  verdict: "Safe" | "Risky" | "Dangerous";
  honeypotDetected: boolean;
  hiddenFees: { detected: boolean; details: string };
  mintFunction: { detected: boolean; details: string };
  blacklistMechanism: { detected: boolean; details: string };
  rugPullRisk: { score: number; factors: string[] };
  summary: string;
  recommendations: string[];
  generatedAt: string;
}

const SYSTEM_PROMPT = `You are an expert DeFi security analyst specializing in token contract analysis. Your task is to analyze the given token contract address, its on-chain metadata/holder statistics, and its source code (if provided) to evaluate its security profile, checking for honeypots, hidden fees, malicious minting, blacklisting mechanisms, and rug pull risks.

You MUST respond with **only** valid JSON matching the TokenAnalysisReport interface, with no markdown fences, no commentary, and no extra text.

JSON Schema:
{
  "contractAddress": "<string>",
  "safetyScore": <number 0-100>,
  "verdict": "<Safe | Risky | Dangerous>",
  "honeypotDetected": <boolean>,
  "hiddenFees": { "detected": <boolean>, "details": "<string>" },
  "mintFunction": { "detected": <boolean>, "details": "<string>" },
  "blacklistMechanism": { "detected": <boolean>, "details": "<string>" },
  "rugPullRisk": { "score": <number 0-100>, "factors": ["<string>"] },
  "summary": "<string>",
  "recommendations": ["<string>"],
  "generatedAt": "<ISO 8601 string>"
}`;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function analyzeToken(contractAddress: string): Promise<TokenAnalysisReport> {
  const { address, chain } = parseContractInput(contractAddress);

  // 1. Fetch on-chain token data and holder count
  const tokenData = await fetchTokenData(contractAddress);
  const holderCount = await fetchTokenHolders(contractAddress);

  // 2. Attempt to fetch source code if verified
  let sourceCode = "";
  try {
    sourceCode = await fetchContractSource(address, chain);
  } catch (err: any) {
    console.warn(`Could not fetch contract source code for ${address} on ${chain}: ${err.message}`);
  }

  // 3. Construct user prompt
  let userPrompt = `Analyze the following token contract details:
Contract Address: ${address}
Chain: ${chain}
Token Name: ${tokenData.name}
Token Symbol: ${tokenData.symbol}
Decimals: ${tokenData.decimals}
Total Supply: ${tokenData.totalSupply}
Holder Count: ${holderCount}

`;

  if (sourceCode) {
    userPrompt += `--- BEGIN CONTRACT SOURCE CODE ---\n${sourceCode}\n--- END CONTRACT SOURCE CODE ---`;
  } else {
    userPrompt += `Source code is not verified on the block explorer, so we only have on-chain metadata and holders.`;
  }

  userPrompt += `\n\nGenerate and return the TokenAnalysisReport JSON object matching the requested schema.`;

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
    const report: TokenAnalysisReport = JSON.parse(rawResponse);
    return report;
  } catch (err: any) {
    throw new Error(`Failed to parse token analysis report as JSON: ${err.message}\nRaw response:\n${rawResponse}`);
  }
}
