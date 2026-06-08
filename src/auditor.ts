import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

// ── Types ────────────────────────────────────────────────────────────────────

export interface Vulnerability {
  name: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  description: string;
  recommendation: string;
}

export interface GasOptimization {
  description: string;
  estimatedSavings: string;
}

export interface AuditReport {
  overallScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low" | "Safe";
  vulnerabilities: Vulnerability[];
  summary: string;
  gasOptimizations: GasOptimization[];
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite smart contract security auditor with deep expertise in Solidity, the EVM, and common vulnerability patterns (reentrancy, access control flaws, integer overflow/underflow, front-running, flash-loan attacks, oracle manipulation, etc.).

Your job is to analyse the provided smart contract source code and produce a comprehensive security audit report.

You MUST respond with **only** valid JSON — no markdown fences, no commentary, no extra text. The JSON schema is:

{
  "overallScore": <number 0–100>,
  "riskLevel": "<Critical | High | Medium | Low | Safe>",
  "vulnerabilities": [
    {
      "name": "<short vulnerability title>",
      "severity": "<Critical | High | Medium | Low | Informational>",
      "description": "<detailed explanation of the issue>",
      "recommendation": "<actionable fix or mitigation>"
    }
  ],
  "summary": "<short paragraph summarising the audit findings>",
  "gasOptimizations": [
    {
      "description": "<optimisation suggestion>",
      "estimatedSavings": "<rough gas saving estimate>"
    }
  ]
}

Scoring guidelines:
- 90–100 = Safe — no meaningful issues found
- 70–89  = Low risk — minor or informational findings only
- 50–69  = Medium risk — issues that should be addressed before mainnet
- 25–49  = High risk — significant vulnerabilities present
- 0–24   = Critical — contract is dangerous to deploy`;

function buildUserPrompt(sourceCode: string): string {
  return `Audit the following smart contract source code and return the JSON report.\n\n--- BEGIN CONTRACT SOURCE ---\n${sourceCode}\n--- END CONTRACT SOURCE ---`;
}

// ── Auditor ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function auditContract(sourceCode: string): Promise<AuditReport> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(sourceCode),
      },
    ],
  });

  // Extract the text content from Claude's response
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  const raw = textBlock.text.trim();
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Parse and return the structured report
  try {
    const report: AuditReport = JSON.parse(cleaned);
    return report;
  } catch (err) {
    throw new Error(
      `Failed to parse audit report as JSON: ${(err as Error).message}\n\nRaw response:\n${raw}`
    );
  }
}
