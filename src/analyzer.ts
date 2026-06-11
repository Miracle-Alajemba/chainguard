/**
 * A lightweight pattern-based static analysis engine for Solidity code.
 * Scans for common vulnerabilities and provides hints that are fed into the LLM
 * to combine heuristic scanning with AI-reasoning.
 */
export function analyzeSolidityCode(sourceCode: string): string[] {
  const findings: string[] = [];

  // 1. Reentrancy Vulnerability Check
  if (sourceCode.includes(".call{value:") && !sourceCode.includes("nonReentrant")) {
    findings.push(
      "Unprotected External Call: Found '.call{value: ...}' without any 'nonReentrant' modifier in the file."
    );
  }

  // 2. tx.origin Authorization Check
  if (sourceCode.includes("tx.origin")) {
    findings.push(
      "Phishing Risk via tx.origin: Found 'tx.origin' being used. This should be replaced with 'msg.sender' for authentication checks."
    );
  }

  // 3. Floating Compiler Version Check
  if (/pragma\s+solidity\s+[\^><=]/i.test(sourceCode)) {
    findings.push(
      "Floating Compiler Pragma: The file uses a floating/unlocked solidity compiler version (e.g., '^0.8.0'). Consider pinning the compiler to a specific version (e.g., '0.8.20') to guarantee reproducible builds."
    );
  }

  // 4. Block Timestamp Dependency Check
  if (sourceCode.includes("block.timestamp") || /\bnow\b/.test(sourceCode)) {
    findings.push(
      "Block Timestamp Dependency: Found 'block.timestamp' or 'now'. Minors/validators can manipulate timestamps within short windows, making it risky to use for random number generation or critical timer logic."
    );
  }

  // 5. Selfdestruct Usage
  if (sourceCode.includes("selfdestruct(") || sourceCode.includes("suicide(")) {
    findings.push(
      "Deprecated/Dangerous Functions: Found 'selfdestruct' or 'suicide'. These commands are deprecated under EIP-6780 and can lock up contracts permanently."
    );
  }

  // 6. Access Control Modifiers Check
  const administrativeFunctionRegex = /function\s+(?:set|change|update|transfer)(?:Owner|Admin|Governance|Fee|Vault|Whitelist|Pause)\b/i;
  if (administrativeFunctionRegex.test(sourceCode)) {
    const accessKeywords = ["onlyOwner", "onlyRole", "restricted", "require", "revert"];
    const hasAccessControl = accessKeywords.some((kw) => sourceCode.includes(kw));
    if (!hasAccessControl) {
      findings.push(
        "Potential Missing Access Control: Found a function signature related to administrative updates (e.g., owner/admin modifications) that does not seem to contain standard access control modifiers."
      );
    }
  }

  // 7. Assembler Usage Check
  if (sourceCode.includes("assembly {")) {
    findings.push(
      "Inline Assembly Detected: Inline assembly ('assembly { ... }') bypasses compiler safety checks. Ensure memory safety and check for potential pointer bugs."
    );
  }

  return findings;
}
