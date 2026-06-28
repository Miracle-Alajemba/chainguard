import * as dotenv from "dotenv";
dotenv.config();

import { scanWallet } from "../src/walletScanner";

async function main() {
  // Let's test with vitalik.eth address on Ethereum
  const walletAddress = "ethereum:0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  console.log(`Running wallet security scan for ${walletAddress}...`);
  try {
    const report = await scanWallet(walletAddress);
    console.log("Scan Result:");
    console.log(JSON.stringify(report, null, 2));
  } catch (err: any) {
    console.error("Scan failed:", err);
  }
}

main();
