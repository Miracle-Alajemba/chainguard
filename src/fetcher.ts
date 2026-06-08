import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

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

    const result = response.data.result[0];

    if (result && result.SourceCode && result.SourceCode !== "") {
      return result.SourceCode;
    }

    throw new Error("Contract source code not verified or not found on Etherscan");
  } catch (error: any) {
    throw new Error(`Failed to fetch contract: ${error.message}`);
  }
}

export function isContractAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input);
}
