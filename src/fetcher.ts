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

const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
};

export async function fetchContractSource(contractAddress: string, chain = "ethereum"): Promise<string> {
  const parsed = parseContractInput(contractAddress);
  const address = parsed.address;
  const targetChain = parsed.chain || chain;

  const chainId = CHAIN_IDS[targetChain.toLowerCase()] || 1;
  const config = CHAIN_CONFIGS[targetChain.toLowerCase()] || CHAIN_CONFIGS.ethereum;

  try {
    const response = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        module: "contract",
        action: "getsourcecode",
        address: address,
        chainid: chainId,
        apikey: config.apiKey,
      },
    });

    const result = response.data?.result?.[0];

    if (result && typeof result.SourceCode === "string" && result.SourceCode !== "") {
      return parseSourceCode(result.SourceCode);
    }

    throw new Error(`Contract source code not verified or not found on ${targetChain}`);
  } catch (error: any) {
    throw new Error(`Failed to fetch contract from ${targetChain}: ${error.message}`);
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

const GECKO_NETWORKS: Record<string, string> = {
  ethereum: "eth",
  base: "base",
  arbitrum: "arbitrum",
  optimism: "optimism",
};

export async function fetchTokenData(contractAddress: string, chain = "ethereum"): Promise<any> {
  const parsed = parseContractInput(contractAddress);
  const address = parsed.address;
  const targetChain = parsed.chain || chain;

  const blockscoutChains: Record<string, string> = {
    ethereum: "eth",
    base: "base",
    arbitrum: "arbitrum",
    optimism: "optimism",
  };

  const bsChain = blockscoutChains[targetChain.toLowerCase()] || "eth";
  try {
    const url = `https://${bsChain}.blockscout.com/api/v2/tokens/${address}`;
    const response = await axios.get(url);
    if (response.data) {
      return {
        name: response.data.name || "Unknown Token",
        symbol: response.data.symbol || "UNKNOWN",
        decimals: Number(response.data.decimals || 18),
        totalSupply: response.data.total_supply || "Unknown",
        type: response.data.type || "ERC-20",
      };
    }
  } catch (error: any) {
    console.warn(`Blockscout token info failed: ${error.message}. Trying GeckoTerminal fallback...`);
  }

  const geckoNetwork = GECKO_NETWORKS[targetChain.toLowerCase()] || "eth";
  try {
    const url = `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/tokens/${address}/info`;
    const response = await axios.get(url, {
      headers: {
        Accept: "application/json;version=20230203",
      },
    });
    const data = response.data?.data?.attributes;
    if (data) {
      return {
        name: data.name,
        symbol: data.symbol,
        decimals: data.decimals || 18,
        totalSupply: "Unknown",
        type: "ERC-20",
      };
    }
  } catch (error: any) {
    console.warn(`GeckoTerminal token info failed: ${error.message}`);
  }

  return {
    name: "Unknown Token",
    symbol: "UNKNOWN",
    decimals: 18,
    totalSupply: "Unknown",
    type: "ERC-20",
  };
}

export async function fetchTokenHolders(contractAddress: string, chain = "ethereum"): Promise<number> {
  const parsed = parseContractInput(contractAddress);
  const address = parsed.address;
  const targetChain = parsed.chain || chain;

  const blockscoutChains: Record<string, string> = {
    ethereum: "eth",
    base: "base",
    arbitrum: "arbitrum",
    optimism: "optimism",
  };

  const bsChain = blockscoutChains[targetChain.toLowerCase()] || "eth";
  try {
    const url = `https://${bsChain}.blockscout.com/api/v2/tokens/${address}`;
    const response = await axios.get(url);
    if (response.data && response.data.holders !== undefined) {
      return Number(response.data.holders);
    }
  } catch (error: any) {
    console.warn(`Blockscout getTokenHolders failed: ${error.message}`);
  }

  return 0;
}

export async function fetchWalletActivity(walletAddress: string, chain = "ethereum"): Promise<any[]> {
  const parsed = parseContractInput(walletAddress);
  const address = parsed.address;
  const targetChain = parsed.chain || chain;

  const chainId = CHAIN_IDS[targetChain.toLowerCase()] || 1;
  const config = CHAIN_CONFIGS[targetChain.toLowerCase()] || CHAIN_CONFIGS.ethereum;
  try {
    const response = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        module: "account",
        action: "txlist",
        address: address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 50, // Get last 50 transactions to keep it rich but not exceed token limits
        sort: "desc",
        chainid: chainId,
        apikey: config.apiKey,
      },
    });

    if (response.data && Array.isArray(response.data.result)) {
      return response.data.result.map((tx: any) => ({
        blockNumber: tx.blockNumber,
        timeStamp: tx.timeStamp,
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        isError: tx.isError,
        txreceipt_status: tx.txreceipt_status,
        input: tx.input,
        contractAddress: tx.contractAddress,
        gasUsed: tx.gasUsed,
        confirmations: tx.confirmations,
        methodId: tx.methodId,
        functionName: tx.functionName,
      }));
    }
  } catch (error: any) {
    console.warn(`Failed to fetch wallet activity from ${targetChain}: ${error.message}`);
  }

  return [];
}



