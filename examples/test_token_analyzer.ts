import * as dotenv from "dotenv";
dotenv.config();

import { analyzeToken } from "../src/tokenAnalyzer";

async function main() {
  const tokenAddress = "base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
  console.log(`Running token analysis for ${tokenAddress}...`);
  try {
    const report = await analyzeToken(tokenAddress);
    console.log("Analysis Result:");
    console.log(JSON.stringify(report, null, 2));
  } catch (err: any) {
    console.error("Analysis failed:", err);
  }
}

main();
