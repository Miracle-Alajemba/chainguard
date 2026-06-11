import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

function parseSourceCode(sourceCode: string): string {
  const trimmed = sourceCode.trim();

  // Etherscan Standard JSON-input format is wrapped in double curly braces `{{ ... }}`
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    try {
      const jsonStr = trimmed.slice(1, -1);
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.sources === "object") {
        let concatenated = "";
        for (const [filePath, fileObj] of Object.entries(parsed.sources)) {
          const content = (fileObj as any)?.content || "";
          concatenated += `// File: ${filePath}\n\n${content}\n\n`;
        }
        return concatenated.trim();
      }
    } catch (err) {
      // Fall back to returning raw sourceCode if JSON parsing fails
    }
  }

  // Or sometimes single curly braces `{ ... }`
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.sources === "object") {
        let concatenated = "";
        for (const [filePath, fileObj] of Object.entries(parsed.sources)) {
          const content = (fileObj as any)?.content || "";
          concatenated += `// File: ${filePath}\n\n${content}\n\n`;
        }
        return concatenated.trim();
      }
    } catch (err) {
      // Fall back
    }
  }

  return trimmed;
}

export async function fetchContractSource(contractAddress: string): Promise<string> {
  try {
    // Try Etherscan first
    const response = await axios.get(`https://api.etherscan.io/api`, {
      params: {
        module: "contract",
        action: "getsourcecode",
        address: contractAddress,
        apikey: ETHERSCAN_API_KEY,
      },
    });

    const result = response.data?.result?.[0];

    if (result && typeof result.SourceCode === "string" && result.SourceCode !== "") {
      return parseSourceCode(result.SourceCode);
    }

    throw new Error("Contract source code not verified or not found on Etherscan");
  } catch (error: any) {
    throw new Error(`Failed to fetch contract: ${error.message}`);
  }
}

export function isContractAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}
