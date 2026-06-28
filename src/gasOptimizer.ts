import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";

dotenv.config();

export interface GasOptimizationReport {
  totalFunctionsAnalyzed: number;
  estimatedTotalSavings: string;
  optimizations: {
    functionName: string;
    issue: string;
    suggestion: string;
    estimatedSavings: string;
    severity: "High" | "Medium" | "Low";
  }[];
  generalRecommendations: string[];
  summary: string;
  generatedAt: string;
}

const SYSTEM_PROMPT = `You are an expert Solidity gas optimization engineer. Your job is to analyze the provided Solidity source code for gas optimization opportunities and return a structured report. Focus on common Solidity gas-saving patterns such as:
- Variable packing in storage
- Using calldata instead of memory for read-only function parameters
- Caching storage variables in memory during loops
- Replacing expensive operations with unchecked math where overflow is impossible
- Using custom errors instead of require statements with long strings
- Optimizing loop conditions and limits
- Minimizing public/external function footprints

You MUST respond with **only** valid JSON matching the GasOptimizationReport interface, with no markdown fences, no commentary, and no extra text.

JSON Schema:
{
  "totalFunctionsAnalyzed": <number>,
  "estimatedTotalSavings": "<string describing estimated gas saved, e.g., '15,000 gas'>",
  "optimizations": [
    {
      "functionName": "<string>",
      "issue": "<string>",
      "suggestion": "<string>",
      "estimatedSavings": "<string>",
      "severity": "<High | Medium | Low>"
    }
  ],
  "generalRecommendations": ["<string>"],
  "summary": "<string>",
  "generatedAt": "<ISO 8601 string>"
}`;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export async function optimizeGas(sourceCode: string): Promise<GasOptimizationReport> {
  // 1. Construct user prompt
  const userPrompt = `Analyze the following Solidity contract code for gas optimization opportunities:

--- BEGIN SOLIDITY SOURCE CODE ---
${sourceCode}
--- END SOLIDITY SOURCE CODE ---

Generate and return the GasOptimizationReport JSON object matching the requested schema.`;

  // 2. Call Claude API using model claude-sonnet-4-5
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
    const report: GasOptimizationReport = JSON.parse(rawResponse);
    return report;
  } catch (err: any) {
    throw new Error(`Failed to parse gas optimization report as JSON: ${err.message}\nRaw response:\n${rawResponse}`);
  }
}
