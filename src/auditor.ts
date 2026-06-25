import Anthropic from "@anthropic-ai/sdk";
import { analyzeSolidityCode } from "./analyzer";

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

Your job is to analyse the provided smart contract source code and produce a comprehensive security audit report. You should also verify the local static analysis warnings provided in the prompt, filter out any false positives, and incorporate valid findings into the report.

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

function buildUserPrompt(sourceCode: string, warnings: string[]): string {
  let warningSection = "";
  if (warnings.length > 0) {
    warningSection = `Local static analysis has flagged the following warnings:\n${warnings.map((w) => `- ${w}`).join("\n")}\n\n`;
  }
  return `Audit the following smart contract source code and return the JSON report.\n\n${warningSection}--- BEGIN CONTRACT SOURCE ---\n${sourceCode}\n--- END CONTRACT SOURCE ---`;
}

// ── Auditor ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`⚠️ API call failed. Retrying in ${delay}ms... Error: ${(error as Error).message}`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return callWithRetry(fn, retries - 1, delay * 2);
  }
}

export async function auditContract(sourceCode: string): Promise<AuditReport> {
  const warnings = analyzeSolidityCode(sourceCode);

  const message = await callWithRetry(() =>
    anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(sourceCode, warnings),
        },
      ],
    })
  );

  // Extract the text content from Claude's response
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  const raw = textBlock.text.trim();

  // Robustly extract the JSON block by finding the outermost curly braces
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error(`Could not find valid JSON boundaries in response: ${raw}`);
  }

  const cleaned = raw.substring(firstBrace, lastBrace + 1);

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
