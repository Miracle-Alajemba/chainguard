import * as dotenv from "dotenv";
dotenv.config();

import { startProvider } from "./provider";

// ── Startup Banner ───────────────────────────────────────────────────────────

console.log(`
=======================================
  ChainGuard — Smart Contract Auditor
  Powered by CROO CAP + Claude AI
  Listening for audit orders...
=======================================
`);

// ── Graceful Shutdown ────────────────────────────────────────────────────────

function shutdown(): void {
  console.log("\n🛑 ChainGuard shutting down...");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ── Start ────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await startProvider();
  } catch (err) {
    console.error("🚨 ChainGuard crashed:", err);
    process.exit(1);
  }
})();
