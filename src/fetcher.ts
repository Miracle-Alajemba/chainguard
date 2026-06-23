import axios from "axios";

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY || ETHERSCAN_API_KEY;
const OPTIMISMSCAN_API_KEY = process.env.OPTIMISMSCAN_API_KEY || ETHERSCAN_API_KEY;
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || ETHERSCAN_API_KEY;

interface ChainConfig {
  apiUrl: string;
  apiKey: string;
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    apiUrl: "https://api.etherscan.io/api",
    apiKey: ETHERSCAN_API_KEY,
  },
  base: {
    apiUrl: "https://api.basescan.org/api",
    apiKey: BASESCAN_API_KEY,
  },
  arbitrum: {
    apiUrl: "https://api.arbiscan.io/api",
    apiKey: ARBISCAN_API_KEY,
  },
  optimism: {
    apiUrl: "https://api-optimistic.etherscan.io/api",
    apiKey: OPTIMISMSCAN_API_KEY,
  },
};

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

export async function fetchContractSource(contractAddress: string, chain = "ethereum"): Promise<string> {
  const config = CHAIN_CONFIGS[chain.toLowerCase()] || CHAIN_CONFIGS.ethereum;
  try {
    const response = await axios.get(config.apiUrl, {
      params: {
        module: "contract",
        action: "getsourcecode",
        address: contractAddress,
        apikey: config.apiKey,
      },
    });

    const result = response.data?.result?.[0];

    if (result && typeof result.SourceCode === "string" && result.SourceCode !== "") {
      return parseSourceCode(result.SourceCode);
    }

    throw new Error(`Contract source code not verified or not found on ${chain}`);
  } catch (error: any) {
    throw new Error(`Failed to fetch contract from ${chain}: ${error.message}`);
  }
}

export function isContractAddress(input: string): boolean {
  return /^(?:(?:ethereum|base|arbitrum|optimism):)?0x[a-fA-F0-9]{40}$/i.test(input);
}

export function parseContractInput(input: string): { address: string; chain: string } {
  const parts = input.split(":");
  if (parts.length === 2 && CHAIN_CONFIGS[parts[0].toLowerCase()]) {
    return {
      address: parts[1].trim(),
      chain: parts[0].toLowerCase(),
    };
  }
  return {
    address: input.trim(),
    chain: "ethereum",
  };
}
